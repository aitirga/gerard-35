# Gerard 35 developer commands. Run `just` to see the menu.

set shell := ["bash", "-euo", "pipefail", "-c"]
# Local secrets such as TYPESAFE_API_KEY live in .env (see .env.example).
set dotenv-load := true

site_url := "https://gerard-35-aitirga.fly.dev/"

# Show the command menu
[group('Help')]
default:
    @printf 'Gerard 35 — developer commands\n\n'
    @just --list --color never
    @printf '\nLive development: just backend + just dev (two terminals).\n'

# Install exact dependencies (Node + Python)
[group('Setup')]
setup:
    npm ci
    uv sync --locked

# Start the Vite dev server with hot reload on http://127.0.0.1:5173
[group('Development')]
dev:
    npm run dev

# Open a repeatable battle: just dev-battle 4 2 (foes 2–4, allies 1–2)
[group('Development')]
dev-battle foes="4" allies="1":
    @[[ "{{ foes }}" =~ ^[234]$ && "{{ allies }}" =~ ^[12]$ ]] || { printf 'Use 2–4 foes and 1–2 allies.\n'; exit 1; }
    npm run dev -- --open '/?battle={{ foes }}&allies={{ allies }}'

# Jump into chapter 1 after a story beat: just dev-chapter got-backpack (new = from the start)
[group('Development')]
dev-chapter beat="new":
    @[[ "{{ beat }}" =~ ^(new|intro|met-jan|got-shoes|got-potion|got-backpack|bernat-joined|bernat-stalled|dejavu|minion|first-fight|palace|in-palace|got-chicle|noista|wrapper-room)$ ]] || { printf 'Use new or a story flag from src/story.ts (e.g. got-backpack).\n'; exit 1; }
    npm run dev -- --open '/?story={{ beat }}'

# Play as a generated character: just dev-character bernat (file in src/characters/)
[group('Development')]
dev-character name="gerard-child":
    @[[ -f "src/characters/{{ name }}.json" ]] || { printf 'No src/characters/%s.json; run just character first.\n' "{{ name }}"; exit 1; }
    npm run dev -- --open '/?character={{ name }}'

# Start the persistent API on port 8080, proxied by `just dev` under /api
[group('Development')]
backend:
    uv run --locked uvicorn server:app --host 127.0.0.1 --port 8080 --reload

# Build, then serve game + API together on http://127.0.0.1:8080
[group('Development')]
run: build
    uv run --locked uvicorn server:app --host 127.0.0.1 --port 8080

# Type-check the TypeScript source without emitting files
[group('Quality')]
typecheck:
    npm run typecheck

# Run the game tests (Node) and the server tests (Python)
[group('Quality')]
test:
    npm test
    uv run --locked python -m unittest discover -s tests -v

# Everything that must pass before shipping
[group('Quality')]
check: typecheck test

# Create the production bundle in dist/
[group('Build')]
build:
    npm run build

# Remove generated build output
[group('Build')]
clean:
    rm -rf dist

# Play a scripted scenario and save screenshots + gallery: just screenshots chapter-1 (scripts/screenshots/)
[group('Screenshots')]
screenshots scenario="chapter-1" *options="":
    node scripts/screenshots.mjs {{ scenario }} {{ options }}

# List the screenshot scenarios
[group('Screenshots')]
screenshots-list:
    @ls scripts/screenshots/*.json | xargs -n1 basename | sed 's/\.json$//'

# Download the Chromium build Playwright uses (once per machine)
[group('Screenshots')]
screenshots-browser:
    npx playwright install chromium

# Check, build and deploy a single machine to Fly, then verify health
[group('Deployment')]
deploy: check
    fly deploy --remote-only --ha=false
    fly checks list
    curl --fail --retry 5 --retry-delay 3 "{{ site_url }}healthz"

# Show machine state and health checks for the deployed app
[group('Deployment')]
deploy-status:
    fly status
    fly checks list

# Store the battle AI key from .env as a Fly secret (restarts the machine)
[group('Deployment')]
deploy-ai-key:
    @[[ -n "${TYPESAFE_API_KEY:-}" ]] || { printf 'Set TYPESAFE_API_KEY in .env first.\n'; exit 1; }
    printf 'TYPESAFE_API_KEY=%s\n' "$TYPESAFE_API_KEY" | fly secrets import

# Tail logs from the deployed app
[group('Deployment')]
deploy-logs:
    fly logs

# Export scene grids, footprints and interaction anchors to output/environments
[group('Data')]
export-environments:
    node --experimental-strip-types scripts/export-environments.mjs

# Generate portrait, expressions, full-body art and 3D model: just character bernat --description '…' (--help)
[group('Tools')]
[positional-arguments]
character *args:
    uv run --locked python tools/character.py "$@"
