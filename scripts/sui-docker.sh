#!/usr/bin/env bash
# Persistent Sui CLI via Docker — install once, reuse forever.
set -euo pipefail

CONTAINER_NAME="${SUI_CONTAINER_NAME:-sparky-sui}"
SUI_WALLET="${SUI_WALLET:-$HOME/.sui-docker}"
SUI_TOOLS="${SUI_TOOLS:-$HOME/.sui-docker-tools}"
SUI_RELEASE="${SUI_RELEASE:-testnet-v1.73.1}"
SPARKY_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

ensure_container() {
  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    docker start "$CONTAINER_NAME" >/dev/null 2>&1 || true
  else
    docker run -d --name "$CONTAINER_NAME" \
      -v "$SUI_WALLET:/root/.sui" \
      -v "$SUI_TOOLS:/root/.local" \
      -v "$SPARKY_ROOT:/sparky" \
      ubuntu:22.04 sleep infinity
  fi
}

sui_installed() {
  docker exec "$CONTAINER_NAME" test -x /root/.local/bin/sui
}

setup() {
  ensure_container
  if sui_installed; then
    echo "Sui CLI already installed in $SUI_TOOLS"
    docker exec "$CONTAINER_NAME" /root/.local/bin/sui --version
    return 0
  fi

  echo "One-time setup: downloading sui $SUI_RELEASE (~1GB)."
  echo "Uses direct GitHub download (suiup often hangs in Docker). Do not interrupt."
  docker exec "$CONTAINER_NAME" bash -lc "
    set -e
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates tar
    mkdir -p /root/.local/bin
    cd /tmp
    URL=\"https://github.com/MystenLabs/sui/releases/download/${SUI_RELEASE}/sui-${SUI_RELEASE}-ubuntu-x86_64.tgz\"
    echo \"Fetching \$URL\"
    curl -L --progress-bar -o sui.tgz \"\$URL\"
    tar -xzf sui.tgz
    install -m 755 sui /root/.local/bin/sui
    rm -rf sui.tgz sui move-analyzer sui-* 2>/dev/null || true
    /root/.local/bin/sui --version
  "
  echo "Setup complete. Run: ./scripts/sui-docker.sh shell"
}

shell() {
  ensure_container
  if ! sui_installed; then
    echo "Sui not installed yet. Run: ./scripts/sui-docker.sh setup"
    exit 1
  fi
  docker exec -it "$CONTAINER_NAME" bash -lc '
    export PATH="$HOME/.local/bin:$PATH"
    cd /sparky
    exec bash
  '
}

run_sui() {
  ensure_container
  if ! sui_installed; then
    echo "Sui not installed yet. Run: ./scripts/sui-docker.sh setup"
    exit 1
  fi
  docker exec -it "$CONTAINER_NAME" bash -lc "export PATH=\$HOME/.local/bin:\$PATH; sui $*"
}

case "${1:-shell}" in
  setup) setup ;;
  shell) shell ;;
  sui) shift; run_sui "$@" ;;
  *)
    echo "Usage: $0 {setup|shell|sui <args>}"
    echo "  setup  — one-time install (direct GitHub download)"
    echo "  shell  — open a reusable bash shell with sui on PATH"
    echo "  sui    — run a sui command, e.g. $0 sui client balance"
    exit 1
    ;;
esac
