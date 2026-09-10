#!/usr/bin/env bash
# One-click local development deployment: SurrealDB + API + worker + frontend,
# all in the background (non-blocking), with health checks.
# Usage: ./scripts/dev.sh [start|stop|status|restart]   (default: start)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

env_or() { grep -E "^[[:space:]]*$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true; }

API_HOST="${API_HOST:-$(env_or API_HOST)}"
API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-$(env_or API_PORT)}"
API_PORT="${API_PORT:-5055}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
WORKER_MAX_TASKS="${OPEN_NOTEBOOK_WORKER_MAX_TASKS:-6}"
LOG_DIR="$ROOT/logs"

is_api_up()     { pgrep -f "run_api[.]py|uvicorn api[.]main:app" >/dev/null 2>&1; }
is_worker_up()  { pgrep -f "surreal-commands-[w]orker" >/dev/null 2>&1; }
is_frontend_up(){ pgrep -f "next [d]ev" >/dev/null 2>&1; }
is_db_up()      { docker compose ps --quiet --status running surrealdb 2>/dev/null | grep -q .; }
api_bind_addr() { ss -tln 2>/dev/null | awk -v p=":$API_PORT$" '$4 ~ p {print $4; exit}'; }
lan_ip()        { hostname -I 2>/dev/null | awk '{print $1}'; }

wait_http() { # <url> <attempts> <name>
  local url="$1" attempts="$2" name="$3" i=0
  while ! curl -sf -o /dev/null "$url"; do
    i=$((i + 1))
    if [ "$i" -gt "$attempts" ]; then
      echo "❌ $name not healthy after $((i * 2))s — check $LOG_DIR/" >&2
      return 1
    fi
    sleep 2
  done
}

warn_if_loopback_only() {
  local addr
  addr="$(api_bind_addr)"
  case "$addr" in
    127.0.0.1*|::1*) echo "  ⚠️  API bound to localhost only — LAN machines can't reach it. Fix: $0 restart" ;;
  esac
}

start() {
  mkdir -p "$LOG_DIR"

  if is_db_up; then
    echo "📊 SurrealDB: already running"
  else
    echo "📊 Starting SurrealDB..."
    docker compose up -d surrealdb
  fi

  if is_api_up; then
    echo "🔧 API: already running"
    warn_if_loopback_only
  else
    echo "🔧 Starting API on $API_HOST:$API_PORT..."
    API_HOST="$API_HOST" API_PORT="$API_PORT" setsid nohup uv run run_api.py </dev/null >>"$LOG_DIR/api.log" 2>&1 &
  fi

  if is_worker_up; then
    echo "⚙️  Worker: already running"
  else
    echo "⚙️  Starting background worker..."
    setsid nohup uv run --env-file .env surreal-commands-worker --import-modules commands --max-tasks "$WORKER_MAX_TASKS" </dev/null >>"$LOG_DIR/worker.log" 2>&1 &
  fi

  if is_frontend_up; then
    echo "🌐 Frontend: already running"
  else
    echo "🌐 Starting Next.js frontend..."
    ( cd frontend && setsid nohup npm run dev </dev/null >>"$LOG_DIR/frontend.log" 2>&1 & )
  fi

  echo "⏳ Waiting for API (DB readiness + migrations)..."
  wait_http "http://127.0.0.1:$API_PORT/health" 90 "API"

  echo "⏳ Waiting for frontend..."
  wait_http "http://127.0.0.1:$FRONTEND_PORT/" 90 "Frontend"

  sleep 2
  if ! is_worker_up; then
    echo "❌ Worker died at startup — check $LOG_DIR/worker.log" >&2
    return 1
  fi

  local lan
  lan="$(lan_ip)"
  echo
  echo "✅ Open Notebook is up."
  echo "   Frontend: http://localhost:$FRONTEND_PORT"
  [ -n "${lan:-}" ] && echo "   LAN:      http://$lan:$FRONTEND_PORT"
  echo "   API:      http://localhost:$API_PORT  (docs: http://localhost:$API_PORT/docs)"
  echo "   Logs:     $LOG_DIR/"
}

stop() {
  echo "🛑 Stopping Open Notebook dev services..."
  pkill -f "next [d]ev" || true
  pkill -f "surreal-commands-[w]orker" || true
  pkill -f "run_api[.]py" || true
  pkill -f "uvicorn api[.]main:app" || true
  docker compose down || true
  echo "✅ Stopped."
}

status() {
  echo "📊 Open Notebook status"
  if is_db_up; then echo "  ✅ SurrealDB (docker)"
  else echo "  ❌ SurrealDB"; fi

  if is_api_up; then
    echo "  ✅ API (listening on $(api_bind_addr))"
    warn_if_loopback_only
  else
    echo "  ❌ API"
  fi

  if is_worker_up; then echo "  ✅ Worker"
  else echo "  ❌ Worker"; fi

  if is_frontend_up; then echo "  ✅ Frontend"
  else echo "  ❌ Frontend"; fi
}

action="${1:-start}"
case "$action" in
  start)   start ;;
  stop)    stop ;;
  status)  status ;;
  restart) stop; sleep 2; start ;;
  *) echo "usage: $0 [start|stop|status|restart] (default: start)" >&2; exit 1 ;;
esac
