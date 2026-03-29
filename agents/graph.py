"""Grafo principal do LangGraph — orquestra todo o pipeline de conteúdo.

CONCEITO LANGGRAPH:
- StateGraph: grafo onde cada nó opera sobre um state compartilhado
- add_node(): registra uma função como nó
- add_edge(): conecta nós sequencialmente (A → B)
- add_conditional_edges(): branching baseado em condição (if/else no grafo)
- START / END: nós especiais de início e fim
- compile(): transforma o grafo em um Runnable executável

FLUXO DO GRAFO:
                    ┌─────────┐
                    │  START  │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │ classify│ ← Classifica o conteúdo (relevante? categoria?)
                    └────┬────┘
                         │
                    ┌────▼──────────┐
                    │ should_process │ ← DECISÃO: relevante + confiança > threshold?
                    └────┬─────┬────┘
                         │     │
                    SIM  │     │ NÃO
                         │     │
                    ┌────▼───┐ └──► END (skip)
                    │strategy│
                    └────┬───┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼───┐ ┌───▼────┐
         │caption │ │growth │ │channels│  ← 3 nós em PARALELO
         └────┬───┘ └───┬───┘ └───┬────┘
              │          │          │
              └──────────┼──────────┘
                         │
                    ┌────▼───┐
                    │  save  │ ← Salva no DB
                    └────┬───┘
                         │
                    ┌────▼───┐
                    │  END   │
                    └────────┘
"""

import structlog
from langgraph.graph import END, START, StateGraph

from agents.nodes import (
    caption_node,
    channels_node,
    classify_node,
    growth_node,
    save_node,
    strategize_node,
)
from agents.state import ContentState
from config.settings import settings

log = structlog.get_logger()


def should_process(state: ContentState) -> str:
    """Função de decisão: o conteúdo vale processar?

    CONCEITO LANGGRAPH:
    - Conditional edges usam uma função que retorna o nome do próximo nó
    - Permite branching dinâmico no grafo
    - Retorna string = nome do nó destino
    """
    if not state.get("is_relevant", False):
        log.info("graph.skip", reason="not_relevant", uid=state.get("uid", ""))
        return "skip"

    confidence = state.get("classification_confidence", 0)
    if confidence < settings.moment_confidence_threshold:
        log.info(
            "graph.skip",
            reason="low_confidence",
            confidence=confidence,
            threshold=settings.moment_confidence_threshold,
            uid=state.get("uid", ""),
        )
        return "skip"

    return "process"


def build_graph() -> StateGraph:
    """Constrói o grafo do pipeline.

    CONCEITO LANGGRAPH:
    - StateGraph(ContentState) cria um grafo tipado
    - Cada nó é registrado com add_node(nome, função)
    - Edges definem o fluxo entre nós
    - compile() retorna um CompiledGraph que é um Runnable
    """

    # 1. Cria o grafo com o state tipado
    graph = StateGraph(ContentState)

    # 2. Registra os nós
    graph.add_node("classify", classify_node)
    graph.add_node("strategize", strategize_node)
    graph.add_node("caption", caption_node)
    graph.add_node("growth", growth_node)
    graph.add_node("channels", channels_node)
    graph.add_node("save", save_node)

    # 3. Define o fluxo

    # START → classify
    graph.add_edge(START, "classify")

    # classify → decisão condicional
    graph.add_conditional_edges(
        "classify",
        should_process,
        {
            "process": "strategize",  # Se relevante → próximo nó
            "skip": END,              # Se não relevante → fim
        },
    )

    # strategize → 3 nós paralelos (caption, growth, channels)
    # CONCEITO LANGGRAPH: múltiplas edges do mesmo nó = execução paralela
    graph.add_edge("strategize", "caption")
    graph.add_edge("strategize", "growth")
    graph.add_edge("strategize", "channels")

    # Os 3 nós paralelos → save
    graph.add_edge("caption", "save")
    graph.add_edge("growth", "save")
    graph.add_edge("channels", "save")

    # save → END
    graph.add_edge("save", END)

    return graph


# Compila o grafo (singleton)
# CONCEITO LANGGRAPH: compile() transforma o grafo em executável
# Depois é só chamar: await compiled_graph.ainvoke(state)
content_pipeline = build_graph().compile()


async def process_content(
    source_type: str,
    source_id: str,
    source_url: str,
    source_text: str,
    source_media_url: str = "",
    source_author: str = "",
    source_topic_hints: list[str] | None = None,
) -> ContentState:
    """Processa um conteúdo pelo pipeline LangGraph.

    Uso:
        result = await process_content(
            source_type="rss",
            source_id="123",
            source_url="https://...",
            source_text="Título da notícia...",
        )
        if result.get("published"):
            print(f"Clip {result['db_clip_id']} salvo!")
    """
    import uuid

    uid = str(uuid.uuid4())[:8]
    log.info("graph.process.start", uid=uid, source=source_type)

    # State inicial
    initial_state: ContentState = {
        "uid": uid,
        "source_type": source_type,
        "source_id": source_id,
        "source_url": source_url,
        "source_text": source_text,
        "source_media_url": source_media_url,
        "source_author": source_author,
        "source_topic_hints": source_topic_hints or [],
        "messages": [],
    }

    # CONCEITO LANGGRAPH: ainvoke() roda todo o grafo de forma assíncrona
    # O grafo percorre todos os nós na ordem definida pelas edges
    result = await content_pipeline.ainvoke(initial_state)

    log.info(
        "graph.process.done",
        uid=uid,
        relevant=result.get("is_relevant"),
        category=result.get("category"),
        clip_id=result.get("db_clip_id"),
        channels=result.get("target_channels"),
    )

    return result
