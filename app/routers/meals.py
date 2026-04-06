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


@router.post("/bulk", status_code=201)
def import_week(
    data: schemas.WeekImport,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Importe un plan de semaine complet généré par Claude (repas + courses + recettes)"""
    # replace_days=None → tout écraser ; replace_days=[...] → seulement ces jours
    days = [d.lower() for d in data.replace_days] if data.replace_days is not None else None

    # Supprimer les repas existants (tous ou par jour)
    q_meals = db.query(models.MealPlan).filter(
        models.MealPlan.user_id == current_user.id,
        models.MealPlan.week_date == data.week_date
    )
    if days is not None:
        q_meals = q_meals.filter(models.MealPlan.day_of_week.in_(days))
    q_meals.delete(synchronize_session=False)

    # Créer les repas (filtrer par jours sélectionnés si partiel)
    for m in data.meals:
        if days is None or m.day_of_week.lower() in days:
            db.add(models.MealPlan(
                user_id=current_user.id,
                week_date=data.week_date,
                **m.dict()
            ))

    # Courses : remplacer seulement si import total OU si explicitement fourni avec jours=None
    if data.shopping and days is None:
        old = db.query(models.ShoppingList).filter(
            models.ShoppingList.user_id == current_user.id,
            models.ShoppingList.week_date == data.week_date
        ).first()
        if old:
            db.delete(old)
        items = [{"name": s.name, "qty": s.qty, "category": s.category, "done": False}
                 for s in data.shopping]
        db.add(models.ShoppingList(
            user_id=current_user.id,
            week_date=data.week_date,
            items=json.dumps(items, ensure_ascii=False)
        ))

    # Exercices (tous ou par jour)
    if data.exercises:
        q_ex = db.query(models.DailyExercise).filter(
            models.DailyExercise.user_id == current_user.id,
            models.DailyExercise.week_date == data.week_date
        )
        if days is not None:
            q_ex = q_ex.filter(models.DailyExercise.day_of_week.in_(days))
        q_ex.delete(synchronize_session=False)
        for e in data.exercises:
            if days is None or e.day_of_week.lower() in days:
                db.add(models.DailyExercise(
                    user_id=current_user.id,
                    week_date=data.week_date,
                    **e.dict()
                ))

    # Créer les recettes si fournies
    if data.recipes:
        for r in data.recipes:
            # Remplacer si une recette du même nom existe déjà
            existing = db.query(models.Recipe).filter(
                models.Recipe.user_id == current_user.id,
                models.Recipe.name == r.name
            ).first()
            if existing:
                db.delete(existing)
            db.add(models.Recipe(
                user_id=current_user.id,
                name=r.name,
                cuisine=r.cuisine,
                servings=r.servings,
                prep_time=r.prep_time,
                cook_time=r.cook_time,
                calories_per_serving=r.calories_per_serving,
                proteins_per_serving=r.proteins_per_serving,
                ingredients=json.dumps([i.dict() for i in r.ingredients], ensure_ascii=False),
                steps=json.dumps(r.steps, ensure_ascii=False),
                notes=r.notes
            ))

    db.commit()
    return {
        "ok": True,
        "meals_imported": len(data.meals),
        "shopping_items": len(data.shopping),
        "recipes_imported": len(data.recipes),
        "exercises_imported": len(data.exercises)
    }


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
