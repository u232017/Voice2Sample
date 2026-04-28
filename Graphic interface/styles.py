import streamlit as st


def apply_styles():
    st.markdown("""
    <style>
        .main {
            background: linear-gradient(135deg, #0b1020 0%, #11182b 35%, #1a1033 100%);
        }

        .stApp {
            background: linear-gradient(135deg, #0b1020 0%, #11182b 35%, #1a1033 100%);
        }

        .hero-card {
            padding: 2rem 1.8rem;
            border-radius: 24px;
            background: linear-gradient(135deg, rgba(111,66,193,0.35), rgba(0,191,255,0.18), rgba(255,0,128,0.12));
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 12px 40px rgba(0,0,0,0.30);
            margin-bottom: 1.2rem;
            backdrop-filter: blur(8px);
        }

        .hero-title {
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 0.3rem;
            color: white;
        }

        .hero-subtitle {
            font-size: 1.05rem;
            color: #d4def5;
            line-height: 1.6;
        }

        .section-card {
            padding: 1.2rem 1.1rem;
            border-radius: 20px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 10px 28px rgba(0,0,0,0.22);
            margin-bottom: 1rem;
            backdrop-filter: blur(6px);
        }

        .section-title {
            font-size: 1.45rem;
            font-weight: 760;
            margin-bottom: 0.8rem;
            color: white;
        }

        .soft-text {
            color: #c3d2ee;
            font-size: 0.95rem;
        }

        .result-card {
            padding: 1rem;
            border-radius: 18px;
            background: linear-gradient(135deg, rgba(26,35,58,0.96), rgba(14,19,34,0.96));
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 10px 26px rgba(0,0,0,0.24);
            margin-bottom: 0.9rem;
            min-height: 150px;
        }

        .result-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.7rem;
        }

        .result-left {
            display: flex;
            align-items: center;
            gap: 0.8rem;
        }

        .result-icon {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
            background: linear-gradient(135deg, #7c3aed, #06b6d4);
            box-shadow: 0 6px 18px rgba(124,58,237,0.35);
        }

        .result-title {
            color: white;
            font-size: 1.05rem;
            font-weight: 700;
            margin-bottom: 0.15rem;
        }

        .result-meta {
            color: #aebdde;
            font-size: 0.9rem;
            margin-bottom: 0.55rem;
            line-height: 1.45;
        }

        .score-pill {
            padding: 0.32rem 0.7rem;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 700;
            color: white;
            background: linear-gradient(135deg, #ec4899, #8b5cf6);
            white-space: nowrap;
        }

        .badge {
            display: inline-block;
            padding: 0.3rem 0.7rem;
            margin-right: 0.45rem;
            margin-top: 0.25rem;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 650;
            color: white;
        }

        .badge-melodic {
            background: linear-gradient(135deg, #7c3aed, #a855f7);
        }

        .badge-voice {
            background: linear-gradient(135deg, #ec4899, #f43f5e);
        }

        .badge-synth {
            background: linear-gradient(135deg, #06b6d4, #3b82f6);
        }

        .badge-hybrid {
            background: linear-gradient(135deg, #f59e0b, #ef4444);
        }

        div.stButton > button {
            width: 100%;
            border-radius: 14px;
            border: none;
            padding: 0.75rem 1rem;
            font-weight: 700;
            color: white;
            background: linear-gradient(135deg, #7c3aed, #06b6d4);
            box-shadow: 0 6px 20px rgba(124,58,237,0.35);
        }

        div.stButton > button:hover {
            background: linear-gradient(135deg, #8b5cf6, #0ea5e9);
            transform: translateY(-1px);
        }

        [data-testid="stAudio"] {
            background: rgba(255,255,255,0.04);
            border-radius: 14px;
            padding: 0.35rem;
        }

        [data-testid="stMetric"] {
            background: rgba(255,255,255,0.04);
            border-radius: 16px;
            padding: 0.7rem;
            border: 1px solid rgba(255,255,255,0.06);
        }

        [data-testid="stMetricLabel"] {
            font-size: 0.9rem;
        }

        [data-testid="stMetricValue"] {
            font-size: 2rem;
            line-height: 1.1;
        }

        [data-testid="stProgressBar"] > div > div {
            background: linear-gradient(90deg, #7c3aed, #06b6d4, #ec4899);
        }

        .sidebar-card {
            padding: 1rem;
            border-radius: 18px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.08);
            color: white;
            margin-bottom: 1rem;
        }
    </style>
    """, unsafe_allow_html=True)