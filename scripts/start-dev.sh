#!/bin/bash
# ============================================================
# ProPod Dev Startup — LAN Mode
#
# Usage: ./scripts/start-dev.sh
#
# What it does:
#   1. Auto-detects your Windows WiFi IP
#   2. Updates REACT_NATIVE_PACKAGER_HOSTNAME in frontend/.env
#   3. Clears API_BASE_URL so apiService.js auto-detects it
#   4. Starts FastAPI backend (background)
#   5. Starts Expo in LAN mode
#
# Use this when: phone and laptop are on the same WiFi
# Use start-dev-tunnel.sh when: testing webhooks, mobile data, different network
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_ENV="$ROOT_DIR/frontend/.env"
BACKEND_ENV="$ROOT_DIR/backend/.env"

echo "🚀 ProPod Dev (LAN mode)"
echo "========================"

# ── Step 1: Detect Windows WiFi IP ──────────────────────────
# Priority 1: 192.168.x.x — standard home/office WiFi (most common)
WINDOWS_IP=$(powershell.exe -Command \
    "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.PrefixOrigin -eq 'Dhcp' -and \$_.IPAddress -match '^192\.168\.' } | Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress" \
    2>/dev/null | tr -d '\r\n ')

# Priority 2: 10.x.x.x — corporate WiFi / some hotspots
if [ -z "$WINDOWS_IP" ]; then
    WINDOWS_IP=$(powershell.exe -Command \
        "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.PrefixOrigin -eq 'Dhcp' -and \$_.IPAddress -match '^10\.' } | Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress" \
        2>/dev/null | tr -d '\r\n ')
fi

# Priority 3: any DHCP, but skip VPN/WireGuard (172.16–31.x.x range)
if [ -z "$WINDOWS_IP" ]; then
    WINDOWS_IP=$(powershell.exe -Command \
        "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.PrefixOrigin -eq 'Dhcp' -and \$_.IPAddress -notmatch '^(127\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)' } | Sort-Object InterfaceMetric | Select-Object -First 1).IPAddress" \
        2>/dev/null | tr -d '\r\n ')
fi

# Priority 4: ipconfig.exe parse — fallback for non-DHCP or WSL quirks
if [ -z "$WINDOWS_IP" ]; then
    WINDOWS_IP=$(ipconfig.exe 2>/dev/null \
        | grep "IPv4" \
        | grep -E "192\.168\.|10\." \
        | head -1 \
        | awk -F': ' '{print $2}' \
        | tr -d '\r ')
fi

if [ -z "$WINDOWS_IP" ]; then
    echo "❌ Could not detect Windows WiFi IP."
    echo "   Make sure phone and laptop are on the same WiFi."
    echo "   Alternatively use:  npm run dev:tunnel  (works on any network)"
    exit 1
fi

echo "✅ Windows WiFi IP: $WINDOWS_IP"

# ── Step 2: Update frontend/.env ────────────────────────────
if [ -f "$FRONTEND_ENV" ]; then
    sed -i "s/^REACT_NATIVE_PACKAGER_HOSTNAME=.*/REACT_NATIVE_PACKAGER_HOSTNAME=$WINDOWS_IP/" "$FRONTEND_ENV"
    sed -i "s/^EXPO_DEVTOOLS_LISTEN_ADDRESS=.*/EXPO_DEVTOOLS_LISTEN_ADDRESS=$WINDOWS_IP/" "$FRONTEND_ENV"
    # Clear API_BASE_URL → apiService.js auto-detects from hostUri:8000
    sed -i "s/^API_BASE_URL=.*/API_BASE_URL=/" "$FRONTEND_ENV"
    sed -i "s/^EXPO_PUBLIC_API_URL=.*/EXPO_PUBLIC_API_URL=/" "$FRONTEND_ENV"
    echo "✅ frontend/.env updated (API_BASE_URL cleared → auto-detect active)"
else
    echo "⚠️  frontend/.env not found — creating from example"
    cp "$ROOT_DIR/frontend/.env.example" "$FRONTEND_ENV"
    sed -i "s/YOUR_WINDOWS_IP/$WINDOWS_IP/g" "$FRONTEND_ENV"
    sed -i "s/^API_BASE_URL=.*/API_BASE_URL=/" "$FRONTEND_ENV"
    sed -i "s/^EXPO_PUBLIC_API_URL=.*/EXPO_PUBLIC_API_URL=/" "$FRONTEND_ENV"
fi

# ── Step 3: Update backend/.env BASE_URL ────────────────────
if [ -f "$BACKEND_ENV" ]; then
    if grep -q "^BASE_URL=" "$BACKEND_ENV"; then
        sed -i "s|^BASE_URL=.*|BASE_URL=http://$WINDOWS_IP:8000|" "$BACKEND_ENV"
    else
        # Add BASE_URL if it doesn't exist yet
        echo "BASE_URL=http://$WINDOWS_IP:8000" >> "$BACKEND_ENV"
    fi
    echo "✅ backend/.env BASE_URL updated"
fi

echo ""
echo "📡 API will be served at: http://$WINDOWS_IP:8000"
echo "   (auto-detected by app — no manual .env update needed next time)"
echo ""

# ── Step 4: Start backend if not already running ─────────────
BACKEND_PID=""

cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        echo ""
        echo "🛑 Stopping backend..."
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

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

    # Wait for backend to be ready
    echo "⏳ Waiting for backend..."
    BACKEND_READY=false
    for i in {1..10}; do
        if curl -s "http://localhost:8000/docs" > /dev/null 2>&1; then
            BACKEND_READY=true
            echo "✅ Backend ready"
            break
        fi
        sleep 1
    done

    if [ "$BACKEND_READY" = false ]; then
        echo "⚠️  Backend did not respond after 10s — check for venv/import errors above."
        echo "   Expo will still start, but API calls will fail until backend is up."
    fi
fi

# ── Step 5: Start Expo (LAN) ─────────────────────────────────
echo ""
echo "📱 Starting Expo (LAN mode)..."
echo "   Scan QR on phone (must be on same WiFi)"
echo ""
cd "$ROOT_DIR/frontend"
npm run start:dev
