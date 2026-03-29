"""Geração de voz natural pra narração dos cortes.

Usa múltiplos backends:
1. Edge TTS (Microsoft) — grátis, boa qualidade, pt-BR
2. Google Cloud TTS — pago, qualidade premium
3. ElevenLabs — pago, mais natural
"""

import asyncio
from pathlib import Path

import structlog

from config.settings import settings

log = structlog.get_logger()


async def generate_voice(
    text: str,
    output_name: str,
    backend: str = "edge",
    voice: str = "pt-BR-AntonioNeural",
    speed: float = 1.1,
) -> str | None:
    """Gera áudio de voz a partir de texto.

    Backends disponíveis:
    - "edge": Microsoft Edge TTS (grátis, bom pra começar)
    - "google": Google Cloud TTS (precisa de API key)
    - "elevenlabs": ElevenLabs (mais natural, precisa de API key)
    """
    output_dir = settings.clips_output_dir / "voice"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(output_dir / f"{output_name}.mp3")

    if backend == "edge":
        return await _edge_tts(text, output_path, voice, speed)
    elif backend == "google":
        return await _google_tts(text, output_path, voice, speed)
    elif backend == "elevenlabs":
        return await _elevenlabs_tts(text, output_path, voice)
    else:
        log.error("voice.unknown_backend", backend=backend)
        return None


async def _edge_tts(
    text: str, output_path: str, voice: str, speed: float
) -> str | None:
    """Microsoft Edge TTS — grátis e de boa qualidade."""
    try:
        import edge_tts

        rate = f"+{int((speed - 1) * 100)}%" if speed > 1 else f"{int((speed - 1) * 100)}%"
        communicate = edge_tts.Communicate(text, voice, rate=rate)
        await communicate.save(output_path)
        log.info("voice.edge_tts.done", path=output_path, voice=voice)
        return output_path

    except ImportError:
        log.error("voice.edge_tts.not_installed", hint="pip install edge-tts")
        return None
    except Exception as e:
        log.error("voice.edge_tts.error", error=str(e))
        return None


async def _google_tts(
    text: str, output_path: str, voice: str, speed: float
) -> str | None:
    """Google Cloud TTS — alta qualidade, pago."""
    try:
        from google.cloud import texttospeech

        client = texttospeech.TextToSpeechClient()

        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice_config = texttospeech.VoiceSelectionParams(
            language_code="pt-BR",
            name=voice or "pt-BR-Neural2-B",
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speed,
            pitch=0.0,
        )

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.synthesize_speech(
                input=synthesis_input, voice=voice_config, audio_config=audio_config
            ),
        )

        Path(output_path).write_bytes(response.audio_content)
        log.info("voice.google_tts.done", path=output_path)
        return output_path

    except Exception as e:
        log.error("voice.google_tts.error", error=str(e))
        return None


async def _elevenlabs_tts(
    text: str, output_path: str, voice: str
) -> str | None:
    """ElevenLabs TTS — mais natural, pago."""
    try:
        import httpx

        api_key = settings.__dict__.get("elevenlabs_api_key", "")
        if not api_key:
            log.warning("voice.elevenlabs.no_key")
            return None

        voice_id = voice or "21m00Tcm4TlvDq8ikWAM"  # Rachel default

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={"xi-api-key": api_key},
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
                timeout=30,
            )

            if resp.status_code == 200:
                Path(output_path).write_bytes(resp.content)
                log.info("voice.elevenlabs.done", path=output_path)
                return output_path
            else:
                log.error("voice.elevenlabs.api_error", status=resp.status_code)
                return None

    except Exception as e:
        log.error("voice.elevenlabs.error", error=str(e))
        return None


# Vozes disponíveis pra Edge TTS (pt-BR)
EDGE_VOICES = {
    "antonio": "pt-BR-AntonioNeural",   # Masculino, narrador
    "francisca": "pt-BR-FranciscaNeural",  # Feminino, natural
    "humberto": "pt-BR-HumbertoNeural",  # Masculino, formal
    "macerio": "pt-BR-MacerioNeural",    # Masculino, jovem
    "thalita": "pt-BR-ThalitaNeural",    # Feminino, jovem
    "yara": "pt-BR-YaraNeural",          # Feminino, profissional
}
