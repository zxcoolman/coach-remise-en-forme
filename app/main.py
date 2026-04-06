from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import text
from .database import Base, engine, SessionLocal
from .routers import auth, checkins, meals, shopping, recipes, exercises
from . import models
from .auth import get_password_hash
import os
import secrets
import string

# Créer les tables au démarrage
Base.metadata.create_all(bind=engine)


def run_migrations():
    """Applique les migrations de colonnes manquantes sur les tables existantes."""
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
        ))
        conn.commit()


run_migrations()


def create_admin_if_missing():
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.is_admin == True).first()
        if not admin:
            alphabet = string.ascii_letters + string.digits
            password = ''.join(secrets.choice(alphabet) for _ in range(16))
            admin = models.User(
                username="admin",
                email="admin@local",
                hashed_password=get_password_hash(password),
                full_name="Administrateur",
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            print("=" * 50)
            print("ADMIN CRÉÉ — MOT DE PASSE (affiché une seule fois) :")
            print(f"  username : admin")
            print(f"  password : {password}")
            print("=" * 50)
    finally:
        db.close()


create_admin_if_missing()

app = FastAPI(
    title="Coach Remise en Forme",
    description="Suivi personnalisé minceur et remise en forme",
    version="1.0.0"
)

# Routes API
app.include_router(auth.router)
app.include_router(checkins.router)
app.include_router(meals.router)
app.include_router(shopping.router)
app.include_router(recipes.router)
app.include_router(exercises.router)

# Servir le frontend statique
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", include_in_schema=False)
def root():
    index_path = os.path.join(static_dir, "index.html")
    return FileResponse(index_path)

@app.get("/health")
def health():
    return {"status": "ok", "app": "Coach Remise en Forme"}
