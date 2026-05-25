import os
import librosa
import pandas as pd
import numpy as np

def analyze_audio_durations(folder_path):
    durations = []
    filenames = []

    print(f"Analyzing files in {folder_path}...")

    # 1. Extract durations
    for file in os.listdir(folder_path):
        if file.endswith(('.wav')):
            path = os.path.join(folder_path, file)
            try:
                # get_duration is fast because it only reads the header
                d = librosa.get_duration(path=path)
                durations.append(d)
                filenames.append(file)
            except Exception as e:
                print(f"Error reading {file}: {e}")

    # 2. Create a DataFrame for analysis
    df = pd.DataFrame({'filename': filenames, 'duration': durations})

    # 3. Calculate Statistics
    stats = {
        "Mean": float(df['duration'].mean()),
        "Median": float(df['duration'].median()),
        "Std Dev": float(df['duration'].std()),
        "Min": float(df['duration'].min()),
        "Max": float(df['duration'].max())
    }

    # 4. Detect Outliers (Far from Median)
    # We use IQR: Values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
    Q1 = df['duration'].quantile(0.25)
    Q3 = df['duration'].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    
    outliers = df[(df['duration'] < lower_bound) | (df['duration'] > upper_bound)]

    return stats, df, outliers
