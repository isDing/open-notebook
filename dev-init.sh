#!/bin/bash
# Development environment startup for Open Notebook
# Assumes SurrealDB is already running externally (per .env config)
# Services start detached (setsid + nohup) so they survive terminal close.

set -e

LOG_DIR="$PWD/.dev-logs"
mkdir -p "$LOG_DIR"

echo "=== Open Notebook Dev Startup ==="

# Check SurrealDB connectivity
SURREAL_PORT=$(grep -oP 'SURREAL_URL=ws://127\.0\.0\.1:\K[0-9]+' .env | head -1)
SURREAL_PORT=${SURREAL_PORT:-8000}
echo "Checking SurrealDB on port $SURREAL_PORT..."
if ! nc -z localhost "$SURREAL_PORT" 2>/dev/null; then
  echo "❌ SurrealDB not reachable on port $SURREAL_PORT. Please start it first."
  exit 1
fi
echo "✅ SurrealDB is running"

# Install dependencies if needed
echo "Syncing Python dependencies..."
uv sync

echo "Syncing frontend dependencies..."
cd frontend && npm install && cd ..

# Start a service detached; skip if an instance is already running
start_detached() {
  local label="$1" pattern="$2" log="$3"; shift 3
  if pgrep -f "$pattern" > /dev/null 2>&1; then
    echo "⏭️  $label already running — skipping."
    return 0
  fi
  setsid nohup "$@" > "$log" 2>&1 < /dev/null &
  disown
  echo "🚀 $label starting (log: ${log#$PWD/})"
}

echo ""
start_detached "API backend" 'run_api[.]py' "$LOG_DIR/api.log" \
  uv run --env-file .env run_api.py

start_detached "background worker" 'surreal-commands-[w]orker' "$LOG_DIR/worker.log" \
  uv run --env-file .env surreal-commands-worker --import-modules commands --max-tasks "${OPEN_NOTEBOOK_WORKER_MAX_TASKS:-6}"

start_detached "Next.js frontend" 'next [d]ev' "$LOG_DIR/frontend.log" \
  bash -c 'cd frontend && npm run dev'

# Wait for the API to answer before reporting success
echo ""
echo "Waiting for API to be ready..."
api_up=0
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null http://localhost:5055/docs; then
    api_up=1
    break
  fi
  sleep 2
done

echo ""
if [ "$api_up" -eq 1 ]; then
  echo "✅ All services started!"
else
  echo "❌ API did not become ready in time — check $LOG_DIR/api.log"
fi
echo "  Frontend: http://localhost:3000"
echo "  API:      http://localhost:5055"
echo "  API Docs: http://localhost:5055/docs"
echo "  Logs:     $LOG_DIR/"
echo ""
echo "Stop: make stop-all"

[ "$api_up" -eq 1 ]
