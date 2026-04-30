from sqlalchemy import Column, Integer, String, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    total_points = Column(Integer, default=0)
    predictions = relationship("Prediction", back_populates="user")

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    race_slug = Column(String)
    season = Column(Integer)
    
    # Palpites
    top_10 = Column(JSON) # Lista de drivers codes
    
    # NOVOS CAMPOS: Estratégia de Pneus
    # Vamos salvar como JSON: {"VER": {"start": "SOFT", "end": "HARD"}, ...}
    tire_strategy = Column(JSON, default={}) 
    
    driver_of_day = Column(String)
    most_positions_gained = Column(String)
    
    points_earned = Column(Integer, default=0)
    user = relationship("User", back_populates="predictions")