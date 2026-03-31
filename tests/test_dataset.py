"""Tests for DatasetManager."""

import os
import shutil
import tempfile
import unittest
from unittest.mock import MagicMock

import numpy as np
import pandas as pd


class TestDatasetManagerDownloadSounds(unittest.TestCase):
    """Tests for DatasetManager.download_sounds."""

    def setUp(self):
        self.test_dir = "tests/tmp_dataset"
        self.features_file = os.path.join(self.test_dir, "features.csv")
        os.makedirs(self.test_dir, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _make_manager(self):
        from sound_classifier.dataset import DatasetManager
        return DatasetManager(
            data_dir=os.path.join(self.test_dir, "sounds"),
            features_file=self.features_file,
        )

    def test_download_sounds_calls_search_and_download(self):
        """download_sounds calls search_sounds and download_preview for each class."""
        manager = self._make_manager()
        mock_client = MagicMock()
        mock_client.search_sounds.return_value = [
            {"id": 1, "name": "s1", "previews": {}, "duration": 3.0},
        ]
        mock_client.download_preview.return_value = "/fake/path/1.mp3"

        result = manager.download_sounds(mock_client, ["dog_bark", "rain"], n_per_class=1)

        self.assertEqual(mock_client.search_sounds.call_count, 2)
        self.assertEqual(mock_client.download_preview.call_count, 2)
        self.assertIn("dog_bark", result)
        self.assertIn("rain", result)

    def test_download_sounds_skips_failed_downloads(self):
        """download_sounds skips sounds whose download returns None."""
        manager = self._make_manager()
        mock_client = MagicMock()
        mock_client.search_sounds.return_value = [
            {"id": 1, "name": "s1", "previews": {}, "duration": 3.0},
        ]
        mock_client.download_preview.return_value = None  # simulate failure

        result = manager.download_sounds(mock_client, ["silence"], n_per_class=1)
        self.assertEqual(result["silence"], [])


class TestDatasetManagerExtractFeatures(unittest.TestCase):
    """Tests for DatasetManager.extract_features."""

    def setUp(self):
        self.test_dir = "tests/tmp_dataset_feat"
        self.features_file = os.path.join(self.test_dir, "features.csv")
        os.makedirs(self.test_dir, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _make_manager(self):
        from sound_classifier.dataset import DatasetManager
        return DatasetManager(
            data_dir=os.path.join(self.test_dir, "sounds"),
            features_file=self.features_file,
        )

    def test_extract_features_builds_dataframe(self):
        """extract_features returns a DataFrame with a 'label' column."""
        manager = self._make_manager()
        mock_extractor = MagicMock()
        mock_extractor.extract_all.return_value = np.zeros(37, dtype=np.float32)

        sound_files = {
            "dog_bark": ["a.mp3", "b.mp3"],
            "rain": ["c.mp3"],
        }
        df = manager.extract_features(mock_extractor, sound_files)

        self.assertIsNotNone(df)
        self.assertIn("label", df.columns)
        self.assertEqual(len(df), 3)
        self.assertEqual(mock_extractor.extract_all.call_count, 3)

    def test_extract_features_returns_none_when_all_fail(self):
        """extract_features returns None when all extractions fail."""
        manager = self._make_manager()
        mock_extractor = MagicMock()
        mock_extractor.extract_all.return_value = None

        df = manager.extract_features(mock_extractor, {"dog_bark": ["a.mp3"]})
        self.assertIsNone(df)

    def test_extract_features_saves_csv(self):
        """extract_features saves a CSV to the features_file path."""
        manager = self._make_manager()
        mock_extractor = MagicMock()
        mock_extractor.extract_all.return_value = np.ones(37, dtype=np.float32)

        manager.extract_features(mock_extractor, {"rain": ["r.mp3"]})
        self.assertTrue(os.path.exists(self.features_file))


class TestDatasetManagerLoadFeatures(unittest.TestCase):
    """Tests for DatasetManager.load_features."""

    def setUp(self):
        self.test_dir = "tests/tmp_dataset_load"
        self.features_file = os.path.join(self.test_dir, "features.csv")
        os.makedirs(self.test_dir, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _make_manager(self):
        from sound_classifier.dataset import DatasetManager
        return DatasetManager(
            data_dir=os.path.join(self.test_dir, "sounds"),
            features_file=self.features_file,
        )

    def test_load_features_returns_X_y(self):
        """load_features returns X array and y label array from CSV."""
        df = pd.DataFrame(
            {
                "feature_0": [0.1, 0.2],
                "feature_1": [0.3, 0.4],
                "label": ["dog_bark", "rain"],
            }
        )
        df.to_csv(self.features_file, index=False)

        manager = self._make_manager()
        X, y = manager.load_features()

        self.assertIsNotNone(X)
        self.assertIsNotNone(y)
        self.assertEqual(X.shape, (2, 2))
        self.assertEqual(list(y), ["dog_bark", "rain"])

    def test_load_features_returns_none_if_missing(self):
        """load_features returns (None, None) when file does not exist."""
        manager = self._make_manager()
        X, y = manager.load_features()
        self.assertIsNone(X)
        self.assertIsNone(y)


if __name__ == "__main__":
    unittest.main()
