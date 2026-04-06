from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
import json
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/meals", tags=["meals"])

DAYS_ORDER = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MEAL_ORDER = ["petit-déjeuner", "déjeuner", "dîner", "collation"]


@router.post("/", response_model=schemas.MealPlanOut, status_code=201)
def create_meal(
    data: schemas.MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meal = models.MealPlan(**data.dict(), user_id=current_user.id)
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.get("/week/{week_date}", response_model=List[schemas.MealPlanOut])
def get_week_meals(
    week_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meals = db.query(models.MealPlan).filter(
        models.MealPlan.user_id == current_user.id,
        models.MealPlan.week_date == week_date
    ).all()

    # Trier par jour + type de repas
    def sort_key(m):
        day_idx = DAYS_ORDER.index(m.day_of_week.lower()) if m.day_of_week.lower() in DAYS_ORDER else 99
        meal_idx = MEAL_ORDER.index(m.meal_type.lower()) if m.meal_type.lower() in MEAL_ORDER else 99
        return (day_idx, meal_idx)

    return sorted(meals, key=sort_key)


@router.delete("/{meal_id}", status_code=204)
def delete_meal(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meal = db.query(models.MealPlan).filter(
        models.MealPlan.id == meal_id,
        models.MealPlan.user_id == current_user.id
    ).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Repas introuvable")
    db.delete(meal)
    db.commit()


@router.post("/generate-shopping/{week_date}", response_model=schemas.ShoppingListOut)
def generate_shopping_list(
    week_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Génère automatiquement une liste de courses depuis le plan de la semaine"""
    meals = db.query(models.MealPlan).filter(
        models.MealPlan.user_id == current_user.id,
        models.MealPlan.week_date == week_date
    ).all()

    if not meals:
        raise HTTPException(status_code=404, detail="Aucun repas planifié pour cette semaine")

    # Créer la liste à partir des recettes
    items = []
    seen = set()
    for meal in meals:
        if meal.recipe_name and meal.recipe_name not in seen:
            items.append({
                "name": f"Ingrédients pour : {meal.recipe_name}",
                "qty": "selon recette",
                "category": meal.meal_type,
                "done": False
            })
            seen.add(meal.recipe_name)

    # Supprimer l'ancienne liste si elle existe
    old = db.query(models.ShoppingList).filter(
        models.ShoppingList.user_id == current_user.id,
        models.ShoppingList.week_date == week_date
    ).first()
    if old:
        db.delete(old)

    shopping = models.ShoppingList(
        user_id=current_user.id,
        week_date=week_date,
        items=json.dumps(items, ensure_ascii=False)
    )
    db.add(shopping)
    db.commit()
    db.refresh(shopping)
    return shopping
