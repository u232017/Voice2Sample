import streamlit as st
from audio_utils import get_raw_bytes, render_waveform


def badge_class(sample_type):
    mapping = {
        "Melodic": "badge badge-melodic",
        "Voice": "badge badge-voice",
        "Synth": "badge badge-synth",
        "Hybrid": "badge badge-hybrid"
    }
    return mapping.get(sample_type, "badge badge-melodic")


def sample_icon(sample_type):
    icons = {
        "Melodic": "🎹",
        "Voice": "🎤",
        "Synth": "🎛️",
        "Hybrid": "🎵"
    }
    return icons.get(sample_type, "🎶")


def loading_icon(step):
    step_lower = step.lower()

    if "normalizing" in step_lower or "preparing input" in step_lower:
        return "🎚️"
    if "extracting" in step_lower or "features" in step_lower:
        return "🧠"
    if "estimating" in step_lower:
        return "🎼"
    if "matching" in step_lower or "comparing" in step_lower:
        return "🔎"
    if "ranking" in step_lower:
        return "📊"
    if "recommendations" in step_lower or "final results" in step_lower:
        return "✨"

    return "🎧"


def loading_subtext(step):
    step_lower = step.lower()

    if "normalizing" in step_lower or "preparing input" in step_lower:
        return "Preparing your audio for analysis."
    if "extracting" in step_lower or "features" in step_lower:
        return "Reading pitch, energy and timbral information."
    if "estimating" in step_lower:
        return "Building a clearer profile of your sound."
    if "comparing" in step_lower or "matching" in step_lower:
        return "Comparing your input against the sound library."
    if "ranking" in step_lower:
        return "Sorting the closest matches."
    if "recommendations" in step_lower or "final results" in step_lower:
        return "Preparing the final recommendations for display."

    return "Your input is being processed."


def render_hero():
    st.markdown("""
    <div class="hero-card">
        <div class="hero-title">Voice2Sample</div>
        <div class="hero-subtitle">
            Record or upload a sound, let the system analyze it,
            and find similar samples faster and more creatively.
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_sidebar():
    with st.sidebar:
        st.markdown("""
        <div class="sidebar-card">
            <h3 style="margin-top:0;">🎧 Voice2Sample</h3>
            <p style="color:#d4def5; margin-bottom:0;">
                Visual demo for sample retrieval from recorded or uploaded audio.
            </p>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("### Demo mode")
        st.write("The app currently shows simulated results for interface testing.")

        st.markdown("### Input options")
        st.write("- Upload audio")
        st.write("- Microphone recording")

        st.markdown("### Output")
        st.write("- Detected class")
        st.write("- 3 or 4 recommended samples")


def render_input_and_preview():
    raw_bytes = None

    col_left, col_right = st.columns([1.1, 1.4], gap="large")

    with col_left:
        st.markdown("## 1. Input audio")
        st.caption("You can upload an audio file or record directly from the microphone.")

        uploaded_audio = st.file_uploader(
            "Upload an audio file",
            type=["wav", "mp3", "ogg", "flac", "m4a"]
        )

        recorded_audio = st.audio_input("Or record a sound with the microphone")

    with col_right:
        st.markdown("## 2. Preview")

        source = None
        source_label = None

        if recorded_audio is not None:
            source = recorded_audio
            source_label = "Recorded input"
        elif uploaded_audio is not None:
            source = uploaded_audio
            source_label = "Uploaded input"

        if source is not None:
            try:
                raw_bytes = get_raw_bytes(source)
                st.markdown(
                    f"<div class='soft-text' style='margin-bottom:0.4rem;'>{source_label} ready for analysis.</div>",
                    unsafe_allow_html=True
                )
                st.caption("This audio will be used as the reference for sample matching.")
                st.audio(raw_bytes)
                render_waveform(raw_bytes)
            except Exception:
                raw_bytes = None
                st.error("Audio not recognizable, please try again")
        else:
            st.info("You have not uploaded or recorded any audio yet.")

    return raw_bytes


def render_loading_step(step):
    icon = loading_icon(step)
    subtext = loading_subtext(step)

    st.markdown(
        f"""
<div style="
    padding: 1.15rem 1rem;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(124,58,237,0.14), rgba(6,182,212,0.10), rgba(236,72,153,0.10));
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 10px 28px rgba(0,0,0,0.20);
    text-align: center;
    margin-bottom: 0.4rem;
">
    <div style="font-size: 1.8rem; margin-bottom: 0.35rem;">{icon}</div>
    <div style="font-size: 1.08rem; font-weight: 700; color: white; margin-bottom: 0.35rem;">
        {step}
    </div>
    <div style="font-size: 0.95rem; color: #c3d2ee; line-height: 1.45;">
        {subtext}
    </div>
</div>
""",
        unsafe_allow_html=True
    )


def render_results(detected_class, confidence, recommendations):
    st.markdown("### Results")
    m1, m2 = st.columns(2)
    m1.metric("Detected class", detected_class)
    m2.metric("Confidence", f"{confidence * 100:.0f}%")

    if not recommendations:
        st.warning("There are no results similar to your audio")
        return

    st.markdown("### Recommended samples")

    cols = st.columns(2, gap="large")

    for idx, sample in enumerate(recommendations):
        ui_type = sample.get("ui_type", "Unknown")
        icon = sample_icon(ui_type)
        score = sample.get("match_score", 0)
        category = sample.get("category", ui_type)
        duration = sample.get("duration")
        license_name = sample.get("license")
        preview_url = sample.get("preview_url")
        download_url = sample.get("download_url")
        freesound_url = sample.get("url")
        meta = sample.get("meta", "")

        with cols[idx % 2]:
            st.markdown(
                f"""
<div class="result-card">
    <div class="result-top">
        <div class="result-left">
            <div class="result-icon">{icon}</div>
            <div>
                <div class="result-title">{sample['name']}</div>
                <div class="soft-text">{category}</div>
            </div>
        </div>
        <div class="score-pill">{score}% match</div>
    </div>
</div>
""",
                unsafe_allow_html=True
            )

            if meta:
                st.caption(meta)

            info_parts = []
            info_parts.append(f"Type: {ui_type}")

            if duration is not None:
                info_parts.append(f"Duration: {duration:.1f}s")

            if license_name:
                info_parts.append(f"License: {license_name}")

            st.caption(" • ".join(info_parts))

            if preview_url:
                st.audio(preview_url)

            action_cols = st.columns([1, 1])

            with action_cols[0]:
                if download_url:
                    st.link_button("⬇ Download", download_url, use_container_width=True)

            with action_cols[1]:
                if freesound_url:
                    st.markdown(f"[Open in Freesound]({freesound_url})")

    st.button("Try another sound", type="secondary", use_container_width=True)