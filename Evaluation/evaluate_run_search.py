"""
Quantitative evaluation script for run_search_with_json model using an imitation audio.

Produces a small JSON summary with timing and similarity statistics.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate run_search_with_json with imitation audio")
    repo_root = _repo_root()

    parser.add_argument(
        "--embeddings",
        default=str(repo_root / "Dataset" / "embeddings_output.json"),
        help="Path to embeddings JSON",
    )
    parser.add_argument(
        "--imitation",
        default=str(repo_root / "Dataset" / "audio_processed" / "100270.wav"),
        help="Path to imitation audio file",
    )
    parser.add_argument("--k", type=int, default=5, help="Top-K to retrieve")
    parser.add_argument(
        "--output",
        default=str(repo_root / "Evaluation" / "run_search_evaluation.json"),
        help="Output JSON summary path",
    )

    args = parser.parse_args()

    sys.path.insert(0, str(repo_root))
    try:
        from audio_processing.CLAP import run_search_with_json as rsj  # type: ignore
    except Exception as exc:
        print(f"Error importing run_search_with_json: {exc}")
        return 2

    embeddings_path = Path(args.embeddings)
    imitation_path = Path(args.imitation)

    if not embeddings_path.exists():
        print(f"Embeddings JSON not found: {embeddings_path}")
        return 3
    if not imitation_path.exists():
        print(f"Imitation audio not found: {imitation_path}")
        return 4

    rutas, emb_matrix = rsj.cargar_embeddings_json(str(embeddings_path))

    start = time.time()
    resultados = rsj.buscar_similares(str(imitation_path), rutas, emb_matrix, k=args.k)
    elapsed = time.time() - start

    similitudes = [float(r.get("similitud", 0.0)) for r in resultados]
    distancias = [float(r.get("distancia", 0.0)) for r in resultados]

    summary: Dict = {
        "query": str(imitation_path),
        "embeddings_json": str(embeddings_path),
        "n_results": len(resultados),
        "time_sec": elapsed,
        "mean_similarity": float(sum(similitudes) / len(similitudes)) if similitudes else 0.0,
        "max_similarity": float(max(similitudes)) if similitudes else 0.0,
        "mean_distance": float(sum(distancias) / len(distancias)) if distancias else 0.0,
        "results": resultados,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Evaluation complete — summary written to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
