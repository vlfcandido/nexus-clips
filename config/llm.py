"""Helper centralizado pra chamadas LLM — Groq (grátis) ou Claude (pago).

Uso:
    from config.llm import llm_json
    result = await llm_json(system="...", user="...", temperature=0.3)
    # result é um dict parseado do JSON
"""

import json

import httpx
import structlog

from config.settings import settings

log = structlog.get_logger()


async def llm_json(
    system: str,
    user: str,
    temperature: float = 0.3,
    max_tokens: int = 600,
) -> dict:
    """Chama LLM e retorna resposta parseada como JSON.

    Tenta Groq primeiro (grátis), fallback pra Anthropic.
    Usa httpx direto pra evitar overhead de SDK.
    """
    if settings.groq_api_key:
        return await _groq_call(system, user, temperature, max_tokens)
    if settings.anthropic_api_key:
        return await _anthropic_call(system, user, temperature, max_tokens)
    raise RuntimeError("Nenhuma LLM API key configurada")


async def _groq_call(system: str, user: str, temperature: float, max_tokens: int) -> dict:
    """Chamada via Groq API (formato OpenAI-compatible)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.groq_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.ai_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )

        if resp.status_code != 200:
            log.error("llm.groq.error", status=resp.status_code, body=resp.text[:200])
            raise RuntimeError(f"Groq API error: {resp.status_code}")

        data = resp.json()
        text = data["choices"][0]["message"]["content"].strip()
        log.info("llm.groq.ok", model=settings.ai_model, tokens=data.get("usage", {}).get("total_tokens", 0))
        return _parse_json(text)


async def _anthropic_call(system: str, user: str, temperature: float, max_tokens: int) -> dict:
    """Chamada via Anthropic API."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user}],
                "temperature": temperature,
            },
        )

        if resp.status_code != 200:
            log.error("llm.anthropic.error", status=resp.status_code)
            raise RuntimeError(f"Anthropic API error: {resp.status_code}")

        data = resp.json()
        text = data["content"][0]["text"].strip()
        log.info("llm.anthropic.ok", tokens=data.get("usage", {}).get("input_tokens", 0))
        return _parse_json(text)


def _parse_json(text: str) -> dict:
    """Parseia JSON mesmo que venha com backticks."""
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)
