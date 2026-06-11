"""
regenerate_descriptors.py
-------------------------
Regenera los descriptores del dataset usando LOS MISMOS extractores que se
usan en tiempo de consulta (audio_analysis/*.py, basados en librosa) y
reentrena los modelos KNN.

POR QUÉ ES NECESARIO
────────────────────
Los modelos KNN originales se entrenaron con descriptores de Essentia
(MusicExtractor), pero los extractores de consulta se reescribieron con
librosa para poder procesar audio nuevo en tiempo real. Essentia y librosa
calculan los mismos descriptores con algoritmos distintos (otra escala,
otra ventana, otro filterbank), así que el vector de consulta no era
comparable con la base de datos: los vecinos devueltos eran ruido.

Este script garantiza la consistencia: dataset y consulta pasan por las
mismas funciones exactas.

USO (desde audio_processing/Processing/, con el venv del proyecto)
──────────────────────────────────────────────────────────────────
    python regenerate_descriptors.py --retrain

El script es reanudable: guarda un checkpoint cada N audios y al relanzarlo
continúa donde se quedó.
"""

import argparse
import contextlib
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../audio_analysis")))

CHECKPOINT_EVERY = 25

AUDIO_DIR_DEFAULT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../Dataset/audio_processed"))
DESCRIPTORS_DIR_DEFAULT = os.path.abspath(os.path.join(os.path.dirname(__file__), "descriptors"))
MODELS_DIR_DEFAULT = os.path.abspath(os.path.join(os.path.dirname(__file__), "models"))


def _extract_one(audio_path: str) -> tuple[str, dict | None, dict | None, dict | None]:
    """Worker: extrae los tres grupos de descriptores de un audio.

    Importa dentro del worker (cada proceso necesita su propio import) y
    silencia los prints por-archivo de los extractores para no inundar el log.
    """
    from rhythmic_features import extract_rhythmic_descriptors
    from melodic_features import extract_melodic_features
    from timbre_features import extract_timbre_descriptors

    audio_id = os.path.splitext(os.path.basename(audio_path))[0]
    with open(os.devnull, "w") as devnull, contextlib.redirect_stdout(devnull):
        ritmo = extract_rhythmic_descriptors(audio_path)
        melodia = extract_melodic_features(audio_path)
        timbre = extract_timbre_descriptors(audio_path)
    return audio_id, ritmo, melodia, timbre


def _load_checkpoint(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_checkpoint(path: str, data: dict) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)


def _backup(path: str) -> None:
    if os.path.exists(path):
        bak = path + ".pre_regen.bak"
        if not os.path.exists(bak):
            os.replace(path, bak)
            print(f"  backup: {os.path.basename(path)} -> {os.path.basename(bak)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenera descriptores del dataset con los extractores de consulta")
    parser.add_argument("--audio-dir", default=AUDIO_DIR_DEFAULT)
    parser.add_argument("--descriptors-dir", default=DESCRIPTORS_DIR_DEFAULT)
    parser.add_argument("--models-dir", default=MODELS_DIR_DEFAULT)
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    parser.add_argument("--retrain", action="store_true", help="Reentrena los KNN al terminar")
    args = parser.parse_args()

    wavs = sorted(
        os.path.join(args.audio_dir, f)
        for f in os.listdir(args.audio_dir)
        if f.lower().endswith((".wav", ".mp3", ".flac", ".ogg", ".aiff"))
    )
    print(f"Dataset: {len(wavs)} audios | workers={args.workers}")

    checkpoint_path = os.path.join(args.descriptors_dir, "_regen_checkpoint.json")
    done = _load_checkpoint(checkpoint_path)
    pending = [p for p in wavs if os.path.splitext(os.path.basename(p))[0] not in done]
    print(f"Checkpoint: {len(done)} ya procesados, {len(pending)} pendientes")

    t0 = time.time()
    errores: list[str] = []

    if pending:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(_extract_one, p): p for p in pending}
            completados = 0
            for future in as_completed(futures):
                path = futures[future]
                audio_id = os.path.splitext(os.path.basename(path))[0]
                try:
                    _, ritmo, melodia, timbre = future.result()
                except Exception as exc:
                    errores.append(f"{audio_id}: {exc}")
                    continue
                if ritmo is None or melodia is None or timbre is None:
                    errores.append(f"{audio_id}: extractor devolvió None (¿audio silencioso?)")
                    continue
                done[audio_id] = {"ritmo": ritmo, "melodia": melodia, "timbre": timbre}
                completados += 1
                if completados % CHECKPOINT_EVERY == 0:
                    _save_checkpoint(checkpoint_path, done)
                    rate = completados / (time.time() - t0)
                    eta_min = (len(pending) - completados) / max(rate, 1e-9) / 60
                    print(f"  {completados}/{len(pending)} | {rate:.2f} audios/s | ETA {eta_min:.0f} min", flush=True)

        _save_checkpoint(checkpoint_path, done)

    print(f"\nExtracción terminada: {len(done)} audios OK, {len(errores)} errores en {(time.time()-t0)/60:.1f} min")
    for e in errores[:10]:
        print("  ERROR:", e)

    # ── Escribir los tres JSON de descriptores (con backup de los antiguos) ──
    print("\nEscribiendo descriptores…")
    salidas = {
        "rhythmic_descriptors.json": {aid: v["ritmo"] for aid, v in done.items()},
        "melodic_descriptors.json": {aid: v["melodia"] for aid, v in done.items()},
        "timbre_descriptors.json": {aid: v["timbre"] for aid, v in done.items()},
    }
    for nombre, datos in salidas.items():
        destino = os.path.join(args.descriptors_dir, nombre)
        _backup(destino)
        with open(destino, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False)
        print(f"  ✓ {nombre} ({len(datos)} audios)")

    # ── Reentrenar KNN ────────────────────────────────────────────────────────
    if args.retrain:
        print("\nReentrenando modelos KNN…")
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from train_models import cargar_descriptores, combinar_descriptores, construir_y_guardar_knn

        os.makedirs(os.path.join(args.models_dir, "backup_pre_regen"), exist_ok=True)
        for modo in ("ritmo", "melodia", "timbre", "general"):
            for pref in ("knn", "meta", "columnas"):
                src = os.path.join(args.models_dir, f"{pref}_{modo}.joblib")
                dst = os.path.join(args.models_dir, "backup_pre_regen", f"{pref}_{modo}.joblib")
                if os.path.exists(src) and not os.path.exists(dst):
                    import shutil
                    shutil.copy2(src, dst)

        def rutas(modo: str):
            return (
                os.path.join(args.models_dir, f"knn_{modo}.joblib"),
                os.path.join(args.models_dir, f"meta_{modo}.joblib"),
                os.path.join(args.models_dir, f"columnas_{modo}.joblib"),
            )

        j_r = os.path.join(args.descriptors_dir, "rhythmic_descriptors.json")
        j_m = os.path.join(args.descriptors_dir, "melodic_descriptors.json")
        j_t = os.path.join(args.descriptors_dir, "timbre_descriptors.json")

        n, m, c = cargar_descriptores(j_r)
        construir_y_guardar_knn(n, m, c, *rutas("ritmo"))
        n, m, c = cargar_descriptores(j_m)
        construir_y_guardar_knn(n, m, c, *rutas("melodia"))
        n, m, c = cargar_descriptores(j_t)
        construir_y_guardar_knn(n, m, c, *rutas("timbre"))
        n, m, c = combinar_descriptores([j_r, j_m, j_t])
        construir_y_guardar_knn(n, m, c, *rutas("general"))

        print("\n✅ Modelos reentrenados. Reinicia el backend para que los cargue.")


if __name__ == "__main__":
    main()
