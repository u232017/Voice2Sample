from __future__ import annotations

import json
from pathlib import Path
from urllib.request import Request, urlopen
import mimetypes
import uuid

API_URL = "http://127.0.0.1:8000/api/recommendations"

AUDIO_DIR = Path("audiospruebas")

OUTPUT_FILE = Path("backend/melodic_similarity_report.txt")


def build_multipart_form(fields, files):

    boundary = uuid.uuid4().hex
    lines = []

    for name, value in fields:
        lines.append(f"--{boundary}".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"'.encode()
        )
        lines.append(b"")
        lines.append(str(value).encode())

    for field_name, filename, data, content_type in files:
        lines.append(f"--{boundary}".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode()
        )
        lines.append(f"Content-Type: {content_type}".encode())
        lines.append(b"")
        lines.append(data)

    lines.append(f"--{boundary}--".encode())
    lines.append(b"")

    body = b"\r\n".join(lines)

    return body, boundary


def send_audio(audio_path):

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    content_type = (
        mimetypes.guess_type(audio_path.name)[0]
        or "application/octet-stream"
    )

    fields = [
        ("focus", "melodic"),
        ("limit", "1")
    ]

    files = [
        (
            "audio",
            audio_path.name,
            audio_bytes,
            content_type
        )
    ]

    body, boundary = build_multipart_form(fields, files)

    headers = {
        "Content-Type":
            f"multipart/form-data; boundary={boundary}"
    }

    request = Request(
        API_URL,
        data=body,
        headers=headers
    )

    with urlopen(request) as response:
        return json.loads(
            response.read().decode("utf-8")
        )


def main():

    if not AUDIO_DIR.exists():
        print(f"No existe carpeta: {AUDIO_DIR}")
        return

    audio_files = [
        p for p in AUDIO_DIR.iterdir()
        if p.suffix.lower() in
        [".wav", ".mp3", ".flac", ".ogg", ".m4a"]
    ]

    report = []

    for audio_path in audio_files:

        print(f"Evaluando: {audio_path.name}")

        try:

            response = send_audio(audio_path)

            results = response.get("results", [])

            if not results:

                report.append(
                    f"{audio_path.name} -> SIN RESULTADOS"
                )

                continue

            top = results[0]

            line = (
                f"QUERY={audio_path.name} | "
                f"MATCH={top.get('id')} | "
                f"SIMILARITY={top.get('similarity')} | "
                f"DISTANCE={top.get('distance')}"
            )

            print(line)

            report.append(line)

        except Exception as e:

            error_line = (
                f"{audio_path.name} -> ERROR: {str(e)}"
            )

            print(error_line)

            report.append(error_line)

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    OUTPUT_FILE.write_text(
        "\n".join(report),
        encoding="utf-8"
    )

    print(f"\nInforme guardado en:")
    print(OUTPUT_FILE)


if __name__ == "__main__":
    main()