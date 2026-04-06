from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
import json
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


@router.post("/", response_model=schemas.ShoppingListOut, status_code=201)
def create_shopping_list(
    data: schemas.ShoppingListCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Supprimer l'ancienne si elle existe
    old = db.query(models.ShoppingList).filter(
        models.ShoppingList.user_id == current_user.id,
        models.ShoppingList.week_date == data.week_date
    ).first()
    if old:
        db.delete(old)

    shopping = models.ShoppingList(**data.dict(), user_id=current_user.id)
    db.add(shopping)
    db.commit()
    db.refresh(shopping)
    return shopping


@router.get("/week/{week_date}", response_model=schemas.ShoppingListOut)
def get_shopping_list(
    week_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    shopping = db.query(models.ShoppingList).filter(
        models.ShoppingList.user_id == current_user.id,
        models.ShoppingList.week_date == week_date
    ).first()
    if not shopping:
        raise HTTPException(status_code=404, detail="Aucune liste pour cette semaine")
    return shopping


@router.patch("/week/{week_date}/item/{item_idx}")
def toggle_item(
    week_date: date,
    item_idx: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Cocher/décocher un article de la liste"""
    shopping = db.query(models.ShoppingList).filter(
        models.ShoppingList.user_id == current_user.id,
        models.ShoppingList.week_date == week_date
    ).first()
    if not shopping:
        raise HTTPException(status_code=404, detail="Liste introuvable")

    items = json.loads(shopping.items)
    if item_idx >= len(items):
        raise HTTPException(status_code=400, detail="Index invalide")

    items[item_idx]["done"] = not items[item_idx]["done"]
    shopping.items = json.dumps(items, ensure_ascii=False)

    # Marquer la liste comme terminée si tout est coché
    shopping.is_done = all(i["done"] for i in items)
    db.commit()
    return {"ok": True, "done": items[item_idx]["done"]}


@router.get("/", response_model=List[schemas.ShoppingListOut])
def list_all_shopping(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.ShoppingList).filter(
        models.ShoppingList.user_id == current_user.id
    ).order_by(models.ShoppingList.week_date.desc()).all()
