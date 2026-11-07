# Ports for `just dev`, sourced by the recipe. Other checkouts of the repo (feature worktrees) run
# their own game and API, so a run takes the first free port from the usual one upward instead of
# failing on a taken one; a port set in the environment is used as given. The API's port goes to
# GERARD_API_PORT and its URL to GERARD_API, which Vite's /api proxy reads (vite.config.ts), and is
# written to .dev-ports (git-ignored) for anything started separately in the same checkout.

API_PORT_VAR=GERARD_API_PORT
WEB_PORT_VAR=GERARD_WEB_PORT
API_URL_VAR=GERARD_API
dev_ports_file=$PWD/.dev-ports

port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
  fi
}

# free_port START: the first port from START upward that nothing listens on.
free_port() {
  local port=$1
  while port_busy "$port"; do port=$((port + 1)); done
  echo "$port"
}

# choose_api_port DEFAULT: exports the API port, a free one from DEFAULT unless already set, and records it.
choose_api_port() {
  local port=${!API_PORT_VAR:-$(free_port "$1")}
  export "$API_PORT_VAR=$port"
  echo "$API_PORT_VAR=$port" >"$dev_ports_file"
}

# choose_web_port DEFAULT: exports the game's port and the API URL its proxy goes to.
choose_web_port() {
  if [ -z "${!API_URL_VAR:-}" ]; then export "$API_URL_VAR=http://127.0.0.1:${!API_PORT_VAR}"; fi
  local port=${!WEB_PORT_VAR:-$(free_port "$1")}
  export "$WEB_PORT_VAR=$port"
}
