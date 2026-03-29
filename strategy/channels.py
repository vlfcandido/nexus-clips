"""Gestão de canais múltiplos — cada canal tem identidade, tom e público-alvo.

Estratégia: múltiplos canais por tema e viés político.
Ex: "guerra_news", "copa_clips", "politica_direita", "politica_esquerda"

Cada canal tem:
- Nome e identidade visual
- Tom de voz (formal, informal, polêmico, neutro)
- Viés editorial (direita, esquerda, neutro)
- Plataformas onde publica
- Hashtags padrão
- Métricas separadas
"""

from dataclasses import dataclass, field

import structlog

from config.llm import llm_json

log = structlog.get_logger()


@dataclass
class Channel:
    """Definição de um canal de publicação."""
    id: str  # ex: "guerra_news"
    name: str  # ex: "Guerra Agora"
    topic: str  # guerra, futebol, política
    bias: str  # "direita", "esquerda", "neutro"
    tone: str  # "urgente", "informal", "polêmico", "analítico"
    platforms: list[str]  # ["tiktok", "instagram", "youtube"]
    default_hashtags: list[str] = field(default_factory=list)
    voice_id: str = "pt-BR-AntonioNeural"  # voz padrão do canal
    description: str = ""
    active: bool = True


# Canais pré-configurados
DEFAULT_CHANNELS: list[Channel] = [
    # === GUERRA ===
    Channel(
        id="guerra_news",
        name="Guerra Agora",
        topic="guerra",
        bias="neutro",
        tone="urgente",
        platforms=["tiktok", "instagram", "youtube", "twitter"],
        default_hashtags=["#guerra", "#urgente", "#ultimahora", "#geopolitica"],
        voice_id="pt-BR-HumbertoNeural",
        description="Cobertura em tempo real de conflitos mundiais",
    ),

    # === FUTEBOL ===
    Channel(
        id="futebol_clips",
        name="Gol a Gol",
        topic="futebol",
        bias="neutro",
        tone="informal",
        platforms=["tiktok", "instagram", "youtube"],
        default_hashtags=["#futebol", "#gol", "#copadomundo", "#futebolbrasileiro"],
        voice_id="pt-BR-MacerioNeural",
        description="Melhores momentos e polêmicas do futebol",
    ),

    # === POLÍTICA — DIREITA ===
    Channel(
        id="politica_direita",
        name="Brasil Livre News",
        topic="política",
        bias="direita",
        tone="polêmico",
        platforms=["tiktok", "instagram", "youtube", "twitter"],
        default_hashtags=["#brasil", "#politica", "#liberdade", "#direita"],
        voice_id="pt-BR-AntonioNeural",
        description="Notícias políticas com perspectiva conservadora/liberal",
    ),

    # === POLÍTICA — ESQUERDA ===
    Channel(
        id="politica_esquerda",
        name="Povo Informa",
        topic="política",
        bias="esquerda",
        tone="polêmico",
        platforms=["tiktok", "instagram", "youtube", "twitter"],
        default_hashtags=["#brasil", "#politica", "#democracia", "#justicasocial"],
        voice_id="pt-BR-FranciscaNeural",
        description="Notícias políticas com perspectiva progressista/popular",
    ),

    # === TRENDING / GERAL ===
    Channel(
        id="trending_br",
        name="Viralizou BR",
        topic="trending",
        bias="neutro",
        tone="informal",
        platforms=["tiktok", "instagram"],
        default_hashtags=["#viral", "#brasil", "#trending", "#fyp"],
        voice_id="pt-BR-ThalitaNeural",
        description="Tudo que está viralizando agora no Brasil",
    ),
]


def get_channel(channel_id: str) -> Channel | None:
    """Busca canal por ID."""
    for ch in DEFAULT_CHANNELS:
        if ch.id == channel_id:
            return ch
    return None


def get_channels_for_topic(topic: str) -> list[Channel]:
    """Retorna todos os canais ativos pra um tópico."""
    return [ch for ch in DEFAULT_CHANNELS if ch.topic == topic and ch.active]


def get_channels_for_content(topic: str, bias_hint: str = "neutro") -> list[Channel]:
    """Decide em quais canais publicar um conteúdo.

    Conteúdo político vai pra AMBOS os canais (direita e esquerda),
    adaptando o tom e ângulo pra cada público.
    """
    channels = []

    for ch in DEFAULT_CHANNELS:
        if not ch.active:
            continue

        # Trending pega tudo
        if ch.id == "trending_br":
            channels.append(ch)
            continue

        # Match por tópico
        if ch.topic == topic:
            channels.append(ch)

    log.info(
        "channels.matched",
        topic=topic,
        channels=[c.id for c in channels],
    )
    return channels


async def adapt_content_for_channel(
    content_summary: str,
    original_caption: str,
    channel: Channel,
) -> dict:
    """Adapta o conteúdo (caption, tom, hashtags) pro canal específico.

    Ex: mesma notícia política, mas com tom diferente pra direita vs esquerda.
    """
    try:
        bias_instructions = {
            "direita": "Tom conservador/liberal. Valorize liberdade individual, economia de mercado, segurança, valores tradicionais. Critique excesso de estado, burocracia, impostos.",
            "esquerda": "Tom progressista/popular. Valorize justiça social, direitos trabalhistas, igualdade, serviços públicos. Critique desigualdade, privilégios, concentração de renda.",
            "neutro": "Tom informativo e equilibrado. Apresente os fatos sem viés claro.",
        }

        data = await llm_json(
            system="Você é um editor de conteúdo que adapta posts pra diferentes canais e públicos. Responda APENAS em JSON.",
            user=f"""Adapte este conteúdo pro canal "{channel.name}".

Conteúdo original: {content_summary}
Caption original: {original_caption}

Canal: {channel.name}
Tom: {channel.tone}
Viés: {bias_instructions.get(channel.bias, bias_instructions['neutro'])}

Responda em JSON:
{{
    "caption": "caption adaptada pro público do canal",
    "hook": "gancho de abertura",
    "hashtags": ["#tag1", "#tag2"],
    "controversial_take": "opinião que gera engajamento (sem fake news)"
}}

REGRAS:
- PT-BR informal
- Hashtags do canal: {channel.default_hashtags}
- NUNCA invente fatos ou fake news
- Pode ter opinião forte, mas baseada no fato real
- Gere engajamento: polêmica controlada""",
            max_tokens=400,
        )

        log.info(
            "channels.content_adapted",
            channel=channel.id,
            bias=channel.bias,
        )
        return data

    except Exception as e:
        log.error("channels.adapt_error", error=str(e), channel=channel.id)
        return {
            "caption": original_caption,
            "hook": "",
            "hashtags": channel.default_hashtags,
            "controversial_take": "",
        }
