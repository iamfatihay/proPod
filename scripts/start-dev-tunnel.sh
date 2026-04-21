#!/bin/bash
# ============================================================
# ProPod Dev — Tunnel Mode
#
# Usage: npm run dev:tunnel   (from frontend/)
#   OR:  ./scripts/start-dev-tunnel.sh  (from root)
#
# Works on ANY network — same WiFi, office WiFi, mobile data.
# Use this whenever you need:
#   - Phone and laptop on different networks
#   - Testing 100ms RTC webhooks (need public URL)
#   - Switching between work/home WiFi without reconfiguring
#
# What this script does:
#   1. Starts FastAPI backend (if not already running)
#   2. Kills any running ngrok (frees the session for Expo's tunnel)
#   3. Opens localtunnel for the backend (port 8000) → public HTTPS URL
#   4. Updates API_BASE_URL in .env files
#   5. Starts Expo in tunnel mode (Expo uses ngrok for its own tunnel)
#
# Why localtunnel for backend instead of ngrok?
#   Expo's --tunnel uses ngrok. Free ngrok allows only 1 session.
#   localtunnel is free, unlimited, and doesn't conflict with Expo's ngrok.
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"
BACKEND_ENV="$ROOT_DIR/backend/.env"
BACKEND_PID=""

echo "🚀 ProPod Dev (Tunnel mode — works on any network)"
echo "===================================================="

# ── Cleanup handler ──────────────────────────────────────────
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    [ -n "$LT_PID" ] && kill "$LT_PID" 2>/dev/null || true
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
        echo "❌ venv not found. Run: cd backend && python -m venv venv && pip install -r requirements.txt"
        exit 1
    fi
    source venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    echo "✅ Backend started (PID: $BACKEND_PID)"

    # Wait for it to be ready
    echo "⏳ Waiting for backend..."
    for i in {1..15}; do
        if curl -s "http://localhost:8000/docs" > /dev/null 2>&1; then
            echo "✅ Backend ready"
            break
        fi
        [ "$i" -eq 15 ] && echo "⚠️  Backend slow to start — continuing anyway..." || sleep 1
    done
fi

# ── Step 2: Kill any running ngrok ───────────────────────────
# Expo's --tunnel uses ngrok (via @expo/ngrok). Free ngrok only allows
# 1 active session. Any running ngrok process will block Expo's tunnel.
echo "🔄 Freeing ngrok session for Expo tunnel..."
pkill -f "ngrok" 2>/dev/null || true
sleep 1
echo "✅ ngrok session free"

# ── Step 3: Open localtunnel for backend (port 8000) ─────────
echo "🌐 Opening backend tunnel (localtunnel, port 8000)..."
cd "$ROOT_DIR"
npx localtunnel --port 8000 > /tmp/propod-lt.log 2>&1 &
LT_PID=$!

# Poll until URL appears in log (up to 25s)
TUNNEL_URL=""
for i in {1..25}; do
    TUNNEL_URL=$(grep -o 'https://[^ ]*\.loca\.lt' /tmp/propod-lt.log 2>/dev/null | head -1)
    [ -n "$TUNNEL_URL" ] && break
    sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Could not get localtunnel URL after 25s."
    echo "   Check: cat /tmp/propod-lt.log"
    echo "   If localtunnel is down, try: npx localtunnel --port 8000"
    exit 1
fi

echo "✅ Backend tunnel: $TUNNEL_URL"

# ── Step 4: Update .env files ────────────────────────────────
if [ -f "$FRONTEND_ENV" ]; then
    sed -i "s|^API_BASE_URL=.*|API_BASE_URL=$TUNNEL_URL|" "$FRONTEND_ENV"
    sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$TUNNEL_URL|" "$FRONTEND_ENV"
    echo "✅ frontend/.env updated"
else
    echo "⚠️  frontend/.env not found — creating from example"
    cp "$ROOT_DIR/frontend/.env.example" "$FRONTEND_ENV"
    sed -i "s|API_BASE_URL=.*|API_BASE_URL=$TUNNEL_URL|" "$FRONTEND_ENV"
    sed -i "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$TUNNEL_URL|" "$FRONTEND_ENV"
fi

if [ -f "$BACKEND_ENV" ]; then
    if grep -q "^BASE_URL=" "$BACKEND_ENV"; then
        sed -i "s|^BASE_URL=.*|BASE_URL=$TUNNEL_URL|" "$BACKEND_ENV"
    else
        echo "BASE_URL=$TUNNEL_URL" >> "$BACKEND_ENV"
    fi
    echo "✅ backend/.env BASE_URL updated"
fi

echo ""
echo "┌────────────────────────────────────────────────────────────┐"
echo "│  Backend API:  $TUNNEL_URL"
echo "│  Webhooks:     $TUNNEL_URL/rtc/webhooks/100ms"
echo "│"
echo "│  Works from any network (same WiFi, mobile data, office)"
echo "└────────────────────────────────────────────────────────────┘"
echo ""

# ── Step 5: Start Expo (tunnel mode) ─────────────────────────
echo "📱 Starting Expo (tunnel mode)..."
echo "   Scan QR from any network — phone does NOT need to be on same WiFi"
echo ""
cd "$ROOT_DIR/frontend"
npm run start:dev:tunnel
