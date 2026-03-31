"""Audio feature extraction using Essentia."""

from typing import Optional

import numpy as np

es = None
try:
    import essentia.standard as es  # type: ignore[no-redef]
    ESSENTIA_AVAILABLE = True
except ImportError:
    ESSENTIA_AVAILABLE = False
    print(
        "Warning: Essentia is not installed. "
        "Audio feature extraction will not be available."
    )


class AudioFeatureExtractor:
    """Extracts audio features from sound files using Essentia.

    Supports MFCC, spectral, and rhythm feature extraction.
    All features are concatenated into a single flat numpy array.
    """

    def __init__(self, sample_rate: int = 44100) -> None:
        """Initialize the extractor with the desired sample rate.

        Args:
            sample_rate: Target sample rate for audio loading.
        """
        self.sample_rate = sample_rate

    def load_audio(self, file_path: str) -> Optional[np.ndarray]:
        """Load an audio file as a mono waveform.

        Args:
            file_path: Path to the audio file.

        Returns:
            1-D numpy array of audio samples, or None on failure.
        """
        if not ESSENTIA_AVAILABLE:
            raise RuntimeError("Essentia is not installed.")
        try:
            loader = es.MonoLoader(filename=file_path, sampleRate=self.sample_rate)
            audio = loader()
            return audio
        except Exception as exc:
            print(f"Error loading audio '{file_path}': {exc}")
            return None

    def extract_mfcc(self, audio: np.ndarray) -> np.ndarray:
        """Extract MFCC features from an audio array.

        Computes frame-level MFCCs (13 coefficients) and returns the
        per-coefficient mean and standard deviation as a flat array.

        Args:
            audio: 1-D numpy array of audio samples.

        Returns:
            Numpy array of length 26 (mean + std for 13 coefficients).
        """
        mfcc_extractor = es.MFCC(
            frameSize=2048,
            hopSize=1024,
            numberCoefficients=13,
            sampleRate=self.sample_rate,
        )
        w = es.Windowing(type="hann")
        spectrum = es.Spectrum()

        mfcc_frames = []
        for frame in es.FrameGenerator(audio, frameSize=2048, hopSize=1024):
            _, mfcc_coeffs = mfcc_extractor(spectrum(w(frame)))
            mfcc_frames.append(mfcc_coeffs)

        mfcc_matrix = np.array(mfcc_frames)
        return np.concatenate([mfcc_matrix.mean(axis=0), mfcc_matrix.std(axis=0)])

    def extract_spectral_features(self, audio: np.ndarray) -> np.ndarray:
        """Extract spectral features from an audio array.

        Computes SpectralCentroidTime, RollOff, Flux, and ZeroCrossingRate
        per frame, then returns [mean, std] for each descriptor.

        Args:
            audio: 1-D numpy array of audio samples.

        Returns:
            Numpy array of length 8 (mean + std for 4 descriptors).
        """
        centroid_extractor = es.SpectralCentroidTime(sampleRate=self.sample_rate)
        rolloff_extractor = es.RollOff()
        flux_extractor = es.Flux()
        zcr_extractor = es.ZeroCrossingRate()
        w = es.Windowing(type="hann")
        spectrum = es.Spectrum()

        centroids, rolloffs, fluxes, zcrs = [], [], [], []
        for frame in es.FrameGenerator(audio, frameSize=2048, hopSize=1024):
            windowed = w(frame)
            spec = spectrum(windowed)
            centroids.append(centroid_extractor(windowed))
            rolloffs.append(rolloff_extractor(spec))
            fluxes.append(flux_extractor(spec))
            zcrs.append(zcr_extractor(frame))

        features = []
        for values in (centroids, rolloffs, fluxes, zcrs):
            arr = np.array(values)
            features.extend([arr.mean(), arr.std()])
        return np.array(features)

    def extract_rhythm_features(self, audio: np.ndarray) -> np.ndarray:
        """Extract rhythm features from an audio array.

        Args:
            audio: 1-D numpy array of audio samples.

        Returns:
            Numpy array of [bpm, beats_confidence, onset_rate].
        """
        rhythm_extractor = es.RhythmExtractor2013()
        bpm, _, beats_confidence, _, _ = rhythm_extractor(audio)
        onset_rate_extractor = es.OnsetRate()
        onset_rate, _ = onset_rate_extractor(audio)
        return np.array([bpm, beats_confidence, onset_rate])

    def extract_all(self, file_path: str) -> Optional[np.ndarray]:
        """Extract all features from an audio file and concatenate them.

        Combines MFCC (26), spectral (8), and rhythm (3) features into a
        single array of length 37.

        Args:
            file_path: Path to the audio file.

        Returns:
            Flat numpy array of all features, or None on any error.
        """
        try:
            audio = self.load_audio(file_path)
            if audio is None or len(audio) == 0:
                return None
            mfcc = self.extract_mfcc(audio)
            spectral = self.extract_spectral_features(audio)
            rhythm = self.extract_rhythm_features(audio)
            return np.concatenate([mfcc, spectral, rhythm])
        except Exception as exc:
            print(f"Error extracting features from '{file_path}': {exc}")
            return None
