import time
import streamlit as st

from styles import apply_styles
from fake_backend import run_real_analysis
from ui_components import (
    render_hero,
    render_sidebar,
    render_input_and_preview,
    render_loading_step,
    render_results,
)

# =========================
# CONFIG
# =========================
st.set_page_config(
    page_title="Voice2Sample",
    page_icon="🎤",
    layout="wide"
)

# =========================
# LOAD STYLES
# =========================
apply_styles()

# =========================
# HERO + SIDEBAR
# =========================
render_hero()
render_sidebar()

# =========================
# INPUT + PREVIEW
# =========================
raw_bytes = render_input_and_preview()

# =========================
# ANALYZE BUTTON
# =========================
st.markdown("## 3. Analyze")
st.caption("Start the analysis and let the system compare your sound with the library.")

analyze = st.button("Analyze", use_container_width=True)

if analyze:
    if raw_bytes is None:
        st.warning("Please upload or record an audio file first.")
    else:
        status_box = st.status("Starting analysis...", expanded=True)
        progress_bar = st.progress(0, text="Preparing input...")
        loading_box = st.empty()

        steps = [
            "Preparing input...",
            "Extracting audio features...",
            "Building the sound profile...",
            "Matching with the sample library...",
            "Checking Freesound candidates...",
            "Ranking best matches...",
            "Preparing final results..."
        ]

        for i, step in enumerate(steps, start=1):
            with loading_box.container():
                render_loading_step(step)

            status_box.write(step)
            progress_bar.progress(int(i / len(steps) * 100), text=step)
            time.sleep(0.6)

        loading_box.empty()

        try:
            detected_class, confidence, recommendations = run_real_analysis(raw_bytes)

            status_box.update(label="Analysis completed", state="complete", expanded=False)
            st.toast("Analysis finished", icon="🎧")

            render_results(detected_class, confidence, recommendations)

        except Exception:
            status_box.update(label="Analysis failed", state="error", expanded=False)
            st.error("An error occurred while analyzing your audio. Please try again.")