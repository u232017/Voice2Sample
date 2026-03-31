"""Tests for AudioFeatureExtractor."""

import unittest
from unittest.mock import MagicMock, patch

import numpy as np


class TestAudioFeatureExtractorLoadAudio(unittest.TestCase):
    """Tests for AudioFeatureExtractor.load_audio."""

    @patch("sound_classifier.audio_features.ESSENTIA_AVAILABLE", True)
    @patch("sound_classifier.audio_features.es")
    def test_load_audio_returns_array(self, mock_es):
        """load_audio returns the numpy array produced by MonoLoader."""
        from sound_classifier.audio_features import AudioFeatureExtractor

        expected = np.zeros(44100, dtype=np.float32)
        mock_loader_instance = MagicMock(return_value=expected)
        mock_es.MonoLoader.return_value = mock_loader_instance

        extractor = AudioFeatureExtractor()
        result = extractor.load_audio("dummy.mp3")

        np.testing.assert_array_equal(result, expected)
        mock_es.MonoLoader.assert_called_once_with(
            filename="dummy.mp3", sampleRate=44100
        )

    @patch("sound_classifier.audio_features.ESSENTIA_AVAILABLE", False)
    def test_load_audio_raises_when_essentia_missing(self):
        """load_audio raises RuntimeError when Essentia is not installed."""
        from sound_classifier.audio_features import AudioFeatureExtractor

        extractor = AudioFeatureExtractor()
        with self.assertRaises(RuntimeError):
            extractor.load_audio("dummy.mp3")


class TestAudioFeatureExtractorExtractAll(unittest.TestCase):
    """Tests for AudioFeatureExtractor.extract_all."""

    @patch("sound_classifier.audio_features.ESSENTIA_AVAILABLE", True)
    @patch("sound_classifier.audio_features.es")
    def test_extract_all_returns_correct_shape(self, mock_es):
        """extract_all returns a flat numpy array of the expected length."""
        from sound_classifier.audio_features import AudioFeatureExtractor

        # Fake audio signal
        fake_audio = np.random.rand(44100).astype(np.float32)

        extractor = AudioFeatureExtractor()

        # Patch each extraction sub-method so we control the output lengths
        extractor.load_audio = MagicMock(return_value=fake_audio)
        extractor.extract_mfcc = MagicMock(
            return_value=np.zeros(26, dtype=np.float32)
        )
        extractor.extract_spectral_features = MagicMock(
            return_value=np.zeros(8, dtype=np.float32)
        )
        extractor.extract_rhythm_features = MagicMock(
            return_value=np.zeros(3, dtype=np.float32)
        )

        result = extractor.extract_all("dummy.mp3")

        self.assertIsNotNone(result)
        self.assertIsInstance(result, np.ndarray)
        self.assertEqual(result.shape, (37,))

    @patch("sound_classifier.audio_features.ESSENTIA_AVAILABLE", True)
    @patch("sound_classifier.audio_features.es")
    def test_extract_all_returns_none_on_error(self, mock_es):
        """extract_all returns None when an exception is raised during extraction."""
        from sound_classifier.audio_features import AudioFeatureExtractor

        extractor = AudioFeatureExtractor()
        extractor.load_audio = MagicMock(side_effect=Exception("load error"))

        result = extractor.extract_all("bad_file.mp3")
        self.assertIsNone(result)

    @patch("sound_classifier.audio_features.ESSENTIA_AVAILABLE", True)
    @patch("sound_classifier.audio_features.es")
    def test_extract_all_returns_none_for_empty_audio(self, mock_es):
        """extract_all returns None when the loaded audio is empty."""
        from sound_classifier.audio_features import AudioFeatureExtractor

        extractor = AudioFeatureExtractor()
        extractor.load_audio = MagicMock(return_value=np.array([]))

        result = extractor.extract_all("empty.mp3")
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
