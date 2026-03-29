"""Carrega prompts do DB — editáveis pelo Pedro no frontend.

Uso:
    from config.prompts import get_prompt
    prompt = await get_prompt("classify")
    result = await llm_json(
        system=prompt.system_prompt,
        user=prompt.user_template.format(**vars),
        temperature=prompt.temperature,
        max_tokens=prompt.max_tokens,
    )
"""

from dataclasses import dataclass

import structlog
from sqlalchemy import select

from db.database import async_session
from db.models import PromptTemplate

log = structlog.get_logger()

# Cache em memória (recarrega a cada 5 min ou quando Pedro edita)
_cache: dict[str, "PromptConfig"] = {}


@dataclass
class PromptConfig:
    key: str
    system_prompt: str
    user_template: str
    temperature: float
    max_tokens: int


async def get_prompt(key: str) -> PromptConfig:
    """Busca prompt do DB (com cache). Pedro edita pelo frontend, pipeline usa em tempo real."""

    if key in _cache:
        return _cache[key]

    async with async_session() as session:
        result = await session.execute(
            select(PromptTemplate).where(PromptTemplate.key == key, PromptTemplate.active == True)
        )
        prompt = result.scalar_one_or_none()

    if prompt:
        config = PromptConfig(
            key=prompt.key,
            system_prompt=prompt.system_prompt,
            user_template=prompt.user_prompt_template,
            temperature=prompt.temperature,
            max_tokens=prompt.max_tokens,
        )
        _cache[key] = config
        return config

    # Fallback se não encontrar no DB
    log.warning("prompts.not_found", key=key)
    return PromptConfig(
        key=key,
        system_prompt="Responda em JSON.",
        user_template="{context}",
        temperature=0.3,
        max_tokens=600,
    )


def clear_cache():
    """Limpa cache (chamado quando Pedro edita um prompt)."""
    _cache.clear()
    log.info("prompts.cache_cleared")
