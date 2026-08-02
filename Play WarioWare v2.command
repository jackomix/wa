#!/bin/bash
#
#  Play WarioWare v2  —  double-click this file in Finder.
#
#  Handles everything: checks for Node, installs dependencies the first time,
#  starts the dev server, and opens your browser. No terminal knowledge needed.
#
#  (The .command extension is what makes macOS run it on double-click.)
#

# Always work from the folder this script lives in, no matter where it's
# launched from. Double-clicking in Finder starts you in $HOME otherwise.
cd "$(dirname "$0")" || exit 1

# --- pretty output -----------------------------------------------------------
# Only emit colour when attached to a real terminal, so the output stays clean
# if this is ever piped to a file or run by a CI job.
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
  GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; CYAN=$'\033[36m'
else
  BOLD=""; DIM=""; RESET=""; GREEN=""; YELLOW=""; RED=""; CYAN=""
fi

say()  { printf "%s\n" "$1"; }
ok()   { printf "  ${GREEN}OK${RESET}  %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${RESET}   %s\n" "$1"; }
err()  { printf "  ${RED}X${RESET}   %s\n" "$1"; }

# `clear` writes a warning when TERM is unset (e.g. launched by an IDE).
[ -t 1 ] && [ -n "$TERM" ] && clear

say ""
say "  ${BOLD}WarioWare v2${RESET} ${DIM}- ROM-faithful microgame engine${RESET}"
say "  ${DIM}139 microgames recreated from the original GBA ROM${RESET}"
say ""
say "  ${DIM}----------------------------------------------------${RESET}"
say ""

# Keep the window open on failure so a double-click user can read the error.
die() {
  say ""
  if [ -t 0 ]; then
    read -r -p "  Press Return to close... " _
  fi
  exit 1
}

# --- 1. Node present and new enough? -----------------------------------------
if ! command -v node >/dev/null 2>&1; then
  err "Node.js isn't installed."
  say ""
  say "  This project needs Node.js 18 or newer."
  say ""
  say "  ${BOLD}Easiest fix:${RESET} download the LTS installer from"
  say "  ${CYAN}https://nodejs.org${RESET}"
  say ""
  say "  ${DIM}(Or with Homebrew:  brew install node)${RESET}"
  say ""
  say "  Once it's installed, double-click this file again."
  die
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null)
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ] 2>/dev/null; then
  err "Node.js $(node -v 2>/dev/null) is too old - this needs v18 or newer."
  say ""
  say "  Update from ${CYAN}https://nodejs.org${RESET} and try again."
  die
fi
ok "Node.js $(node -v)"

# --- 2. Dependencies installed? ----------------------------------------------
# Test for a real executable rather than just the node_modules folder: an
# interrupted install leaves the directory present but unusable.
if [ ! -x "node_modules/.bin/vite" ]; then
  say ""
  warn "First run - installing dependencies."
  say "  ${DIM}Takes a minute or two. This only happens once.${RESET}"
  say ""

  if ! npm install; then
    say ""
    err "Install failed."
    say ""
    say "  Run this in Terminal to see the full error:"
    say "  ${CYAN}cd \"$(pwd)\" && npm install${RESET}"
    die
  fi

  say ""
  ok "Dependencies installed"
else
  ok "Dependencies ready"
fi

# --- 3. Choose a port --------------------------------------------------------
# Ask Node whether the port is free. Node is guaranteed present by this point,
# whereas lsof/nc are not on every system - and a missing tool silently
# breaking the check is worse than not having one.
port_free() {
  node -e '
    const net = require("net");
    const s = net.createServer();
    s.once("error", () => process.exit(1));
    s.once("listening", () => s.close(() => process.exit(0)));
    s.listen(Number(process.argv[1]), "127.0.0.1");
  ' "$1" 2>/dev/null
}

PORT=5173
while ! port_free "$PORT"; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 5200 ]; then
    err "No free port between 5173 and 5200."
    die
  fi
done
[ "$PORT" -ne 5173 ] && warn "Port 5173 was busy - using $PORT instead."

URL="http://localhost:$PORT/v2/"

# --- 4. Start the server, then open the browser ------------------------------
say ""
say "  ${DIM}----------------------------------------------------${RESET}"
say ""
say "  ${BOLD}Starting...${RESET}  ${CYAN}$URL${RESET}"
say ""
say "  ${DIM}Your browser opens automatically in a moment.${RESET}"
say "  ${DIM}To stop: press${RESET} ${BOLD}Control-C${RESET} ${DIM}or close this window.${RESET}"
say ""
say "  ${DIM}----------------------------------------------------${RESET}"
say ""

# Poll the URL itself rather than the socket. A listening socket doesn't mean
# vite has finished its first compile, and opening too early lands the user on
# a connection-refused page.
(
  for _ in $(seq 1 90); do
    if curl -s -o /dev/null --max-time 2 "$URL" 2>/dev/null; then
      sleep 0.3
      open "$URL" 2>/dev/null
      exit 0
    fi
    sleep 0.5
  done
) &
OPENER_PID=$!

cleanup() {
  kill "$OPENER_PID" 2>/dev/null
  printf "\n\n  Stopped. You can close this window.\n\n"
  exit 0
}
trap cleanup INT TERM

npx vite --config v2/vite.config.ts --port "$PORT" --strictPort
cleanup
