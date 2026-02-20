#!/usr/bin/env bash
set -euo pipefail

# End-to-end RTC recording webhook simulation test
# Usage:
#   ./scripts/test_rtc_webhook_e2e.sh <email> <password> [public_webhook_base_url]
# Example:
#   ./scripts/test_rtc_webhook_e2e.sh demo@volo.com demo123 https://abcd-1234.ngrok-free.app

EMAIL="${1:-}"
PASSWORD="${2:-}"
WEBHOOK_BASE_URL="${3:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Usage: $0 <email> <password> [public_webhook_base_url]"
  exit 1
fi

BACKEND_URL="http://localhost:8000"
WEBHOOK_SECRET="${HMS_WEBHOOK_SECRET:-webhook-secret-dev}"

if ! curl -sS "$BACKEND_URL/" >/dev/null 2>&1; then
  echo "❌ Backend is not reachable at $BACKEND_URL"
  echo "Start backend first: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
  exit 1
fi

# If public URL not provided, try ngrok local API
if [[ -z "$WEBHOOK_BASE_URL" ]]; then
  if command -v curl >/dev/null 2>&1; then
    NGROK_JSON="$(curl -s http://127.0.0.1:4040/api/tunnels || true)"
    if [[ -n "$NGROK_JSON" ]]; then
    WEBHOOK_BASE_URL="$(python3 -c 'import json,sys
raw=sys.stdin.read().strip()
if not raw:
  print("")
  raise SystemExit
try:
  data=json.loads(raw)
except Exception:
  print("")
  raise SystemExit
urls=[t.get("public_url","") for t in data.get("tunnels",[])]
https_urls=[u for u in urls if u.startswith("https://")]
print(https_urls[0] if https_urls else (urls[0] if urls else ""))' <<< "$NGROK_JSON")"
    fi
  fi
fi

if [[ -z "$WEBHOOK_BASE_URL" ]]; then
  echo "❌ Public webhook URL not found. Pass it as 3rd argument, e.g. https://xxxx.ngrok-free.app"
  exit 1
fi

echo "🔐 Login and get access token..."
if ! LOGIN_JSON="$(curl -sS -X POST "$BACKEND_URL/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"; then
  echo "❌ Login request failed (cannot reach backend)"
  exit 1
fi

ACCESS_TOKEN="$(python3 -c 'import json,sys
obj=json.loads(sys.stdin.read())
print(obj.get("access_token", ""))' <<< "$LOGIN_JSON")"

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "❌ Login failed or access token missing"
  exit 1
fi

echo "🏗️ Create RTC room/session..."
if ! ROOM_JSON="$(curl -sS -X POST "$BACKEND_URL/rtc/rooms" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"test-room-$(date +%s)\",\"title\":\"Test Live Podcast\",\"description\":\"E2E webhook test\",\"category\":\"General\",\"is_public\":true,\"media_mode\":\"video\"}")"; then
  echo "❌ RTC room creation request failed"
  exit 1
fi

ROOM_ID="$(python3 -c 'import json,sys
obj=json.loads(sys.stdin.read())
print(obj.get("id", ""))' <<< "$ROOM_JSON")"
SESSION_ID="$(python3 -c 'import json,sys
obj=json.loads(sys.stdin.read())
print(obj.get("session_id", ""))' <<< "$ROOM_JSON")"

if [[ -z "$ROOM_ID" || -z "$SESSION_ID" ]]; then
  echo "❌ Room/session creation failed"
  echo "$ROOM_JSON"
  exit 1
fi

echo "✅ room_id=$ROOM_ID session_id=$SESSION_ID"

WEBHOOK_URL="${WEBHOOK_BASE_URL%/}/rtc/webhooks/100ms"
RECORDING_URL="https://example.com/recordings/${ROOM_ID}.mp4"

echo "📨 Send simulated external webhook to $WEBHOOK_URL ..."
WEBHOOK_RESP="$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d "{\"room_id\":\"$ROOM_ID\",\"event\":\"recording.success\",\"recording_url\":\"$RECORDING_URL\",\"duration\":1234}")"

echo "Webhook response: $WEBHOOK_RESP"

echo "🔎 Poll session status from backend..."
for i in {1..10}; do
  if ! SESSION_JSON="$(curl -sS "$BACKEND_URL/rtc/sessions/$SESSION_ID" -H "Authorization: Bearer $ACCESS_TOKEN")"; then
    echo "❌ Session status request failed"
    exit 1
  fi

  HAS_PODCAST="$(python3 -c 'import json,sys
obj=json.loads(sys.stdin.read())
print("1" if obj.get("podcast_id") else "0")' <<< "$SESSION_JSON")"

  if [[ "$HAS_PODCAST" == "1" ]]; then
    echo "✅ Session ready:"
    python3 -c 'import json,sys
obj=json.loads(sys.stdin.read())
print(f"status={obj.get('"'"'status'"'"')}")
print(f"recording_url={obj.get('"'"'recording_url'"'"')}")
print(f"podcast_id={obj.get('"'"'podcast_id'"'"')}")' <<< "$SESSION_JSON"
    exit 0
  fi

  sleep 2

done

echo "⚠️ Session did not reach podcast-ready state in time"
echo "$SESSION_JSON"
exit 2
