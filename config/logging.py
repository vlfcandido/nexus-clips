"""Configuração centralizada de logging com structlog.

Toda operação é logada com contexto. Em prod, JSON. Em dev, colorido.
"""

import logging
import sys

import structlog

from config.settings import settings


def setup_logging():
    """Configura structlog pra todo o projeto."""
    is_dev = settings.log_level == "DEBUG"

    # Processadores comuns
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if is_dev:
        # Dev: output colorido no terminal
        renderer = structlog.dev.ConsoleRenderer(colors=True)
    else:
        # Prod: JSON pra ingestão no GCP/ELK
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.UnicodeDecoder(),
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelName(settings.log_level)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Configura logging stdlib pra capturar logs de libs externas
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.getLevelName(settings.log_level),
    )

    # Silencia libs barulhentas
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    log = structlog.get_logger()
    log.info("logging.initialized", level=settings.log_level, mode="dev" if is_dev else "prod")
