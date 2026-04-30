# 🏎️ F1 Fantasy

Aplicação fullstack de palpites e análise técnica de Fórmula 1: o usuário monta o top-10 da próxima corrida com estratégia de pneus, compara telemetria de pilotos via dados oficiais da F1, vê o carro da escuderia em holograma 3D e simula o carro no túnel de vento.

> **Status:** Fase 0 (Fundação) concluída. Próximas fases entregam ingestão da temporada 2025, telemetria tabbed deep-dive, hub da equipe expandido com notícias e túnel de vento T2 com partículas GPU.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 18 (standalone components) + Three.js + Chart.js + ng2-charts |
| Backend | FastAPI + SQLAlchemy + Pydantic |
| Banco | PostgreSQL 15 |
| Telemetria oficial | [FastF1](https://docs.fastf1.dev/) |
| IA local | [Ollama](https://ollama.ai/) com Llama 3 (engenheiro virtual de pista) |
| Auth | bcrypt |
| Migrations | Alembic |
| Testes | pytest (backend) + Karma/Jasmine (frontend) |
| Empacotamento | docker-compose |

---

## Como subir o projeto

### Pré-requisitos

- Docker Desktop com docker-compose
- Pelo menos 4 GB de RAM livres (Ollama puxa o modelo Llama 3 na primeira execução)

### Boot completo

```bash
docker-compose up -d
```

Sobe 4 containers: `frontend` (Nginx na porta 80), `backend` (FastAPI na 8000), `db` (Postgres na 5432) e `ollama` (LLM na 11434).

Abrir [http://localhost](http://localhost) e usar **"Solicitar Superlicença"** pra criar usuário.

Na primeira execução, baixar o modelo do Llama dentro do container Ollama (ele só baixa uma vez, fica em volume nomeado):

```bash
docker-compose exec ollama ollama pull llama3
```

### Apenas backend (desenvolvimento)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Apenas frontend (desenvolvimento)

```bash
cd frontend
npm install --legacy-peer-deps
npx ng serve --port 4200
```

---

## Como rodar testes

### Backend

```bash
cd backend
pytest -v
```

10 testes na fundação: `auth_service` (5) + `main_auth` (5).

### Frontend

```bash
cd frontend
npx ng test --watch=false --browsers=ChromeHeadless
```

11 testes: `ApiService` (5) + `LoginComponent` (3) + `BetTabComponent` (3).

---

## Estrutura do projeto

```
F1-Fantasy/
├── backend/
│   ├── alembic/                    Migrations (Alembic)
│   │   └── versions/000_baseline.py
│   ├── services/
│   │   ├── auth_service.py         bcrypt hash/verify
│   │   └── f1_service.py           FastF1 + LLM (analise por corrida)
│   ├── tests/                      pytest com SQLite in-memory
│   ├── database.py                 SQLAlchemy engine + Base
│   ├── main.py                     FastAPI app (lifespan setup)
│   ├── models.py                   User, Prediction
│   ├── pyproject.toml              config pytest
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── auth/login.component.ts
│   │       ├── bet/bet-tab.component.ts
│   │       ├── shared/api.service.ts        cliente HTTP tipado
│   │       └── app.component.ts              shell + abas restantes
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig*.json
│   ├── nginx.conf
│   └── Dockerfile                  multi-stage com `npm ci`
├── docker-compose.yml
└── docs/
    └── superpowers/
        ├── specs/                  designs aprovados
        └── plans/                  planos de implementação por fase
```

---

## Funcionalidades

### Implementado (acessível na UI)

- 🎲 **Grid & Apostas** — top-10 com estratégia de pneus (largada/final), Piloto do Dia, Maior Evolução
- 📊 **Telemetria** — line chart de pace por volta + análise textual gerada por LLM (Llama 3 local)
- 🏢 **Hub da Equipe** — holograma 3D do carro com raycaster (clica e vê material/peso)
- 💨 **Túnel de Vento** — cena CFD com 40 streamlines (versão atual; T2 com partículas GPU está no roadmap)
- 🔐 **Login/cadastro** com bcrypt
- 🌎 **Ranking Global**

### Em planejamento (próximas fases)

- 📅 **Fase 1 (Backend infra)** — ingestão completa da temporada 2025 via FastF1, APScheduler com job semanal pós-corrida que recalcula pontos dos palpites, RSS aggregator de notícias com filtragem por LLM
- 📊 **Fase 2 (Telemetria tabbed)** — 4 painéis (Pace, Pneus, Setores, Stints) com IA contextual por aba
- 🏢 **Fase 3 (Hub expandido)** — seleção de equipe com cockpit 3 colunas, holograma + stats + notícias + pilotos
- 💨 **Fase 4 (Túnel T2)** — 5000 partículas GPU, esteira turbulenta com simplex noise, comparação A/B de setups, HUD com CdA estimado do top speed real

Ver `docs/superpowers/specs/2026-04-30-f1-fantasy-evolution-design.md` pro design completo.

---

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/register` | Cria conta (bcrypt hash) |
| POST | `/login` | Autentica |
| GET | `/drivers` | Pilotos da temporada atual |
| POST | `/predict` | Salva palpite |
| GET | `/ranking` | Ranking global |
| POST | `/analyze` | Análise de telemetria via FastF1 + Llama 3 |
| GET | `/team-stats/{team}` | Stats da escuderia (stub — Fase 3 substitui) |

Endpoints novos chegam nas Fases 1-3 (`/season/{year}/...`, `/telemetry/{year}/{race}/{driver}`).

---

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://admin:adminpassword@localhost/f1fantasy` | URL do Postgres |
| `OLLAMA_URL` | `http://localhost:11434` | URL do Ollama |

---

## Deploy / Migrations

A primeira vez que o backend subir em ambiente novo, carimbar o estado do DB como já estando na baseline do Alembic:

```bash
docker-compose exec backend alembic stamp 000_baseline
```

Esse passo só é necessário **uma vez por ambiente**. As migrations das fases seguintes (`001_season_and_news.py`, etc) aplicam normalmente em cima.

---

## Convenções

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `chore:`)
- **Branches:** `feature/<nome-fase>` para evolução, ex: `feature/phase-0-foundation`
- **Tags:** `fase-N-<nome>`, ex: `fase-0-fundacao`
- **Idioma da UI:** pt-BR
- **Idioma do código:** en (variáveis, funções, classes); comentários explicando "porquê" podem ser pt-BR

---

## Brainstorms e planos

Toda evolução não-trivial passa por brainstorm visual antes de virar código. Histórico em:

- `docs/superpowers/specs/` — designs aprovados (estado, decisões, arquitetura)
- `docs/superpowers/plans/` — planos de implementação task-by-task com TDD
