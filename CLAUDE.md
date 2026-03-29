# Nexus Clips — Padrões de Projeto

## Visão
Agente autônomo de IA que gera cortes/vídeos virais de futebol e política brasileira.
Meta: monetizar conteúdo automaticamente, escalando pra Copa do Mundo 2026.

## Arquitetura

```
sources/     → Coletores (Twitter, YouTube, RSS, TV)
detection/   → Análise (Vision, Whisper, Classifier, Trending)
strategy/    → Cérebro (Content Strategist, Scheduler)
generator/   → Produção (Clipper, Thumbnail, Caption, Voice)
publisher/   → Distribuição (TikTok, Reels, Shorts, X, Telegram)
api/         → FastAPI + SSE (backend do dashboard)
dashboard/   → React frontend
config/      → Settings (Pydantic v2)
db/          → SQLAlchemy async + SQLite
```

## Stack
- **Backend**: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy async, aiosqlite
- **IA**: Claude API (Sonnet pra decisões rápidas, Opus pra análises complexas), Google Cloud Vision, OpenAI Whisper
- **Vídeo**: FFmpeg, yt-dlp
- **Voz**: Edge TTS (grátis), Google TTS, ElevenLabs
- **Frontend**: React + Vite + Tailwind CSS + Lucide Icons + Recharts
- **Infra**: GCP (futuro), GitHub Actions CI/CD

## Regras OBRIGATÓRIAS

### 1. Logging em TUDO
- **Toda função pública** deve ter log de entrada e saída
- Usar `structlog` com contexto: `log.info("modulo.acao", param=valor)`
- Pattern: `{modulo}.{acao}` — ex: `classifier.result`, `clipper.created`, `publisher.telegram.sent`
- Logs de erro SEMPRE com `error=str(e)` e contexto suficiente pra debug
- **Métricas**: logar duração de operações longas (Vision, Whisper, FFmpeg)
- Formato JSON em prod, colorido em dev

### 2. Arquitetura
- **Cada módulo é independente** — pode ser testado isolado
- **Callbacks/eventos** entre módulos, nunca import circular
- **Pipeline sequencial**: Source → Detection → Strategy → Generator → Publisher
- **Async everywhere** — nunca bloquear o event loop
- **Operações pesadas** (Whisper, FFmpeg, Vision) rodam em thread pool via `run_in_executor`

### 3. Código
- Type hints em todas as funções públicas
- Dataclasses pra DTOs, Pydantic pra config/API
- Funções pequenas (< 50 linhas), classes com responsabilidade única
- Sem globals mutáveis — estado no DB ou passado via parâmetro
- Error handling: try/except em boundaries (API, I/O), não em lógica interna

### 4. DB
- SQLAlchemy 2.0 style (mapped_column, Mapped)
- Async sessions sempre com context manager
- Migrations quando mudar schema (alembic)
- Índices em colunas usadas em WHERE/ORDER BY

### 5. API (FastAPI)
- Endpoints REST pra CRUD
- SSE pra updates em tempo real
- Pydantic schemas pra request/response
- Auth básica (API key) desde o início

### 6. Frontend
- React funcional (hooks only)
- Tailwind CSS pra estilização
- Componentes pequenos e reutilizáveis
- Estado global via Context API
- SSE pra dados em tempo real

### 7. Anti-Gambiarra
- **Nunca** hardcodar URLs, tokens ou paths — tudo via Settings
- **Nunca** ignorar erros silenciosamente — logar sempre
- **Nunca** fazer sleep arbitrário — usar backoff ou scheduler
- **Nunca** committar .env, credentials, ou arquivos de mídia
- **Sempre** que adicionar feature, adicionar log correspondente
- **Sempre** testar com dados reais antes de confiar

### 8. Deploy
- Dev local → testa
- Push pra `dev` → CI roda
- Merge `dev` → `main` → deploy via GitHub Actions
- Nunca SSH direto em prod

## Convenções de Nomes
- Arquivos: snake_case.py
- Classes: PascalCase
- Funções/variáveis: snake_case
- Constantes: UPPER_SNAKE_CASE
- Logs: "modulo.acao" (pontos separando hierarquia)

## Fluxo de Dados

```
[Fontes] → RawContent
    ↓
[Detection] → MomentClassification
    ↓
[Strategy] → ContentStrategy
    ↓
[Generator] → ClipResult + CaptionResult + VoiceResult
    ↓
[Publisher] → URLs publicadas
    ↓
[DB] → Clip (com métricas)
    ↓
[Dashboard] → Visualização + Controle
```
