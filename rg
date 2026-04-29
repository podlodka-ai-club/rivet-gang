#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
NODE_BIN="${NODE_BIN:-}"

if [ -z "$NODE_BIN" ]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
  elif [ -x "/Users/aifedorov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]; then
    NODE_BIN="/Users/aifedorov/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  else
    echo "rg: node is required but was not found. Set NODE_BIN=/path/to/node or install Node.js." >&2
    exit 1
  fi
fi

if [ ! -d "$ROOT_DIR/dist/commands" ]; then
  echo "rg: build output is missing. Run: npm run build" >&2
  exit 1
fi

exec "$NODE_BIN" "$ROOT_DIR/bin/rg.js" "$@"
