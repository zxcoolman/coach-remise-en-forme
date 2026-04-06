from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/checkins", tags=["checkins"])


@router.post("/", response_model=schemas.CheckinOut, status_code=201)
def create_checkin(
    data: schemas.CheckinCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Vérifier qu'il n'existe pas déjà un checkin pour cette semaine
    existing = db.query(models.WeeklyCheckin).filter(
        models.WeeklyCheckin.user_id == current_user.id,
        models.WeeklyCheckin.week_date == data.week_date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Un check-in existe déjà pour cette semaine")

    checkin = models.WeeklyCheckin(**data.dict(), user_id=current_user.id)
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


@router.put("/{checkin_id}", response_model=schemas.CheckinOut)
def update_checkin(
    checkin_id: int,
    data: schemas.CheckinCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    checkin = db.query(models.WeeklyCheckin).filter(
        models.WeeklyCheckin.id == checkin_id,
        models.WeeklyCheckin.user_id == current_user.id
    ).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in introuvable")

    for key, value in data.dict().items():
        setattr(checkin, key, value)
    db.commit()
    db.refresh(checkin)
    return checkin


@router.get("/", response_model=List[schemas.CheckinOut])
def list_checkins(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.WeeklyCheckin).filter(
        models.WeeklyCheckin.user_id == current_user.id
    ).order_by(models.WeeklyCheckin.week_date.desc()).all()


@router.get("/stats", response_model=List[schemas.WeeklyStats])
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    checkins = db.query(models.WeeklyCheckin).filter(
        models.WeeklyCheckin.user_id == current_user.id
    ).order_by(models.WeeklyCheckin.week_date.asc()).all()

    stats = []
    prev_weight = None
    for c in checkins:
        delta = None
        if prev_weight is not None and c.weight_kg is not None:
            delta = round(c.weight_kg - prev_weight, 2)

        # Calcul de la tendance
        if delta is None:
            trend = "no_data"
        elif delta < -0.2:
            trend = "positive"
        elif delta > 0.2:
            trend = "negative"
        else:
            trend = "stable"

        stats.append(schemas.WeeklyStats(
            week_date=c.week_date,
            weight_kg=c.weight_kg,
            weight_delta=delta,
            steps_per_day=c.steps_per_day,
            sport_sessions=c.sport_sessions,
            energy_level=c.energy_level,
            mood=c.mood,
            trend=trend
        ))
        if c.weight_kg is not None:
            prev_weight = c.weight_kg

    return list(reversed(stats))
