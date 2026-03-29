"""Entrypoint do Nexus Clips."""

import uvicorn

from config.logging import setup_logging

setup_logging()


def main():
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
