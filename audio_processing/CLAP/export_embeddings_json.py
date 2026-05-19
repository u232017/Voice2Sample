"""
Export embeddings from an audio dataset to JSON.

Quick usage:
    python export_embeddings_json.py "path/to/dataset" "output.json"
"""

import json
import os
from typing import Iterable, List, Tuple

from modelo_ml import inicializar_modelo, extraer_embedding

# Optional defaults for quick runs without CLI args.
# Use the processed audio folder in the repository by default.
DEFAULT_DATASET_PATH = "Dataset/audio_processed"
DEFAULT_OUTPUT_JSON = "Dataset/embeddings_output.json"


def _colectar_archivos_audio(
    dataset_path: str,
    recursive: bool,
    extensions: Tuple[str, ...],
) -> List[str]:
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Path does not exist: {dataset_path}")

    if os.path.isfile(dataset_path):
        ext = os.path.splitext(dataset_path)[1].lower()
        if ext in extensions:
            return [dataset_path]
        raise ValueError(f"File is not a supported audio type: {dataset_path}")

    archivos: List[str] = []
    if recursive:
        for root, _, files in os.walk(dataset_path):
            for filename in files:
                if os.path.splitext(filename)[1].lower() in extensions:
                    archivos.append(os.path.join(root, filename))
    else:
        for filename in os.listdir(dataset_path):
            ruta = os.path.join(dataset_path, filename)
            if os.path.isfile(ruta) and os.path.splitext(filename)[1].lower() in extensions:
                archivos.append(ruta)

    return archivos


def exportar_embeddings_a_json(
    dataset_path: str,
    output_json: str,
    recursive: bool = True,
    extensions: Iterable[str] = (".wav",),
    store_relative_paths: bool = True,
) -> dict:
    """
    Extract embeddings from all audios in dataset_path and save them to output_json.

    Returns a summary with count and output path.
    """
    extensiones = tuple(ext.lower() for ext in extensions)
    archivos = _colectar_archivos_audio(dataset_path, recursive, extensiones)

    if not archivos:
        raise RuntimeError(f"No audios found in: {dataset_path}")

    inicializar_modelo()

    base_path = dataset_path if os.path.isdir(dataset_path) else os.path.dirname(dataset_path)
    resultados = []

    for idx, ruta_audio in enumerate(archivos, start=1):
        embedding = extraer_embedding(ruta_audio)
        ruta_guardada = (
            os.path.relpath(ruta_audio, base_path)
            if store_relative_paths
            else os.path.abspath(ruta_audio)
        )
        resultados.append(
            {
                "path": ruta_guardada.replace("\\", "/"),
                "embedding": embedding.astype(float).tolist(),
            }
        )
        if idx % 10 == 0 or idx == len(archivos):
            print(f"Processed {idx}/{len(archivos)}")

    os.makedirs(os.path.dirname(output_json) or ".", exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(
            {
                "dataset": os.path.abspath(dataset_path).replace("\\", "/"),
                "count": len(resultados),
                "items": resultados,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    return {"count": len(resultados), "output": output_json}


if __name__ == "__main__":
    import sys

    if len(sys.argv) >= 3:
        dataset_path = sys.argv[1]
        output_json = sys.argv[2]
    else:
        dataset_path = DEFAULT_DATASET_PATH
        output_json = DEFAULT_OUTPUT_JSON

    if not dataset_path or not output_json:
        print("Usage: python export_embeddings_json.py <dataset_path> <output_json>")
        print("Or set DEFAULT_DATASET_PATH and DEFAULT_OUTPUT_JSON in this file.")
        sys.exit(1)

    resumen = exportar_embeddings_a_json(dataset_path, output_json)
    print(f"Exported {resumen['count']} embeddings to {resumen['output']}")
