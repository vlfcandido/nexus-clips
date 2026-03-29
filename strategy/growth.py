"""Growth Strategy — estratégias pra crescer canais do zero.

Canais novos precisam de táticas específicas pra ganhar tração:
1. Volume alto (algoritmo favorece consistência)
2. Trend jacking (surfar trends do momento)
3. Engagement bait (perguntas, polêmicas controladas)
4. Cross-posting inteligente (adaptar por plataforma)
5. Hashtag strategy (mix de populares + nichados)
6. Horários de pico (quando tem mais gente online)
7. Séries/formatos recorrentes (cria expectativa)
"""

from dataclasses import dataclass

import anthropic
import structlog

from config.settings import settings

log = structlog.get_logger()


@dataclass
class GrowthPlan:
    """Plano de crescimento pra um conteúdo específico."""
    # Volume
    posts_per_day: int
    platforms_priority: list[str]  # ordem de prioridade

    # Engajamento
    hook_text: str  # frase de abertura pra prender
    cta_text: str  # call to action pro final
    engagement_question: str  # pergunta pra gerar comentários
    controversial_angle: str  # ângulo polêmico (sem fake news)

    # Hashtags
    trending_hashtags: list[str]  # tags do momento
    niche_hashtags: list[str]  # tags do nicho
    branded_hashtags: list[str]  # tags próprias (#NexusClips, etc)

    # Formato
    ideal_duration: int  # segundos
    use_text_overlay: bool  # texto grande na tela
    use_trending_sound: bool  # som trending (TikTok)
    thumbnail_style: str  # "clickbait", "clean", "meme"

    # Série
    series_name: str | None  # ex: "Resumo da Guerra em 60s"
    episode_number: int | None

    reasoning: str


# Estratégias por fase de crescimento
GROWTH_PHASES = {
    "zero": {
        "followers": "0-1k",
        "strategy": "Volume máximo + trend jacking. Postar 5-10x/dia. Surfar TODA trend quente.",
        "posts_per_day": 8,
        "focus": "Ganhar primeiros seguidores com conteúdo que já tem demanda.",
    },
    "early": {
        "followers": "1k-10k",
        "strategy": "Séries recorrentes + nicho. Criar identidade. 3-5 posts/dia.",
        "posts_per_day": 5,
        "focus": "Fidelizar audiência com formato reconhecível.",
    },
    "growing": {
        "followers": "10k-100k",
        "strategy": "Qualidade > quantidade. Otimizar por dados. 2-4 posts/dia.",
        "posts_per_day": 3,
        "focus": "Maximizar views por post. Monetização.",
    },
    "established": {
        "followers": "100k+",
        "strategy": "Manter consistência. Expandir pra novas plataformas.",
        "posts_per_day": 2,
        "focus": "Receita e autoridade.",
    },
}

# Séries pré-definidas que funcionam bem
SERIES_TEMPLATES = {
    "guerra": [
        "Resumo da Guerra em 60s",
        "O que aconteceu hoje no conflito",
        "Mapa da guerra — atualização diária",
        "Declaração polêmica do dia",
    ],
    "futebol": [
        "Gol do dia",
        "Polêmica da rodada",
        "Resumo da rodada em 60s",
        "Lance mais bizarro da semana",
    ],
    "política": [
        "Político disse o quê?!",
        "Resumo político do dia",
        "O que o congresso fez hoje",
        "Debate em 60 segundos",
    ],
}


async def generate_growth_plan(
    content_summary: str,
    topic: str,
    category: str,
    current_phase: str = "zero",
    platform: str = "tiktok",
) -> GrowthPlan:
    """Gera plano de crescimento específico pra este conteúdo."""
    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

        phase = GROWTH_PHASES.get(current_phase, GROWTH_PHASES["zero"])
        series = SERIES_TEMPLATES.get(topic, [])

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[
                {
                    "role": "user",
                    "content": f"""Você é um growth hacker de redes sociais brasileiro.
Canal NOVO (fase: {current_phase}, {phase['followers']} seguidores).
Estratégia da fase: {phase['strategy']}

Conteúdo: {content_summary}
Tema: {topic}
Categoria: {category}
Plataforma: {platform}

Séries disponíveis: {series}

Gere um plano de crescimento pra este post. Responda APENAS em JSON:
{{
    "hook_text": "frase de abertura que prende em 2s (PT-BR, informal)",
    "cta_text": "call to action pro final",
    "engagement_question": "pergunta pra gerar comentários",
    "controversial_angle": "ângulo polêmico SEM fake news",
    "trending_hashtags": ["#tag1", "#tag2"],
    "niche_hashtags": ["#tag1", "#tag2"],
    "branded_hashtags": ["#NexusClips"],
    "ideal_duration": 30-90,
    "use_text_overlay": true/false,
    "thumbnail_style": "clickbait|clean|meme",
    "series_name": "nome da série ou null",
    "reasoning": "por que essa estratégia"
}}

REGRAS:
- PT-BR informal, gírias ok
- Hooks que geram curiosidade ou indignação
- CTAs que pedem follow/like/comentário
- Perguntas que dividem opinião (gera comentários = algoritmo empurra)
- Hashtags: 3 trending + 3 nicho + 1 branded""",
                }
            ],
        )

        import json
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(raw)

        plan = GrowthPlan(
            posts_per_day=phase["posts_per_day"],
            platforms_priority=["tiktok", "instagram", "youtube", "twitter"],
            hook_text=data.get("hook_text", ""),
            cta_text=data.get("cta_text", "Segue pra mais!"),
            engagement_question=data.get("engagement_question", ""),
            controversial_angle=data.get("controversial_angle", ""),
            trending_hashtags=data.get("trending_hashtags", []),
            niche_hashtags=data.get("niche_hashtags", []),
            branded_hashtags=data.get("branded_hashtags", ["#NexusClips"]),
            ideal_duration=data.get("ideal_duration", 60),
            use_text_overlay=data.get("use_text_overlay", True),
            use_trending_sound=platform == "tiktok",
            thumbnail_style=data.get("thumbnail_style", "clickbait"),
            series_name=data.get("series_name"),
            episode_number=None,
            reasoning=data.get("reasoning", ""),
        )

        log.info(
            "growth.plan_generated",
            phase=current_phase,
            topic=topic,
            hook=plan.hook_text[:50],
            series=plan.series_name,
        )
        return plan

    except Exception as e:
        log.error("growth.error", error=str(e))
        return GrowthPlan(
            posts_per_day=GROWTH_PHASES[current_phase]["posts_per_day"],
            platforms_priority=["tiktok", "instagram", "youtube", "twitter"],
            hook_text="Você não vai acreditar no que aconteceu...",
            cta_text="Segue pra mais conteúdo como esse!",
            engagement_question="O que você acha? Comenta aí!",
            controversial_angle="",
            trending_hashtags=[],
            niche_hashtags=[f"#{topic}"],
            branded_hashtags=["#NexusClips"],
            ideal_duration=60,
            use_text_overlay=True,
            use_trending_sound=False,
            thumbnail_style="clickbait",
            series_name=None,
            episode_number=None,
            reasoning="Fallback padrão",
        )
