from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Optional
from database import get_db, engine, Base
import models
from services.f1_service import F1Service
from services.auth_service import hash_password, verify_password


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)
f1_service = F1Service()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Schemas ---
class UserLogin(BaseModel):
    username: str
    password: str

class TireStrategy(BaseModel):
    start: str
    end: str

class PredictionCreate(BaseModel):
    user_id: int
    race_slug: str
    top_10: List[str]
    tire_strategies: Dict[str, TireStrategy] 
    driver_of_day: str
    most_positions_gained: str

class AnalysisRequest(BaseModel):
    driver_code: str
    race_x: str
    race_y: str

# --- Endpoints ---

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

@app.get("/drivers")
def get_drivers():
    return f1_service.get_current_drivers(year=2024)

@app.post("/predict")
def make_prediction(pred: PredictionCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Prediction).filter(
        models.Prediction.user_id == pred.user_id,
        models.Prediction.race_slug == pred.race_slug
    ).first()

    tire_json = {k: v.dict() for k, v in pred.tire_strategies.items()}

    if existing:
        existing.top_10 = pred.top_10
        existing.tire_strategy = tire_json
        existing.driver_of_day = pred.driver_of_day
        existing.most_positions_gained = pred.most_positions_gained
    else:
        db_pred = models.Prediction(
            user_id=pred.user_id,
            race_slug=pred.race_slug,
            season=2024,
            top_10=pred.top_10,
            tire_strategy=tire_json,
            driver_of_day=pred.driver_of_day,
            most_positions_gained=pred.most_positions_gained
        )
        db.add(db_pred)
    
    db.commit()
    return {"status": "Aposta Salva!"}

@app.get("/ranking")
def get_ranking(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.total_points.desc()).all()

@app.post("/analyze")
def analyze(req: AnalysisRequest):
    # CORREÇÃO AQUI: Retorna o resultado direto do serviço, sem criar um novo dicionário
    return f1_service.analyze_driver_evolution(req.driver_code, req.race_x, req.race_y)

@app.get("/team-stats/{team_name}")
def team_stats(team_name: str):
    return f1_service.get_team_stats(team_name)