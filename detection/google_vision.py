"""Análise de frames com Google Cloud Vision API."""

import asyncio
import io
from dataclasses import dataclass
from pathlib import Path

import structlog

log = structlog.get_logger()


@dataclass
class VisionResult:
    """Resultado da análise de um frame."""

    labels: list[str]  # O que o Vision detectou (ex: "soccer", "crowd", "goal")
    text_detected: str  # OCR — texto na tela (placar, legenda de TV)
    faces_count: int  # Quantidade de rostos
    emotions: list[str]  # Emoções detectadas (joy, anger, surprise)
    confidence: float  # Confiança geral
    is_relevant: bool  # Se o frame parece relevante pro corte
    raw: dict  # Resposta completa da API


async def analyze_frame(image_path: str) -> VisionResult | None:
    """Analisa um frame de vídeo com Google Cloud Vision."""
    try:
        from google.cloud import vision

        client = vision.ImageAnnotatorClient()

        with open(image_path, "rb") as f:
            content = f.read()

        image = vision.Image(content=content)

        # Roda múltiplas detecções em paralelo
        label_resp = client.label_detection(image=image, max_results=15)
        text_resp = client.text_detection(image=image)
        face_resp = client.face_detection(image=image)

        # Labels
        labels = [l.description.lower() for l in label_resp.label_annotations]

        # OCR
        texts = text_resp.text_annotations
        text_detected = texts[0].description if texts else ""

        # Faces + emoções
        faces = face_resp.face_annotations
        emotions = []
        for face in faces:
            if face.joy_likelihood >= 3:
                emotions.append("joy")
            if face.anger_likelihood >= 3:
                emotions.append("anger")
            if face.surprise_likelihood >= 3:
                emotions.append("surprise")
            if face.sorrow_likelihood >= 3:
                emotions.append("sorrow")

        # Determina relevância
        relevant_labels = {
            "soccer", "football", "goal", "stadium", "crowd", "celebration",
            "sports", "athlete", "ball", "match", "competition",
            "protest", "politician", "speech", "microphone", "podium",
            "news", "television", "broadcast",
        }
        found_relevant = set(labels) & relevant_labels
        is_relevant = len(found_relevant) >= 2

        confidence = max(
            (l.score for l in label_resp.label_annotations if l.description.lower() in relevant_labels),
            default=0.0,
        )

        result = VisionResult(
            labels=labels,
            text_detected=text_detected,
            faces_count=len(faces),
            emotions=emotions,
            confidence=confidence,
            is_relevant=is_relevant,
            raw={"labels": labels, "text": text_detected[:200]},
        )

        log.info(
            "vision.analyzed",
            labels=labels[:5],
            text=text_detected[:50],
            faces=len(faces),
            relevant=is_relevant,
        )
        return result

    except Exception as e:
        log.error("vision.error", error=str(e))
        return None


async def extract_frames(video_path: str, interval_seconds: int = 5) -> list[str]:
    """Extrai frames de um vídeo a cada N segundos usando ffmpeg."""
    output_dir = Path(video_path).parent / "frames"
    output_dir.mkdir(exist_ok=True)
    output_pattern = str(output_dir / "frame_%04d.jpg")

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-i", video_path,
        "-vf", f"fps=1/{interval_seconds}",
        "-q:v", "2",
        output_pattern,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()

    frames = sorted(str(f) for f in output_dir.glob("frame_*.jpg"))
    log.info("vision.frames_extracted", count=len(frames), interval=interval_seconds)
    return frames
