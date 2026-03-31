"""Dataset management: downloading sounds and extracting features."""

import os
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


class DatasetManager:
    """Manages downloading sounds and building feature datasets.

    Handles directory creation, metadata storage, feature extraction,
    and serialisation to/from CSV.
    """

    def __init__(self, data_dir: str, features_file: str) -> None:
        """Initialize the manager and ensure directories exist.

        Args:
            data_dir: Root directory for storing downloaded sound files.
            features_file: Path to the CSV file for storing features.
        """
        self.data_dir = data_dir
        self.features_file = features_file
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(os.path.dirname(features_file) or ".", exist_ok=True)

    def download_sounds(
        self,
        freesound_client,
        sound_classes: List[str],
        n_per_class: int,
    ) -> Dict[str, List[str]]:
        """Download sound previews for each class from Freesound.

        For each class, searches Freesound and downloads up to *n_per_class*
        high-quality MP3 previews. Metadata is saved to a CSV file alongside
        the downloaded files.

        Args:
            freesound_client: An initialised :class:`FreesoundClient` instance.
            sound_classes: List of class label strings used as search queries.
            n_per_class: Maximum number of sounds to download per class.

        Returns:
            Dictionary mapping each class label to a list of local file paths.
        """
        sound_files: Dict[str, List[str]] = {}
        all_metadata = []

        for class_name in sound_classes:
            class_dir = os.path.join(self.data_dir, class_name)
            os.makedirs(class_dir, exist_ok=True)
            print(f"Downloading sounds for class '{class_name}'...")

            sounds = freesound_client.search_sounds(class_name, n_per_class)
            file_paths: List[str] = []

            for sound in sounds:
                file_path = freesound_client.download_preview(sound, class_dir)
                if file_path:
                    file_paths.append(file_path)
                    all_metadata.append(
                        {
                            "id": sound.get("id"),
                            "name": sound.get("name"),
                            "class": class_name,
                            "file_path": file_path,
                            "duration": sound.get("duration"),
                        }
                    )

            sound_files[class_name] = file_paths
            print(f"  Downloaded {len(file_paths)} files for '{class_name}'.")

        # Persist metadata CSV next to the feature file
        if all_metadata:
            meta_path = os.path.join(
                os.path.dirname(self.features_file) or ".", "metadata.csv"
            )
            pd.DataFrame(all_metadata).to_csv(meta_path, index=False)
            print(f"Metadata saved to '{meta_path}'.")

        return sound_files

    def extract_features(
        self,
        feature_extractor,
        sound_files_by_class: Dict[str, List[str]],
    ) -> Optional[pd.DataFrame]:
        """Extract features from all downloaded sound files.

        Args:
            feature_extractor: An initialised :class:`AudioFeatureExtractor`.
            sound_files_by_class: Dict mapping class labels to file-path lists.

        Returns:
            DataFrame with one row per file (feature columns + 'label'), or
            None if no features could be extracted.
        """
        rows = []
        for class_name, file_paths in sound_files_by_class.items():
            for file_path in file_paths:
                print(f"Extracting features from '{file_path}'...")
                features = feature_extractor.extract_all(file_path)
                if features is not None:
                    row = dict(enumerate(features))
                    row["label"] = class_name
                    rows.append(row)

        if not rows:
            print("No features extracted.")
            return None

        df = pd.DataFrame(rows)
        # Rename numeric columns to feature_0, feature_1, …
        feature_cols = [c for c in df.columns if c != "label"]
        df.rename(columns={c: f"feature_{c}" for c in feature_cols}, inplace=True)

        try:
            df.to_csv(self.features_file, index=False)
            print(f"Features saved to '{self.features_file}'.")
        except OSError as exc:
            print(f"Error saving features CSV: {exc}")

        return df

    def load_features(self) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        """Load features from the CSV file.

        Returns:
            Tuple of (X, y) where X is a 2-D numpy array of feature values
            and y is a 1-D numpy array of string labels.  Returns (None, None)
            if the file cannot be read.
        """
        try:
            df = pd.read_csv(self.features_file)
        except (OSError, pd.errors.EmptyDataError) as exc:
            print(f"Error loading features from '{self.features_file}': {exc}")
            return None, None

        feature_cols = [c for c in df.columns if c != "label"]
        X = df[feature_cols].values.astype(np.float32)
        y = df["label"].values
        return X, y
