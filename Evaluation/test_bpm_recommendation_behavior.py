from __future__ import annotations

import csv
import math
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_DIR = ROOT_DIR / "Dataset"
DATASET_METADATA_PATH = DATASET_DIR / "metadata_filtered.csv"
DATASET_AUDIO_DIR = DATASET_DIR / "audio_processed"
CACHE_PATH = ROOT_DIR / "backend" / "cache" / "dataset_features.json"
TOP_K = 10
EXTRA_CANDIDATES = 5
FOCUS = "bpm"
TARGET_BPMS = [100.0, 120.0, 140.0]
BPM_WINDOWS = [2.0, 5.0, 10.0, 20.0]

SUPPORTED_AUDIO_EXTENSIONS = [".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif", ".m4a"]


if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from backend.dataset_recommender import (
        clean_name_from_path,
        load_dataset_items,
        rank_similar_items,
    )
except ImportError as exc:  # pragma: no cover - only for local environment resilience
    raise RuntimeError(
        "Could not import backend.dataset_recommender. "
        "Run this script from the project root: "
        "python Evaluation/test_bpm_recommendation_behavior.py"
    ) from exc


@dataclass
class InputCase:
    label: str
    target_bpm: float
    row: dict[str, Any]
    audio_path: Path
    source: str


def _safe_float(value: Any) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        number = float(value)
        if math.isfinite(number):
            return number
    except (TypeError, ValueError):
        return None
    return None


def _resolve_audio_path(row: dict[str, Any]) -> Path | None:
    audio_id = str(row.get("id", "")).strip()
    audio_path_field = str(row.get("audio_path", "")).strip()

    candidates: list[Path] = []
    if audio_path_field:
        candidate_path = Path(audio_path_field)
        if candidate_path.is_absolute():
            candidates.append(candidate_path)
        else:
            candidates.append(DATASET_DIR / candidate_path)
            candidates.append(ROOT_DIR / candidate_path)

    if audio_id:
        for ext in SUPPORTED_AUDIO_EXTENSIONS:
            candidates.append(DATASET_AUDIO_DIR / f"{audio_id}{ext}")

    seen: set[Path] = set()
    for candidate in candidates:
        normalized = candidate.resolve() if candidate.is_absolute() else candidate
        if normalized in seen:
            continue
        seen.add(normalized)
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()

    if audio_id:
        for match in DATASET_AUDIO_DIR.glob(f"{audio_id}.*"):
            if match.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS and match.is_file():
                return match.resolve()

    return None


def _load_valid_metadata_rows() -> list[dict[str, Any]]:
    if not DATASET_METADATA_PATH.exists():
        raise FileNotFoundError(f"Metadata file not found: {DATASET_METADATA_PATH}")
    if not DATASET_AUDIO_DIR.exists():
        raise FileNotFoundError(f"Audio directory not found: {DATASET_AUDIO_DIR}")

    rows: list[dict[str, Any]] = []
    with DATASET_METADATA_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            audio_id = str(row.get("id", "")).strip()
            bpm = _safe_float(row.get("bpm"))
            if not audio_id or bpm is None:
                continue

            audio_path = _resolve_audio_path(row)
            if audio_path is None:
                continue

            normalized = dict(row)
            normalized["_audio_id"] = audio_id
            normalized["_bpm"] = bpm
            normalized["_audio_path"] = audio_path
            rows.append(normalized)

    if not rows:
        raise RuntimeError(
            "No valid metadata rows with BPM and existing audio files were found. "
            "Check Dataset/metadata_filtered.csv and Dataset/audio_processed."
        )

    return rows


def _pick_best_row(
    rows: list[dict[str, Any]],
    target_bpm: float,
    exclude_ids: set[str] | None = None,
) -> dict[str, Any] | None:
    exclude_ids = exclude_ids or set()
    candidates = [row for row in rows if row["_audio_id"] not in exclude_ids]
    if not candidates:
        return None

    def sort_key(row: dict[str, Any]) -> tuple[float, int]:
        bpm = float(row["_bpm"])
        audio_id = row["_audio_id"]
        try:
            numeric_id = int(audio_id)
        except ValueError:
            numeric_id = 10**12
        return abs(bpm - target_bpm), numeric_id

    return sorted(candidates, key=sort_key)[0]


def _build_input_cases(rows: list[dict[str, Any]]) -> list[InputCase]:
    rows_by_id = {row["_audio_id"]: row for row in rows}
    selected_ids: set[str] = set()
    cases: list[InputCase] = []

    preferred_120_id = "16404"
    preferred_120 = rows_by_id.get(preferred_120_id)
    if preferred_120:
        cases.append(
            InputCase(
                label="120 BPM target",
                target_bpm=120.0,
                row=preferred_120,
                audio_path=preferred_120["_audio_path"],
                source=f"preferred id {preferred_120_id}",
            )
        )
        selected_ids.add(preferred_120_id)
    else:
        fallback_120 = _pick_best_row(rows, 120.0, selected_ids)
        if fallback_120 is None:
            raise RuntimeError("Could not find a valid fallback for ~120 BPM.")
        cases.append(
            InputCase(
                label="120 BPM target",
                target_bpm=120.0,
                row=fallback_120,
                audio_path=fallback_120["_audio_path"],
                source="automatic fallback near 120 BPM",
            )
        )
        selected_ids.add(fallback_120["_audio_id"])

    for label, target in [("100 BPM target", 100.0), ("140 BPM target", 140.0)]:
        picked = _pick_best_row(rows, target, selected_ids)
        if picked is None:
            raise RuntimeError(f"Could not find a valid audio for ~{int(target)} BPM.")
        cases.append(
            InputCase(
                label=label,
                target_bpm=target,
                row=picked,
                audio_path=picked["_audio_path"],
                source=f"nearest available row to {int(target)} BPM",
            )
        )
        selected_ids.add(picked["_audio_id"])

    return cases


def _extract_item_bpm(metadata: dict[str, Any]) -> float | None:
    bpm = _safe_float(metadata.get("bpm"))
    if bpm is not None:
        return bpm
    annotations = metadata.get("annotations")
    if isinstance(annotations, dict):
        return _safe_float(annotations.get("bpm"))
    return None


def _format_float(value: float | None, decimals: int = 3) -> str:
    if value is None:
        return "N/A"
    return f"{value:.{decimals}f}"


def _print_divider(char: str = "-", width: int = 132) -> None:
    print(char * width)


def _print_case_header(case: InputCase) -> None:
    row = case.row
    print()
    _print_divider("=")
    print(f"Case: {case.label} (target ~{int(case.target_bpm)} BPM)")
    _print_divider("=")
    print(f"Selection source: {case.source}")
    print(f"Input id: {row['_audio_id']}")
    print(f"Input name: {row.get('name') or '(no name)'}")
    print(f"Input BPM (metadata): {_format_float(float(row['_bpm']), 2)}")
    print(f"Input audio path: {case.audio_path}")
    print()


def _print_bpm_distribution(rows: list[dict[str, Any]]) -> None:
    bpms = [float(row["_bpm"]) for row in rows]
    bpm_counter: Counter[float] = Counter(bpms)

    print()
    _print_divider("=")
    print("Dataset BPM Distribution (valid rows only)")
    _print_divider("=")
    print(f"Valid rows considered: {len(rows)}")
    print()
    print("Counts near target BPM values:")
    for target in TARGET_BPMS:
        counts = []
        for window in BPM_WINDOWS:
            count = sum(1 for bpm in bpms if abs(bpm - target) <= window)
            counts.append(f"+/-{int(window)}: {count}")
        print(f"- target {int(target)} BPM -> " + " | ".join(counts))

    print()
    print("10 most common BPM values:")
    for bpm, count in bpm_counter.most_common(10):
        bpm_label = str(int(bpm)) if float(bpm).is_integer() else f"{bpm:.2f}"
        print(f"- {bpm_label} BPM: {count}")


def _is_self_match(case: InputCase, item: Any) -> bool:
    input_id = str(case.row.get("_audio_id", "")).strip()
    input_stem = case.audio_path.stem.strip().lower()

    item_audio_id = str(getattr(item, "audio_id", "")).strip()
    item_stem = item.path.stem.strip().lower() if getattr(item, "path", None) else ""

    if input_id and item_audio_id and input_id == item_audio_id:
        return True
    if input_stem and item_stem and input_stem == item_stem:
        return True
    return False


def _print_recommendation_table(
    case: InputCase,
    ranked: list[tuple[Any, float, float]],
) -> tuple[list[float], float | None]:
    input_bpm = float(case.row["_bpm"])
    diffs: list[float] = []
    top1_diff: float | None = None

    header = (
        f"{'rank':<5} {'id/file':<14} {'name':<45} {'meta_bpm':>10} "
        f"{'|dBPM|':>10} {'similarity':>12} {'distance':>12}"
    )
    print(header)
    _print_divider("-")

    for idx, (item, distance, similarity) in enumerate(ranked, start=1):
        metadata = item.metadata or {}
        item_id = str(item.audio_id) if getattr(item, "audio_id", None) else item.path.stem
        item_name = str(metadata.get("name") or clean_name_from_path(item.path))
        item_bpm = _extract_item_bpm(metadata)
        bpm_diff = abs(input_bpm - item_bpm) if item_bpm is not None else None

        if bpm_diff is not None:
            diffs.append(bpm_diff)
            if idx == 1:
                top1_diff = bpm_diff

        print(
            f"{idx:<5} "
            f"{item_id[:14]:<14} "
            f"{item_name[:45]:<45} "
            f"{_format_float(item_bpm, 2):>10} "
            f"{_format_float(bpm_diff, 2):>10} "
            f"{_format_float(float(similarity), 6):>12} "
            f"{_format_float(float(distance), 6):>12}"
        )

    return diffs, top1_diff


def _print_case_summary(
    case: InputCase,
    diffs: list[float],
    top1_diff: float | None,
) -> bool:
    min_diff = min(diffs) if diffs else None
    avg_diff = (sum(diffs) / len(diffs)) if diffs else None
    top1_close = top1_diff is not None and top1_diff <= 5.0
    avg_close = avg_diff is not None and avg_diff <= 10.0
    conclusion_yes = top1_close and avg_close

    print()
    print(f"Minimum returned BPM difference: {_format_float(min_diff, 2)}")
    print(f"Average returned BPM difference: {_format_float(avg_diff, 2)}")
    if top1_diff is None:
        print("Closest-by-ranking recommendation also has close BPM (<= 5 BPM): UNKNOWN (missing BPM metadata)")
    else:
        print(
            "Closest-by-ranking recommendation also has close BPM (<= 5 BPM): "
            f"{'YES' if top1_close else 'NO'} (top1 |dBPM|={top1_diff:.2f})"
        )
    print(
        "Current focus='bpm' behaves like real BPM matching: "
        f"{'YES' if conclusion_yes else 'NO'}"
    )
    print(
        "Heuristic used for this conclusion: top-1 BPM diff <= 5 and average BPM diff <= 10."
    )

    return conclusion_yes


def main() -> None:
    print("BPM Recommendation Behavior Diagnostic")
    print("Goal: verify how current backend focus='bpm' behaves in practice.")
    print()
    print(f"Metadata: {DATASET_METADATA_PATH}")
    print(f"Audio dir: {DATASET_AUDIO_DIR}")
    print(f"Feature cache: {CACHE_PATH}")
    print(f"Ranking config -> focus='{FOCUS}', top_k={TOP_K} (internal fetch={TOP_K + EXTRA_CANDIDATES})")

    rows = _load_valid_metadata_rows()
    cases = _build_input_cases(rows)
    dataset_items = load_dataset_items(DATASET_AUDIO_DIR, DATASET_METADATA_PATH, CACHE_PATH)
    if not dataset_items:
        raise RuntimeError("No dataset items available for recommendation.")

    print()
    print(f"Valid metadata rows with existing audio and BPM: {len(rows)}")
    print(f"Dataset items loaded for ranking: {len(dataset_items)}")
    _print_bpm_distribution(rows)

    case_conclusions: list[bool] = []
    for case in cases:
        _print_case_header(case)
        raw_ranked = rank_similar_items(case.audio_path, dataset_items, TOP_K + EXTRA_CANDIDATES, focus=FOCUS)
        if not raw_ranked:
            print("No recommendations returned for this case.")
            case_conclusions.append(False)
            continue

        filtered_ranked = [entry for entry in raw_ranked if not _is_self_match(case, entry[0])]
        ranked = filtered_ranked[:TOP_K]
        removed_count = len(raw_ranked) - len(filtered_ranked)
        print(f"Self-match excluded from evaluation metrics. (removed: {removed_count})")

        if not ranked:
            print("No non-self recommendations available for this case.")
            case_conclusions.append(False)
            continue

        diffs, top1_diff = _print_recommendation_table(case, ranked)
        case_conclusions.append(_print_case_summary(case, diffs, top1_diff))

    print()
    _print_divider("=")
    print("Final Diagnostic Summary")
    _print_divider("=")
    yes_count = sum(1 for value in case_conclusions if value)
    total = len(case_conclusions)
    print(f"Cases classified as BPM-like matching: {yes_count}/{total}")
    print()
    print("Interpretation:")
    print("- If results are not consistently close in BPM, current ranking is feature-based rather than direct BPM matching.")
    print("- Metadata BPM is displayed in outputs but is not necessarily the ranking signal.")


if __name__ == "__main__":
    main()
