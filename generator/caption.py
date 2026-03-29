"""Geração de captions virais e títulos otimizados com Claude."""

import structlog

from config.llm import llm_json

log = structlog.get_logger()


async def generate_caption(
    summary: str,
    category: str,
    topic: str,
    platform: str = "tiktok",
    tone: str = "viral",
) -> dict:
    """Gera caption otimizada pra cada plataforma.

    Retorna: {
        "title": "Título principal",
        "caption": "Descrição/caption",
        "hashtags": ["#tag1", "#tag2"],
        "hook": "Primeira frase (gancho pra prender)",
        "cta": "Call to action",
    }
    """
    try:
        platform_hints = {
            "tiktok": "Máximo 150 chars no título. Hashtags relevantes (5-8). Tom informal, BR, gírias ok. Gancho forte nos primeiros 2 segundos.",
            "instagram": "Caption mais longa ok (até 2200 chars). 20-30 hashtags. Mix de populares + nichados. CTA pro engajamento.",
            "youtube": "Título SEO-friendly (até 100 chars). Descrição com keywords. 3-5 hashtags. Tom mais profissional.",
            "twitter": "Máximo 280 chars total. 2-3 hashtags máx. Direto ao ponto. Controverso = mais RT.",
        }

        result = await llm_json(
            system="Você é um copywriter viral brasileiro. Responda APENAS em JSON.",
            user=f"""Gere uma caption viral pra esta postagem:

Conteúdo: {summary}
Categoria: {category}
Tema: {topic}
Plataforma: {platform}
Tom: {tone}

Dicas pra {platform}: {platform_hints.get(platform, '')}

Responda APENAS em JSON (sem markdown):
{{
    "title": "título chamativo",
    "caption": "caption completa",
    "hashtags": ["#tag1", "#tag2"],
    "hook": "primeira frase gancho",
    "cta": "call to action"
}}

REGRAS:
- Português BR, informal
- Gancho que prende em 2 segundos
- Polêmico mas sem fake news
- Emojis com moderação
- Hashtags relevantes pro nicho""",
            max_tokens=500,
        )
        log.info("caption.generated", platform=platform, title=result.get("title", "")[:50])
        return result

    except Exception as e:
        log.error("caption.error", error=str(e))
        return {
            "title": summary[:100],
            "caption": summary,
            "hashtags": [f"#{topic}", f"#{category}"],
            "hook": summary[:50],
            "cta": "Segue pra mais!",
        }


async def generate_multi_platform_captions(
    summary: str,
    category: str,
    topic: str,
) -> dict[str, dict]:
    """Gera captions otimizadas pra todas as plataformas de uma vez."""
    import asyncio

    platforms = ["tiktok", "instagram", "youtube", "twitter"]
    results = await asyncio.gather(*[
        generate_caption(summary, category, topic, platform=p)
        for p in platforms
    ])

    return dict(zip(platforms, results))
