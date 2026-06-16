import json
import os
import traceback

import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DESCRIPTORS_PATH = os.path.join(BASE_DIR, "timbre_descriptors.json")
OUTPUT_REPORT_PATH = os.path.join(BASE_DIR, "timbre_descriptor_importance.txt")

# ============================================================
# LOAD JSON
# ============================================================

def load_json(path):
    if not os.path.exists(path):
        return None

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def flatten(value):

    if is_number(value):
        return [float(value)]

    if isinstance(value, (list, tuple)):
        result = []
        for item in value:
            result.extend(flatten(item))
        return result

    if isinstance(value, dict):
        result = []
        for item in value.values():
            result.extend(flatten(item))
        return result

    return []


def extract_track_features(track_descriptors):

    features = {}

    for descriptor_name, value in track_descriptors.items():

        values = flatten(value)

        if not values:
            continue

        # Multi-dimensional descriptors
        if len(values) > 1:

            for i, v in enumerate(values):
                features[f"{descriptor_name}[{i}]"] = float(v)

        else:
            features[descriptor_name] = float(values[0])

    return features


# ============================================================
# BUILD FEATURE MATRIX
# ============================================================

def build_feature_matrix(dataset):

    all_features = []

    for _, descriptors in dataset.items():

        if not isinstance(descriptors, dict):
            continue

        all_features.append(
            extract_track_features(descriptors)
        )

    feature_names = sorted(
        {
            key
            for row in all_features
            for key in row.keys()
        }
    )

    matrix = []

    for row in all_features:

        matrix.append([
            row.get(feature, 0.0)
            for feature in feature_names
        ])

    return np.array(matrix), feature_names


# ============================================================
# CORRELATION FILTERING
# ============================================================

def remove_correlated_features(
    X,
    feature_names,
    threshold=0.95
):

    corr = np.corrcoef(X.T)

    keep = []

    removed = set()

    n = len(feature_names)

    for i in range(n):

        if i in removed:
            continue

        keep.append(i)

        for j in range(i + 1, n):

            if abs(corr[i, j]) > threshold:
                removed.add(j)

    filtered_X = X[:, keep]

    filtered_features = [
        feature_names[i]
        for i in keep
    ]

    return filtered_X, filtered_features


# ============================================================
# PCA IMPORTANCE
# ============================================================

def compute_pca_importance(X, feature_names):

    scaler = StandardScaler()

    X_scaled = scaler.fit_transform(X)

    pca = PCA()

    pca.fit(X_scaled)

    explained = pca.explained_variance_ratio_

    loadings = np.abs(
        pca.components_
    )

    importance = np.sum(
        loadings * explained[:, np.newaxis],
        axis=0
    )

    importance = (
        importance /
        np.sum(importance)
    ) * 100.0

    return {
        feature_names[i]: importance[i]
        for i in range(len(feature_names))
    }


# ============================================================
# FEATURE GROUPING
# ============================================================

def group_feature(feature_name):

    if "mfcc" in feature_name:
        return "MFCC"

    if "gfcc" in feature_name:
        return "GFCC"

    if "spectral_centroid" in feature_name:
        return "Spectral Centroid"

    if "spectral_spread" in feature_name:
        return "Spectral Spread"

    if "spectral_rolloff" in feature_name:
        return "Spectral Rolloff"

    if "spectral_flux" in feature_name:
        return "Spectral Flux"

    if "zerocrossingrate" in feature_name:
        return "Zero Crossing Rate"

    return "Other"


def aggregate_groups(feature_scores):

    grouped = {}

    for feature, score in feature_scores.items():

        group = group_feature(feature)

        grouped[group] = (
            grouped.get(group, 0.0)
            + score
        )

    return grouped


# ============================================================
# EXPLANATIONS
# ============================================================

def explain(group):

    explanations = {

        "MFCC":
            "MFCCs describe the spectral envelope and overall timbral colour. They usually carry the largest amount of discriminative information.",

        "GFCC":
            "GFCCs are perceptually motivated cepstral coefficients. They are robust and effective for texture discrimination.",

        "Spectral Centroid":
            "Measures perceived brightness.",

        "Spectral Spread":
            "Measures how broadly energy is distributed across frequencies.",

        "Spectral Rolloff":
            "Represents the frequency below which most spectral energy lies.",

        "Spectral Flux":
            "Measures how quickly the spectrum changes over time.",

        "Zero Crossing Rate":
            "Measures noisiness and percussiveness."
    }

    return explanations.get(
        group,
        "Additional timbre descriptor."
    )


# ============================================================
# REPORT
# ============================================================

def create_report(group_scores):

    lines = []

    lines.append(
        "=== TIMBRE DESCRIPTOR IMPORTANCE (PCA) ==="
    )
    lines.append("")

    ranking = sorted(
        group_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )

    for name, value in ranking:

        lines.append(
            f"{name:<25} {value:6.2f}%"
        )

    lines.append("")
    lines.append("Interpretation")
    lines.append("")

    best = ranking[0][0]
    worst = ranking[-1][0]

    lines.append(
        f"Most informative: {best}"
    )
    lines.append(
        explain(best)
    )
    lines.append("")

    lines.append(
        f"Least informative: {worst}"
    )
    lines.append(
        explain(worst)
    )
    lines.append("")

    lines.append(
        "The ranking is based on PCA contribution after removing highly correlated features. "
        "Descriptors with higher percentages contribute more unique information to the dataset."
    )

    return lines


# ============================================================
# SAVE REPORT
# ============================================================

def save_report(lines, output_path):

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as f:

        f.write(
            "\n".join(lines)
        )


# ============================================================
# MAIN ANALYSIS
# ============================================================

def analyze_timbre_importance():

    path = (DESCRIPTORS_PATH)

    data = load_json(path)

    if data is None:
        raise FileNotFoundError(path)

    X, feature_names = build_feature_matrix(data)

    X, feature_names = remove_correlated_features(
        X,
        feature_names,
        threshold=0.95
    )

    feature_scores = compute_pca_importance(
        X,
        feature_names
    )

    group_scores = aggregate_groups(
        feature_scores
    )

    report = create_report(
        group_scores
    )

    output_path = OUTPUT_REPORT_PATH

    save_report(
        report,
        output_path
    )

    return output_path


def main():

    try:

        output = (
            analyze_timbre_importance()
        )

        print(
            f"✔ Report generated: {output}"
        )

    except Exception:

        print(
            "ERROR generating timbre report"
        )

        traceback.print_exc()


if __name__ == "__main__":
    main()

