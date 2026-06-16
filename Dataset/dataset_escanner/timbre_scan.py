import json
import numpy as np

# ============================================================
# CONFIG
# ============================================================

INPUT_JSON = "descriptors/timbre_descriptors.json"
OUTPUT_TXT = "timbre_analysis.txt"

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

audio_ids = list(data.keys())

# ============================================================
# FEATURE COLLECTION
# ============================================================

mfcc_energy_values = []
gfcc_energy_values = []
spectral_centroid_values = []
spectral_spread_values = []
spectral_flux_values = []
zcr_values = []

for audio_id in audio_ids:

    song = data[audio_id]

    # --------------------------------------------------------
    # MFCC energy
    # --------------------------------------------------------

    mfcc = song.get("lowlevel.mfcc.mean", [])

    if isinstance(mfcc, list) and len(mfcc) > 0:
        mfcc_energy = np.mean(np.abs(mfcc))
    else:
        mfcc_energy = 0

    # --------------------------------------------------------
    # GFCC energy
    # --------------------------------------------------------

    gfcc = song.get("lowlevel.gfcc.mean", [])

    if isinstance(gfcc, list) and len(gfcc) > 0:
        gfcc_energy = np.mean(np.abs(gfcc))
    else:
        gfcc_energy = 0

    # --------------------------------------------------------
    # Spectral descriptors
    # --------------------------------------------------------

    spectral_centroid = song.get(
        "lowlevel.spectral_centroid.mean",
        0
    )

    spectral_spread = song.get(
        "lowlevel.spectral_spread.mean",
        0
    )

    spectral_flux = song.get(
        "lowlevel.spectral_flux.mean",
        0
    )

    zcr = song.get(
        "lowlevel.zerocrossingrate.mean",
        0
    )

    # --------------------------------------------------------
    # Store
    # --------------------------------------------------------

    mfcc_energy_values.append(mfcc_energy)
    gfcc_energy_values.append(gfcc_energy)
    spectral_centroid_values.append(spectral_centroid)
    spectral_spread_values.append(spectral_spread)
    spectral_flux_values.append(spectral_flux)
    zcr_values.append(zcr)

# ============================================================
# NORMALIZATION
# ============================================================

mfcc_norm = normalize(mfcc_energy_values)
gfcc_norm = normalize(gfcc_energy_values)
centroid_norm = normalize(spectral_centroid_values)
spread_norm = normalize(spectral_spread_values)
flux_norm = normalize(spectral_flux_values)
zcr_norm = normalize(zcr_values)

# ============================================================
# TIMBRE SCORE
# ============================================================

results = []

for i, audio_id in enumerate(audio_ids):

    timbre_score = (
        mfcc_norm[i] * 0.30 +
        gfcc_norm[i] * 0.25 +
        flux_norm[i] * 0.20 +
        spread_norm[i] * 0.15 +
        centroid_norm[i] * 0.05 +
        zcr_norm[i] * 0.05
    )

    # --------------------------------------------------------
    # Confidence tiers
    # --------------------------------------------------------

    if timbre_score >= HIGH_THRESHOLD:
        confidence = "HIGH"

    elif timbre_score >= MEDIUM_THRESHOLD:
        confidence = "MEDIUM"

    else:
        confidence = "LOW"

    results.append({
        "audio_id": audio_id,
        "score": timbre_score,
        "confidence": confidence
    })

# ============================================================
# SORT
# ============================================================

results = sorted(results, key=lambda x: x["score"], reverse=True)

# ============================================================
# COUNTS
# ============================================================

high_count = len([
    r for r in results if r["confidence"] == "HIGH"
])

medium_count = len([
    r for r in results if r["confidence"] == "MEDIUM"
])

low_count = len([
    r for r in results if r["confidence"] == "LOW"
])

# ============================================================
# TOP 3
# ============================================================

top_3 = results[:3]

# ============================================================
# REPORT
# ============================================================

report = []

report.append("=" * 60)
report.append("TIMBRE CHARACTERISTIC ANALYSIS")
report.append("=" * 60)

report.append("\nFEATURES USED:\n")

report.append(
    "- MFCC energy -> spectral envelope complexity"
)

report.append(
    "- GFCC energy -> perceptual spectral texture"
)

report.append(
    "- spectral_flux -> spectral variation over time"
)

report.append(
    "- spectral_spread -> spectral bandwidth richness"
)

report.append(
    "- spectral_centroid -> spectral brightness"
)

report.append(
    "- zerocrossingrate -> noisiness/percussiveness"
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

report.append("\nTOP 3 MOST TIMBRALLY RICH AUDIOS:\n")

for idx, item in enumerate(top_3, start=1):

    report.append(
        f"{idx}. Audio ID: {item['audio_id']} | "
        f"Score: {item['score']:.4f} | "
        f"Confidence: {item['confidence']}"
    )

report.append("\n")

final_report = "\n".join(report)

# ============================================================
# PRINT
# ============================================================

print(final_report)

# ============================================================
# SAVE TXT
# ============================================================

with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
    f.write(final_report)

print(f"\nAnalysis saved to: {OUTPUT_TXT}")