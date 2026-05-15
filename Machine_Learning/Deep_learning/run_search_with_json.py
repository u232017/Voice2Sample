import os
import json
import argparse
import numpy as np
from sklearn.neighbors import NearestNeighbors

from modelo_ml import inicializar_modelo, extraer_embedding


def cargar_embeddings_json(ruta_json):
    with open(ruta_json, 'r', encoding='utf-8') as f:
        datos = json.load(f)

    dataset_root = datos.get('dataset', '')
    items = datos.get('items', [])

    rutas = []
    embeddings = []
    for it in items:
        path = it.get('path')
        emb = it.get('embedding')
        if emb is None or path is None:
            continue
        # si la ruta es relativa, unir con dataset_root
        full_path = path if os.path.isabs(path) else os.path.join(dataset_root, path)
        rutas.append(full_path)
        embeddings.append(emb)

    if len(embeddings) == 0:
        raise RuntimeError('No se cargaron embeddings desde el JSON')

    matriz = np.array(embeddings, dtype=np.float32)
    return rutas, matriz


def buscar_similares(ruta_audio_usuario, rutas_dataset, embeddings_matriz, k=5):
    # inicializar modelo si es necesario
    inicializar_modelo()

    # extraer embedding del audio del usuario
    emb_usuario = extraer_embedding(ruta_audio_usuario)

    # entrenar KNN sobre las embeddings del dataset
    knn = NearestNeighbors(metric='cosine', algorithm='brute')
    knn.fit(embeddings_matriz)

    k_ajustado = min(int(k), len(rutas_dataset))
    distancias, indices = knn.kneighbors(emb_usuario.reshape(1, -1), n_neighbors=k_ajustado)

    resultados = []
    for pos, idx in enumerate(indices[0]):
        distancia = float(distancias[0][pos])
        ruta = rutas_dataset[idx]
        resultados.append({
            'rank': pos + 1,
            'ruta': ruta,
            'archivo': os.path.basename(ruta),
            'distancia': distancia,
            'similitud': float((1 - distancia) * 100),
        })

    return resultados


def main():
    parser = argparse.ArgumentParser(description='Buscar top-k similares usando embeddings JSON')
    parser.add_argument('--embeddings', '-e', default=os.path.join('..', '..', 'Dataset', 'embeddings_output.json'),
                        help='Ruta al JSON de embeddings (por defecto: Dataset/embeddings_output.json)')
    parser.add_argument('--audio', '-a', default='mi_imitacion.wav', help='Ruta al audio de imitación (por defecto: mi_imitacion.wav)')
    # Forzar siempre top-5 (no se puede cambiar desde la línea de comandos)
    K_FIXED = 5
    parser.add_argument('--output', '-o', help='Ruta opcional para guardar resultados en JSON')

    args = parser.parse_args()

    ruta_json = args.embeddings
    ruta_audio = args.audio

    if not os.path.exists(ruta_json):
        raise FileNotFoundError(f'No se encontró el JSON de embeddings: {ruta_json}')

    if not os.path.exists(ruta_audio):
        raise FileNotFoundError(f'No se encontró el archivo de audio de entrada: {ruta_audio}')

    rutas_dataset, embeddings_matriz = cargar_embeddings_json(ruta_json)

    resultados = buscar_similares(ruta_audio, rutas_dataset, embeddings_matriz, k=K_FIXED)

    # Mostrar resultados
    print('\nRESULTADOS TOP-{}:'.format(len(resultados)))
    for r in resultados:
        print(f"#{r['rank']}  {r['archivo']}  -> Similitud: {r['similitud']:.2f}%  (dist: {r['distancia']:.6f})  Ruta: {r['ruta']}")

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump({'query': ruta_audio, 'results': resultados}, f, ensure_ascii=False, indent=2)
        print(f"\nResultados guardados en: {args.output}")


if __name__ == '__main__':
    main()
