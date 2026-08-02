#!/bin/bash
# ──────────────────────────────────────────────────────────────
#  WarioWare Inc. — run.sh
#
#  macOS script to install dependencies and launch the dev server.
#
#  This repo has TWO parallel builds that share node_modules:
#
#    v1  "Micro Mania"  — 40+ hand-coded microgames, emoji + pixel art
#    v2  "ROM-faithful"  — 139 microgames from ROM decompilation, real art
#
#  USAGE:
#    ./run.sh            # runs v1 (default)
#    ./run.sh v1         # same thing, explicit
#    ./run.sh v2         # runs the v2 ROM-faithful build
#
#  You can also double-click "Play WarioWare v2.command" in Finder
#  to launch v2 without a terminal.
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
    echo "🎮  Starting Micro Mania (v1)..."
    echo "   ─────────────────────────────────────────────────"
    echo "   40+ hand-coded microgames across 9 stages,"
    echo "   character interludes, stage selection, and ROM"
    echo "   graphics loading. Uses emoji + pixel art sprites."
    echo ""
    echo "   Controls: Arrow keys = move, Space = action"
    echo "   ─────────────────────────────────────────────────"
    npx vite dev
    ;;

  v2)
    echo "🧪  Starting WarioWare v2 (ROM-faithful)..."
    echo "   ─────────────────────────────────────────────────"
    echo "   139 microgames recreated from the actual ROM."
    echo "   Actor/behavior/event-sheet system, real pixel art"
    echo "   costumes extracted from the GBA ROM, and a"
    echo "   Mario Paint-style editor."
    echo ""
    echo "   Controls: Arrow keys = move, Space = action"
    echo "   ─────────────────────────────────────────────────"
    npx vite dev --config v2/vite.config.ts
    ;;

  *)
    echo "❌  Unknown build: '$BUILD'"
    echo ""
    echo "Usage: $0 [v1|v2]"
    echo ""
    echo "  v1  — Micro Mania (40+ hand-coded microgames, emoji + pixel art)"
    echo "  v2  — ROM-faithful (139 microgames from decompilation, real art)"
    echo ""
    echo "Default is v1 if you don't specify."
    echo ""
    echo "Tip: You can also double-click 'Play WarioWare v2.command' in Finder"
    echo "     to launch v2 without a terminal."
    exit 1
    ;;
esac
