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

USO (desde audio_analysis/, con el venv del proyecto)
─────────────────────────────────────────────────────
    python regenerate_descriptors.py --retrain

(Las rutas se resuelven respecto a este archivo, así que también puede
ejecutarse desde la raíz: python audio_analysis/regenerate_descriptors.py)

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

# Los extractores (rhythmic/melodic/timbre_features.py) viven en esta misma carpeta
_AQUI = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, _AQUI)

CHECKPOINT_EVERY = 25

AUDIO_DIR_DEFAULT = os.path.join(_AQUI, "..", "Dataset", "audio_processed")
DESCRIPTORS_DIR_DEFAULT = os.path.join(_AQUI, "descriptors")
MODELS_DIR_DEFAULT = os.path.join(_AQUI, "..", "audio_processing", "Processing", "models")
REPORTS_DIR_DEFAULT = os.path.join(_AQUI, "..", "reports")

# Informes de estadísticas del análisis del dataset (requisito del proyecto).
# Se escriben aquí, en el paso batch, y no desde los extractores: así las
# búsquedas de usuarios en la web no contaminan las estadísticas del dataset.
REPORT_FILES = {
    "ritmo": ("rhythmic_report.txt", "rítmico"),
    "melodia": ("melodic_report.txt", "melódico"),
    "timbre": ("timbre_report.txt", "tímbrico"),
}


def _extract_one(audio_path: str) -> tuple[str, dict | None, dict | None, dict | None, dict[str, float]]:
    """Worker: extrae los tres grupos de descriptores de un audio.

    Importa dentro del worker (cada proceso necesita su propio import) y
    silencia los prints por-archivo de los extractores para no inundar el log.
    Devuelve también el tiempo de extracción por modo para los informes.
    """
    from rhythmic_features import extract_rhythmic_descriptors
    from melodic_features import extract_melodic_features
    from timbre_features import extract_timbre_descriptors

    audio_id = os.path.splitext(os.path.basename(audio_path))[0]
    tiempos: dict[str, float] = {}
    with open(os.devnull, "w") as devnull, contextlib.redirect_stdout(devnull):
        t = time.time(); ritmo = extract_rhythmic_descriptors(audio_path); tiempos["ritmo"] = time.time() - t
        t = time.time(); melodia = extract_melodic_features(audio_path); tiempos["melodia"] = time.time() - t
        t = time.time(); timbre = extract_timbre_descriptors(audio_path); tiempos["timbre"] = time.time() - t
    return audio_id, ritmo, melodia, timbre, tiempos


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


def _escribir_informes(reports_dir: str, lineas: dict[str, list[str]],
                       tiempos_por_modo: dict[str, list[float]],
                       n_total: int, n_errores: int, duracion_min: float, workers: int) -> None:
    """Escribe los informes de estadísticas del análisis del dataset.

    Mismo formato por línea que usaban los extractores originales
    ("OK - {id} {modo} guardado | time=X.XXs") más un bloque de resumen
    estadístico al final de cada lote.
    """
    import datetime
    os.makedirs(reports_dir, exist_ok=True)
    fecha = datetime.date.today().isoformat()

    for modo, (nombre_archivo, etiqueta) in REPORT_FILES.items():
        ruta = os.path.join(reports_dir, nombre_archivo)
        ts = tiempos_por_modo.get(modo, [])
        with open(ruta, "a", encoding="utf-8") as f:
            f.write(f"\n──── ANÁLISIS DEL DATASET ({fecha}) ─────────────────────────\n")
            for linea in lineas.get(modo, []):
                f.write(linea + "\n")
            f.write(f"──── RESUMEN {etiqueta.upper()} ({fecha}) ────\n")
            f.write(f"Audios procesados: {n_total} | OK: {n_total - n_errores} | Errores: {n_errores}\n")
            if ts:
                f.write(f"Tiempo de extracción por audio: media {sum(ts)/len(ts):.2f}s | "
                        f"mín {min(ts):.2f}s | máx {max(ts):.2f}s\n")
            f.write(f"Duración total del lote: {duracion_min:.1f} min ({workers} workers)\n")
        print(f"  ✓ informe: {ruta}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenera descriptores del dataset con los extractores de consulta")
    parser.add_argument("--audio-dir", default=AUDIO_DIR_DEFAULT)
    parser.add_argument("--descriptors-dir", default=DESCRIPTORS_DIR_DEFAULT)
    parser.add_argument("--models-dir", default=MODELS_DIR_DEFAULT)
    parser.add_argument("--reports-dir", default=REPORTS_DIR_DEFAULT)
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
    lineas_informe: dict[str, list[str]] = {m: [] for m in REPORT_FILES}
    tiempos_por_modo: dict[str, list[float]] = {m: [] for m in REPORT_FILES}

    if pending:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(_extract_one, p): p for p in pending}
            completados = 0
            for future in as_completed(futures):
                path = futures[future]
                audio_id = os.path.splitext(os.path.basename(path))[0]
                try:
                    _, ritmo, melodia, timbre, tiempos = future.result()
                except Exception as exc:
                    errores.append(f"{audio_id}: {exc}")
                    for modo in REPORT_FILES:
                        lineas_informe[modo].append(f"ERROR - {audio_id}: {exc}")
                    continue
                if ritmo is None or melodia is None or timbre is None:
                    errores.append(f"{audio_id}: extractor devolvió None (¿audio silencioso?)")
                    for modo in REPORT_FILES:
                        lineas_informe[modo].append(f"ERROR - {audio_id}: extractor devolvió None")
                    continue
                done[audio_id] = {"ritmo": ritmo, "melodia": melodia, "timbre": timbre}
                for modo, (_, etiqueta) in REPORT_FILES.items():
                    t_modo = tiempos.get(modo, 0.0)
                    tiempos_por_modo[modo].append(t_modo)
                    lineas_informe[modo].append(f"OK - {audio_id} {etiqueta} guardado | time={t_modo:.2f}s")
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

    # Informes de estadísticas del análisis (solo si se procesó algo nuevo)
    if pending:
        print("\nEscribiendo informes de estadísticas…")
        _escribir_informes(
            args.reports_dir, lineas_informe, tiempos_por_modo,
            n_total=len(pending), n_errores=len(errores),
            duracion_min=(time.time() - t0) / 60, workers=args.workers,
        )

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
        # train_models.py vive en audio_processing/Processing/
        sys.path.insert(0, os.path.join(_AQUI, "..", "audio_processing", "Processing"))
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
