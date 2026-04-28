import io
import numpy as np
import streamlit as st
import soundfile as sf
import librosa
import matplotlib.pyplot as plt


def get_raw_bytes(source):
    return source.getvalue()


def load_audio_from_bytes(raw_bytes):
    """Try soundfile first, fallback to librosa."""
    try:
        audio, sr = sf.read(io.BytesIO(raw_bytes))
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)
        return audio.astype(np.float32), sr
    except Exception:
        audio, sr = librosa.load(io.BytesIO(raw_bytes), sr=None, mono=True)
        return audio.astype(np.float32), sr


def render_waveform(raw_bytes):
    audio, sr = load_audio_from_bytes(raw_bytes)
    duration = len(audio) / sr if sr else 0

    if len(audio) > 25000:
        idx = np.linspace(0, len(audio) - 1, 25000).astype(int)
        audio_plot = audio[idx]
    else:
        audio_plot = audio

    t = np.linspace(0, duration, len(audio_plot))

    fig, ax = plt.subplots(figsize=(10, 2.8))
    ax.plot(t, audio_plot, linewidth=1.1)
    ax.fill_between(t, audio_plot, 0, alpha=0.35)
    ax.set_title("Waveform preview", fontsize=11)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Amplitude")
    ax.grid(alpha=0.18)
    fig.patch.set_alpha(0)
    ax.set_facecolor((0, 0, 0, 0))

    axis_color = "#38bdf8"

    ax.spines["bottom"].set_color(axis_color)
    ax.spines["top"].set_color(axis_color)
    ax.spines["left"].set_color(axis_color)
    ax.spines["right"].set_color(axis_color)

    ax.tick_params(axis="x", colors=axis_color)
    ax.tick_params(axis="y", colors=axis_color)

    ax.xaxis.label.set_color(axis_color)
    ax.yaxis.label.set_color(axis_color)
    ax.title.set_color(axis_color)

    st.pyplot(fig, clear_figure=True)

    c1, c2, c3 = st.columns(3)
    c1.metric("Duration", f"{duration:.2f}s")
    c2.metric("Sample rate", f"{sr/1000:.0f} kHz")
    c3.metric("Peak", f"{np.max(np.abs(audio)):.2f}")