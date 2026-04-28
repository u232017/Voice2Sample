#fgiQq94kSB0JoBqeZ9M8fLC2oBo1Iub4lthpTu2m
import re
import requests

API_KEY = "fgiQq94kSB0JoBqeZ9M8fLC2oBo1Iub4lthpTu2m"
BASE_URL = "https://freesound.org/apiv2/search/text/"


def normalize_text(text):
    if not text:
        return ""
    return text.strip().replace("\n", " ").replace("\r", " ")


def guess_category(name, tags, description):
    text = f"{name} {' '.join(tags)} {description}".lower()

    if any(word in text for word in ["voice", "vocal", "speech", "sing", "mouth"]):
        return "Voice"
    if any(word in text for word in ["synth", "pad", "lead", "bass", "pluck"]):
        return "Synth"
    if any(word in text for word in ["melodic", "piano", "guitar", "string", "chord"]):
        return "Melodic"
    if any(word in text for word in ["perc", "drum", "kick", "snare", "click", "hat"]):
        return "Hybrid"

    return "Hybrid"


def clean_license(license_value):
    if not license_value:
        return "Unknown"

    license_lower = license_value.lower()

    if "zero" in license_lower or "cc0" in license_lower:
        return "CC0"
    if "by" in license_lower and "nc" in license_lower and "sa" in license_lower:
        return "CC BY-NC-SA"
    if "by" in license_lower and "nc" in license_lower:
        return "CC BY-NC"
    if "by" in license_lower and "sa" in license_lower:
        return "CC BY-SA"
    if "attribution" in license_lower or "by" in license_lower:
        return "CC BY"

    return license_value


def build_meta(tags, description):
    description = normalize_text(description)

    if description:
        return description[:90] + ("..." if len(description) > 90 else "")

    if tags:
        clean_tags = []
        for tag in tags:
            tag = normalize_text(tag)
            if tag and tag.lower() not in clean_tags:
                clean_tags.append(tag.lower())

        pretty_tags = [tag for tag in tags if normalize_text(tag)]
        return " / ".join(pretty_tags[:4])

    return "No description available"


def normalize_name_for_dedup(name):
    name = normalize_text(name).lower()
    name = re.sub(r"\.(wav|mp3|aiff|aif|flac|ogg)$", "", name)
    name = re.sub(r"\b\d+\b", "", name)
    name = re.sub(r"[_\-]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def search_freesound_sounds(query, page_size=4):
    params = {
        "query": query,
        "page_size": max(page_size * 3, 12),
        "fields": "id,name,url,previews,license,duration,tags,description",
        "token": API_KEY,
    }

    response = requests.get(BASE_URL, params=params, timeout=20)
    response.raise_for_status()

    data = response.json()
    results = data.get("results", [])

    mapped_results = []
    seen_names = set()

    for sound in results:
        name = sound.get("name", "Unknown sound")
        tags = sound.get("tags", [])
        description = sound.get("description", "") or ""
        category = guess_category(name, tags, description)
        previews = sound.get("previews", {})

        preview_url = (
            previews.get("preview-hq-mp3")
            or previews.get("preview-lq-mp3")
            or previews.get("preview-hq-ogg")
            or previews.get("preview-lq-ogg")
        )

        # Si no tiene preview, no nos interesa para la app
        if not preview_url:
            continue

        dedup_key = normalize_name_for_dedup(name)
        if dedup_key in seen_names:
            continue
        seen_names.add(dedup_key)

        mapped_results.append(
            {
                "freesound_id": sound.get("id"),
                "name": name,
                "preview_url": preview_url,
                "download_url": preview_url,
                "url": sound.get("url"),
                "category": category,
                "duration": sound.get("duration"),
                "license": clean_license(sound.get("license")),
                "match_score": 0,   # se rellena luego
                "ui_type": category,
                "meta": build_meta(tags, description),
            }
        )

    # Ajustar match_score después de filtrar
    for idx, item in enumerate(mapped_results):
        item["match_score"] = max(65, 92 - idx * 6)

    return mapped_results[:page_size]