# Gerard 35 developer commands. Run `just` to see the menu.

set shell := ["bash", "-euo", "pipefail", "-c"]
# Local secrets such as TYPESAFE_API_KEY live in .env (see .env.example).
set dotenv-load := true

site_url := "https://gerard-35-aitirga.fly.dev/"
# The local API's port, its own so another project's server on 8080 never answers for it.
api_port := env("GERARD_API_PORT", "8035")

# Show the command menu
[group('Help')]
default:
    @printf 'Gerard 35 — developer commands\n\n'
    @just --list --color never
    @printf '\nLive development: just backend + just dev (two terminals).\n'

# Install exact dependencies (Node + Python) and the house's lights library (vendor/)
[group('Setup')]
setup:
    git submodule update --init
    npm ci
    uv sync --locked

# Move the house's lights library (vendor/geraitor_domotic_house) to its latest main
[group('Setup')]
lights-update:
    git submodule update --init --remote vendor/geraitor_domotic_house
    git -C vendor/geraitor_domotic_house log --oneline -1

# Start the Vite dev server with hot reload on http://127.0.0.1:5173
[group('Development')]
dev:
    npm run dev

# Open a repeatable battle: just dev-battle 4 2 (foes 2–4, allies 1–2)
[group('Development')]
dev-battle foes="4" allies="1":
    @[[ "{{ foes }}" =~ ^[234]$ && "{{ allies }}" =~ ^[12]$ ]] || { printf 'Use 2–4 foes and 1–2 allies.\n'; exit 1; }
    npm run dev -- --open '/?battle={{ foes }}&allies={{ allies }}'

# Jump in after a story beat: just dev-chapter got-backpack, or metro for chapter 2's open city (new = from the start)
[group('Development')]
dev-chapter beat="new":
    @[[ "{{ beat }}" =~ ^(new|intro|met-jan|got-shoes|got-potion|got-backpack|bernat-joined|bernat-stalled|dejavu|minion|first-fight|palace|in-palace|got-chicle|noista|wrapper-room|caught|got-wrapper|tv-news|metro|rec-comtal|castle|palace-tried|clue-r4|anima-nuria|anima-uri|papagato)$ ]] || { printf 'Use new or a story flag from src/story.ts (e.g. got-backpack, metro).\n'; exit 1; }
    npm run dev -- --open '/?story={{ beat }}'

# Wake up on a later day of chapter 2 to see the Queen's spread: just dev-day 6 (7 is the end)
[group('Development')]
dev-day day="4":
    @[[ "{{ day }}" =~ ^[0-9]+$ && "{{ day }}" -ge 2 ]] || { printf 'Use a day from 2 on (7 is the end without ánimas).\n'; exit 1; }
    npm run dev -- --open '/?story=castle&day={{ day }}'

# Debug chapter 2 with one player: Gerard's controls also drive Aitor in battle (just dev-solo off to undo)
[group('Development')]
dev-solo state="on":
    @[[ "{{ state }}" =~ ^(on|off)$ ]] || { printf 'Use on or off.\n'; exit 1; }
    npm run dev -- --open '/?story=got-wrapper&solo={{ if state == "on" { "1" } else { "0" } }}'

# Play as a generated character: just dev-character bernat (file in src/characters/)
[group('Development')]
dev-character name="gerard-child":
    @[[ -f "src/characters/{{ name }}.json" ]] || { printf 'No src/characters/%s.json; run just character first.\n' "{{ name }}"; exit 1; }
    npm run dev -- --open '/?character={{ name }}'

# Play a song from a mark, second or random point, and a haunted one at a level: just dev-music battle 126, just dev-music bubbaloo random .8 (press a key to start)
[group('Development')]
dev-music track="battle" from="start" haunt="":
    @[[ "{{ track }}" =~ ^[a-z0-9-]+$ && "{{ from }}" =~ ^([a-z-]+|[0-9]+(\.[0-9]+)?)$ && "{{ haunt }}" =~ ^([01]|0?\.[0-9]+)?$ ]] || { printf 'Use a track from src/music.ts, a mark or seconds and an optional haunt from 0 to 1, e.g. just dev-music bubbaloo random .8.\n'; exit 1; }
    npm run dev -- --open '/?music={{ track }}&from={{ from }}{{ if haunt != "" { "&haunt=" + haunt } else { "" } }}'

# Start the persistent API on port 8035 (GERARD_API_PORT), proxied by `just dev` under /api
[group('Development')]
backend:
    uv run --locked uvicorn server:app --host 127.0.0.1 --port {{ api_port }} --reload

# Build, then serve game + API together on http://127.0.0.1:8035
[group('Development')]
run: build
    uv run --locked uvicorn server:app --host 127.0.0.1 --port {{ api_port }}

# Open the desktop combat lab: tune encounters, compare policies and replay a seed
[group('Combat')]
combat-lab:
    npm run dev -- --open /combat-lab.html

# Run reproducible difficulty batches (use --help for seeds, policies and tuning)
[group('Combat')]
[positional-arguments]
combat-sim *args:
    node --experimental-strip-types scripts/combat-sim.mjs "$@"

# Check the generic engine, simulator and campaign integration
[group('Combat')]
combat-check:
    node --experimental-strip-types --test tests/combat-*.test.mjs

# Verify the desktop lab in Chromium (use --build after just build for production assets)
[group('Combat')]
[positional-arguments]
combat-browser-check *args:
    node scripts/combat-lab-smoke.mjs "$@"

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

# Stitch the places report from each contribution in output/reports/places/sections/
[group('Screenshots')]
places-report:
    node scripts/places-report.mjs

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

# Let the deployed game drive the lights at home: LIFX_TOKEN and HOME_LIGHTS_KEY from .env (docs/home-lights.md)
[group('Deployment')]
deploy-lights:
    @[[ -n "${LIFX_TOKEN:-}" && -n "${HOME_LIGHTS_KEY:-}" ]] || { printf 'Set LIFX_TOKEN and HOME_LIGHTS_KEY in .env first.\n'; exit 1; }
    printf 'LIFX_TOKEN=%s\nHOME_LIGHTS_KEY=%s\n' "$LIFX_TOKEN" "$HOME_LIGHTS_KEY" | fly secrets import
    @printf 'Open the game once with ?luces=<HOME_LIGHTS_KEY> to connect the lights from that browser.\n'

# Tail logs from the deployed app
[group('Deployment')]
deploy-logs:
    fly logs

# Export scene grids, footprints and interaction anchors to output/environments
[group('Data')]
export-environments:
    node --experimental-strip-types scripts/export-environments.mjs

# Download map data for a real place, then build it: just geo alegia (zones in assets/geo/)
[group('Data')]
geo zone="alegia": (geo-fetch zone) (geo-build zone)

# Download OpenStreetMap features (+ Google references with GOOGLE_MAPS_API_KEY) for a zone
[group('Data')]
geo-fetch zone="alegia":
    @[[ -f "assets/geo/{{ zone }}/zone.json" ]] || { printf 'No assets/geo/%s/zone.json; copy assets/geo/alegia/zone.json first.\n' "{{ zone }}"; exit 1; }
    uv run --locked python tools/geo.py fetch {{ zone }}

# Rebuild src/geo/<zone>.json and its preview from the saved map data or its sketch (offline)
[group('Data')]
geo-build zone="alegia":
    @[[ -f "assets/geo/{{ zone }}/osm.json" || -f "assets/geo/{{ zone }}/sketch.json" ]] || { printf 'No map data for %s; run just geo-fetch %s first (or sketch it).\n' "{{ zone }}" "{{ zone }}"; exit 1; }
    uv run --locked python tools/geo.py build {{ zone }}

# List the real places that can be built
[group('Data')]
geo-zones:
    @ls assets/geo/*/zone.json | xargs -n1 dirname | xargs -n1 basename

# Fetch a CC0 material into public/textures/<id>/: just texture-fetch polyhaven clay_roof_tiles_02 --id teula (--help)
[group('Data')]
[positional-arguments]
texture-fetch *args:
    uv run --locked python tools/textures.py fetch "$@"

# Make a facade, bays or a sign from a photo (local or Wikimedia Commons): just texture-photo foto.jpg --id <id> --size-m 12 9 --corners …
[group('Data')]
[positional-arguments]
texture-photo *args:
    uv run --locked python tools/textures.py photo "$@"

# Draw Barcelona's panot (square or flor) over a fetched grain: just texture-panot flor --id panot-flor --grain formigo
[group('Data')]
[positional-arguments]
texture-panot *args:
    uv run --locked python tools/textures.py panot "$@"

# List the real textures with their size, source and licence
[group('Data')]
textures:
    @uv run --locked python tools/textures.py list

# Rebuild the network map: hand-drawn stations and landmarks + the real city behind (docs/barcelona.md)
[group('Data')]
city: && city-background
    uv run --locked python tools/city.py build

# Download Barcelona's streets, coast and parks from OpenStreetMap, then rebuild the map
[group('Data')]
city-fetch: && city
    uv run --locked python tools/city.py fetch

# Download every building's footprint and height from OpenStreetMap, then rebuild the map
[group('Data')]
city-fetch-buildings: && city
    uv run --locked python tools/city.py fetch-buildings

# Render the ground under the 3D city into public/maps/barcelona.webp
[group('Data')]
city-background:
    @[[ -f output/city/background.svg ]] || { printf 'No street data yet; run just city-fetch first.\n'; exit 0; }
    node scripts/city-background.mjs

# Ship a song from its master in assets/music/ to public/music/<name>.m4a (copied if .m4a, else encoded) with its loudness map: just music-export battle
[group('Audio')]
music-export name:
    @[[ "{{ name }}" =~ ^[a-z0-9-]+$ ]] || { printf 'Use the song name without extension, e.g. just music-export battle.\n'; exit 1; }
    @src=$(ls assets/music/{{ name }}.* 2>/dev/null | head -n1); [[ -n "$src" ]] || { printf 'No master for %s in assets/music/.\n' '{{ name }}'; exit 1; }; mkdir -p public/music; if [[ "$src" == *.m4a ]]; then cp "$src" public/music/{{ name }}.m4a; else ffmpeg -v error -y -i "$src" -vn -c:a aac -b:a 192k public/music/{{ name }}.m4a; fi; printf '%s → public/music/%s.m4a\n' "$src" '{{ name }}'
    @uv run --locked python tools/music_loop.py loudness public/music/{{ name }}.m4a

# Find where a song loops: tempo, opening notes and seams (just music-loop public/music/battle.m4a --start 2.1:2.7)
[group('Audio')]
[positional-arguments]
music-loop file *args:
    uv run --locked python tools/music_loop.py analyze "$@"

# Write a seam to output/music/ to listen to: the loop's end, then its start (just music-seam public/music/battle.m4a 2.398 134.398)
[group('Audio')]
music-seam file start end:
    uv run --locked python tools/music_loop.py preview '{{ file }}' '{{ start }}' '{{ end }}'

# Generate portrait, expressions, full-body art and 3D model: just character bernat --description '…' (--help)
[group('Tools')]
[positional-arguments]
character *args:
    uv run --locked python tools/character.py "$@"
