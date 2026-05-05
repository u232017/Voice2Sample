
const FREESOUND_API_KEY = "fgiQq94kSB0JoBqeZ9M8fLC2oBo1Iub4lthpTu2m"
const FREESOUND_SEARCH_URL = "https://freesound.org/apiv2/search/text/";

function getPreviewUrl(previews) {
  if (!previews) return null;

  return (
    previews["preview-hq-mp3"] ||
    previews["preview-lq-mp3"] ||
    previews["preview-hq-ogg"] ||
    previews["preview-lq-ogg"] ||
    null
  );
}

function getWaveformImageUrl(images) {
  if (!images) return null;

  return (
    images.waveform_m ||
    images.waveform_l ||
    images.waveform_bw_m ||
    images.waveform_bw_l ||
    null
  );
}

function cleanLicense(license) {
  if (!license) return "Unknown";

  const value = license.toLowerCase();

  if (value.includes("zero") || value.includes("cc0")) {
    return "CC0";
  }

  if (value.includes("noncommercial")) {
    return "CC BY-NC";
  }

  if (value.includes("attribution")) {
    return "CC BY";
  }

  return "CC";
}

function guessCategory(name, tags, description) {
  const text = `${name} ${tags.join(" ")} ${description}`.toLowerCase();

  if (text.includes("voice") || text.includes("vocal") || text.includes("speech")) {
    return "Voice";
  }

  if (
    text.includes("synth") ||
    text.includes("pad") ||
    text.includes("lead") ||
    text.includes("bass") ||
    text.includes("pluck")
  ) {
    return "Synth";
  }

  if (
    text.includes("piano") ||
    text.includes("guitar") ||
    text.includes("melody") ||
    text.includes("melodic") ||
    text.includes("chord")
  ) {
    return "Melodic";
  }

  return "Hybrid";
}

function guessTimbre(tags, description) {
  const text = `${tags.join(" ")} ${description}`.toLowerCase();

  if (text.includes("bright") || text.includes("sharp") || text.includes("high")) {
    return "Bright";
  }

  if (text.includes("warm") || text.includes("soft") || text.includes("smooth")) {
    return "Warm";
  }

  if (text.includes("dark") || text.includes("deep") || text.includes("low")) {
    return "Dark";
  }

  if (text.includes("noise") || text.includes("glitch") || text.includes("distortion")) {
    return "Noisy";
  }

  return "Clean";
}

function guessRhythm(tags, description, duration) {
  const text = `${tags.join(" ")} ${description}`.toLowerCase();

  if (text.includes("loop") || text.includes("beat") || text.includes("bpm")) {
    return "Loop";
  }

  if (text.includes("drum") || text.includes("hit") || text.includes("click")) {
    return "Percussive";
  }

  if (duration <= 3) {
    return "One-shot";
  }

  return "Sustained";
}

function buildMeta(tags, description) {
  if (description) {
    const cleanDescription = description.replace(/\n/g, " ").trim();

    return cleanDescription.length > 90
      ? `${cleanDescription.slice(0, 90)}...`
      : cleanDescription;
  }

  if (tags && tags.length > 0) {
    return tags.slice(0, 5).join(" / ");
  }

  return "No description available";
}

async function searchFreesoundSounds(query, pageSize = 4) {
  const params = new URLSearchParams({
    query,
    page_size: String(pageSize),
    fields: "id,name,url,previews,license,duration,tags,description,images",
    token: FREESOUND_API_KEY,
  });

  const response = await fetch(`${FREESOUND_SEARCH_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Freesound request failed");
  }

  const data = await response.json();
  const results = data.results || [];

  return results
    .map((sound, index) => {
      const name = sound.name || "Unknown sound";
      const tags = sound.tags || [];
      const description = sound.description || "";
      const duration = sound.duration || 0;
      const previewUrl = getPreviewUrl(sound.previews);
      const waveformImageUrl = getWaveformImageUrl(sound.images);
      const category = guessCategory(name, tags, description);

      return {
        freesound_id: sound.id,
        name,
        preview_url: previewUrl,
        download_url: previewUrl,
        url: sound.url,
        waveform_image: waveformImageUrl,
        category,
        duration: Number(duration.toFixed(1)),
        license: cleanLicense(sound.license),
        match_score: Math.max(70, 92 - index * 6),
        ui_type: category,
        timbre: guessTimbre(tags, description),
        rhythm: guessRhythm(tags, description, duration),
        meta: buildMeta(tags, description),
      };
    })
    .filter((sample) => sample.preview_url);
}

export async function analyzeAudio(audioData) {
  /*
    Temporary demo version.

    For now:
    - the detected class is simulated
    - confidence is simulated
    - Freesound results are real
    - the audio input is not used for real matching yet
  */

  console.log("Audio sent to analysis:", {
    name: audioData.name,
    trimStart: audioData.trimStart,
    trimEnd: audioData.trimEnd,
  });

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const detectedClass = "Melodic sound";
  const confidence = 0.86;

  const queries = [
    "synth one shot",
    "melodic pluck",
    "piano one shot",
    "vocal texture",
    "percussive hit",
  ];

  let recommendations = [];

  for (const query of queries) {
    try {
      recommendations = await searchFreesoundSounds(query, 4);

      if (recommendations.length > 0) {
        break;
      }
    } catch (error) {
      console.error("Freesound query failed:", query, error);
    }
  }

  return {
    detected_class: detectedClass,
    confidence,
    recommendations,
  };
}