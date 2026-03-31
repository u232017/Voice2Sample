"""End-to-end sound classification pipeline."""

import os
from typing import Any, Dict, List, Optional

import pandas as pd

from sound_classifier.audio_features import AudioFeatureExtractor
from sound_classifier.dataset import DatasetManager
from sound_classifier.freesound_client import FreesoundClient
from sound_classifier.models import SoundClassifier


class SoundClassificationPipeline:
    """Orchestrates dataset building, training, and inference.

    Ties together the Freesound client, feature extractor, dataset manager,
    and classifier into a single cohesive pipeline.
    """

    def __init__(
        self,
        api_key: str,
        data_dir: str,
        features_file: str,
        model_file: str,
        sound_classes: List[str],
        n_per_class: int,
        model_type: str = "random_forest",
    ) -> None:
        """Initialise all pipeline components.

        Args:
            api_key: Freesound API key.
            data_dir: Root directory for downloaded audio files.
            features_file: Path to the feature CSV file.
            model_file: Path where the trained model will be saved.
            sound_classes: List of class labels / search queries.
            n_per_class: Number of sounds to download per class.
            model_type: Classifier type (see :class:`SoundClassifier`).
        """
        self.api_key = api_key
        self.data_dir = data_dir
        self.features_file = features_file
        self.model_file = model_file
        self.sound_classes = sound_classes
        self.n_per_class = n_per_class
        self.model_type = model_type

        self.freesound_client = FreesoundClient(api_key)
        self.feature_extractor = AudioFeatureExtractor()
        self.dataset_manager = DatasetManager(data_dir, features_file)
        self.classifier = SoundClassifier(model_type)

    def build_dataset(self) -> Optional[pd.DataFrame]:
        """Download sounds and extract features.

        Returns:
            Feature DataFrame, or None on failure.
        """
        print("Building dataset…")
        sound_files = self.dataset_manager.download_sounds(
            self.freesound_client, self.sound_classes, self.n_per_class
        )
        df = self.dataset_manager.extract_features(self.feature_extractor, sound_files)
        print("Dataset build complete.")
        return df

    def train(self) -> Optional[Dict[str, Any]]:
        """Load features, train the classifier, and save the model.

        Returns:
            Training result dictionary, or None on failure.
        """
        X, y = self.dataset_manager.load_features()
        if X is None or y is None:
            print("No features found. Run build_dataset() first.")
            return None

        print(f"Training {self.model_type} classifier on {len(y)} samples…")
        results = self.classifier.train(X, y)
        print(
            f"Training complete. Accuracy: {results['accuracy']:.4f}\n"
            f"{results['report']}"
        )
        os.makedirs(os.path.dirname(self.model_file) or ".", exist_ok=True)
        self.classifier.save(self.model_file)
        return results

    def classify_sound(self, sound_id_or_file: Any) -> Optional[Dict[str, Any]]:
        """Classify a sound given a Freesound ID or a local file path.

        Args:
            sound_id_or_file: Integer Freesound sound ID, a digit string,
                or a local file path.

        Returns:
            Dictionary with ``"class"`` (predicted label) and
            ``"probabilities"`` (dict of class → probability), or None on
            failure.
        """
        file_path: Optional[str] = None

        try:
            # Treat integers or digit strings as Freesound IDs
            if isinstance(sound_id_or_file, int) or (
                isinstance(sound_id_or_file, str)
                and str(sound_id_or_file).isdigit()
            ):
                sound_id = int(sound_id_or_file)
                sound = self.freesound_client.get_sound(sound_id)
                if sound is None:
                    print(f"Could not retrieve sound ID {sound_id}.")
                    return None
                tmp_dir = os.path.join(self.data_dir, "tmp")
                file_path = self.freesound_client.download_preview(sound, tmp_dir)
                if file_path is None:
                    print(f"Could not download preview for sound ID {sound_id}.")
                    return None
            else:
                file_path = str(sound_id_or_file)

            features = self.feature_extractor.extract_all(file_path)
            if features is None:
                print(f"Feature extraction failed for '{file_path}'.")
                return None

            predicted_class = self.classifier.predict(features)
            try:
                probabilities = self.classifier.predict_proba(features)
            except AttributeError:
                probabilities = {}

            return {"class": predicted_class, "probabilities": probabilities}

        except Exception as exc:
            print(f"Error classifying sound: {exc}")
            return None

    def evaluate(self) -> Dict[str, Any]:
        """Evaluate all supported model types on the current dataset.

        Returns:
            Dictionary mapping model type to training result dict.
        """
        X, y = self.dataset_manager.load_features()
        if X is None or y is None:
            print("No features found. Run build_dataset() first.")
            return {}

        model_types = ["random_forest", "svm", "knn", "gradient_boost"]
        results: Dict[str, Any] = {}

        for mtype in model_types:
            print(f"Evaluating model type: {mtype}…")
            classifier = SoundClassifier(model_type=mtype)
            try:
                result = classifier.train(X, y)
                results[mtype] = result
                print(f"  {mtype}: accuracy={result['accuracy']:.4f}")
            except Exception as exc:
                print(f"  {mtype}: failed with error: {exc}")
                results[mtype] = {"error": str(exc)}

        return results
