# Gerard 35 developer commands. Run `just` to see the menu.

set shell := ["bash", "-euo", "pipefail", "-c"]

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

# Tail logs from the deployed app
[group('Deployment')]
deploy-logs:
    fly logs

# Export scene grids, footprints and interaction anchors to output/environments
[group('Data')]
export-environments:
    node --experimental-strip-types scripts/export-environments.mjs
