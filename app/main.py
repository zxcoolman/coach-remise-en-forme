from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import Base, engine
from .routers import auth, checkins, meals, shopping
import os

# Créer les tables au démarrage
Base.metadata.create_all(bind=engine)

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
