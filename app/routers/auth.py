from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..auth import get_password_hash, verify_password, create_access_token, get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


def require_admin(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Réservé à l'administrateur")
    return current_user


@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if db.query(models.User).filter(models.User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")
    if db.query(models.User).filter(models.User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")

    user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        height_cm=user_data.height_cm,
        target_weight=user_data.target_weight,
        is_admin=user_data.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    return db.query(models.User).order_by(models.User.created_at).all()


@router.patch("/users/{user_id}/role")
def update_role(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas modifier ton propre rôle")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_admin = body.get("is_admin", False)
    db.commit()
    return {"ok": True, "username": user.username, "is_admin": user.is_admin}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas supprimer ton propre compte")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    db.delete(user)
    db.commit()


@router.patch("/users/{user_id}/credentials")
def update_credentials(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if "email" in body and body["email"]:
        existing = db.query(models.User).filter(
            models.User.email == body["email"],
            models.User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        user.email = body["email"]
    if "password" in body and body["password"]:
        user.hashed_password = get_password_hash(body["password"])
    db.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/toggle-active")
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Tu ne peux pas te bloquer toi-même")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_active = not user.is_active
    db.commit()
    return {"ok": True, "is_active": user.is_active}


@router.post("/users/{user_id}/impersonate", response_model=schemas.Token)
def impersonate(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Tu es déjà toi-même")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=schemas.Token)
def login(data: schemas.LoginData, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Ce compte est désactivé")
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
