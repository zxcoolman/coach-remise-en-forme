#!/bin/bash
# ══════════════════════════════════════════════════════
#  Script : Créer le repo GitHub et pousser l'application
#  À lancer UNE SEULE FOIS depuis ton terminal WSL Ubuntu
# ══════════════════════════════════════════════════════

set -e

GITHUB_TOKEN="${GITHUB_TOKEN:-}"  # Défini via variable d'environnement
GITHUB_USER="zxcoolman"
REPO_NAME="coach-remise-en-forme"

echo ""
echo "🚀 Création du repo GitHub : $REPO_NAME"
echo "══════════════════════════════════════════"

# 1. Créer le repo sur GitHub
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"Application de suivi minceur et remise en forme\",\"private\":false,\"auto_init\":false}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Repo créé : https://github.com/$GITHUB_USER/$REPO_NAME"
elif echo "$BODY" | grep -q "already exists"; then
  echo "ℹ️  Le repo existe déjà, on continue..."
else
  echo "⚠️  Réponse GitHub : $BODY"
  echo "   Continue quand même avec git push..."
fi

# 2. Init git si pas encore fait
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

# 3. Configurer le remote
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git"

# 4. Commit et push
git add -A
git commit -m "feat: application coach remise en forme

- Auth JWT multi-utilisateurs (login/register)
- Check-in hebdomadaire (poids, activité, énergie, humeur)
- Plan de repas par semaine avec grille visuelle
- Liste de courses auto-générée depuis le plan
- Tableau de bord avec courbes Chart.js
- Déploiement Railway avec Dockerfile" 2>/dev/null || echo "Rien à committer"

git push -u origin main --force

echo ""
echo "✅ Code poussé sur : https://github.com/$GITHUB_USER/$REPO_NAME"
echo ""
echo "══════════════════════════════════════════"
echo "📦 ÉTAPES SUIVANTES — DÉPLOIEMENT RAILWAY"
echo "══════════════════════════════════════════"
echo ""
echo "1. Va sur https://railway.app"
echo "2. Clique 'New Project'"
echo "3. Choisis 'Deploy from GitHub repo'"
echo "4. Sélectionne : $GITHUB_USER/$REPO_NAME"
echo "5. Railway détecte automatiquement le Dockerfile"
echo "6. Dans 'Variables', ajoute :"
echo "   SECRET_KEY = une-chaine-aleatoire-longue-ici"
echo "7. Clique Deploy → ton app sera en ligne en 2 min !"
echo ""
echo "🌐 L'URL sera du type : https://$REPO_NAME.railway.app"
echo ""
