"""Tests for SoundClassifier."""

import os
import shutil
import unittest

import numpy as np
from sklearn.datasets import make_classification


def _make_xy(n_samples=100, n_features=37, n_classes=3):
    """Generate a synthetic classification dataset."""
    X, y_int = make_classification(
        n_samples=n_samples,
        n_features=n_features,
        n_informative=10,
        n_classes=n_classes,
        n_clusters_per_class=1,
        random_state=42,
    )
    classes = ["dog_bark", "rain", "music"]
    y = np.array([classes[i] for i in y_int])
    return X.astype(np.float32), y


class TestSoundClassifierTrain(unittest.TestCase):
    """Tests for SoundClassifier.train."""

    def test_train_returns_accuracy_dict(self):
        """train() returns a dict with accuracy, report, and model_type."""
        from sound_classifier.models import SoundClassifier

        X, y = _make_xy()
        clf = SoundClassifier(model_type="random_forest")
        result = clf.train(X, y)

        self.assertIn("accuracy", result)
        self.assertIn("report", result)
        self.assertIn("model_type", result)
        self.assertIsInstance(result["accuracy"], float)
        self.assertGreaterEqual(result["accuracy"], 0.0)
        self.assertLessEqual(result["accuracy"], 1.0)

    def test_train_all_model_types(self):
        """train() works for all four supported model types."""
        from sound_classifier.models import SoundClassifier

        X, y = _make_xy()
        for mtype in ["random_forest", "svm", "knn", "gradient_boost"]:
            clf = SoundClassifier(model_type=mtype)
            result = clf.train(X, y)
            self.assertIn("accuracy", result, f"Failed for model_type={mtype}")

    def test_train_invalid_model_type_raises(self):
        """_create_model raises ValueError for unknown model_type."""
        from sound_classifier.models import SoundClassifier

        clf = SoundClassifier(model_type="unknown_model")
        with self.assertRaises(ValueError):
            clf._create_model()


class TestSoundClassifierPredict(unittest.TestCase):
    """Tests for SoundClassifier.predict and predict_proba."""

    def _trained_clf(self):
        from sound_classifier.models import SoundClassifier
        X, y = _make_xy()
        clf = SoundClassifier(model_type="random_forest")
        clf.train(X, y)
        return clf

    def test_predict_returns_string(self):
        """predict() returns a string label."""
        clf = self._trained_clf()
        X, _ = _make_xy(n_samples=1)
        result = clf.predict(X[0])
        self.assertIsInstance(result, str)

    def test_predict_proba_returns_dict(self):
        """predict_proba() returns a dict with float probabilities."""
        clf = self._trained_clf()
        X, _ = _make_xy(n_samples=1)
        proba = clf.predict_proba(X[0])
        self.assertIsInstance(proba, dict)
        self.assertTrue(all(isinstance(v, float) for v in proba.values()))

    def test_predict_without_training_raises(self):
        """predict() raises RuntimeError if the model hasn't been trained."""
        from sound_classifier.models import SoundClassifier

        clf = SoundClassifier()
        dummy = np.zeros(37, dtype=np.float32)
        with self.assertRaises(RuntimeError):
            clf.predict(dummy)


class TestSoundClassifierSaveLoad(unittest.TestCase):
    """Tests for SoundClassifier.save and .load roundtrip."""

    def setUp(self):
        self.tmp_dir = "tests/tmp_model"
        os.makedirs(self.tmp_dir, exist_ok=True)
        self.model_path = os.path.join(self.tmp_dir, "model.pkl")

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_save_load_roundtrip(self):
        """Loaded model produces the same predictions as the original."""
        from sound_classifier.models import SoundClassifier

        X, y = _make_xy()
        clf = SoundClassifier(model_type="random_forest")
        clf.train(X, y)
        clf.save(self.model_path)

        clf2 = SoundClassifier()
        clf2.load(self.model_path)

        sample = X[0]
        pred1 = clf.predict(sample)
        pred2 = clf2.predict(sample)
        self.assertEqual(pred1, pred2)

    def test_save_without_training_raises(self):
        """save() raises RuntimeError if called before training."""
        from sound_classifier.models import SoundClassifier

        clf = SoundClassifier()
        with self.assertRaises(RuntimeError):
            clf.save(self.model_path)


if __name__ == "__main__":
    unittest.main()
