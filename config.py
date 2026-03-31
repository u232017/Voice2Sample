"""Configuration settings for the Sound Classifier application."""

FREESOUND_API_KEY = ""  # User must fill in their API key
FREESOUND_BASE_URL = "https://freesound.org/apiv2"
DATA_DIR = "data/sounds"
FEATURES_FILE = "data/features.csv"
MODEL_FILE = "data/model.pkl"
SOUND_CLASSES = ["dog_bark", "rain", "music", "speech", "silence"]
N_SOUNDS_PER_CLASS = 10
SAMPLE_RATE = 44100
