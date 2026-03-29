"""Nós do grafo LangGraph — cada nó é uma etapa do pipeline.

CONCEITO LANGGRAPH:
- Cada nó é uma função async que recebe State e retorna dict parcial
- O retorno é automaticamente mergeado no state
- Nós podem ser funções simples ou chains do LangChain
- Edges conectam os nós e podem ter condições (branching)
"""

import time
import uuid

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import JsonOutputParser

from agents.state import ContentState
from config.settings import settings

log = structlog.get_logger()


# ==================== LLM SETUP ====================

def get_llm(temperature: float = 0.3):
    """Retorna LLM via LangChain — usa Groq (grátis) ou Claude (pago).

    CONCEITO LANGCHAIN:
    - ChatGroq e ChatAnthropic implementam a mesma interface
    - Trocar de provider é só mudar o wrapper — o resto do código não muda
    - Isso é o poder da abstração do LangChain: vendor-agnostic
    """
    if settings.groq_api_key:
        from langchain_groq import ChatGroq
        log.debug("llm.provider", provider="groq", model=settings.ai_model)
        return ChatGroq(
            model=settings.ai_model,
            api_key=settings.groq_api_key,
            temperature=temperature,
            max_tokens=600,
        )

    if settings.anthropic_api_key:
        from langchain_anthropic import ChatAnthropic
        log.debug("llm.provider", provider="anthropic")
        return ChatAnthropic(
            model="claude-sonnet-4-6",
            anthropic_api_key=settings.anthropic_api_key,
            temperature=temperature,
            max_tokens=600,
        )

    raise RuntimeError("Nenhuma API key configurada (GROQ_API_KEY ou ANTHROPIC_API_KEY)")


# ==================== NÓ: CLASSIFY ====================

async def classify_node(state: ContentState) -> dict:
    """Nó que classifica o conteúdo usando LangChain.

    CONCEITO LANGCHAIN:
    - SystemMessage define o comportamento do LLM
    - HumanMessage é o input do usuário
    - JsonOutputParser parseia a saída como JSON
    - Chain: messages → LLM → parser (composição com |)
    """
    uid = state.get("uid", str(uuid.uuid4())[:8])
    start = time.monotonic()
    log.info("node.classify.start", uid=uid)

    # Carrega prompt do DB (editavel pelo Pedro no frontend)
    from config.prompts import get_prompt
    prompt_cfg = await get_prompt("classify")

    llm = get_llm(temperature=prompt_cfg.temperature)
    parser = JsonOutputParser()
    chain = llm | parser

    context = f"Texto: {state.get('source_text', '')}\nFonte: {state.get('source_type', '')}\nAutor: {state.get('source_author', '')}"
    try:
        user_text = prompt_cfg.user_template.format(context=context)
    except (KeyError, IndexError):
        user_text = f"{context}\n\n{prompt_cfg.user_template}"

    messages = [
        SystemMessage(content=prompt_cfg.system_prompt),
        HumanMessage(content=user_text),
    ]

    try:
        result = await chain.ainvoke(messages)

        elapsed = time.monotonic() - start
        log.info(
            "node.classify.done",
            uid=uid,
            relevant=result.get("is_relevant"),
            category=result.get("category"),
            virality=result.get("virality_score"),
            elapsed_ms=round(elapsed * 1000),
        )

        return {
            "is_relevant": result.get("is_relevant", False),
            "category": result.get("category", "unknown"),
            "topic": result.get("topic", "unknown"),
            "virality_score": float(result.get("virality_score", 0)),
            "urgency": result.get("urgency", "low"),
            "summary": result.get("summary", ""),
            "suggested_title": result.get("suggested_title", ""),
            "classification_confidence": float(result.get("confidence", 0)),
        }

    except Exception as e:
        log.error("node.classify.error", uid=uid, error=str(e))
        return {"is_relevant": False, "error": str(e), "skip_reason": "classification_failed"}


# ==================== NÓ: STRATEGIZE ====================

async def strategize_node(state: ContentState) -> dict:
    """Nó que decide a estratégia de conteúdo.

    CONCEITO LANGCHAIN:
    - Prompt templates podem ser dinâmicos
    - O LLM recebe contexto rico e decide a melhor abordagem
    """
    uid = state.get("uid", "")
    start = time.monotonic()
    log.info("node.strategize.start", uid=uid, topic=state.get("topic"))

    from config.prompts import get_prompt
    prompt_cfg = await get_prompt("strategy")

    llm = get_llm(temperature=prompt_cfg.temperature)
    parser = JsonOutputParser()
    chain = llm | parser

    has_video = bool(state.get("source_media_url"))
    template_vars = {
        "category": state.get("category", ""),
        "topic": state.get("topic", ""),
        "virality_score": state.get("virality_score", 0),
        "urgency": state.get("urgency", "low"),
        "summary": state.get("summary", ""),
        "has_video": str(has_video),
        "source_type": state.get("source_type", ""),
    }
    try:
        user_text = prompt_cfg.user_template.format(**template_vars)
    except (KeyError, IndexError):
        user_text = str(template_vars)

    messages = [
        SystemMessage(content=prompt_cfg.system_prompt),
        HumanMessage(content=user_text),
    ]

    try:
        result = await chain.ainvoke(messages)

        elapsed = time.monotonic() - start
        log.info(
            "node.strategize.done",
            uid=uid,
            format=result.get("format_type"),
            platform=result.get("primary_platform"),
            elapsed_ms=round(elapsed * 1000),
        )

        return {
            "format_type": result.get("format_type", "narrated_news"),
            "duration_target": result.get("duration_target", 60),
            "primary_platform": result.get("primary_platform", "tiktok"),
            "secondary_platforms": result.get("secondary_platforms", []),
            "use_voice": result.get("use_voice", True),
            "voice_style": result.get("voice_style", "narrador"),
            "needs_anti_strike": result.get("needs_anti_strike", True),
            "optimal_post_time": result.get("optimal_post_time", "21:00"),
            "estimated_views": result.get("estimated_views", 5000),
            "estimated_revenue": result.get("estimated_revenue", 0),
            "strategy_reasoning": result.get("reasoning", ""),
        }

    except Exception as e:
        log.error("node.strategize.error", uid=uid, error=str(e))
        return {
            "format_type": "narrated_news",
            "primary_platform": "tiktok",
            "secondary_platforms": ["instagram"],
            "use_voice": True,
            "error": str(e),
        }


# ==================== NÓ: GENERATE CAPTION ====================

async def caption_node(state: ContentState) -> dict:
    """Nó que gera captions otimizadas por plataforma.

    CONCEITO LANGCHAIN:
    - Podemos rodar múltiplas chains em paralelo com asyncio
    - Cada plataforma recebe um prompt customizado
    """
    uid = state.get("uid", "")
    start = time.monotonic()
    log.info("node.caption.start", uid=uid)

    llm = get_llm(temperature=0.7)  # Mais criativo pra captions
    parser = JsonOutputParser()
    chain = llm | parser

    platforms = [state.get("primary_platform", "tiktok")] + state.get("secondary_platforms", [])
    captions = {}

    for platform in platforms[:4]:
        try:
            messages = [
                SystemMessage(content=f"Gere caption viral pra {platform}. PT-BR informal. Responda em JSON."),
                HumanMessage(content=f"""Conteúdo: {state.get('summary', '')}
Categoria: {state.get('category', '')}
Tema: {state.get('topic', '')}

JSON: {{"title": "título", "caption": "descrição", "hashtags": ["#tag"], "hook": "gancho", "cta": "call to action"}}"""),
            ]
            result = await chain.ainvoke(messages)
            captions[platform] = result
        except Exception as e:
            log.error("node.caption.platform_error", uid=uid, platform=platform, error=str(e))
            captions[platform] = {
                "title": state.get("suggested_title", ""),
                "caption": state.get("summary", ""),
                "hashtags": [f"#{state.get('topic', 'brasil')}"],
                "hook": "",
                "cta": "Segue pra mais!",
            }

    elapsed = time.monotonic() - start
    log.info("node.caption.done", uid=uid, platforms=list(captions.keys()), elapsed_ms=round(elapsed * 1000))

    return {"captions": captions}


# ==================== NÓ: GROWTH ====================

async def growth_node(state: ContentState) -> dict:
    """Nó que gera estratégia de crescimento do canal.

    CONCEITO LANGCHAIN:
    - Um nó pode chamar outro serviço ou módulo existente
    - Aqui integramos com o módulo growth.py que já existia
    """
    uid = state.get("uid", "")
    log.info("node.growth.start", uid=uid)

    from strategy.growth import generate_growth_plan

    plan = await generate_growth_plan(
        content_summary=state.get("summary", ""),
        topic=state.get("topic", ""),
        category=state.get("category", ""),
        current_phase="zero",
        platform=state.get("primary_platform", "tiktok"),
    )

    log.info("node.growth.done", uid=uid, hook=plan.hook_text[:40], series=plan.series_name)

    return {
        "hook_text": plan.hook_text,
        "cta_text": plan.cta_text,
        "engagement_question": plan.engagement_question,
        "growth_hashtags": plan.trending_hashtags + plan.niche_hashtags + plan.branded_hashtags,
        "series_name": plan.series_name or "",
    }


# ==================== NÓ: CHANNELS ====================

async def channels_node(state: ContentState) -> dict:
    """Nó que decide em quais canais publicar e adapta o conteúdo.

    CONCEITO LANGGRAPH:
    - Nós podem enriquecer o state com informações de múltiplas fontes
    - O state acumula dados ao longo do grafo
    """
    uid = state.get("uid", "")
    log.info("node.channels.start", uid=uid, topic=state.get("topic"))

    from strategy.channels import get_channels_for_content, adapt_content_for_channel

    channels = get_channels_for_content(
        topic=state.get("topic", ""),
        bias_hint="neutro",
    )

    target_ids = [ch.id for ch in channels]
    adaptations = {}

    for ch in channels:
        if ch.bias != "neutro":
            # Adapta conteúdo pra canais com viés
            adapted = await adapt_content_for_channel(
                content_summary=state.get("summary", ""),
                original_caption=state.get("captions", {}).get(
                    state.get("primary_platform", "tiktok"), {}
                ).get("caption", ""),
                channel=ch,
            )
            adaptations[ch.id] = adapted

    log.info("node.channels.done", uid=uid, channels=target_ids, adaptations=list(adaptations.keys()))

    return {
        "target_channels": target_ids,
        "channel_adaptations": adaptations,
    }


# ==================== NÓ: GENERATE VIDEO ====================

async def generate_video_node(state: ContentState) -> dict:
    """Nó que gera o vídeo (voz + ffmpeg).

    CONCEITO LANGGRAPH:
    - Este nó faz trabalho pesado (I/O, ffmpeg) mas é async
    - O state acumula os paths dos arquivos gerados
    """
    uid = state.get("uid", "")
    log.info("node.generate_video.start", uid=uid, format=state.get("format_type"))

    from generator.video_builder import generate_narrated_video

    # Monta texto de narração combinando hook + summary
    hook = state.get("hook_text", "")
    summary = state.get("summary", "")
    narration = f"{hook}. {summary}" if hook else summary
    # Remove emojis e caracteres non-latin que Edge TTS não processa
    import re
    narration = re.sub(r'[^\w\s.,!?;:\-\'\"áàâãéèêíìîóòôõúùûçÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]', '', narration).strip()
    log.info("node.generate_video.narration", uid=uid, text=narration[:100])

    # Escolhe voz pelo estilo
    voice_map = {
        "narrador": "pt-BR-AntonioNeural",
        "informal": "pt-BR-MacerioNeural",
        "urgente": "pt-BR-HumbertoNeural",
        "humoristico": "pt-BR-ThalitaNeural",
    }
    voice = voice_map.get(state.get("voice_style", "narrador"), "pt-BR-AntonioNeural")

    result = await generate_narrated_video(
        title=state.get("suggested_title", state.get("summary", "")[:60]),
        summary=state.get("summary", ""),
        narration_text=narration,
        source=state.get("source_author", state.get("source_type", "")),
        category=state.get("category", "breaking"),
        topic=state.get("topic", "guerra"),
        output_name=uid,
        voice=voice,
    )

    if result:
        log.info(
            "node.generate_video.done",
            uid=uid,
            video=result["video_path"],
            duration=round(result["duration"], 1),
        )
        return {
            "clip_path": result["video_path"],
            "voice_path": result["voice_path"],
            "duration_target": int(result["duration"]),
        }

    log.warning("node.generate_video.failed", uid=uid)
    return {}


# ==================== NÓ: SAVE ====================

async def save_node(state: ContentState) -> dict:
    """Nó que salva o resultado no banco de dados."""
    uid = state.get("uid", "")
    log.info("node.save.start", uid=uid)

    from db.database import async_session
    from db.models import Clip

    primary_caption = state.get("captions", {}).get(
        state.get("primary_platform", "tiktok"), {}
    )

    # Converte paths absolutos pra URLs relativas (/media/...)
    clip_path = state.get("clip_path", "")
    if clip_path:
        from pathlib import Path
        rel = Path(clip_path).relative_to(settings.clips_output_dir)
        clip_path = f"/media/{rel}"

    thumb_path = state.get("thumbnail_path", "")
    if thumb_path:
        from pathlib import Path
        rel = Path(thumb_path).relative_to(settings.clips_output_dir)
        thumb_path = f"/media/{rel}"

    async with async_session() as session:
        clip = Clip(
            source_type=state.get("source_type", ""),
            source_url=state.get("source_url", ""),
            source_id=state.get("source_id", ""),
            topic=state.get("topic", ""),
            category=state.get("category", ""),
            moment_text=state.get("summary", ""),
            confidence=state.get("classification_confidence", 0),
            clip_path=clip_path,
            thumbnail_path=thumb_path,
            duration_seconds=state.get("duration_target", 60),
            caption=primary_caption.get("caption", state.get("summary", "")),
            hashtags=" ".join(primary_caption.get("hashtags", [])),
        )
        session.add(clip)
        await session.commit()
        clip_id = clip.id

    log.info("node.save.done", uid=uid, clip_id=clip_id)
    return {"db_clip_id": clip_id, "published": False}
