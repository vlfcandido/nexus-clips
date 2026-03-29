import abc
import datetime as dt
from dataclasses import dataclass, field


@dataclass
class RawContent:
    """Conteúdo bruto capturado de uma fonte."""

    source_type: str  # twitter, youtube, rss, tv
    source_id: str  # identificador único na fonte
    source_url: str = ""

    # Conteúdo
    text: str = ""  # texto do tweet, título da notícia, etc
    media_url: str = ""  # URL do vídeo/imagem
    local_media_path: str = ""  # caminho local após download

    # Metadata
    author: str = ""
    timestamp: dt.datetime = field(default_factory=dt.datetime.utcnow)
    topic_hints: list[str] = field(default_factory=list)  # palavras-chave encontradas
    extra: dict = field(default_factory=dict)


class BaseSource(abc.ABC):
    """Interface base pra todos os coletores."""

    @abc.abstractmethod
    async def start(self) -> None:
        """Inicia o monitoramento contínuo."""

    @abc.abstractmethod
    async def stop(self) -> None:
        """Para o monitoramento."""

    @abc.abstractmethod
    def on_content(self, callback) -> None:
        """Registra callback chamado quando novo conteúdo é detectado.

        callback(content: RawContent) -> None
        """
