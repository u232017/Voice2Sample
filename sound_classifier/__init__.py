"""Sound Classifier package."""

from sound_classifier.freesound_client import FreesoundClient
from sound_classifier.audio_features import AudioFeatureExtractor
from sound_classifier.dataset import DatasetManager
from sound_classifier.models import SoundClassifier
from sound_classifier.pipeline import SoundClassificationPipeline

__all__ = [
    "FreesoundClient",
    "AudioFeatureExtractor",
    "DatasetManager",
    "SoundClassifier",
    "SoundClassificationPipeline",
]
