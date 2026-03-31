"""Freesound API client for searching and downloading sounds."""

import os
from typing import Dict, List, Optional

import requests


class FreesoundClient:
    """Client for interacting with the Freesound API.

    Provides methods to search for sounds, download previews, and
    retrieve individual sound metadata.
    """

    def __init__(self, api_key: str) -> None:
        """Initialize the client with an API key.

        Args:
            api_key: Freesound API authentication token.
        """
        self.api_key = api_key
        self.base_url = "https://freesound.org/apiv2"

    def search_sounds(
        self,
        query: str,
        num_results: int = 10,
        fields: str = "id,name,previews,tags,duration",
    ) -> List[Dict]:
        """Search for sounds using a text query.

        Args:
            query: Text query to search for.
            num_results: Maximum number of results to return.
            fields: Comma-separated list of fields to include in results.

        Returns:
            List of sound dictionaries from the API response.

        Raises:
            requests.exceptions.RequestException: On HTTP or network errors.
        """
        url = f"{self.base_url}/search/text/"
        params = {
            "query": query,
            "fields": fields,
            "page_size": num_results,
            "token": self.api_key,
        }
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            return data.get("results", [])
        except requests.exceptions.RequestException as exc:
            print(f"Error searching sounds for '{query}': {exc}")
            return []

    def download_preview(self, sound: Dict, output_dir: str) -> Optional[str]:
        """Download the high-quality MP3 preview of a sound.

        Args:
            sound: Sound dictionary containing 'id' and 'previews' fields.
            output_dir: Directory where the file will be saved.

        Returns:
            Path to the saved file, or None on failure.
        """
        try:
            sound_id = sound["id"]
            preview_url = sound["previews"]["preview-hq-mp3"]
            os.makedirs(output_dir, exist_ok=True)
            file_path = os.path.join(output_dir, f"{sound_id}.mp3")
            response = requests.get(preview_url, timeout=60, stream=True)
            response.raise_for_status()
            with open(file_path, "wb") as fh:
                for chunk in response.iter_content(chunk_size=8192):
                    fh.write(chunk)
            return file_path
        except (requests.exceptions.RequestException, KeyError, OSError) as exc:
            print(f"Error downloading preview for sound {sound.get('id')}: {exc}")
            return None

    def get_sound(self, sound_id: int) -> Optional[Dict]:
        """Retrieve metadata for a specific sound by ID.

        Args:
            sound_id: Numeric Freesound sound identifier.

        Returns:
            Sound metadata dictionary, or None on failure.
        """
        url = f"{self.base_url}/sounds/{sound_id}/"
        params = {"token": self.api_key}
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as exc:
            print(f"Error fetching sound {sound_id}: {exc}")
            return None
