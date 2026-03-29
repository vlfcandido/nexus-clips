"""Transcrição de áudio com OpenAI Whisper (local)."""

import asyncio
from dataclasses import dataclass
from pathlib import Path

import structlog

from config.settings import settings

log = structlog.get_logger()


@dataclass
class TranscriptionSegment:
    start: float  # segundos
    end: float
    text: str


@dataclass
class TranscriptionResult:
    full_text: str
    language: str
    segments: list[TranscriptionSegment]


_model = None


def _get_model():
    global _model
    if _model is None:
        import whisper
        _model = whisper.load_model(settings.whisper_model)
        log.info("whisper.model_loaded", model=settings.whisper_model)
    return _model


async def transcribe(audio_path: str) -> TranscriptionResult | None:
    """Transcreve áudio/vídeo com Whisper. Roda em thread pra não bloquear."""
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _transcribe_sync, audio_path)
        return result
    except Exception as e:
        log.error("whisper.error", error=str(e))
        return None


def _transcribe_sync(audio_path: str) -> TranscriptionResult:
    model = _get_model()

    result = model.transcribe(
        audio_path,
        language="pt",
        task="transcribe",
        verbose=False,
    )

    segments = [
        TranscriptionSegment(
            start=seg["start"],
            end=seg["end"],
            text=seg["text"].strip(),
        )
        for seg in result.get("segments", [])
    ]

    transcription = TranscriptionResult(
        full_text=result["text"].strip(),
        language=result.get("language", "pt"),
        segments=segments,
    )

    log.info(
        "whisper.transcribed",
        length=len(transcription.full_text),
        segments=len(segments),
        language=transcription.language,
    )
    return transcription


async def extract_audio(video_path: str) -> str | None:
    """Extrai áudio de um vídeo usando ffmpeg."""
    output_path = str(Path(video_path).with_suffix(".wav"))

    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le",
        "-ar", "16000", "-ac", "1",
        "-y", output_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()

    if proc.returncode == 0:
        log.info("whisper.audio_extracted", path=output_path)
        return output_path
    return None
