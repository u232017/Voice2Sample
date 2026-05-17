"""
main.py
-------
Punto de entrada principal de Voice2Sample (backend local).

FLUJO COMPLETO
──────────────
    1. Entrena los 4 modelos KNN desde los JSON consolidados
    2. Ejecuta una búsqueda de prueba con el audio que pases

USO RÁPIDO
──────────
    # Solo entrenar:
    python main.py --solo_entrenar

    # Entrenar + buscar:
    python main.py --audio ./sample.wav --modo timbre

    # Solo buscar (modelos ya entrenados):
    python main.py --solo_buscar --audio ./sample.wav --modo ritmo --top_k 5

    # Ver todos los modos de búsqueda con el mismo audio:
    python main.py --solo_buscar --audio ./sample.wav --todos_los_modos
"""

import argparse
import os
import sys


# ─────────────────────────────────────────────────────────────
#  Configuración por defecto
# ─────────────────────────────────────────────────────────────

DESCRIPTORS_DIR = "./descriptors"
MODELS_DIR      = "./models"
N_NEIGHBORS     = 10
TOP_K_DEFAULT   = 5
MODOS           = ["ritmo", "melodia", "timbre", "general"]


# ─────────────────────────────────────────────────────────────
#  Paso 1: Entrenamiento
# ─────────────────────────────────────────────────────────────

def paso_entrenar(descriptors_dir, models_dir, n_neighbors):
    from train_models import (
        cargar_descriptores,
        combinar_descriptores,
        construir_y_guardar_knn,
    )

    os.makedirs(models_dir, exist_ok=True)

    json_ritmo   = os.path.join(descriptors_dir, "rhythmic_descriptors.json")
    json_melodia = os.path.join(descriptors_dir, "melodic_descriptors.json")
    json_timbre  = os.path.join(descriptors_dir, "timbre_descriptors.json")

    # Verificación anticipada
    faltantes = [r for r in [json_ritmo, json_melodia, json_timbre]
                 if not os.path.exists(r)]
    if faltantes:
        print("\n❌ Faltan los siguientes JSON de descriptores:")
        for f in faltantes:
            print(f"   {f}")
        print(
            "\n💡 Soluciones:\n"
            "   A) Ejecuta el pipeline de extracción de features primero.\n"
            "   B) Si tienes JSONs individuales, ejecuta:\n"
            "      python consolidar_jsons.py --rhythmic_dir ... --melodic_dir ... --timbre_dir ...\n"
        )
        sys.exit(1)

    def rutas(modo):
        d = models_dir
        return (
            os.path.join(d, f"knn_{modo}.joblib"),
            os.path.join(d, f"meta_{modo}.joblib"),
            os.path.join(d, f"columnas_{modo}.joblib"),
        )

    modos_ok = []
    print("\n── [Paso 1/2] Entrenando modelos KNN ─────────────────────────────\n")

    for label, json_path, modo in [
        ("[1/4] knn_ritmo",   json_ritmo,   "ritmo"),
        ("[2/4] knn_melodia", json_melodia, "melodia"),
        ("[3/4] knn_timbre",  json_timbre,  "timbre"),
    ]:
        print(label)
        try:
            n, m, c = cargar_descriptores(json_path)
            construir_y_guardar_knn(n, m, c, *rutas(modo), n_neighbors)
            modos_ok.append(modo)
        except Exception as e:
            print(f"  ✗ Error en {modo}: {e}")

    print("\n[4/4] knn_general")
    if len(modos_ok) == 3:
        try:
            n, m, c = combinar_descriptores([json_ritmo, json_melodia, json_timbre])
            construir_y_guardar_knn(n, m, c, *rutas("general"), n_neighbors)
            modos_ok.append("general")
        except Exception as e:
            print(f"  ✗ Error en general: {e}")
    else:
        print("  ✗ knn_general requiere los 3 modos anteriores correctos")

    print(f"\n  Modelos entrenados: {modos_ok}\n")
    return modos_ok


# ─────────────────────────────────────────────────────────────
#  Paso 2: Búsqueda
# ─────────────────────────────────────────────────────────────

def paso_buscar(ruta_audio, modo, top_k, models_dir):
    from inference import buscar_similar

    print(f"\n── [Paso 2/2] Búsqueda de similitud ──────────────────────────────")
    print(f"   Audio : {ruta_audio}")
    print(f"   Modo  : {modo}")
    print(f"   Top-K : {top_k}\n")

    try:
        resultados = buscar_similar(
            ruta_audio=ruta_audio,
            modo=modo,
            top_k=top_k,
            models_dir=models_dir,
        )
        _imprimir_resultados(resultados, modo)
    except Exception as e:
        print(f"  ✗ Error en búsqueda: {e}")
        raise


def _imprimir_resultados(resultados, modo):
    ancho = 60
    print(f"  {'─'*ancho}")
    print(f"  {'#':<5} {'Similitud':>10}  {'Distancia':>11}   Nombre")
    print(f"  {'─'*ancho}")
    for r in resultados:
        barra = "█" * int(r["similitud"] * 20)
        print(f"  {r['rank']:<5} {r['similitud']:>10.4f}  {r['distancia']:>11.4f}   {r['nombre']}")
        print(f"  {'':5} {barra}")
    print(f"  {'─'*ancho}")
    print(f"  ✓ {len(resultados)} resultados para modo '{modo}'\n")


def paso_buscar_todos_los_modos(ruta_audio, top_k, models_dir):
    from inference import BuscadorSimilitud

    print(f"\n── Búsqueda en los 4 modos ────────────────────────────────────────")
    print(f"   Audio : {ruta_audio}\n")

    buscador = BuscadorSimilitud(models_dir=models_dir)

    for modo in MODOS:
        print(f"\n  ▶ MODO: {modo.upper()}")
        try:
            resultados = buscador.buscar(ruta_audio, modo=modo, top_k=top_k)
            _imprimir_resultados(resultados, modo)
        except FileNotFoundError as e:
            print(f"  ✗ Modelo no disponible: {e}\n")
        except Exception as e:
            print(f"  ✗ Error: {e}\n")


# ─────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Voice2Sample — motor de búsqueda por similitud de audio"
    )
    parser.add_argument("--descriptors_dir", default=DESCRIPTORS_DIR,
                        help=f"Carpeta de descriptores JSON (default: {DESCRIPTORS_DIR})")
    parser.add_argument("--models_dir",      default=MODELS_DIR,
                        help=f"Carpeta de modelos .joblib (default: {MODELS_DIR})")
    parser.add_argument("--n_neighbors",     type=int, default=N_NEIGHBORS,
                        help=f"Máximo de vecinos al entrenar (default: {N_NEIGHBORS})")
    parser.add_argument("--audio",           default=None,
                        help="Audio de prueba para la búsqueda")
    parser.add_argument("--modo",            default="general",
                        choices=MODOS,
                        help="Modo de búsqueda (default: general)")
    parser.add_argument("--top_k",           type=int, default=TOP_K_DEFAULT,
                        help=f"Resultados a mostrar (default: {TOP_K_DEFAULT})")
    parser.add_argument("--solo_entrenar",   action="store_true",
                        help="Solo entrena, no busca")
    parser.add_argument("--solo_buscar",     action="store_true",
                        help="Salta el entrenamiento, solo busca")
    parser.add_argument("--todos_los_modos", action="store_true",
                        help="Ejecuta la búsqueda en los 4 modos y compara")
    args = parser.parse_args()

    # ── Entrenamiento ──
    if not args.solo_buscar:
        paso_entrenar(args.descriptors_dir, args.models_dir, args.n_neighbors)

    # ── Búsqueda ──
    if args.solo_entrenar:
        print("  (búsqueda omitida por --solo_entrenar)\n")
        return

    if args.audio is None:
        print(
            "  No se especificó --audio. Entrenamiento completado.\n\n"
            "  Para buscar:\n"
            f"    python main.py --solo_buscar --audio sample.wav --modo timbre\n"
            f"    python main.py --solo_buscar --audio sample.wav --todos_los_modos\n"
        )
        return

    if not os.path.exists(args.audio):
        print(f"\n  ✗ Audio no encontrado: {args.audio}")
        sys.exit(1)

    if args.todos_los_modos:
        paso_buscar_todos_los_modos(args.audio, args.top_k, args.models_dir)
    else:
        paso_buscar(args.audio, args.modo, args.top_k, args.models_dir)


if __name__ == "__main__":
    main()