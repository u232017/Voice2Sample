"""Entry point for the Sound Classifier application."""

import sys
from config import (FREESOUND_API_KEY, DATA_DIR, FEATURES_FILE, MODEL_FILE,
                    SOUND_CLASSES, N_SOUNDS_PER_CLASS)
from sound_classifier.pipeline import SoundClassificationPipeline
from sound_classifier.gui import SoundClassifierGUI


def main():
    """Initialize the pipeline and launch the GUI."""
    pipeline = SoundClassificationPipeline(
        api_key=FREESOUND_API_KEY,
        data_dir=DATA_DIR,
        features_file=FEATURES_FILE,
        model_file=MODEL_FILE,
        sound_classes=SOUND_CLASSES,
        n_per_class=N_SOUNDS_PER_CLASS
    )
    gui = SoundClassifierGUI(pipeline)
    gui.run()


if __name__ == "__main__":
    main()
