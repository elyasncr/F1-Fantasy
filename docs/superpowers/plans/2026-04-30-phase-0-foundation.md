# F1 Fantasy — Fase 0 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer a fundação do F1 Fantasy antes de adicionar features novas — substituir senha em texto puro por bcrypt, trocar o `ng new` em build-time por `npm ci`, quebrar o monolito `app.component.ts` em shell + Login + BetTab + ApiService, e inicializar Alembic.

**Architecture:** TDD em Python (pytest), TDD leve no Angular (smoke tests com Karma/Jasmine reativados), Alembic com baseline capturando o estado atual antes da Fase 1 adicionar tabelas novas. Cada task termina com commit.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, passlib[bcrypt], pytest, pytest-asyncio, Angular 18 standalone, Karma, Jasmine.

**Spec:** [`docs/superpowers/specs/2026-04-30-f1-fantasy-evolution-design.md`](../specs/2026-04-30-f1-fantasy-evolution-design.md) (Fase 0)

---

## File Structure

**Backend criados:**
- `backend/services/auth_service.py` — hash_password, verify_password (bcrypt)
- `backend/tests/__init__.py`
- `backend/tests/conftest.py` — fixtures pytest (DB SQLite in-memory)
- `backend/tests/test_auth_service.py`
- `backend/tests/test_main_auth.py`
- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/alembic/script.py.mako`
- `backend/alembic/versions/000_baseline.py`
- `backend/pyproject.toml` — config pytest

**Backend modificados:**
- `backend/main.py:47-61` — `/register` e `/login` usam auth_service
- `backend/requirements.txt` — adiciona `apscheduler`, `feedparser`, `alembic`, `cachetools`, `pytest`, `pytest-asyncio`, `httpx`

**Frontend criados (scaffolding Angular versionado):**
- `frontend/package.json`, `frontend/package-lock.json`
- `frontend/angular.json`
- `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.spec.json`
- `frontend/.gitignore` (apenas `node_modules/`, `dist/`, `.angular/`)
- `frontend/src/app/auth/login.component.ts`
- `frontend/src/app/bet/bet-tab.component.ts`
- `frontend/src/app/shared/api.service.ts`
- `frontend/src/app/shared/api.service.spec.ts`

**Frontend modificados:**
- `frontend/Dockerfile` — substitui `ng new` por `npm ci`
- `frontend/src/app/app.component.ts` — vira shell magro

---

## Task 1: Setup pytest infrastructure

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1.1: Adicionar deps de teste ao requirements.txt**

Editar `backend/requirements.txt` adicionando ao final:

```
pytest
pytest-asyncio
httpx
alembic
apscheduler
feedparser
cachetools
```

- [ ] **Step 1.2: Criar pyproject.toml com config pytest**

Criar `backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
pythonpath = ["."]
```

- [ ] **Step 1.3: Criar pacote tests/**

Criar arquivo vazio `backend/tests/__init__.py`.

- [ ] **Step 1.4: Criar conftest.py com fixture de DB in-memory**

Criar `backend/tests/conftest.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
import models  # noqa: F401  registra os modelos no Base


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient
    from main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

- [ ] **Step 1.5: Instalar deps + smoke test do pytest**

Run:
```bash
cd backend && pip install -r requirements.txt && pytest --collect-only
```
Expected: `0 tests collected` (sem erro de importação).

- [ ] **Step 1.6: Commit**

```bash
git add backend/pyproject.toml backend/tests/ backend/requirements.txt
git commit -m "chore(backend): add pytest infrastructure with in-memory db fixture"
```

---

## Task 2: TDD auth_service.py (hash + verify)

**Files:**
- Create: `backend/tests/test_auth_service.py`
- Create: `backend/services/auth_service.py`

- [ ] **Step 2.1: Escrever testes que falham**

Criar `backend/tests/test_auth_service.py`:

```python
from services.auth_service import hash_password, verify_password


def test_hash_password_returns_string_different_from_input():
    plain = "minha-senha-secreta"
    hashed = hash_password(plain)
    assert isinstance(hashed, str)
    assert hashed != plain
    assert len(hashed) > 30  # bcrypt hashes are ~60 chars


def test_hash_password_is_not_deterministic():
    plain = "mesma-senha"
    h1 = hash_password(plain)
    h2 = hash_password(plain)
    assert h1 != h2  # bcrypt salts cada hash


def test_verify_password_accepts_correct_plain():
    plain = "abc123"
    hashed = hash_password(plain)
    assert verify_password(plain, hashed) is True


def test_verify_password_rejects_wrong_plain():
    hashed = hash_password("certo")
    assert verify_password("errado", hashed) is False


def test_verify_password_rejects_garbage_hash():
    assert verify_password("qualquer", "isso-nao-eh-bcrypt") is False
```

- [ ] **Step 2.2: Rodar e ver falhar**

Run: `cd backend && pytest tests/test_auth_service.py -v`
Expected: ImportError — `services.auth_service` não existe.

- [ ] **Step 2.3: Implementar auth_service**

Criar `backend/services/auth_service.py`:

```python
from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plain, hashed)
    except (ValueError, TypeError):
        return False
```

- [ ] **Step 2.4: Rodar e ver passar**

Run: `cd backend && pytest tests/test_auth_service.py -v`
Expected: 5 PASS.

- [ ] **Step 2.5: Commit**

```bash
git add backend/services/auth_service.py backend/tests/test_auth_service.py
git commit -m "feat(backend): add auth_service with bcrypt hash/verify"
```

---

## Task 3: Refactor /register e /login para usar auth_service

**Files:**
- Create: `backend/tests/test_main_auth.py`
- Modify: `backend/main.py:47-61`

- [ ] **Step 3.1: Escrever testes de integração que falham**

Criar `backend/tests/test_main_auth.py`:

```python
from services.auth_service import verify_password


def test_register_stores_bcrypt_hash_not_plaintext(client, db_session):
    import models

    response = client.post("/register", json={"username": "alice", "password": "senha123"})
    assert response.status_code == 200

    user = db_session.query(models.User).filter_by(username="alice").first()
    assert user is not None
    assert user.password_hash != "senha123"
    assert verify_password("senha123", user.password_hash) is True


def test_register_rejects_duplicate_username(client):
    client.post("/register", json={"username": "bob", "password": "x"})
    second = client.post("/register", json={"username": "bob", "password": "y"})
    assert second.status_code == 400


def test_login_accepts_correct_password(client):
    client.post("/register", json={"username": "carol", "password": "p4ss"})
    response = client.post("/login", json={"username": "carol", "password": "p4ss"})
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "carol"
    assert "user_id" in body


def test_login_rejects_wrong_password(client):
    client.post("/register", json={"username": "dave", "password": "right"})
    response = client.post("/login", json={"username": "dave", "password": "wrong"})
    assert response.status_code == 401


def test_login_rejects_unknown_user(client):
    response = client.post("/login", json={"username": "ghost", "password": "x"})
    assert response.status_code == 401
```

- [ ] **Step 3.2: Rodar e ver falhar**

Run: `cd backend && pytest tests/test_main_auth.py -v`
Expected: `test_register_stores_bcrypt_hash_not_plaintext` falha porque hoje `password_hash` é igual ao plaintext. `test_login_accepts_correct_password` pode passar por acaso pelo mesmo motivo (compara plain==plain).

- [ ] **Step 3.3: Refatorar /register e /login em main.py**

Em `backend/main.py`, adicionar import no topo:

```python
from services.auth_service import hash_password, verify_password
```

Substituir o bloco de `/register` e `/login` (linhas atuais 47-61) por:

```python
@app.post("/register")
def register(user: UserLogin, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já existe.")
    new_user = models.User(username=user.username, password_hash=hash_password(user.password))
    db.add(new_user)
    db.commit()
    return {"user_id": new_user.id, "username": new_user.username}


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")
    return {"user_id": db_user.id, "username": db_user.username}
```

- [ ] **Step 3.4: Rodar e ver passar**

Run: `cd backend && pytest tests/ -v`
Expected: 10 PASS (5 do auth_service + 5 do main_auth).

- [ ] **Step 3.5: Commit**

```bash
git add backend/main.py backend/tests/test_main_auth.py
git commit -m "refactor(backend): use bcrypt for register/login (R1 fixed)"
```

---

## Task 4: Alembic init + baseline migration

**Files:**
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/000_baseline.py`

- [ ] **Step 4.1: Inicializar alembic**

Run:
```bash
cd backend && alembic init alembic
```
Expected: cria `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako` e pasta `backend/alembic/versions/`.

- [ ] **Step 4.2: Configurar alembic.ini para usar DATABASE_URL do ambiente**

Em `backend/alembic.ini`, localizar a linha `sqlalchemy.url = driver://user:pass@localhost/dbname` e substituir por (deixa vazio — vamos ler do env):

```
sqlalchemy.url =
```

- [ ] **Step 4.3: Configurar env.py para ler DATABASE_URL e Base do projeto**

Substituir o conteúdo de `backend/alembic/env.py` por:

```python
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base  # noqa: E402
import models  # noqa: F401, E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:adminpassword@localhost/f1fantasy")
config.set_main_option("sqlalchemy.url", DATABASE_URL)


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4.4: Criar migration baseline manualmente**

Criar `backend/alembic/versions/000_baseline.py`:

```python
"""baseline (captures current users + predictions tables)

Revision ID: 000_baseline
Revises:
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "000_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op: tabelas já existem (criadas via Base.metadata.create_all em main.py).
    # Este baseline serve apenas para alembic ter um ponto de partida; migrations
    # subsequentes (Fase 1) partem daqui.
    pass


def downgrade() -> None:
    pass
```

- [ ] **Step 4.5: Carimbar o DB existente como já estando na baseline**

Quando subir o backend pela primeira vez após esse commit, rodar uma única vez (manualmente ou via comando docker-compose exec):

```bash
cd backend && alembic stamp 000_baseline
```

Esse passo é documentado no plano mas não roda agora — fica como instrução de deploy.

- [ ] **Step 4.6: Commit**

```bash
git add backend/alembic.ini backend/alembic/
git commit -m "chore(backend): initialize alembic with baseline migration"
```

---

## Task 5: Gerar scaffolding Angular versionado

**Files:**
- Create: `frontend/package.json`, `frontend/package-lock.json`
- Create: `frontend/angular.json`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.spec.json`
- Create: `frontend/.gitignore`

- [ ] **Step 5.1: Pré-requisito — instalar Angular CLI localmente (uma vez)**

Run:
```bash
npm install -g @angular/cli
```
Expected: instala `ng` globalmente. Verificar com `ng version`.

- [ ] **Step 5.2: Gerar scaffolding em diretório temporário**

Run:
```bash
cd "D:/AI Solution/F1-Fantasy" && ng new f1-fantasy-app --directory ./tmp-scaffold --skip-git --skip-tests=false --style=css --routing=false --defaults
```
Expected: cria `tmp-scaffold/` com projeto Angular completo.

- [ ] **Step 5.3: Copiar arquivos de scaffolding para frontend/**

Run (do diretório raiz do repo):

```bash
cp tmp-scaffold/package.json frontend/package.json
cp tmp-scaffold/package-lock.json frontend/package-lock.json
cp tmp-scaffold/angular.json frontend/angular.json
cp tmp-scaffold/tsconfig.json frontend/tsconfig.json
cp tmp-scaffold/tsconfig.app.json frontend/tsconfig.app.json
cp tmp-scaffold/tsconfig.spec.json frontend/tsconfig.spec.json
```

- [ ] **Step 5.4: Adicionar libs gráficas ao package.json do frontend**

Editar `frontend/package.json`. Na seção `dependencies`, adicionar:

```json
"chart.js": "^4.4.0",
"ng2-charts": "^5.0.0",
"three": "^0.160.0"
```

Na seção `devDependencies`, adicionar:

```json
"@types/three": "^0.160.0"
```

- [ ] **Step 5.5: Patch angular.json — remover budgets que estouram com CSS rico**

Em `frontend/angular.json`, localizar `projects.f1-fantasy-app.architect.build.configurations.production.budgets` e substituir por array vazio `[]`:

```json
"budgets": []
```

- [ ] **Step 5.6: Ajustar nome do projeto no angular.json**

Em `frontend/angular.json`, garantir que `projects.f1-fantasy-app` seja a chave (já é, vindo do `ng new`). Manter como está.

- [ ] **Step 5.7: Criar .gitignore do frontend**

Criar `frontend/.gitignore`:

```
node_modules/
dist/
.angular/
*.log
```

- [ ] **Step 5.8: Apagar tmp-scaffold/**

Run:
```bash
rm -rf tmp-scaffold
```

- [ ] **Step 5.9: Instalar deps localmente para gerar package-lock atualizado**

Run:
```bash
cd frontend && npm install --legacy-peer-deps
```
Expected: gera/atualiza `package-lock.json` com chart.js, three, etc.

- [ ] **Step 5.10: Smoke local: build de produção funciona**

Run:
```bash
cd frontend && npx ng build --configuration production
```
Expected: build conclui sem erro, output em `frontend/dist/f1-fantasy-app/browser/`.

- [ ] **Step 5.11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/angular.json frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.spec.json frontend/.gitignore
git commit -m "chore(frontend): version angular scaffolding files"
```

---

## Task 6: Refatorar Dockerfile do frontend

**Files:**
- Modify: `frontend/Dockerfile`

- [ ] **Step 6.1: Substituir Dockerfile**

Substituir o conteúdo de `frontend/Dockerfile` por:

```dockerfile
# Stage 1: Build
FROM node:18 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json ./
COPY src ./src

RUN npx ng build --configuration production

# Stage 2: Serve (Nginx)
FROM nginx:alpine

COPY --from=build /app/dist/f1-fantasy-app/browser /usr/share/nginx/html

RUN mkdir -p /usr/share/nginx/html/assets/drivers
COPY src/assets/ /usr/share/nginx/html/assets/

COPY nginx.conf /etc/nginx/conf.d/default.conf
```

- [ ] **Step 6.2: Build via docker-compose para verificar**

Run (do raiz do repo):
```bash
docker-compose build frontend
```
Expected: build conclui em ~20-40s no rebuild (vs ~3min no Dockerfile antigo).

- [ ] **Step 6.3: Subir stack e verificar UI carrega**

Run:
```bash
docker-compose up -d
```

Abrir `http://localhost` no browser. Expected: tela de login do F1 Fantasy aparece.

- [ ] **Step 6.4: Derrubar stack**

Run: `docker-compose down`

- [ ] **Step 6.5: Commit**

```bash
git add frontend/Dockerfile
git commit -m "refactor(frontend): replace ng new build with npm ci (R3 fixed)"
```

---

## Task 7: Criar ApiService com TDD

**Files:**
- Create: `frontend/src/app/shared/api.service.ts`
- Create: `frontend/src/app/shared/api.service.spec.ts`
- Modify: `frontend/src/main.ts`

- [ ] **Step 7.1: Escrever spec que falha**

Criar `frontend/src/app/shared/api.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('login posts to /login with credentials', () => {
    service.login('alice', 'p').subscribe();
    const req = httpMock.expectOne('http://localhost:8000/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'alice', password: 'p' });
    req.flush({ user_id: 1, username: 'alice' });
  });

  it('register posts to /register', () => {
    service.register('bob', 'x').subscribe();
    const req = httpMock.expectOne('http://localhost:8000/register');
    expect(req.request.method).toBe('POST');
    req.flush({ user_id: 2, username: 'bob' });
  });

  it('getDrivers fetches from /drivers', () => {
    service.getDrivers().subscribe();
    httpMock.expectOne('http://localhost:8000/drivers').flush([]);
  });

  it('getRanking fetches from /ranking', () => {
    service.getRanking().subscribe();
    httpMock.expectOne('http://localhost:8000/ranking').flush([]);
  });

  it('submitPrediction posts to /predict', () => {
    const payload = { user_id: 1, race_slug: 'AUS', top_10: [], tire_strategies: {}, driver_of_day: '', most_positions_gained: '' };
    service.submitPrediction(payload).subscribe();
    const req = httpMock.expectOne('http://localhost:8000/predict');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ status: 'ok' });
  });
});
```

- [ ] **Step 7.2: Rodar e ver falhar**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: erro de import — `api.service` não existe.

- [ ] **Step 7.3: Implementar ApiService**

Criar `frontend/src/app/shared/api.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuthResponse { user_id: number; username: string; }
export interface Driver { code: string; name: string; team: string; number: number; image: string; car: string; }
export interface RankingEntry { username: string; total_points: number; }

export interface PredictionPayload {
  user_id: number;
  race_slug: string;
  top_10: string[];
  tire_strategies: Record<string, { start: string; end: string }>;
  driver_of_day: string;
  most_positions_gained: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, { username, password });
  }

  register(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, { username, password });
  }

  getDrivers(): Observable<Driver[]> {
    return this.http.get<Driver[]>(`${this.baseUrl}/drivers`);
  }

  getRanking(): Observable<RankingEntry[]> {
    return this.http.get<RankingEntry[]>(`${this.baseUrl}/ranking`);
  }

  submitPrediction(payload: PredictionPayload): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.baseUrl}/predict`, payload);
  }
}
```

- [ ] **Step 7.4: Rodar e ver passar**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: 5 PASS no `ApiService`.

- [ ] **Step 7.5: Commit**

```bash
git add frontend/src/app/shared/
git commit -m "feat(frontend): add ApiService with typed methods (login/register/drivers/ranking/predict)"
```

---

## Task 8: Extrair LoginComponent

**Files:**
- Create: `frontend/src/app/auth/login.component.ts`
- Create: `frontend/src/app/auth/login.component.spec.ts`
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 8.1: Escrever smoke test que falha**

Criar `frontend/src/app/auth/login.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule, FormsModule],
    });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('renders without crashing', () => {
    expect(component).toBeTruthy();
  });

  it('toggleMode flips isRegistering', () => {
    expect(component.isRegistering).toBe(false);
    component.toggleMode();
    expect(component.isRegistering).toBe(true);
  });

  it('emits authenticated event on successful login', (done) => {
    component.usernameInput = 'alice';
    component.passwordInput = 'p';
    component.authenticated.subscribe((ev) => {
      expect(ev.username).toBe('alice');
      done();
    });
    component.actionAuth();
    const req = httpMock.expectOne('http://localhost:8000/login');
    req.flush({ user_id: 1, username: 'alice' });
  });
});
```

- [ ] **Step 8.2: Rodar e ver falhar**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: erro de import — `login.component` não existe.

- [ ] **Step 8.3: Criar LoginComponent**

Criar `frontend/src/app/auth/login.component.ts`:

```typescript
import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, AuthResponse } from '../shared/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-overlay">
      <div class="login-box">
        <div class="f1-logo-mock">🏎️</div>
        <h2>Acesso ao Paddock</h2>
        <div class="input-group">
          <input [(ngModel)]="usernameInput" placeholder="Piloto" (keyup.enter)="actionAuth()">
        </div>
        <div class="input-group">
          <input [(ngModel)]="passwordInput" type="password" placeholder="Senha" (keyup.enter)="actionAuth()">
        </div>
        <button (click)="actionAuth()" class="btn-cta">
          {{ isRegistering ? 'Assinar Contrato' : 'Entrar' }}
        </button>
        <p class="toggle-link" (click)="toggleMode()">
          {{ isRegistering ? 'Já tenho Superlicença' : 'Solicitar Superlicença' }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); display: flex; justify-content: center; align-items: center; z-index: 100; }
    .login-box { background: #1e1f26; padding: 50px; border-radius: 16px; width: 350px; text-align: center; border: 1px solid #2d2e36; }
    .f1-logo-mock { font-size: 3rem; margin-bottom: 10px; }
    .input-group input { width: 100%; padding: 12px; margin-bottom: 10px; background: #15161b; border: 1px solid #333; color: white; border-radius: 6px; box-sizing: border-box; }
    .btn-cta { width: 100%; padding: 12px; background: #e10600; border: none; color: white; border-radius: 6px; font-weight: bold; cursor: pointer; text-transform: uppercase; }
    .toggle-link { color: #666; margin-top: 15px; cursor: pointer; font-size: 0.9rem; text-decoration: underline; }
  `],
})
export class LoginComponent {
  @Output() authenticated = new EventEmitter<AuthResponse>();

  usernameInput = '';
  passwordInput = '';
  isRegistering = false;

  constructor(private api: ApiService) {}

  actionAuth() {
    if (this.isRegistering) {
      this.api.register(this.usernameInput, this.passwordInput).subscribe(() => {
        alert('Licença emitida!');
        this.toggleMode();
      });
    } else {
      this.api.login(this.usernameInput, this.passwordInput).subscribe((r) => {
        this.authenticated.emit(r);
      });
    }
  }

  toggleMode() {
    this.isRegistering = !this.isRegistering;
  }
}
```

- [ ] **Step 8.4: Atualizar app.component.ts para usar LoginComponent**

Em `frontend/src/app/app.component.ts`:

1. Adicionar import: `import { LoginComponent } from './auth/login.component';`
2. Adicionar `LoginComponent` ao array `imports` do `@Component`.
3. Remover o bloco do template `<div *ngIf="!userId" class="login-overlay">...</div>` e substituir por:

```html
<app-login *ngIf="!userId" (authenticated)="setSess($event)"></app-login>
```

4. Remover do componente as propriedades `usernameInput`, `passwordInput`, `isRegistering` e os métodos `actionAuth`, `login`, `register`, `toggleMode`.

- [ ] **Step 8.5: Rodar tests e ver passar**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: testes do `ApiService` (5) + `LoginComponent` (3) PASS.

- [ ] **Step 8.6: Smoke manual em browser**

Run: `docker-compose up -d`. Abrir `http://localhost`. Verificar que login + cadastro continuam funcionando exatamente como antes.

- [ ] **Step 8.7: Commit**

```bash
git add frontend/src/app/auth/ frontend/src/app/app.component.ts
git commit -m "refactor(frontend): extract LoginComponent (R2 step 1/2)"
```

---

## Task 9: Extrair BetTabComponent

**Files:**
- Create: `frontend/src/app/bet/bet-tab.component.ts`
- Create: `frontend/src/app/bet/bet-tab.component.spec.ts`
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 9.1: Escrever smoke test que falha**

Criar `frontend/src/app/bet/bet-tab.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { BetTabComponent } from './bet-tab.component';

describe('BetTabComponent', () => {
  let fixture: ComponentFixture<BetTabComponent>;
  let component: BetTabComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BetTabComponent, HttpClientTestingModule, FormsModule],
    });
    fixture = TestBed.createComponent(BetTabComponent);
    component = fixture.componentInstance;
    component.drivers = [];
    component.ranking = [];
    component.calendar = [];
    component.userId = 1;
    component.username = 'tester';
    fixture.detectChanges();
  });

  it('renders without crashing', () => {
    expect(component).toBeTruthy();
  });

  it('isDriverSelected returns true if driver code is in another slot', () => {
    component.prediction.top_10 = ['VER', '', '', '', '', '', '', '', '', ''];
    expect(component.isDriverSelected('VER', 1)).toBe(true);
    expect(component.isDriverSelected('VER', 0)).toBe(false);
  });

  it('setTire stores compound for the driver at index', () => {
    component.prediction.top_10[0] = 'VER';
    component.setTire(0, 'start', 'SOFT');
    expect(component.getTire(0, 'start')).toBe('SOFT');
  });
});
```

- [ ] **Step 9.2: Rodar e ver falhar**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: erro de import — `bet-tab.component` não existe.

- [ ] **Step 9.3: Criar BetTabComponent**

Criar `frontend/src/app/bet/bet-tab.component.ts`:

```typescript
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Driver, RankingEntry } from '../shared/api.service';

interface CalendarRace {
  date: string;
  gp: string;
  sprint: boolean;
}

interface Prediction {
  top_10: string[];
  tire_strategies: Record<string, { start: string; end: string }>;
  driver_of_day: string;
  most_positions_gained: string;
}

@Component({
  selector: 'app-bet-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bet-layout">
      <div class="main-column">
        <div class="panel">
          <div class="panel-header"><h3>🚦 Grid de Largada</h3><small>Defina as posições e estratégia de pneus</small></div>
          <div class="grid-list">
            <div *ngFor="let i of [0,1,2,3,4,5,6,7,8,9]; let idx = index" class="driver-card">
              <div class="position-marker">P{{idx + 1}}</div>
              <div class="driver-content">
                <div class="driver-selection-row">
                  <img [src]="getDriverImage(prediction.top_10[idx])" (error)="handleImageError($event)" class="driver-avatar">
                  <div class="select-container">
                    <select [(ngModel)]="prediction.top_10[idx]" class="premium-select" [class.filled]="prediction.top_10[idx]">
                      <option value="" disabled selected>Selecione o Piloto...</option>
                      <option *ngFor="let d of drivers" [value]="d.code" [disabled]="isDriverSelected(d.code, idx)">
                        {{d.name}} #{{d.number}} ({{d.team}})
                      </option>
                    </select>
                  </div>
                </div>
                <div class="tire-strategy-box">
                  <div class="strategy-col">
                    <span class="tire-label">LARGADA</span>
                    <div class="tire-toggles">
                      <button (click)="setTire(idx, 'start', 'SOFT')" [class.active]="getTire(idx, 'start') === 'SOFT'" class="tire-dot soft"></button>
                      <button (click)="setTire(idx, 'start', 'MEDIUM')" [class.active]="getTire(idx, 'start') === 'MEDIUM'" class="tire-dot medium"></button>
                      <button (click)="setTire(idx, 'start', 'HARD')" [class.active]="getTire(idx, 'start') === 'HARD'" class="tire-dot hard"></button>
                    </div>
                  </div>
                  <div class="arrow">➜</div>
                  <div class="strategy-col">
                    <span class="tire-label">FINAL</span>
                    <div class="tire-toggles">
                      <button (click)="setTire(idx, 'end', 'SOFT')" [class.active]="getTire(idx, 'end') === 'SOFT'" class="tire-dot soft"></button>
                      <button (click)="setTire(idx, 'end', 'MEDIUM')" [class.active]="getTire(idx, 'end') === 'MEDIUM'" class="tire-dot medium"></button>
                      <button (click)="setTire(idx, 'end', 'HARD')" [class.active]="getTire(idx, 'end') === 'HARD'" class="tire-dot hard"></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="side-column">
        <div class="panel">
          <div class="panel-header"><h3>🔥 Especiais</h3></div>
          <div class="special-input">
            <label>Piloto do Dia</label>
            <div class="special-row">
              <img [src]="getDriverImageByName(prediction.driver_of_day)" (error)="handleImageError($event)" class="mini-avatar">
              <select [(ngModel)]="prediction.driver_of_day" class="premium-select">
                <option value="" disabled>Escolha...</option>
                <option *ngFor="let d of drivers" [value]="d.name">{{d.name}}</option>
              </select>
            </div>
          </div>
          <div class="special-input">
            <label>Maior Evolução</label>
            <div class="special-row">
              <img [src]="getDriverImageByName(prediction.most_positions_gained)" (error)="handleImageError($event)" class="mini-avatar">
              <select [(ngModel)]="prediction.most_positions_gained" class="premium-select">
                <option value="" disabled>Escolha...</option>
                <option *ngFor="let d of drivers" [value]="d.name">{{d.name}}</option>
              </select>
            </div>
          </div>
          <button (click)="submitPrediction()" class="btn-save-all">💾 SALVAR PREDIÇÃO</button>
        </div>

        <div class="panel calendar-panel">
          <div class="panel-header"><h3>📅 Calendário 2026</h3></div>
          <div class="calendar-list">
            <div *ngFor="let race of calendar" class="race-item">
              <div class="race-header"><span class="race-date">{{race.date}}</span><span class="race-country">{{race.gp}}</span></div>
              <div class="race-events"><span *ngIf="race.sprint" class="badge sprint">SPRINT</span><span class="badge race">CORRIDA</span></div>
            </div>
          </div>
        </div>

        <div class="panel ranking-panel">
          <div class="panel-header"><h3>🌎 Ranking Global</h3></div>
          <ul class="ranking-list">
            <li *ngFor="let u of ranking" [class.me]="u.username === username">
              #{{ranking.indexOf(u)+1}} {{u.username}} - {{u.total_points}} pts
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bet-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; padding: 25px; max-width: 1600px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    .driver-card { display: flex; align-items: center; gap: 15px; background: #1a1b21; margin-bottom: 12px; padding: 15px; border-radius: 10px; border-left: 4px solid transparent; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .driver-card:hover { border-left-color: #e10600; background: #202129; transform: translateX(5px); }
    .driver-content { flex: 1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .driver-selection-row, .special-row { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 250px; }
    .driver-avatar { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; background: #333; border: 1px solid #444; }
    .mini-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #333; border: 1px solid #444; }
    .select-container { flex: 1; }
    .tire-strategy-box { display: flex; align-items: center; gap: 15px; background: #131418; padding: 8px 15px; border-radius: 8px; border: 1px solid #2d2e36; }
    .strategy-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .tire-label { font-size: 0.6rem; color: #8a8a93; font-weight: bold; }
    .tire-toggles { display: flex; gap: 6px; }
    .tire-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; opacity: 0.3; background: transparent; padding: 0; }
    .tire-dot:hover { opacity: 0.7; transform: scale(1.1); }
    .tire-dot.active { opacity: 1; transform: scale(1.2); border-color: #fff; box-shadow: 0 0 5px currentColor; }
    .tire-dot.soft { background-color: #ff3333; color: #ff3333; }
    .tire-dot.medium { background-color: #ffcc00; color: #ffcc00; }
    .tire-dot.hard { background-color: #f0f0f0; color: #f0f0f0; }
    .arrow { color: #8a8a93; }
    .panel { background: #1e1f26; border-radius: 12px; border: 1px solid #2d2e36; margin-bottom: 25px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .panel-header { padding: 18px 25px; background: rgba(255,255,255,0.02); border-bottom: 1px solid #2d2e36; display: flex; justify-content: space-between; align-items: center; }
    .premium-select { background-color: #15161b; color: #fff; border: 1px solid #333; border-radius: 6px; padding: 12px 15px; width: 100%; cursor: pointer; }
    .btn-save-all { width: 100%; padding: 15px; background: #e10600; color: white; border: none; font-weight: 800; cursor: pointer; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; margin-top: 15px; }
    .position-marker { font-size: 1.2rem; font-weight: 900; color: #8a8a93; width: 35px; text-align: center; font-style: italic; }
    .special-input { margin-bottom: 15px; }
    .special-input label { display: block; margin-bottom: 5px; color: #e10600; font-weight: bold; font-size: 0.8rem; text-transform: uppercase; }
    .calendar-list { max-height: 350px; overflow-y: auto; }
    .race-item { padding: 12px 15px; border-bottom: 1px solid #2d2e36; }
    .race-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .race-date { color: #e10600; font-weight: 800; font-size: 0.8rem; }
    .race-country { font-weight: bold; font-size: 0.9rem; }
    .race-events { display: flex; gap: 5px; }
    .badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #333; color: #aaa; }
    .badge.sprint { background: #ffcc00; color: #000; }
    .badge.race { background: #e10600; color: #fff; }
    .ranking-list { padding: 12px 25px; list-style: none; margin: 0; }
    .ranking-list li { padding: 6px 0; color: #ccc; font-size: 0.9rem; }
    .ranking-list li.me { color: #fff; font-weight: bold; }
  `],
})
export class BetTabComponent {
  @Input() drivers: Driver[] = [];
  @Input() ranking: RankingEntry[] = [];
  @Input() calendar: CalendarRace[] = [];
  @Input() userId: number | null = null;
  @Input() username = '';

  prediction: Prediction = {
    top_10: new Array(10).fill(''),
    tire_strategies: {},
    driver_of_day: '',
    most_positions_gained: '',
  };

  constructor(private api: ApiService) {}

  isDriverSelected(code: string, idx: number): boolean {
    return this.prediction.top_10.includes(code) && this.prediction.top_10[idx] !== code;
  }

  getDriverImage(code: string): string {
    const d = this.drivers.find((x) => x.code === code);
    return d ? d.image : 'assets/drivers/placeholder.png';
  }

  getDriverImageByName(name: string): string {
    const d = this.drivers.find((x) => x.name === name);
    return d ? d.image : 'assets/drivers/placeholder.png';
  }

  handleImageError(event: any) {
    event.target.src = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';
  }

  setTire(idx: number, type: 'start' | 'end', compound: string) {
    const code = this.prediction.top_10[idx];
    if (!code) return;
    if (!this.prediction.tire_strategies[code]) this.prediction.tire_strategies[code] = { start: '', end: '' };
    this.prediction.tire_strategies[code][type] = compound;
  }

  getTire(idx: number, type: 'start' | 'end'): string {
    const code = this.prediction.top_10[idx];
    return code && this.prediction.tire_strategies[code] ? this.prediction.tire_strategies[code][type] : '';
  }

  submitPrediction() {
    if (!this.userId) return;
    this.api
      .submitPrediction({
        user_id: this.userId,
        race_slug: this.calendar[0]?.gp || 'AUS',
        top_10: this.prediction.top_10,
        tire_strategies: this.prediction.tire_strategies,
        driver_of_day: this.prediction.driver_of_day,
        most_positions_gained: this.prediction.most_positions_gained,
      })
      .subscribe(() => alert('Estratégia salva no banco de dados!'));
  }
}
```

- [ ] **Step 9.4: Atualizar app.component.ts para usar BetTabComponent**

Em `frontend/src/app/app.component.ts`:

1. Adicionar import: `import { BetTabComponent } from './bet/bet-tab.component';`
2. Adicionar `BetTabComponent` ao array `imports`.
3. Substituir o bloco `<div *ngIf="activeTab === 'bet'" class="tab-content bet-layout">...</div>` (todo o conteúdo até o fechamento) por:

```html
<app-bet-tab
  *ngIf="activeTab === 'bet'"
  [drivers]="drivers"
  [ranking]="ranking"
  [calendar]="calendar"
  [userId]="userId"
  [username]="username">
</app-bet-tab>
```

4. Remover do componente as propriedades `prediction`, e os métodos `submitPrediction`, `isDriverSelected`, `getDriverImage`, `getDriverImageByName`, `handleImageError`, `setTire`, `getTire`. **Manter** os métodos de telemetria, holograma e túnel — esses ainda vivem aqui até as próximas fases.

- [ ] **Step 9.5: Rodar tests e ver passar**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: testes do `ApiService` (5) + `LoginComponent` (3) + `BetTabComponent` (3) PASS.

- [ ] **Step 9.6: Smoke manual em browser**

Run: `docker-compose up -d`. Abrir `http://localhost`. Logar e verificar:
- Aba "Grid & Apostas" carrega
- Selecionar pilotos no top 10 funciona
- Toggles de pneus marcam/desmarcam
- Botão "SALVAR PREDIÇÃO" dispara alert

- [ ] **Step 9.7: Commit**

```bash
git add frontend/src/app/bet/ frontend/src/app/app.component.ts
git commit -m "refactor(frontend): extract BetTabComponent (R2 step 2/2)"
```

---

## Task 10: Verificação final + tag de release da Fase 0

**Files:** nenhum modificado.

- [ ] **Step 10.1: Rodar suite completa do backend**

Run: `cd backend && pytest -v`
Expected: 10 PASS (5 auth_service + 5 main_auth).

- [ ] **Step 10.2: Rodar suite completa do frontend**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: 11 PASS (5 ApiService + 3 LoginComponent + 3 BetTabComponent).

- [ ] **Step 10.3: Build de produção do frontend**

Run: `docker-compose build frontend`
Expected: build conclui em <40s no rebuild.

- [ ] **Step 10.4: Stack completa funciona**

Run: `docker-compose up -d`. Abrir `http://localhost`.
- [ ] Cadastrar novo usuário → registra, login automático funciona
- [ ] Logar com mesmo usuário em sessão limpa → entra
- [ ] Logar com senha errada → "Credenciais inválidas"
- [ ] Aba Apostas funciona como antes
- [ ] Abas Telemetria, Hub e Túnel continuam funcionando (não mexemos, só validar que não quebrou)

Derrubar com `docker-compose down`.

- [ ] **Step 10.5: Verificar bcrypt no DB**

Run: `docker-compose up -d db backend`. Aguardar boot. Em outro terminal:
```bash
docker-compose exec db psql -U postgres -d f1fantasy -c "SELECT username, password_hash FROM users LIMIT 3;"
```
Expected: `password_hash` começa com `$2b$` ou `$2a$` (formato bcrypt), não é texto puro.

- [ ] **Step 10.6: Tag**

```bash
git tag -a fase-0-fundacao -m "Fase 0 (Fundação) completa: bcrypt + npm ci + LoginComponent + BetTabComponent + ApiService + Alembic baseline"
```

---

## Notas de deploy

Após deploy desse commit pela primeira vez em ambiente novo, executar uma única vez para alinhar Alembic com o estado do DB:

```bash
docker-compose exec backend alembic stamp 000_baseline
```

Não rodar isso em ambiente que já tinha tabelas alembic_version (não é o caso aqui — Fase 0 introduz Alembic do zero).

A migração para bcrypt **invalida usuários existentes** (senhas viraram texto puro no DB legado). Como o ambiente é dev sem usuários reais, o impacto é apagar e recadastrar. Comando de limpeza:

```bash
docker-compose exec db psql -U postgres -d f1fantasy -c "DELETE FROM predictions; DELETE FROM users;"
```
