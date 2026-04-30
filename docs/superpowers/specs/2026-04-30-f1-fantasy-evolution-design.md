# F1 Fantasy — Evolução: Hub da Equipe, Telemetria, Túnel de Vento e Temporada 2025

**Data:** 2026-04-30
**Estado:** Design aprovado, aguardando plano de implementação
**Autor (sessão de brainstorm):** Elyas + Claude

---

## 1. Contexto e Objetivo

O F1 Fantasy hoje é uma aplicação fullstack (FastAPI + Angular standalone + PostgreSQL + FastF1 + Ollama/Llama3) com 4 abas: Apostas, Telemetria, Hub da Equipe, Túnel de Vento. Tem fundação técnica sólida mas várias frentes parcialmente implementadas:

- **Túnel de Vento** funciona como cena 3D estática com 40 streamlines fake e HUD hardcoded.
- **Telemetria** chama FastF1 e devolve dados ricos (sectors, tyre life, stints, top speed) mas o frontend só plota um line chart simples.
- **Histórico de temporada** (`get_season_history`) é mock pra apenas 3 pilotos; resto é placeholder.
- **Hub da Equipe** existe mas é só um dropdown que carrega GLBs sem identidade de equipe; `/team-stats` é stub.

Adicionalmente foram detectados riscos críticos fora do escopo principal mas que afetam a evolução:

- Senhas armazenadas em texto puro (bcrypt instalado mas não utilizado).
- `users.total_points` nunca é atualizado — não existe job que avalia palpites.
- `app.component.ts` com 608 linhas concentra login, apostas, telemetria, 3D e túnel.
- `frontend/Dockerfile` executa `ng new` em build-time, recriando o projeto Angular do zero.

**Objetivo desse spec:** evoluir as 4 frentes em paralelo (Túnel de Vento, Telemetria, Temporada 2025, Hub da Equipe expandido) e endereçar os 3 riscos críticos endereçáveis (R1 senha, R2 componentização, R3 Dockerfile). O risco de pontuação é resolvido naturalmente como parte da Frente 3.

## 2. Decisões da brainstorming

| # | Decisão | Justificativa curta |
|---|---|---|
| D1 | Notícias via **RSS aggregator + Llama3 filtrando ruído** | Zero custo externo, reaproveita Ollama já presente, resiliente a fontes individuais |
| D2 | Ingestão de dados **bulk no boot + APScheduler semanal** + tabelas novas | Histórico 2025 já fechou; job semanal mantém 2026 vivo e destrava cálculo de pontos |
| D3 | Túnel de Vento **Tier 2** (partículas GPU + esteira + comparação A/B), T3 vai pro roadmap | Salto visual de partículas/esteira é o grosso do "feel CFD"; shader de pressão é alto investimento com ROI menor |
| D4 | Telemetria **Layout B Tabbed Deep-Dive** (Pace / Pneus / Setores / Stints) com IA contextual | Casa com estilo tab-based do app, gráficos respiram, IA fica útil ao focar dimensão visível |
| D5 | Hub da Equipe **Layout B Cockpit 3 colunas** | Conteúdo é identidade + listas compactas (não charts analíticos); cockpit feel funciona aqui mesmo com mobile pior |
| D6 | Riscos críticos R1+R2+R3 **incluídos no escopo** | R2 é pré-requisito real — adicionar features novas no monolito atual triplicaria o custo da refatoração futura |
| D7 | Sequenciamento por **vertical slices** (Approach A) | Cada fase entrega valor visível, R2 dilui no caminho, dá pra parar entre fases sem lixo |

## 3. Arquitetura

### 3.1 Backend (`backend/services/`)

```
services/
├── f1_data_service.py       (telemetria via FastF1 + análise LLM contextual,
│                             substitui f1_service.py)
├── season_ingest_service.py (bulk ingest + idempotência)
├── news_service.py          (RSS aggregator + Llama3 categorização)
├── scheduler_service.py     (APScheduler com SQLAlchemyJobStore)
├── scoring_service.py       (avalia palpites pós-corrida)
└── auth_service.py          (bcrypt hash/verify)
```

`f1_data_service.py` herda toda a lógica de análise LLM do `f1_service.py` atual, mas a chamada agora é parametrizada por `focus` (`pace`/`tyre`/`sectors`/`stints`/`overall`) e o prompt é montado de acordo. Cache LLM por chave `(driver, raceX, raceY, focus)` via `cachetools.TTLCache`.

### 3.2 Modelos novos (`backend/models.py`)

```
Race(id, season, round, slug, name, country, date, has_sprint)
RaceResult(id, race_id, driver_code, team, grid, finish_position,
           points, status, fastest_lap_rank, fastest_lap_top_speed)
Qualifying(id, race_id, driver_code, q1, q2, q3, position)
DriverSeasonStat(id, season, driver_code, wins, podiums, points,
                 avg_finish, dnfs)
TeamSeasonStat(id, season, team, wins, podiums, points,
               constructor_position)
NewsArticle(id, team, title, summary, url, source, published_at,
            url_hash, llm_relevance_score)
```

`User.password_hash` muda de plaintext para hash bcrypt. Migration explícita apaga registros existentes (desenvolvimento, sem usuários reais).

### 3.3 Frontend — quebra do monolito

```
app/
├── app.component.ts                  (shell + roteamento de tabs, ~80 linhas)
├── auth/
│   └── login.component.ts
├── bet/
│   └── bet-tab.component.ts
├── telemetry/
│   ├── telemetry-tab.component.ts    (host com tabs internas)
│   ├── pace-panel.component.ts
│   ├── tyre-panel.component.ts
│   ├── sectors-panel.component.ts
│   └── stints-panel.component.ts
├── team-hub/
│   ├── team-hub.component.ts         (3-col layout host)
│   ├── team-list.component.ts
│   ├── team-hologram.component.ts
│   ├── team-stats.component.ts
│   ├── team-drivers.component.ts
│   └── team-news.component.ts
├── wind-tunnel/
│   ├── wind-tunnel.component.ts      (host)
│   ├── particle-system.service.ts
│   ├── wake-generator.service.ts
│   └── aero-controls.component.ts
└── shared/
    ├── three-scene.service.ts        (cleanup, OrbitControls compartilhado)
    └── api.service.ts                (HttpClient tipado)
```

### 3.4 Dependências adicionadas

- Backend: `apscheduler`, `feedparser`, `alembic`, `cachetools` (cache TTL em memória).
- Frontend: `simplex-noise` (~6kb) para a esteira turbulenta no Túnel de Vento. Sem mais nada.
- Reaproveitado: `passlib[bcrypt]` (já em `requirements.txt` mas não usado), Three.js, Chart.js, FastF1, langchain-ollama.

## 4. Fases de implementação (Vertical Slices)

### Fase 0 — Fundação

- **R1 bcrypt:** `auth_service.py` expõe `hash_password` / `verify_password`. `main.py` deixa de armazenar senha em texto puro. Migration apaga `users` existentes.
- **R3 Dockerfile frontend:** versionar `package.json` + `package-lock.json` em `frontend/`. Substituir `ng new` por `npm ci --legacy-peer-deps`. Build cai de minutos pra segundos.
- **R2 fundação:** `app.component.ts` vira shell magro (header + nav-tabs + `<router-outlet>`-style com `*ngIf` por tab). Extrair `LoginComponent`, `BetTabComponent`. Telemetria, Hub e Túnel continuam embutidos no shell até suas próprias fases (R2 incremental — cada fase pega seu pedaço).
- **`ApiService` esqueleto:** criado já com métodos `login`, `register`, `getDrivers`, `getRanking`, `submitPrediction`, mesmo que os outros métodos vão chegando nas próximas fases.
- **Alembic:** `alembic init`, baseline do schema atual, sem migration de feature ainda.

### Fase 1 — Backend infraestrutura

- Migration `001_season_and_news.py`: cria todos os modelos novos da seção 3.2. Seed inicial popula `Race` com calendário 2025 + 2026.
- `season_ingest_service.bootstrap_season(year)`: itera `Race`, baixa sessão R + Q via FastF1, popula `RaceResult` + `Qualifying`. Idempotente (skip se `DriverSeasonStat` já existe pra aquela temporada). Falha por corrida loga e segue.
- `scoring_service.score_predictions(race_slug)`: regras iniciais —
  - top10 acerto exato: 10pt por posição correta
  - top10 ±1 posição (e não exato): 3pt por posição
  - driver_of_day correto: 15pt
  - most_positions_gained correto: 15pt
  - bônus de pneus: 5pt se composto previsto em `start` aparece nos stints reais do piloto + 5pt independentes para o composto previsto em `end` (máx 10pt por piloto, conferidos separadamente)
  - Soma em `User.total_points`, marca `Prediction.points_earned`.
- `news_service.fetch_all()`: RSS de Motorsport.com, Autosport, F1.com via `feedparser`. Pipeline por artigo: parse → dedup por hash MD5 da URL → prompt Llama3 (`"A qual equipe da F1 esta notícia se refere principalmente? Responda apenas o nome ou NONE."`) → score 0-1 → save. Fallback: regex em título com nome da equipe.
- `scheduler_service.start()`: APScheduler com `SQLAlchemyJobStore` no Postgres. Jobs:
  - `weekly_race_update` — segunda 10:00 UTC: detecta corrida do domingo anterior, atualiza `RaceResult`, recalcula stats, dispara `score_predictions`.
  - `daily_news_refresh` — 06:00 UTC: chama `news_service.fetch_all()`.
- Endpoints novos / reformulados:
  - `POST /register`, `POST /login` — usam bcrypt
  - `GET /drivers` — passa a usar 2026, cruza com `RaceResult` recente
  - `GET /season/{year}/driver/{code}` — substitui histórico mockado
  - `GET /season/{year}/team/{team}/news?limit=N` — feed de notícias
  - `GET /season/{year}/team/{team}/stats` — substitui `/team-stats/{team}` mockado
  - `GET /telemetry/{year}/{race}/{driver}` — payload completo, cache `cachetools` TTL 1h
  - `POST /analyze` — aceita `focus: 'pace'|'tyre'|'sectors'|'stints'|'overall'`, prompt LLM contextual
- Variáveis de ambiente: `INGEST_ON_BOOT=true`, `SCHEDULER_ENABLED=true`, `OLLAMA_TIMEOUT=30`.
- Volume nomeado para cache FastF1: `f1_cache_data:/app/f1_cache`.

### Fase 2 — Frontend Telemetria

- Extrair `TelemetryTabComponent` do monolito (R2 continua).
- `tab-bar` interna com 4 botões: Pace / Pneus / Setores / Stints.
- Painéis dumb (`@Input() data`):
  - `PacePanel`: line chart voltas × tempo (raceX vermelho, raceY azul) + box plot de distribuição. Modo SEASON: posições por GP.
  - `TyrePanel`: scatter `TyreLife × LapTime` agrupado por composto (cores SOFT/MED/HARD), linha de tendência por composto = curva de degradação.
  - `SectorsPanel`: bars S1/S2/S3 lado a lado raceX vs raceY, highlight do setor de maior delta.
  - `StintsPanel`: timeline gantt horizontal, cor por composto, anotação de pit stops.
- IA contextual: `POST /analyze` recebe `focus`, prompt muda. Cache LLM por `(driver, raceX, raceY, focus)`.
- `ApiService.getTelemetry()` substitui `http.post('/analyze', ...)` em chamadas iniciais; `analyze` vira chamada secundária só pra prompt.

### Fase 3 — Hub da Equipe

- Extrair `TeamHubComponent` (R2 continua).
- Layout 3 colunas: `team-list` (sidebar esq) | `team-hologram` + `team-stats` + `team-drivers` (centro) | `team-news` (sidebar dir).
- Mapeamento `team → glbFile` reaproveita `assets/3d/`.
- `TeamHologramComponent` usa `ThreeSceneService` compartilhado, OrbitControls habilitado, normalização de tamanho idêntica à do Hub atual.
- `TeamStatsComponent`: 4 pills (Vitórias / Pódios / Construtores / Pontos) de `GET /season/2026/team/{team}/stats`.
- `TeamDriversComponent`: strip horizontal com 2 mini-cards (avatar + nome + número), reaproveita `assets/drivers/{code}.png`.
- `TeamNewsComponent`: lista vertical scrollável (15 últimas notícias), título + fonte + tempo relativo. Clique abre URL externa.

### Fase 4 — Túnel de Vento T2

- Extrair `WindTunnelComponent` (R2 final — `app.component.ts` agora é só shell).
- `ThreeSceneService` reusado para setup, lights, OrbitControls, cleanup.
- `ParticleSystemService`:
  - 5000 partículas, `BufferGeometry` com atributos `position`, `velocity`, `life`.
  - Atualização CPU por frame; promovido para GPU compute apenas se virar gargalo.
  - Detecção de colisão por bbox do carro; ao colidir, desvio perpendicular + tinge vermelho.
  - Cor por velocidade local (HSL): vermelho estagnação, amarelo médio, azul livre.
  - Respawn em `z = +limite` com `y` aleatório.
- `WakeGeneratorService`:
  - Subset de 1500 partículas ativadas só atrás do carro (`z < bbox.min.z`).
  - `simplexNoise(x, y, z, t)` aplicado pra turbulência crível; cores quentes (laranja/amarelo) para destaque.
- Streamlines: 150 (vs 40 hoje), unificadas em `THREE.LineSegments` com 1 draw call.
- `AeroControlsComponent`: 3 sliders (velocidade, yaw, ride height), toggle wireframe/sólido, botões `Setup A` / `Setup B` / `Comparar`.
- Modo A/B: 2 `WebGLRenderer` em canvas lado a lado compartilhando scene; cada um com `setupParams` e câmera distintos. HUD mostra delta `ΔDF`, `ΔDrag`.
- HUD live com `CdA ≈ (2 × power) / (ρ × v³)` (power=940kW, ρ=1.2). Heurísticas para downforce variando com ride height. Top speed real consultado em `RaceResult.fastest_lap_top_speed`.
- Performance: throttle automático para 2500 partículas se FPS < 30 por 2 segundos. Cleanup explícito `geometry.dispose()`, `material.dispose()`, `renderer.dispose()`, `cancelAnimationFrame` ao sair da aba.

## 5. Tratamento de erros

- **LLM offline (Ollama):** timeout 30s, fallback texto + dado bruto sempre serve. Já presente; mantido.
- **FastF1 indisponível para uma sessão:** 404 explícito + flag `data_quality: "unavailable"` no payload, frontend mostra estado vazio em vez de quebrar.
- **DB indisponível:** 503 do FastAPI; APScheduler retry com backoff exponencial.
- **RSS source individual falha:** outras fontes seguem; falha logada.
- **GLB de equipe ausente:** fallback pra `FiaModel.glb` (genérico).
- **Frontend padronizado:** cada componente exibe `loading` (skeleton), `error` (mensagem), ou conteúdo. Sem estado em branco.

## 6. Testes

**Backend (`pytest` + `pytest-asyncio`):**

- Unit: `auth_service` (hash + verify), `scoring_service` (cada regra com fixture), `news_service` (parser RSS com fixture HTML, dedup por URL).
- Integration: `season_ingest_service` com FastF1 cache em disco como fixture estável; testa idempotência.
- Endpoint: `httpx.AsyncClient` + DB SQLite in-memory para os 3 endpoints novos críticos.
- Não testar: APScheduler (lib testada), LLM (mock).
- Cobertura alvo: 70% nos services.

**Frontend (`karma` + `jasmine` reativados):**

- Smoke por painel da Telemetria com data mockada.
- `ApiService` com mock de `HttpClient`.
- `ParticleSystem`: testa funções puras de respawn e desvio (sem WebGL).
- Sem E2E nessa rodada.

## 7. Deploy / Migração

- `docker-compose up` continua sendo o vetor único.
- Healthcheck no serviço `db` para o backend não subir antes do Postgres estar pronto.
- Volume nomeado `f1_cache_data` para cache do FastF1.
- Migration Alembic `001_season_and_news` aplicada automaticamente no boot do backend.
- `INGEST_ON_BOOT=true` no primeiro deploy popula 2025; após isso é idempotente.
- Build do frontend: rebuild de ~3 min cai pra ~20s com `npm ci`.

## 8. Não-escopo (explicitamente fora)

- Mobile app nativa
- Login social / OAuth
- Multi-língua (fica em pt-BR)
- Túnel de Vento T3 (shader GLSL de pressão)
- Histórico pré-2025
- WebSockets / live updates durante corrida
- Migração para Redis / Memcached
- CI/CD pipeline (deploy continua manual)
- Testes E2E (Cypress)

## 9. Riscos remanescentes

| Risco | Mitigação |
|---|---|
| FastF1 muda formato ou rate-limit aperta | Cache em disco; ingest tolera erro por corrida; pinar versão da lib |
| RSS feeds mudam URL | Lista configurável; falha de fonte não derruba as outras |
| Llama3 pesado em CPU-only | Timeout 30s + fallback texto + categorização tem fallback regex |
| Componentização incremental gera duplicação temporária | Aceito (Approach A escolhido); `app.component.ts` vira shell magrinho ao final da Fase 4 |
| Senha bcrypt quebra users de teste existentes | Migration apaga `users` (sem usuário real ainda) |
| 5000 partículas + Three.js em laptop fraca | Auto-degradação para 2500 a 30fps documentada e implementada |

## 10. Roadmap futuro (mapeado, não-escopo)

- **T3 Túnel de Vento**: shader GLSL de pressão na superfície do carro + post-processing — entrega "sensação de túnel real" com gradiente vermelho/azul nas zonas de stagnação e baixa pressão. Seria um próximo brainstorm dedicado.
- Live timing durante corridas (WebSocket + FastF1 live timing API).
- Liga privada (palpites entre amigos com convite).
- Mobile-first do Hub da Equipe (cockpit precisa virar accordion stackable).
- E2E Cypress quando o time crescer.

## 11. Ordem de implementação (resumo)

```
Fase 0 — Fundação
  ├── R1 bcrypt (auth_service + main.py)
  ├── R3 Dockerfile frontend (package.json + npm ci)
  ├── R2 fundação (LoginComponent + BetTabComponent + ApiService)
  └── Alembic baseline

Fase 1 — Backend infra
  ├── Migration 001_season_and_news
  ├── season_ingest_service + bootstrap 2025
  ├── scoring_service
  ├── news_service (RSS + Llama3)
  ├── scheduler_service (weekly + daily)
  └── Endpoints novos

Fase 2 — Frontend Telemetria
  ├── TelemetryTabComponent + tabs internas
  ├── 4 painéis (Pace, Tyre, Sectors, Stints)
  └── ApiService tipado

Fase 3 — Hub da Equipe
  ├── TeamHubComponent + 3 cols
  ├── TeamList + TeamHologram + TeamStats + TeamDrivers + TeamNews
  └── Endpoints de team consumidos

Fase 4 — Túnel de Vento T2
  ├── WindTunnelComponent
  ├── ParticleSystemService (5000 partículas)
  ├── WakeGeneratorService (simplex noise)
  ├── AeroControlsComponent (3 sliders)
  └── Modo A/B comparativo
```
