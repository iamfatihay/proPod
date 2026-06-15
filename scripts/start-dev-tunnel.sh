#!/bin/bash
# ============================================================
# ProPod Dev — Tunnel Mode
#
# Starts:
#   1. FastAPI backend on localhost:8000
#   2. ngrok static backend tunnel
#   3. Expo in tunnel mode
#
# Backend URL is static:
#   https://subsumable-submucronated-inga.ngrok-free.dev
#
# .env files are NOT modified by this script.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

BACKEND_PID=""
NGROK_PID=""

BACKEND_URL="https://subsumable-submucronated-inga.ngrok-free.dev"
WEBHOOK_URL="$BACKEND_URL/rtc/webhooks/100ms"

echo "🚀 ProPod Dev (Tunnel mode)"
echo "==========================="

cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    [ -n "$NGROK_PID" ] && kill "$NGROK_PID" 2>/dev/null || true
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Step 1: Start backend if not running ─────────────────────
echo "🔍 Checking backend..."
if curl -s "http://localhost:8000/docs" > /dev/null 2>&1; then
    echo "✅ Backend already running"
else
    echo "🐍 Starting backend..."
    cd "$ROOT_DIR/backend"

    if [ ! -f "venv/bin/activate" ]; then
        echo "❌ venv not found. Run:"
        echo "   cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
        exit 1
    fi

    source venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!

    echo "⏳ Waiting for backend..."
    for i in {1..15}; do
        if curl -s "http://localhost:8000/docs" > /dev/null 2>&1; then
            echo "✅ Backend ready"
            break
        fi

        if [ "$i" -eq 15 ]; then
            echo "⚠️  Backend slow to start — continuing anyway..."
        else
            sleep 1
        fi
    done
fi

# ── Step 2: Start ngrok static backend tunnel ────────────────
echo "🌐 Starting ngrok backend tunnel..."
cd "$ROOT_DIR"

ngrok http 8000 --url "$BACKEND_URL" > /tmp/propod-ngrok.log 2>&1 &
NGROK_PID=$!

for i in {1..20}; do
    if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
        echo "✅ ngrok backend tunnel ready"
        break
    fi

    if [ "$i" -eq 20 ]; then
        echo "❌ ngrok did not start in time."
        echo "   Check: cat /tmp/propod-ngrok.log"
        exit 1
    fi

    sleep 1
done

echo ""
echo "┌────────────────────────────────────────────────────────────┐"
echo "│  Backend API:  $BACKEND_URL"
echo "│  Webhooks:     $WEBHOOK_URL"
echo "│"
echo "│  100ms webhook URL is static. No localtunnel needed."
echo "└────────────────────────────────────────────────────────────┘"
echo ""

# ── Step 3: Start Expo tunnel ────────────────────────────────
echo "📱 Starting Expo (tunnel mode)..."
echo "   Scan QR from any network."
echo ""

cd "$ROOT_DIR/frontend"
npm run start:dev:tunnel