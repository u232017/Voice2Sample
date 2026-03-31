"""Tests for FreesoundClient."""

import os
import unittest
from io import BytesIO
from unittest.mock import MagicMock, patch

from sound_classifier.freesound_client import FreesoundClient


class TestFreesoundClientSearchSounds(unittest.TestCase):
    """Tests for FreesoundClient.search_sounds."""

    def setUp(self):
        self.client = FreesoundClient(api_key="test_key")

    @patch("sound_classifier.freesound_client.requests.get")
    def test_search_sounds_returns_results(self, mock_get):
        """search_sounds returns the 'results' list from the API response."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"id": 1, "name": "dog_bark_1"},
                {"id": 2, "name": "dog_bark_2"},
            ]
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        results = self.client.search_sounds("dog_bark", num_results=2)

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["id"], 1)

    @patch("sound_classifier.freesound_client.requests.get")
    def test_search_sounds_calls_correct_url(self, mock_get):
        """search_sounds sends a GET request to the text-search endpoint."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        self.client.search_sounds("rain", num_results=5)

        called_url = mock_get.call_args[0][0]
        self.assertIn("/search/text/", called_url)

    @patch("sound_classifier.freesound_client.requests.get")
    def test_search_sounds_includes_token(self, mock_get):
        """search_sounds includes the API key as a 'token' query parameter."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        self.client.search_sounds("rain")

        params = mock_get.call_args[1]["params"]
        self.assertEqual(params["token"], "test_key")

    @patch("sound_classifier.freesound_client.requests.get")
    def test_search_sounds_returns_empty_on_error(self, mock_get):
        """search_sounds returns [] when a request exception occurs."""
        import requests as req
        mock_get.side_effect = req.exceptions.RequestException("network error")

        results = self.client.search_sounds("rain")
        self.assertEqual(results, [])


class TestFreesoundClientDownloadPreview(unittest.TestCase):
    """Tests for FreesoundClient.download_preview."""

    def setUp(self):
        self.client = FreesoundClient(api_key="test_key")

    @patch("sound_classifier.freesound_client.requests.get")
    def test_download_preview_saves_file(self, mock_get):
        """download_preview writes content to disk and returns file path."""
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.iter_content.return_value = [b"audio_data"]
        mock_get.return_value = mock_response

        sound = {"id": 42, "previews": {"preview-hq-mp3": "http://example.com/42.mp3"}}
        output_dir = "tests/tmp_download"
        os.makedirs(output_dir, exist_ok=True)

        try:
            file_path = self.client.download_preview(sound, output_dir)
            self.assertIsNotNone(file_path)
            self.assertTrue(file_path.endswith("42.mp3"))
            self.assertTrue(os.path.exists(file_path))
        finally:
            # Cleanup
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
            if os.path.isdir(output_dir):
                os.rmdir(output_dir)

    @patch("sound_classifier.freesound_client.requests.get")
    def test_download_preview_returns_none_on_error(self, mock_get):
        """download_preview returns None when the request fails."""
        import requests as req
        mock_get.side_effect = req.exceptions.RequestException("fail")

        sound = {"id": 99, "previews": {"preview-hq-mp3": "http://example.com/99.mp3"}}
        result = self.client.download_preview(sound, "tests/nowhere")
        self.assertIsNone(result)


class TestFreesoundClientGetSound(unittest.TestCase):
    """Tests for FreesoundClient.get_sound."""

    def setUp(self):
        self.client = FreesoundClient(api_key="test_key")

    @patch("sound_classifier.freesound_client.requests.get")
    def test_get_sound_returns_dict(self, mock_get):
        """get_sound returns the sound metadata dict."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": 7, "name": "test_sound"}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = self.client.get_sound(7)
        self.assertEqual(result["id"], 7)

    @patch("sound_classifier.freesound_client.requests.get")
    def test_get_sound_calls_correct_url(self, mock_get):
        """get_sound hits the /sounds/{id}/ endpoint."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": 7}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        self.client.get_sound(7)
        called_url = mock_get.call_args[0][0]
        self.assertIn("/sounds/7/", called_url)

    @patch("sound_classifier.freesound_client.requests.get")
    def test_get_sound_returns_none_on_error(self, mock_get):
        """get_sound returns None when a request exception occurs."""
        import requests as req
        mock_get.side_effect = req.exceptions.RequestException("fail")

        result = self.client.get_sound(7)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
