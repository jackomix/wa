#!/bin/bash
# ──────────────────────────────────────────────────────────────
#  WarioWare Inc. — run.sh
#
#  macOS script to install dependencies and launch the dev server.
#
#  USAGE:
#    chmod +x run.sh
#    ./run.sh            # runs the v1 build (default)
#    ./run.sh v1         # same thing, explicit
#    ./run.sh v2         # runs the v2 build
#
# ──────────────────────────────────────────────────────────────

set -e

cd "$(dirname "$0")"

# ── check node ──────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install it first:"
  echo "    brew install node"
  exit 1
fi

NODE_MAJ=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJ" -lt 18 ]; then
  echo "❌  Node $NODE_MAJ is too old — need 18+. Run:"
  echo "    brew upgrade node"
  exit 1
fi

# ── install deps if needed ──────────────────────────────────
if [ ! -d "node_modules" ]; then
  echo "📦  Installing dependencies..."
  npm install
fi

# ── which build? ────────────────────────────────────────────
BUILD="${1:-v1}"

case "$BUILD" in
  v1)
    echo "🎮  Starting WarioWare v1 (original emoji/pixel-art build)..."
    echo "   ─────────────────────────────────────────────────"
    echo "   This is the build with 40+ hand-coded microgames,"
    echo "   stage selection, character interludes, and ROM"
    echo "   graphics loading. Uses emoji + pixel art sprites."
    echo ""
    echo "   Controls: Arrow keys = move, Space = action"
    echo "   ─────────────────────────────────────────────────"
    npx vite dev
    ;;

  v2)
    echo "🧪  Starting WarioWare v2 (ROM-faithful actor/behavior build)..."
    echo "   ─────────────────────────────────────────────────"
    echo "   This is the newer architecture with actor/behavior/"
    echo "   event-sheet system, ROM-extracted pixel art costumes,"
    echo "   and data-driven microgame specs from the actual ROM."
    echo ""
    echo "   ⚠️  The v2 build is still experimental/unfinished."
    echo "   Controls: Arrow keys = move, Space = action"
    echo "   ─────────────────────────────────────────────────"
    npx vite dev --config v2/vite.config.ts
    ;;

  *)
    echo "❌  Unknown build: '$BUILD'"
    echo ""
    echo "Usage: $0 [v1|v2]"
    echo ""
    echo "  v1  — Original build (40+ hand-coded microgames, emoji + pixel art)"
    echo "  v2  — New ROM-faithful build (actor/behavior system, ROM-extracted art)"
    echo ""
    echo "Default is v1 if you don't specify."
    exit 1
    ;;
esac
