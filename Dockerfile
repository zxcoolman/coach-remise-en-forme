FROM python:3.11-slim

WORKDIR /code

# Dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code de l'application
COPY . .

# Créer le dossier pour la base de données
RUN mkdir -p /data

# Exposer le port
EXPOSE 8000

# Lancer l'application
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
