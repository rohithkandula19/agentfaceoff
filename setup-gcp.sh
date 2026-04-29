#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  AgentFaceOff — one-time GCP setup
#  Run this ONCE before your first Cloud Build deploy.
#  Usage: bash setup-gcp.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="agentfaceoff"
REGION="us-central1"
INSTANCE="agentfaceoff-postgres"
DB_NAME="agentfaceoff"
DB_USER="agentfaceoff"

# ── 1. Auth + project ──────────────────────────────────────────
gcloud config set project "$PROJECT_ID"
echo "✓ Project set to $PROJECT_ID"

# ── 2. Enable APIs ────────────────────────────────────────────
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com
echo "✓ APIs enabled"

# ── 3. Cloud SQL PostgreSQL ───────────────────────────────────
if gcloud sql instances describe "$INSTANCE" --quiet 2>/dev/null; then
  echo "ℹ  Cloud SQL instance '$INSTANCE' already exists — skipping creation"
else
  echo "Creating Cloud SQL instance (takes ~5 min)…"
  gcloud sql instances create "$INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-g1-small \
    --region="$REGION" \
    --no-backup
  echo "✓ Cloud SQL instance created"
fi

if gcloud sql databases describe "$DB_NAME" --instance="$INSTANCE" --quiet 2>/dev/null; then
  echo "ℹ  Database '$DB_NAME' already exists — skipping"
else
  gcloud sql databases create "$DB_NAME" --instance="$INSTANCE"
  echo "✓ Database '$DB_NAME' created"
fi

# Prompt for DB password
echo ""
read -r -s -p "Enter a secure password for the Cloud SQL user '$DB_USER': " DB_PASS
echo ""
gcloud sql users create "$DB_USER" --instance="$INSTANCE" --password="$DB_PASS" 2>/dev/null \
  || gcloud sql users set-password "$DB_USER" --instance="$INSTANCE" --password="$DB_PASS"
echo "✓ DB user '$DB_USER' configured"

# ── 4. Secret Manager ─────────────────────────────────────────
create_or_update_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --quiet 2>/dev/null; then
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=-
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=-
  fi
  echo "✓ Secret '$name' stored"
}

echo ""
read -r -p "Paste your GROQ_API_KEY: " GROQ_KEY
create_or_update_secret "groq-api-key" "$GROQ_KEY"

read -r -p "Paste your OPENROUTER_API_KEY: " OR_KEY
create_or_update_secret "openrouter-api-key" "$OR_KEY"

read -r -p "Paste your TAVILY_API_KEY: " TAV_KEY
create_or_update_secret "tavily-api-key" "$TAV_KEY"

# Build DATABASE_URL using Cloud SQL socket
DB_URL="postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE}"
create_or_update_secret "database-url" "$DB_URL"

JWT_SECRET=$(openssl rand -hex 32)
create_or_update_secret "jwt-secret" "$JWT_SECRET"
echo "  (JWT secret auto-generated)"

ORIGINS="https://agentfaceoff.web.app,https://agentfaceoff.firebaseapp.com"
create_or_update_secret "allowed-origins" "$ORIGINS"

# ── 5. IAM — Secret Manager access ───────────────────────────
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
CR_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/secretmanager.secretAccessor" --quiet
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CR_SA}" \
  --role="roles/secretmanager.secretAccessor" --quiet
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CR_SA}" \
  --role="roles/cloudsql.client" --quiet
echo "✓ IAM bindings configured"

# ── 6. Summary ────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅  GCP setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Deploy backend:"
echo "     cd $(pwd)"
echo "     gcloud builds submit --config backend/cloudbuild.yaml"
echo ""
echo "  2. Get Cloud Run URL:"
echo "     gcloud run services describe agentfaceoff-backend \\"
echo "       --region=us-central1 --format='value(status.url)'"
echo ""
echo "  3. Build frontend (replace URL with actual Cloud Run URL):"
echo "     cd frontend"
echo "     VITE_API_URL=https://YOUR_CLOUD_RUN_URL \\"
echo "     VITE_WS_URL=wss://YOUR_CLOUD_RUN_URL \\"
echo "     npm run build"
echo ""
echo "  4. Deploy frontend to Firebase:"
echo "     firebase deploy --only hosting"
echo "══════════════════════════════════════════════════════════"
