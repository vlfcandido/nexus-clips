"""Classificador de momentos usando Claude API.

Analisa o conteúdo (transcrição + visão) e decide:
- Se é um momento relevante pra virar corte/vídeo
- Qual categoria (gol, polêmica, declaração, treta, etc)
- Qual tópico (futebol, política)
- Score de viralidade estimado
"""

from dataclasses import dataclass

import structlog

from config.llm import llm_json
from detection.google_vision import VisionResult
from detection.whisper_transcriber import TranscriptionResult

log = structlog.get_logger()


@dataclass
class MomentClassification:
    is_relevant: bool
    category: str  # gol, polêmica, declaração, treta, análise, humor
    topic: str  # futebol, política, entretenimento
    virality_score: float  # 0-10 estimativa de potencial viral
    summary: str  # Resumo curto do momento
    suggested_title: str  # Título sugerido pro corte
    urgency: str  # high, medium, low — quão rápido precisa postar
    confidence: float  # 0-1


async def classify_moment(
    text: str,
    transcription: TranscriptionResult | None = None,
    vision: VisionResult | None = None,
    source_type: str = "",
) -> MomentClassification:
    """Usa Claude pra classificar se o conteúdo vale um corte."""
    try:
        context_parts = [f"Texto/título: {text}"]
        if transcription:
            context_parts.append(f"Transcrição do áudio: {transcription.full_text[:2000]}")
        if vision:
            context_parts.append(f"Labels do Vision: {', '.join(vision.labels)}")
            context_parts.append(f"Texto na tela (OCR): {vision.text_detected[:500]}")
            context_parts.append(f"Emoções detectadas: {', '.join(vision.emotions)}")
        context_parts.append(f"Fonte: {source_type}")

        context = "\n".join(context_parts)

        data = await llm_json(
            system="Você é um classificador de conteúdo de mídia brasileira. Responda APENAS em JSON.",
            user=f"""Analise este conteúdo de mídia brasileira e classifique:

{context}

Responda APENAS neste formato JSON (sem markdown):
{{
    "is_relevant": true/false,
    "category": "gol|polêmica|declaração|treta|análise|humor|breaking",
    "topic": "futebol|política|entretenimento",
    "virality_score": 0-10,
    "summary": "resumo em 1 frase",
    "suggested_title": "título chamativo pra rede social",
    "urgency": "high|medium|low",
    "confidence": 0.0-1.0
}}

Critérios de viralidade alta (7+): gol importante, polêmica explosiva, fala viral, treta entre figuras públicas.
Critérios de urgência high: eventos ao vivo, breaking news, gol em jogo grande.""",
            max_tokens=500,
        )

        result = MomentClassification(
            is_relevant=data.get("is_relevant", False),
            category=data.get("category", "unknown"),
            topic=data.get("topic", "unknown"),
            virality_score=float(data.get("virality_score", 0)),
            summary=data.get("summary", ""),
            suggested_title=data.get("suggested_title", ""),
            urgency=data.get("urgency", "low"),
            confidence=float(data.get("confidence", 0)),
        )

        log.info(
            "classifier.result",
            relevant=result.is_relevant,
            category=result.category,
            virality=result.virality_score,
            urgency=result.urgency,
        )
        return result

    except Exception as e:
        log.error("classifier.error", error=str(e))
        return MomentClassification(
            is_relevant=False,
            category="error",
            topic="unknown",
            virality_score=0,
            summary="",
            suggested_title="",
            urgency="low",
            confidence=0,
        )
