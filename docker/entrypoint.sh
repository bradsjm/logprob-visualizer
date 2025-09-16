#!/usr/bin/env bash
set -euo pipefail

npx tsx server/index.ts &
backend_pid=$!

graceful_shutdown() {
  if kill -0 "$backend_pid" 2>/dev/null; then
    kill -TERM "$backend_pid"
    wait "$backend_pid" || true
  fi
  if [[ -n "${nginx_pid:-}" ]] && kill -0 "$nginx_pid" 2>/dev/null; then
    kill -TERM "$nginx_pid"
    wait "$nginx_pid" || true
  fi
}

handle_signal() {
  graceful_shutdown
  exit 0
}

trap handle_signal TERM INT

nginx -g 'daemon off;' &
nginx_pid=$!

wait -n "$backend_pid" "$nginx_pid"
exit_code=$?

graceful_shutdown

exit "$exit_code"
