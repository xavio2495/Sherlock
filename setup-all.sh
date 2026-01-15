#!/usr/bin/env bash
set -euo pipefail

# Configurable via env or flags
RPC_URL="${RPC_URL:-}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
WALLETCONNECT_ID="${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-}"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-3001}"

# Simple flag parser
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc-url) RPC_URL="$2"; shift 2;;
    --private-key) PRIVATE_KEY="$2"; shift 2;;
    --walletconnect-id) WALLETCONNECT_ID="$2"; shift 2;;
    --api-url) API_URL="$2"; shift 2;;
    --frontend-port) FRONTEND_PORT="$2"; shift 2;;
    --backend-port) BACKEND_PORT="$2"; shift 2;;
    *) echo "Unknown arg: $1" && exit 1;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
contracts_dir="$repo_root/contracts"
backend_dir="$repo_root/backend"
frontend_dir="$repo_root/sherlock"

# Helpers
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1"; exit 1; }
}

require_cmd forge
require_cmd npm

# Contracts: build, test, deploy
pushd "$contracts_dir" >/dev/null
forge build
forge test -vvv
if [[ -n "$RPC_URL" && -n "$PRIVATE_KEY" ]]; then
  forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast
else
  echo "[contracts] Skipping deploy (set RPC_URL and PRIVATE_KEY to enable)"
fi
popd >/dev/null

# Backend: install + run dev
if [[ -f "$backend_dir/package.json" ]]; then
  pushd "$backend_dir" >/dev/null
  npm install
  PORT="$BACKEND_PORT" NEXT_PUBLIC_API_URL="$API_URL" npm run dev >/tmp/sherlock-backend.log 2>&1 &
  echo "[backend] running on :$BACKEND_PORT (log: /tmp/sherlock-backend.log) pid=$!"
  popd >/dev/null
else
  echo "[backend] package.json not found; skipping"
fi

# Frontend: install + run dev
if [[ -f "$frontend_dir/package.json" ]]; then
  pushd "$frontend_dir" >/dev/null
  npm install
  PORT="$FRONTEND_PORT" NEXT_PUBLIC_API_URL="$API_URL" NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="$WALLETCONNECT_ID" npm run dev >/tmp/sherlock-frontend.log 2>&1 &
  echo "[frontend] running on :$FRONTEND_PORT (log: /tmp/sherlock-frontend.log) pid=$!"
  popd >/dev/null
else
  echo "[frontend] package.json not found; skipping"
fi

echo "All tasks started. Frontend: http://localhost:$FRONTEND_PORT  Backend: http://localhost:$BACKEND_PORT"