"""Estado compartilhado do grafo LangGraph.

O State é o "pacote" que viaja entre os nós do grafo.
Cada nó lê e escreve no state, passando informação adiante.

CONCEITO LANGGRAPH:
- State = TypedDict que define a forma dos dados
- Cada nó recebe o state inteiro e retorna um dict parcial (merge automático)
- Reducer annotations (Annotated + operator.add) controlam como listas são mergeadas
"""

from __future__ import annotations

import operator
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage


class ContentState(TypedDict, total=False):
    """Estado que flui pelo pipeline de conteúdo.

    Cada campo é preenchido por um nó diferente do grafo:
    - collect: preenche source_*
    - classify: preenche classification_*
    - strategize: preenche strategy_*
    - generate: preenche clip_*, voice_*, caption_*
    - grow: preenche growth_*
    - publish: preenche publish_*
    """

    # === Identificação ===
    uid: str  # ID único deste conteúdo no pipeline

    # === Source (preenchido pelo coletor) ===
    source_type: str  # twitter, youtube, rss
    source_id: str
    source_url: str
    source_text: str
    source_media_url: str
    source_author: str
    source_topic_hints: list[str]

    # === Classification (preenchido pelo classificador) ===
    is_relevant: bool
    category: str  # gol, polêmica, declaração, treta, breaking
    topic: str  # guerra, futebol, política
    virality_score: float  # 0-10
    urgency: str  # high, medium, low
    summary: str
    suggested_title: str
    classification_confidence: float

    # === Strategy (preenchido pelo estrategista) ===
    format_type: str  # clip, narrated_news, original_video, meme
    duration_target: int
    primary_platform: str
    secondary_platforms: list[str]
    use_voice: bool
    voice_style: str
    needs_anti_strike: bool
    optimal_post_time: str
    estimated_views: int
    estimated_revenue: float
    strategy_reasoning: str

    # === Generation (preenchido pelo gerador) ===
    video_local_path: str
    clip_path: str
    thumbnail_path: str
    subtitle_path: str
    voice_path: str

    # === Captions (por plataforma) ===
    captions: dict[str, dict]  # {"tiktok": {"title": ..., "caption": ..., "hashtags": [...]}}

    # === Growth (preenchido pelo growth agent) ===
    hook_text: str
    cta_text: str
    engagement_question: str
    growth_hashtags: list[str]
    series_name: str

    # === Channels (quais canais publicar) ===
    target_channels: list[str]  # IDs dos canais
    channel_adaptations: dict[str, dict]  # {"politica_direita": {"caption": ..., "hashtags": [...]}}

    # === Publish (preenchido pelo publisher) ===
    published_urls: dict[str, str]  # {"tiktok": "https://...", "instagram": "..."}
    published: bool
    db_clip_id: int

    # === Controle ===
    error: str  # Se algum nó falhar, registra aqui
    skip_reason: str  # Se o conteúdo for pulado, registra o motivo

    # === Messages (pra debug/trace do LangGraph) ===
    messages: Annotated[list[BaseMessage], operator.add]
