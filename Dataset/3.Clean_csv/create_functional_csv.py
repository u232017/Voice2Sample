import pandas as pd
from  import extract_features
from pathlib import Path


def add_audio_features(csv_path, audio_folder, output_path):
    """
    Añade features de Essentia al dataset CSV.
    """

    df = pd.read_csv(csv_path)

    audio_folder = Path(audio_folder)

    # listas para nuevas columnas
    centroid = []
    rolloff = []
    flux = []
    onset_rate = []
    bpm = []
    confidence = []
    beat_count = []

    mfcc_cols = [[] for _ in range(13)]

    for idx, row in df.iterrows():

        audio_path = audio_folder / f"{row['id']}.wav"

        if not audio_path.exists():
            print(f"⚠️ Audio no encontrado: {audio_path}")

            centroid.append(None)
            rolloff.append(None)
            flux.append(None)
            onset_rate.append(None)
            bpm.append(None)
            confidence.append(None)
            beat_count.append(None)

            for m in mfcc_cols:
                m.append(None)

            continue

        features = extract_features(str(audio_path))

        # primeros valores
        centroid.append(features[0])
        rolloff.append(features[1])
        flux.append(features[2])
        onset_rate.append(features[3])
        bpm.append(features[4])
        confidence.append(features[5])
        beat_count.append(features[6])

        # MFCCs (13 últimos valores)
        mfcc = features[7:]

        for i in range(13):
            mfcc_cols[i].append(mfcc[i])

    # añadir al dataframe
    df["centroid"] = centroid
    df["rolloff"] = rolloff
    df["flux"] = flux
    df["onset_rate"] = onset_rate
    df["bpm_estimated"] = bpm
    df["confidence"] = confidence
    df["beat_count"] = beat_count

    for i in range(13):
        df[f"mfcc_{i+1}"] = mfcc_cols[i]

    # guardar
    df.to_csv(output_path, index=False)

    print(f"✅ Dataset con features guardado en: {output_path}")