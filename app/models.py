from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    height_cm = Column(Float)          # taille en cm
    target_weight = Column(Float)      # poids objectif
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    checkins = relationship("WeeklyCheckin", back_populates="user", cascade="all, delete-orphan")
    meal_plans = relationship("MealPlan", back_populates="user", cascade="all, delete-orphan")
    shopping_lists = relationship("ShoppingList", back_populates="user", cascade="all, delete-orphan")


class WeeklyCheckin(Base):
    __tablename__ = "weekly_checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_date = Column(Date, nullable=False)       # lundi de la semaine
    weight_kg = Column(Float)                       # poids mesuré
    steps_per_day = Column(Integer)                 # pas/jour moyen
    sport_sessions = Column(Integer, default=0)     # nb séances sport
    sport_minutes = Column(Integer, default=0)      # minutes totales
    energy_level = Column(Integer)                  # 1-5
    mood = Column(Integer)                          # 1-5
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="checkins")


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_date = Column(Date, nullable=False)
    day_of_week = Column(String)                    # lundi, mardi...
    meal_type = Column(String)                      # petit-déjeuner, déjeuner, dîner
    recipe_name = Column(String)
    calories = Column(Integer)
    proteins_g = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="meal_plans")


class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_date = Column(Date, nullable=False)
    items = Column(Text)                             # JSON string
    is_done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="shopping_lists")
