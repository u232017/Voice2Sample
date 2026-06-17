import json
import numpy as np
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

INPUT_JSON = "descriptors/melodic_descriptors.json"
OUTPUT_TXT = "melodic_analysis.txt"

# Confidence thresholds
HIGH_THRESHOLD = 0.75
MEDIUM_THRESHOLD = 0.45

def normalize(values):
    values = np.array(values, dtype=np.float32)

    min_v = np.min(values)
    max_v = np.max(values)

    if max_v - min_v == 0:
        return np.zeros_like(values)

    return (values - min_v) / (max_v - min_v)


# ============================================================
# LOAD DATA
# ============================================================

with open(INPUT_JSON, "r", encoding="utf-8") as f:
    data = json.load(f)

# ============================================================
# FEATURE EXTRACTION
# ============================================================

audio_ids = list(data.keys())

pitch_mean_values = []
pitch_var_values = []
hpcp_crest_values = []
hpcp_entropy_values = []
key_strength_values = []

for audio_id in audio_ids:

    song = data[audio_id]

    pitch_mean_values.append(song.get("pitch_mean", 0))
    pitch_var_values.append(song.get("pitch_var", 0))
    hpcp_crest_values.append(song.get("hpcp_crest_mean", 0))
    hpcp_entropy_values.append(song.get("hpcp_entropy_mean", 0))

    avg_key_strength = np.mean([
        song.get("key_strength_edma", 0),
        song.get("key_strength_krumhansl", 0),
        song.get("key_strength_temperley", 0)
    ])

    key_strength_values.append(avg_key_strength)

# ============================================================
# NORMALIZATION
# ============================================================


pitch_mean_norm = normalize(pitch_mean_values)
pitch_var_norm = normalize(pitch_var_values)
hpcp_crest_norm = normalize(hpcp_crest_values)
hpcp_entropy_norm = normalize(hpcp_entropy_values)
key_strength_norm = normalize(key_strength_values)

# ============================================================
# MELODIC SCORE
# ============================================================

results = []

for i, audio_id in enumerate(audio_ids):

    melodic_score = (
        pitch_mean_norm[i] * 0.30 +
        hpcp_crest_norm[i] * 0.25 +
        key_strength_norm[i] * 0.25 +
        (1 - hpcp_entropy_norm[i]) * 0.10 +
        (1 - pitch_var_norm[i]) * 0.10
    )

    # Confidence tier
    if melodic_score >= HIGH_THRESHOLD:
        confidence = "HIGH"

    elif melodic_score >= MEDIUM_THRESHOLD:
        confidence = "MEDIUM"

    else:
        confidence = "LOW"

    results.append({
        "audio_id": audio_id,
        "score": melodic_score,
        "confidence": confidence
    })

# ============================================================
# SORT RESULTS
# ============================================================

results = sorted(results, key=lambda x: x["score"], reverse=True)

# ============================================================
# COUNTS
# ============================================================

high_count = len([r for r in results if r["confidence"] == "HIGH"])
medium_count = len([r for r in results if r["confidence"] == "MEDIUM"])
low_count = len([r for r in results if r["confidence"] == "LOW"])

# ============================================================
# TOP 3
# ============================================================

top_3 = results[:3]

# ============================================================
# REPORT
# ============================================================

report = []

report.append("=" * 60)
report.append("MELODIC CHARACTERISTIC ANALYSIS")
report.append("=" * 60)

report.append("\nFEATURES USED:\n")

report.append(
    "- pitch_mean -> measures pitch salience "
    "(higher = stronger melodic presence)"
)

report.append(
    "- pitch_var -> measures pitch stability "
    "(lower = more stable melody)"
)

report.append(
    "- hpcp_crest_mean -> harmonic concentration "
    "(higher = clearer tonal organization)"
)

report.append(
    "- hpcp_entropy_mean -> harmonic disorder "
    "(lower = more melodic coherence)"
)

report.append(
    "- average key strength -> tonal certainty "
    "(higher = stronger musical key)"
)

report.append("\nCONFIDENCE TIERS:\n")

report.append(f"HIGH   : score >= {HIGH_THRESHOLD}")
report.append(
    f"MEDIUM : {MEDIUM_THRESHOLD} <= score < {HIGH_THRESHOLD}"
)
report.append(f"LOW    : score < {MEDIUM_THRESHOLD}")

report.append("\nCOUNTS:\n")

report.append(f"HIGH   : {high_count} audios")
report.append(f"MEDIUM : {medium_count} audios")
report.append(f"LOW    : {low_count} audios")

report.append("\nTOP 3 MOST MELODIC AUDIOS:\n")

for idx, item in enumerate(top_3, start=1):

    report.append(
        f"{idx}. Audio ID: {item['audio_id']} | "
        f"Score: {item['score']:.4f} | "
        f"Confidence: {item['confidence']}"
    )

report.append("\n")

final_report = "\n".join(report)

# ============================================================
# PRINT TERMINAL
# ============================================================

print(final_report)

# ============================================================
# SAVE TXT
# ============================================================

with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
    f.write(final_report)

print(f"\nAnalysis saved to: {OUTPUT_TXT}")