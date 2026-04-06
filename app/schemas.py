from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    height_cm: Optional[float] = None
    target_weight: Optional[float] = None
    is_admin: bool = False


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    height_cm: Optional[float]
    target_weight: Optional[float]
    is_admin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginData(BaseModel):
    username: str
    password: str


# ── Check-in hebdomadaire ─────────────────────────────────────────────────────
class CheckinCreate(BaseModel):
    week_date: date
    weight_kg: Optional[float] = None
    steps_per_day: Optional[int] = None
    sport_sessions: Optional[int] = 0
    sport_minutes: Optional[int] = 0
    energy_level: Optional[int] = None   # 1-5
    mood: Optional[int] = None           # 1-5
    notes: Optional[str] = None


class CheckinOut(CheckinCreate):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Plan de repas ─────────────────────────────────────────────────────────────
class MealPlanCreate(BaseModel):
    week_date: date
    day_of_week: str
    meal_type: str
    recipe_name: str
    calories: Optional[int] = None
    proteins_g: Optional[float] = None
    notes: Optional[str] = None


class MealPlanOut(MealPlanCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True


# ── Liste de courses ──────────────────────────────────────────────────────────
class ShoppingListCreate(BaseModel):
    week_date: date
    items: str   # JSON string: [{"name": "...", "qty": "...", "done": false}]


class ShoppingListOut(ShoppingListCreate):
    id: int
    user_id: int
    is_done: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Recettes ─────────────────────────────────────────────────────────────────
class IngredientItem(BaseModel):
    name: str
    qty: str = ""


class RecipeCreate(BaseModel):
    name: str
    cuisine: Optional[str] = None
    servings: int = 4
    prep_time: Optional[int] = None
    cook_time: Optional[int] = None
    calories_per_serving: Optional[int] = None
    proteins_per_serving: Optional[float] = None
    ingredients: List[IngredientItem] = []
    steps: List[str] = []
    notes: Optional[str] = None


class RecipeOut(BaseModel):
    id: int
    user_id: int
    name: str
    cuisine: Optional[str]
    servings: int
    prep_time: Optional[int]
    cook_time: Optional[int]
    calories_per_serving: Optional[int]
    proteins_per_serving: Optional[float]
    ingredients: str  # JSON string
    steps: str        # JSON string
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Import Claude ─────────────────────────────────────────────────────────────
class MealBulkItem(BaseModel):
    day_of_week: str
    meal_type: str
    recipe_name: str
    calories: Optional[int] = None
    proteins_g: Optional[float] = None
    notes: Optional[str] = None


class ShoppingBulkItem(BaseModel):
    name: str
    qty: str = ""
    category: str = ""


# ── Exercices ─────────────────────────────────────────────────────────────────
class ExerciseBulkItem(BaseModel):
    day_of_week: str
    exercise_name: str
    exercise_type: str = "renforcement"   # marche, renforcement, étirement, cardio
    sets: Optional[int] = None
    reps_or_duration: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    order_idx: int = 0


class ExerciseOut(BaseModel):
    id: int
    day_of_week: str
    exercise_name: str
    exercise_type: str
    sets: Optional[int]
    reps_or_duration: Optional[str]
    description: Optional[str]
    image_url: Optional[str]
    order_idx: int
    done: bool

    class Config:
        from_attributes = True


class WeekImport(BaseModel):
    week_date: date
    meals: List[MealBulkItem] = []
    shopping: List[ShoppingBulkItem] = []
    recipes: List[RecipeCreate] = []
    exercises: List[ExerciseBulkItem] = []


# ── Stats / Dashboard ─────────────────────────────────────────────────────────
class WeeklyStats(BaseModel):
    week_date: date
    weight_kg: Optional[float]
    weight_delta: Optional[float]    # différence avec semaine précédente
    steps_per_day: Optional[int]
    sport_sessions: Optional[int]
    energy_level: Optional[int]
    mood: Optional[int]
    trend: str                        # "positive", "negative", "stable", "no_data"
