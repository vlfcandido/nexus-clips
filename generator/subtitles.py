"""Gerador de legendas word-by-word estilo TikTok.

Usa Whisper pra transcrever o áudio TTS e gerar legendas
sincronizadas palavra por palavra — como creators profissionais.

Estilo: 1-3 palavras por vez, texto grande, centralizado,
palavra atual destacada em cor.
"""

import asyncio
from pathlib import Path

import structlog

log = structlog.get_logger()

# Cache do modelo Whisper (carrega uma vez)
_whisper_model = None


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        _whisper_model = whisper.load_model("tiny")  # tiny = rápido, suficiente pra TTS
        log.info("whisper.loaded", model="tiny")
    return _whisper_model


async def generate_word_subtitles(
    audio_path: str,
    output_path: str,
    accent_color: str = "#FFFFFF",
    highlight_color: str = "#FFD700",
    font_size: int = 56,
    words_per_group: int = 3,
) -> str | None:
    """Gera arquivo .ass com legendas word-by-word a partir do áudio.

    1. Transcreve com Whisper (word_timestamps=True)
    2. Agrupa palavras em grupos de 2-3
    3. Gera .ass com timing preciso por grupo
    4. Estilo: texto grande centralizado, highlight na palavra atual
    """
    try:
        loop = asyncio.get_event_loop()
        segments = await loop.run_in_executor(None, _transcribe_words, audio_path)

        if not segments:
            log.warning("subtitles.no_words")
            return None

        # Agrupa palavras em grupos de N
        groups = _group_words(segments, words_per_group)

        # Gera .ass
        ass_content = _build_ass(groups, accent_color, highlight_color, font_size)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(ass_content, encoding='utf-8')

        log.info("subtitles.generated", path=output_path, groups=len(groups))
        return output_path

    except Exception as e:
        log.error("subtitles.error", error=str(e))
        return None


def _transcribe_words(audio_path: str) -> list[dict]:
    """Transcreve áudio com Whisper e retorna palavras com timestamps."""
    model = _get_whisper()
    result = model.transcribe(
        audio_path,
        language="pt",
        word_timestamps=True,
        verbose=False,
    )

    words = []
    for segment in result.get("segments", []):
        for word_info in segment.get("words", []):
            words.append({
                "word": word_info["word"].strip(),
                "start": word_info["start"],
                "end": word_info["end"],
            })

    log.info("subtitles.transcribed", words=len(words))
    return words


def _group_words(words: list[dict], per_group: int) -> list[dict]:
    """Agrupa palavras em grupos de N pra legibilidade."""
    groups = []
    for i in range(0, len(words), per_group):
        chunk = words[i:i + per_group]
        if not chunk:
            continue
        groups.append({
            "text": " ".join(w["word"] for w in chunk),
            "start": chunk[0]["start"],
            "end": chunk[-1]["end"],
        })
    return groups


def _build_ass(groups: list[dict], accent: str, highlight: str, font_size: int) -> str:
    """Gera arquivo .ass com estilo TikTok — texto grande centralizado."""
    # Converte hex colors pra ASS format (&HBBGGRR)
    def hex_to_ass(hex_color: str) -> str:
        h = hex_color.lstrip('#')
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"&H00{b:02X}{g:02X}{r:02X}"

    primary = hex_to_ass(accent)
    outline_color = "&H00000000"  # Preto

    ass = f"""[Script Info]
Title: NexusClips Word-by-Word
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Arial,{font_size},{primary},&H000000FF,{outline_color},&H80000000,-1,0,0,0,100,100,2,0,1,4,2,2,40,40,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    for g in groups:
        start = _fmt_time(g["start"])
        end = _fmt_time(g["end"])
        text = g["text"].upper()  # Maiúsculas pra impacto visual
        ass += f"Dialogue: 0,{start},{end},Word,,0,0,0,,{text}\n"

    return ass


def _fmt_time(seconds: float) -> str:
    """Formata tempo pra ASS: H:MM:SS.CC"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
