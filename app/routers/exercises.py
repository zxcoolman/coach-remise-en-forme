from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("/week/{week_date}", response_model=List[schemas.ExerciseOut])
def get_week_exercises(
    week_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
    exercises = db.query(models.DailyExercise).filter(
        models.DailyExercise.user_id == current_user.id,
        models.DailyExercise.week_date == week_date
    ).all()
    return sorted(exercises, key=lambda e: (
        DAYS.index(e.day_of_week.lower()) if e.day_of_week.lower() in DAYS else 99,
        e.order_idx
    ))


@router.patch("/{exercise_id}/toggle")
def toggle_done(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ex = db.query(models.DailyExercise).filter(
        models.DailyExercise.id == exercise_id,
        models.DailyExercise.user_id == current_user.id
    ).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercice introuvable")
    ex.done = not ex.done
    db.commit()
    return {"ok": True, "done": ex.done}


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ex = db.query(models.DailyExercise).filter(
        models.DailyExercise.id == exercise_id,
        models.DailyExercise.user_id == current_user.id
    ).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercice introuvable")
    db.delete(ex)
    db.commit()
