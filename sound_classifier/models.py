"""Machine learning models for sound classification."""

from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


class SoundClassifier:
    """Wrapper around scikit-learn classifiers for sound classification.

    Supports random forest, SVM, k-NN, and gradient boosting models.
    Feature scaling is applied automatically before training and prediction.
    """

    def __init__(self, model_type: str = "random_forest") -> None:
        """Initialise the classifier.

        Args:
            model_type: One of ``"random_forest"``, ``"svm"``, ``"knn"``,
                or ``"gradient_boost"``.
        """
        self.model_type = model_type
        self.model: Optional[Any] = None
        self.scaler: StandardScaler = StandardScaler()

    def _create_model(self) -> Any:
        """Instantiate the underlying scikit-learn estimator.

        Returns:
            A freshly created, unfitted scikit-learn estimator.

        Raises:
            ValueError: If *model_type* is not recognised.
        """
        if self.model_type == "random_forest":
            return RandomForestClassifier(n_estimators=100, random_state=42)
        if self.model_type == "svm":
            return SVC(kernel="rbf", random_state=42, probability=True)
        if self.model_type == "knn":
            return KNeighborsClassifier(n_neighbors=5)
        if self.model_type == "gradient_boost":
            return GradientBoostingClassifier(n_estimators=100, random_state=42)
        raise ValueError(
            f"Unknown model_type '{self.model_type}'. "
            "Choose from: random_forest, svm, knn, gradient_boost."
        )

    def train(
        self, X: np.ndarray, y: np.ndarray
    ) -> Dict[str, Any]:
        """Train the classifier and evaluate it on a held-out test split.

        Args:
            X: Feature matrix, shape (n_samples, n_features).
            y: Label vector, shape (n_samples,).

        Returns:
            Dictionary with keys ``"accuracy"``, ``"report"``, and
            ``"model_type"``.
        """
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )
        self.model = self._create_model()
        self.model.fit(X_train, y_train)
        accuracy = self.model.score(X_test, y_test)
        report = classification_report(y_test, self.model.predict(X_test))
        return {
            "accuracy": accuracy,
            "report": report,
            "model_type": self.model_type,
        }

    def predict(self, features: np.ndarray) -> str:
        """Predict the class label for a single sample.

        Args:
            features: 1-D numpy array of feature values.

        Returns:
            Predicted class label as a string.

        Raises:
            RuntimeError: If the model has not been trained yet.
        """
        if self.model is None:
            raise RuntimeError("Model has not been trained. Call train() first.")
        scaled = self.scaler.transform(features.reshape(1, -1))
        return str(self.model.predict(scaled)[0])

    def predict_proba(self, features: np.ndarray) -> Dict[str, float]:
        """Return class probabilities for a single sample.

        Args:
            features: 1-D numpy array of feature values.

        Returns:
            Dictionary mapping class name to probability.

        Raises:
            RuntimeError: If the model has not been trained yet.
            AttributeError: If the underlying model does not support
                ``predict_proba``.
        """
        if self.model is None:
            raise RuntimeError("Model has not been trained. Call train() first.")
        scaled = self.scaler.transform(features.reshape(1, -1))
        proba = self.model.predict_proba(scaled)[0]
        return dict(zip(self.model.classes_, proba.tolist()))

    def save(self, file_path: str) -> None:
        """Persist the trained model, scaler, and class list to disk.

        Args:
            file_path: Destination path for the joblib dump.

        Raises:
            RuntimeError: If the model has not been trained yet.
        """
        if self.model is None:
            raise RuntimeError("Model has not been trained. Call train() first.")
        joblib.dump((self.model, self.scaler, self.model.classes_), file_path)
        print(f"Model saved to '{file_path}'.")

    def load(self, file_path: str) -> None:
        """Restore a previously saved model from disk.

        Args:
            file_path: Path to a joblib dump created by :meth:`save`.
        """
        self.model, self.scaler, classes_ = joblib.load(file_path)
        self.model.classes_ = classes_
        print(f"Model loaded from '{file_path}'.")
