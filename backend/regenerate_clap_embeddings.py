"""
regenerate_clap_embeddings.py
-----------------------------
Regenera Dataset/embeddings_output.json con el entorno actual.

POR QUÉ ES NECESARIO
────────────────────
Los embeddings almacenados se generaron con otra versión de transformers y
NO son compatibles con los que produce el entorno actual: el coseno entre el
embedding recién calculado y el almacenado para el mismo audio era ≈ -0.08
(debería ser ≈ 1.0). Con embeddings incompatibles, la búsqueda CLAP devuelve
vecinos aleatorios.

Este script usa exactamente la misma función `_extract_embedding` que el
backend usa en tiempo de consulta, garantizando la consistencia.

USO (desde la raíz del repo, con el venv del proyecto)
──────────────────────────────────────────────────────
    python backend/regenerate_clap_embeddings.py

Reanudable: guarda checkpoint cada 25 audios.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import clap_recommender as cr

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "Dataset" / "audio_processed"
OUTPUT = ROOT / "Dataset" / "embeddings_output.json"
CHECKPOINT = ROOT / "Dataset" / "_clap_regen_checkpoint.json"
CHECKPOINT_EVERY = 25


def main() -> None:
    if not cr.init_clap():
        print("ERROR: no se pudo cargar el modelo CLAP (¿torch/transformers instalados?)")
        sys.exit(1)

    wavs = sorted(p for p in AUDIO_DIR.iterdir() if p.suffix.lower() in (".wav", ".mp3", ".flac", ".ogg"))
    print(f"Dataset: {len(wavs)} audios")

    done: dict[str, list[float]] = {}
    if CHECKPOINT.exists():
        with CHECKPOINT.open() as f:
            done = json.load(f)
        print(f"Checkpoint: {len(done)} ya procesados")

    t0 = time.time()
    errores = []
    procesados = 0

    for path in wavs:
        if path.name in done:
            continue
        emb = cr._extract_embedding(path)
        if emb is None:
            errores.append(path.name)
            continue
        done[path.name] = [round(float(x), 6) for x in emb]
        procesados += 1
        if procesados % CHECKPOINT_EVERY == 0:
            tmp = str(CHECKPOINT) + ".tmp"
            with open(tmp, "w") as f:
                json.dump(done, f)
            os.replace(tmp, CHECKPOINT)
            rate = procesados / (time.time() - t0)
            restantes = len(wavs) - len(done)
            print(f"  {len(done)}/{len(wavs)} | {rate:.2f} audios/s | ETA {restantes/max(rate,1e-9)/60:.0f} min", flush=True)

    print(f"\nExtracción terminada: {len(done)} OK, {len(errores)} errores en {(time.time()-t0)/60:.1f} min")
    for e in errores[:10]:
        print("  ERROR:", e)

    # Backup del JSON antiguo y escritura del nuevo (mismo formato {items: [...]})
    if OUTPUT.exists():
        bak = OUTPUT.with_suffix(".json.pre_regen.bak")
        if not bak.exists():
            os.replace(OUTPUT, bak)
            print(f"  backup: {OUTPUT.name} -> {bak.name}")

    items = [{"path": name, "embedding": emb} for name, emb in sorted(done.items())]
    with OUTPUT.open("w", encoding="utf-8") as f:
        json.dump({"items": items}, f)
    print(f"✓ {OUTPUT} escrito con {len(items)} embeddings. Reinicia el backend.")

    if CHECKPOINT.exists():
        CHECKPOINT.unlink()


if __name__ == "__main__":
    main()
