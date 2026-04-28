from freesound_api import search_freesound_sounds


def get_queries_from_class(detected_class):
    detected_class = detected_class.lower()

    if "voice" in detected_class or "vocal" in detected_class:
        return [
            "vocal",
            "voice",
            "vocal one shot",
            "speech"
        ]

    if "synth" in detected_class:
        return [
            "synth",
            "synth one shot",
            "lead synth",
            "pad synth"
        ]

    if "melodic" in detected_class:
        return [
            "piano",
            "melodic",
            "pluck",
            "piano one shot",
            "synth"
        ]

    if "hybrid" in detected_class or "percussive" in detected_class:
        return [
            "drum",
            "percussion",
            "click",
            "fx hit"
        ]

    return [
        "sound",
        "synth",
        "piano"
    ]


def run_real_analysis(raw_bytes):
    """
    Temporary version:
    - detected_class and confidence are still simulated
    - Freesound results are real
    """

    detected_class = "Melodic sound"
    confidence = 0.86

    recommended_samples = []

    queries = get_queries_from_class(detected_class)

    for query in queries:
        try:
            recommended_samples = search_freesound_sounds(query=query, page_size=4)
            if recommended_samples:
                break
        except Exception:
            continue

    return detected_class, confidence, recommended_samples