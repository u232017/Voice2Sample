"""Tests for SoundClassificationPipeline."""

import os
import shutil
import unittest
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd


class TestPipelineBuildDataset(unittest.TestCase):
    """Tests for SoundClassificationPipeline.build_dataset."""

    def _make_pipeline(self):
        from sound_classifier.pipeline import SoundClassificationPipeline

        pipeline = SoundClassificationPipeline(
            api_key="test_key",
            data_dir="tests/tmp_pipeline/sounds",
            features_file="tests/tmp_pipeline/features.csv",
            model_file="tests/tmp_pipeline/model.pkl",
            sound_classes=["dog_bark", "rain"],
            n_per_class=2,
        )
        return pipeline

    def setUp(self):
        os.makedirs("tests/tmp_pipeline", exist_ok=True)

    def tearDown(self):
        shutil.rmtree("tests/tmp_pipeline", ignore_errors=True)

    def test_build_dataset_calls_download_and_extract(self):
        """build_dataset delegates to dataset_manager's download and extract methods."""
        pipeline = self._make_pipeline()
        fake_df = pd.DataFrame({"feature_0": [1.0], "label": ["dog_bark"]})
        pipeline.dataset_manager.download_sounds = MagicMock(
            return_value={"dog_bark": ["a.mp3"], "rain": ["b.mp3"]}
        )
        pipeline.dataset_manager.extract_features = MagicMock(return_value=fake_df)

        result = pipeline.build_dataset()

        pipeline.dataset_manager.download_sounds.assert_called_once()
        pipeline.dataset_manager.extract_features.assert_called_once()
        self.assertIsNotNone(result)

    def test_build_dataset_returns_none_on_extract_failure(self):
        """build_dataset returns None when feature extraction fails."""
        pipeline = self._make_pipeline()
        pipeline.dataset_manager.download_sounds = MagicMock(return_value={})
        pipeline.dataset_manager.extract_features = MagicMock(return_value=None)

        result = pipeline.build_dataset()
        self.assertIsNone(result)


class TestPipelineTrain(unittest.TestCase):
    """Tests for SoundClassificationPipeline.train."""

    def setUp(self):
        os.makedirs("tests/tmp_pipeline_train", exist_ok=True)

    def tearDown(self):
        shutil.rmtree("tests/tmp_pipeline_train", ignore_errors=True)

    def _make_pipeline(self):
        from sound_classifier.pipeline import SoundClassificationPipeline

        return SoundClassificationPipeline(
            api_key="test_key",
            data_dir="tests/tmp_pipeline_train/sounds",
            features_file="tests/tmp_pipeline_train/features.csv",
            model_file="tests/tmp_pipeline_train/model.pkl",
            sound_classes=["dog_bark", "rain"],
            n_per_class=2,
        )

    def test_train_returns_results_dict(self):
        """train() returns a results dict when features are available."""
        from sklearn.datasets import make_classification

        X, y_int = make_classification(
            n_samples=50, n_features=10, n_informative=5,
            n_classes=2, n_clusters_per_class=1, random_state=0
        )
        y = np.array(["dog_bark" if i == 0 else "rain" for i in y_int])

        pipeline = self._make_pipeline()
        pipeline.dataset_manager.load_features = MagicMock(return_value=(X, y))
        pipeline.classifier.save = MagicMock()

        results = pipeline.train()
        self.assertIsNotNone(results)
        self.assertIn("accuracy", results)

    def test_train_returns_none_when_no_features(self):
        """train() returns None when load_features returns (None, None)."""
        pipeline = self._make_pipeline()
        pipeline.dataset_manager.load_features = MagicMock(return_value=(None, None))

        result = pipeline.train()
        self.assertIsNone(result)


class TestPipelineClassifySound(unittest.TestCase):
    """Tests for SoundClassificationPipeline.classify_sound."""

    def setUp(self):
        os.makedirs("tests/tmp_pipeline_classify", exist_ok=True)

    def tearDown(self):
        shutil.rmtree("tests/tmp_pipeline_classify", ignore_errors=True)

    def _make_pipeline(self):
        from sound_classifier.pipeline import SoundClassificationPipeline

        return SoundClassificationPipeline(
            api_key="test_key",
            data_dir="tests/tmp_pipeline_classify/sounds",
            features_file="tests/tmp_pipeline_classify/features.csv",
            model_file="tests/tmp_pipeline_classify/model.pkl",
            sound_classes=["dog_bark", "rain"],
            n_per_class=2,
        )

    def test_classify_sound_with_file_path(self):
        """classify_sound with a file path returns a class and probabilities."""
        pipeline = self._make_pipeline()
        fake_features = np.zeros(37, dtype=np.float32)
        pipeline.feature_extractor.extract_all = MagicMock(
            return_value=fake_features
        )
        pipeline.classifier.predict = MagicMock(return_value="dog_bark")
        pipeline.classifier.predict_proba = MagicMock(
            return_value={"dog_bark": 0.9, "rain": 0.1}
        )

        result = pipeline.classify_sound("some/file.mp3")

        self.assertIsNotNone(result)
        self.assertEqual(result["class"], "dog_bark")
        self.assertIn("probabilities", result)

    def test_classify_sound_with_freesound_id(self):
        """classify_sound with a numeric ID fetches and downloads the sound."""
        pipeline = self._make_pipeline()
        fake_sound = {
            "id": 42,
            "previews": {"preview-hq-mp3": "http://example.com/42.mp3"},
        }
        pipeline.freesound_client.get_sound = MagicMock(return_value=fake_sound)
        pipeline.freesound_client.download_preview = MagicMock(
            return_value="tests/tmp_pipeline_classify/42.mp3"
        )
        fake_features = np.zeros(37, dtype=np.float32)
        pipeline.feature_extractor.extract_all = MagicMock(
            return_value=fake_features
        )
        pipeline.classifier.predict = MagicMock(return_value="rain")
        pipeline.classifier.predict_proba = MagicMock(
            return_value={"dog_bark": 0.2, "rain": 0.8}
        )

        result = pipeline.classify_sound(42)

        pipeline.freesound_client.get_sound.assert_called_once_with(42)
        self.assertEqual(result["class"], "rain")

    def test_classify_sound_returns_none_when_extraction_fails(self):
        """classify_sound returns None when feature extraction fails."""
        pipeline = self._make_pipeline()
        pipeline.feature_extractor.extract_all = MagicMock(return_value=None)

        result = pipeline.classify_sound("bad_file.mp3")
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
