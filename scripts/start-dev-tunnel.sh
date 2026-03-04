#!/bin/bash
# ============================================================
# ProPod Dev Startup — Tunnel Mode
#
# Usage: ./scripts/start-dev-tunnel.sh
#
# What it does:
#   1. Starts FastAPI backend
#   2. Starts ngrok tunnel on port 8000 (HTTPS public URL)
#   3. Auto-reads ngrok URL → updates API_BASE_URL in frontend/.env
#                           → updates BASE_URL in backend/.env
#   4. Starts Expo in tunnel mode
#
# Use this when:
#   - Testing 100ms RTC webhooks (need public URL)
#   - Phone on mobile data (different network)
#   - Sharing dev build with others remotely
#
# Requires: ngrok installed and authenticated
#   Install: https://ngrok.com/download
#   Auth:    ngrok config add-authtoken <token>
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"
BACKEND_ENV="$ROOT_DIR/backend/.env"

echo "🚀 ProPod Dev (Tunnel mode)"
echo "==========================="

# ── Preflight: check ngrok ───────────────────────────────────
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok not found."
    echo "   Install: https://ngrok.com/download"
    echo "   Or via npm: npm install -g @ngrok/ngrok"
    exit 1
fi

# ── Step 1: Start backend ────────────────────────────────────
echo "🐍 Starting backend..."
cd "$ROOT_DIR/backend"

if [ ! -f "venv/bin/activate" ]; then
    echo "❌ venv not found. Run: cd backend && python -m venv venv && pip install -r requirements.txt"
    exit 1
fi

source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait for backend — track whether it actually became ready
BACKEND_READY=false
for i in {1..10}; do
    if curl -s "http://localhost:8000/docs" > /dev/null 2>&1; then
        BACKEND_READY=true
        break
    fi
    sleep 1
done

if [ "$BACKEND_READY" = false ]; then
    echo "⚠️  Backend did not respond after 10s — check for venv/import errors above."
    echo "   Continuing, but API calls will fail until backend is up."
else
    echo "✅ Backend ready"
fi

# ── Step 2: Start ngrok tunnel for backend ───────────────────
echo "🌐 Starting ngrok tunnel (port 8000)..."
ngrok http 8000 --log=stdout > /tmp/propod-ngrok.log 2>&1 &
NGROK_PID=$!

# Register cleanup immediately after capturing all PIDs
trap "echo ''; echo '🛑 Stopping...'; kill $BACKEND_PID $NGROK_PID 2>/dev/null" EXIT INT TERM

# Poll ngrok API until URL is available (up to 15s) instead of blind sleep
NGROK_URL=""
for i in {1..15}; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for t in data.get('tunnels', []):
        url = t.get('public_url', '')
        if url.startswith('https://'):
            print(url)
            break
except:
    pass
" 2>/dev/null)
    [ -n "$NGROK_URL" ] && break
    sleep 1
done

if [ -z "$NGROK_URL" ]; then
    echo "❌ Could not get ngrok URL after 15s. Check /tmp/propod-ngrok.log"
    exit 1
fi

echo "✅ Backend tunnel: $NGROK_URL"

# ── Step 3: Update frontend/.env with ngrok URL ──────────────
if [ -f "$FRONTEND_ENV" ]; then
    sed -i "s|^API_BASE_URL=.*|API_BASE_URL=$NGROK_URL|" "$FRONTEND_ENV"
    sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$NGROK_URL|" "$FRONTEND_ENV"
    echo "✅ frontend/.env updated with ngrok URL"
else
    echo "⚠️  frontend/.env not found — creating from example"
    cp "$ROOT_DIR/frontend/.env.example" "$FRONTEND_ENV"
    sed -i "s|API_BASE_URL=.*|API_BASE_URL=$NGROK_URL|" "$FRONTEND_ENV"
    sed -i "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$NGROK_URL|" "$FRONTEND_ENV"
fi

# ── Step 4: Update backend/.env BASE_URL with ngrok URL ──────
# Backend uses BASE_URL to generate absolute media/profile links —
# must point to the public ngrok URL in tunnel mode.
if [ -f "$BACKEND_ENV" ]; then
    if grep -q "^BASE_URL=" "$BACKEND_ENV"; then
        sed -i "s|^BASE_URL=.*|BASE_URL=$NGROK_URL|" "$BACKEND_ENV"
    else
        echo "BASE_URL=$NGROK_URL" >> "$BACKEND_ENV"
    fi
    echo "✅ backend/.env BASE_URL updated"
fi

echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  Backend:  $NGROK_URL"
echo "│  Webhooks: $NGROK_URL/rtc/webhooks/100ms"
echo "└─────────────────────────────────────────────────────┘"
echo ""

# ── Step 5: Start Expo (tunnel) ───────────────────────────────
echo "📱 Starting Expo (tunnel mode)..."
echo "   Works on any network, including mobile data"
echo ""
cd "$ROOT_DIR/frontend"
npm run start:dev:tunnel
