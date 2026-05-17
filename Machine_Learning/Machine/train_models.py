"""
train_models.py
---------------
Genera los 4 modelos KNN a partir de los descriptores JSON consolidados.

ESTRUCTURA ESPERADA DE LOS JSON
────────────────────────────────
Cada JSON debe tener UN audio por clave, con sus features como valor:

    {
      "kick_001": {
        "bpm": 120.0,
        "beat_confidence": [0.9, 0.85, ...],
        "beat_intervals": [0.5, 0.5, ...]
      },
      "snare_002": { ... },
      ...
    }

Si tus scripts actuales sobreescriben el JSON con un solo audio, ejecuta
primero `consolidar_jsons.py` para fusionar todos en el formato correcto.

USO
───
    # Entrena los 4 modelos con parámetros por defecto
    python train_models.py

    # Rutas y vecinos personalizados
    python train_models.py \\
        --descriptors_dir ./descriptors \\
        --output_dir      ./models \\
        --n_neighbors     10

SALIDA (en output_dir/)
───────────────────────
    knn_ritmo.joblib      melodia, timbre, general → igual
    meta_ritmo.joblib     lista de IDs de audio (orden de filas)
    columnas_ritmo.joblib lista de nombres de feature (orden de columnas)
"""

import argparse
import json
import os
import sys

import numpy as np
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
import joblib


# ─────────────────────────────────────────────────────────────
#  Aplanado recursivo de JSON
# ─────────────────────────────────────────────────────────────

def _aplanar(valor, prefijo=""):
    """
    Convierte CUALQUIER estructura JSON anidada (dict / list / escalar)
    en un dict plano { "clave_anidada": float }.

    Reglas de nombrado (replica la convención de feature_extractors.py):
      - dict   → prefijo + clave + "_" + recursión
      - list   → prefijo + índice + "_" + recursión
      - escalar → prefijo sin "_" final → float

    Ejemplo:
        {"mfcc": [[1,2],[3,4]]}
        → {"mfcc_0_0": 1.0, "mfcc_0_1": 2.0, "mfcc_1_0": 3.0, "mfcc_1_1": 4.0}
    """
    resultado = {}
    if isinstance(valor, dict):
        for k, v in valor.items():
            sub = f"{prefijo}{k}_" if prefijo else f"{k}_"
            resultado.update(_aplanar(v, prefijo=sub))
    elif isinstance(valor, (list, tuple)):
        for i, v in enumerate(valor):
            resultado.update(_aplanar(v, prefijo=f"{prefijo}{i}_"))
    elif isinstance(valor, (int, float)) and not isinstance(valor, bool):
        clave = prefijo.rstrip("_")
        resultado[clave] = float(valor)
    # strings, bool, None → se ignoran
    return resultado


# ─────────────────────────────────────────────────────────────
#  Carga y construcción de matrices
# ─────────────────────────────────────────────────────────────

def cargar_descriptores(ruta_json):
    """
    Lee un JSON consolidado { audio_id: {features} } y construye
    la matriz numérica correspondiente.

    Returns
    -------
    nombres  : list[str]      — IDs de audio (orden alfabético estable)
    matrix   : np.ndarray     — shape (N, D), float32
    columnas : list[str]      — nombre de cada dimensión
    """
    if not os.path.exists(ruta_json):
        raise FileNotFoundError(f"JSON no encontrado: {ruta_json}")

    with open(ruta_json, "r", encoding="utf-8") as f:
        datos = json.load(f)

    if not datos:
        raise ValueError(f"JSON vacío: {ruta_json}")

    # Orden estable de audios
    nombres = sorted(datos.keys())

    # Aplanar cada audio
    filas_planas = [_aplanar(datos[n]) for n in nombres]

    # Unión ordenada de todas las claves (preserva orden de aparición)
    seen = set()
    columnas = []
    for fila in filas_planas:
        for k in fila:
            if k not in seen:
                columnas.append(k)
                seen.add(k)

    # Construcción de la matriz
    col_idx = {c: i for i, c in enumerate(columnas)}
    matrix = np.zeros((len(nombres), len(columnas)), dtype=np.float32)
    for i, fila in enumerate(filas_planas):
        for k, v in fila.items():
            matrix[i, col_idx[k]] = v

    # Limpieza numérica
    matrix = np.nan_to_num(matrix, nan=0.0, posinf=0.0, neginf=0.0)

    print(f"  Cargados {len(nombres)} audios | {len(columnas)} features  ← {os.path.basename(ruta_json)}")
    return nombres, matrix, columnas


def combinar_descriptores(rutas_json):
    """
    Carga varios JSON y concatena sus matrices horizontalmente.
    Solo conserva los audios presentes en TODOS los archivos
    (intersección de IDs).

    Returns
    -------
    nombres_finales  : list[str]
    matrix_combinada : np.ndarray  — shape (N, D_total)
    columnas_total   : list[str]
    """
    datasets = [cargar_descriptores(r) for r in rutas_json]

    # Intersección de IDs
    conjunto_comun = set(datasets[0][0])
    for nombres, _, _ in datasets[1:]:
        conjunto_comun &= set(nombres)

    if not conjunto_comun:
        raise ValueError(
            "No hay audios comunes entre los 3 JSON. "
            "Asegúrate de que todos comparten los mismos IDs."
        )

    # Usar el orden del primer dataset como referencia
    nombres_finales = [n for n in datasets[0][0] if n in conjunto_comun]

    matrices      = []
    columnas_total = []

    for nombres, matrix, columnas in datasets:
        idx_map = {n: i for i, n in enumerate(nombres)}
        idx     = [idx_map[n] for n in nombres_finales]
        matrices.append(matrix[idx])
        columnas_total.extend(columnas)

    matrix_combinada = np.concatenate(matrices, axis=1)
    print(f"  General: {len(nombres_finales)} audios | {matrix_combinada.shape[1]} features totales")
    return nombres_finales, matrix_combinada, columnas_total


# ─────────────────────────────────────────────────────────────
#  Construcción y persistencia del modelo KNN
# ─────────────────────────────────────────────────────────────

def construir_y_guardar_knn(nombres, matrix, columnas,
                             ruta_modelo, ruta_meta, ruta_columnas,
                             n_neighbors=10):
    """
    1. Ajusta StandardScaler sobre la matriz
    2. Entrena NearestNeighbors
    3. Guarda scaler + knn como un único dict en ruta_modelo
    4. Guarda la lista de IDs en ruta_meta
    5. Guarda la lista de columnas en ruta_columnas

    El bundle { scaler, knn } en un solo .joblib simplifica la carga
    en inferencia (un único joblib.load).
    """
    k_efectivo = min(n_neighbors, len(nombres))
    if k_efectivo < n_neighbors:
        print(f"  ⚠  k reducido a {k_efectivo} (solo {len(nombres)} audios en BD)")

    # Normalización
    scaler = StandardScaler()
    matrix_scaled = scaler.fit_transform(matrix)

    # KNN con ball_tree + distancia euclídea sobre datos normalizados
    # (equivale a Mahalanobis simplificado; cambia a metric="cosine" si prefieres)
    knn = NearestNeighbors(
        n_neighbors=k_efectivo,
        algorithm="ball_tree",
        metric="euclidean",
        n_jobs=-1,
    )
    knn.fit(matrix_scaled)

    # Persistencia
    joblib.dump({"scaler": scaler, "knn": knn}, ruta_modelo)
    joblib.dump(nombres,  ruta_meta)
    joblib.dump(columnas, ruta_columnas)

    nombre_archivo = os.path.basename(ruta_modelo)
    print(f"  ✓  {nombre_archivo:<28}  {len(nombres)} audios | "
          f"{matrix.shape[1]} features | k={k_efectivo}")


# ─────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Voice2Sample — genera los 4 modelos KNN de similitud"
    )
    parser.add_argument("--descriptors_dir", default="./descriptors",
                        help="Carpeta con rhythmic/melodic/timbre_descriptors.json")
    parser.add_argument("--output_dir", default="./models",
                        help="Carpeta de salida para los .joblib (default: ./models)")
    parser.add_argument("--n_neighbors", type=int, default=10,
                        help="Número máximo de vecinos (default: 10)")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    # Rutas de entrada
    json_ritmo   = os.path.join(args.descriptors_dir, "rhythmic_descriptors.json")
    json_melodia = os.path.join(args.descriptors_dir, "melodic_descriptors.json")
    json_timbre  = os.path.join(args.descriptors_dir, "timbre_descriptors.json")

    # Verificación anticipada
    faltantes = [r for r in [json_ritmo, json_melodia, json_timbre]
                 if not os.path.exists(r)]
    if faltantes:
        print("\n❌ Faltan los siguientes JSON:")
        for f in faltantes:
            print(f"   {f}")
        print("\nEjecuta primero el pipeline de extracción de features "
              "o consolidar_jsons.py si tienes JSONs parciales.\n")
        sys.exit(1)

    # Helper: rutas de salida para cada modo
    def rutas(modo):
        d = args.output_dir
        return (
            os.path.join(d, f"knn_{modo}.joblib"),      # scaler + knn
            os.path.join(d, f"meta_{modo}.joblib"),     # lista de IDs
            os.path.join(d, f"columnas_{modo}.joblib"), # lista de features
        )

    print("\n── Entrenando modelos KNN ─────────────────────────────────────────\n")

    # 1. Ritmo
    print("[1/4] knn_ritmo")
    n_r, m_r, c_r = cargar_descriptores(json_ritmo)
    construir_y_guardar_knn(n_r, m_r, c_r, *rutas("ritmo"), args.n_neighbors)

    # 2. Melodía
    print("\n[2/4] knn_melodia")
    n_m, m_m, c_m = cargar_descriptores(json_melodia)
    construir_y_guardar_knn(n_m, m_m, c_m, *rutas("melodia"), args.n_neighbors)

    # 3. Timbre
    print("\n[3/4] knn_timbre")
    n_t, m_t, c_t = cargar_descriptores(json_timbre)
    construir_y_guardar_knn(n_t, m_t, c_t, *rutas("timbre"), args.n_neighbors)

    # 4. General (concatenación de los 3, solo audios comunes)
    print("\n[4/4] knn_general")
    n_g, m_g, c_g = combinar_descriptores([json_ritmo, json_melodia, json_timbre])
    construir_y_guardar_knn(n_g, m_g, c_g, *rutas("general"), args.n_neighbors)

    print(f"\n✅ Modelos guardados en: {os.path.abspath(args.output_dir)}\n")


if __name__ == "__main__":
    main()