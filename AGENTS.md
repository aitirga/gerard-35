# Project instructions

- The game is played exclusively on computers. Target desktop browsers and computer input when designing and implementing features.
- Mobile support and mobile viewport/device checks are not required. Do not spend time on mobile-specific layouts or verification unless explicitly requested.
- Use uv for Python package and project management.
- Format commit messages as `type: verb in infinitive + description` (for example, `feat: add character panel`).
- Maintain the existing justfile with clearly named, grouped commands for setup, dev, build, run, checks, and applicable data/database/export workflows. Follow project and sibling justfile conventions; terminal colors must respect NO_COLOR and non-interactive output.
- Name git branches with a type prefix matching the change: `feat/`, `bugfix/`, `hotfix/`, `docs/`, `refactor/`, `chore/`, `test/` (for example, `feat/character-panel`). Never create branches starting with `claude/`.
- After visual or gameplay changes, capture progress with `just screenshots <scenario>` (add or update a scenario in `scripts/screenshots/` for new features) and share the key screenshots with the user.
- Show the user what you produce in herdr's assets sidebar, never by opening it in their browser. Inside herdr (`test "${HERDR_ENV:-}" = 1`), add each screenshot gallery right after generating it, and re-add it each time it is regenerated (the same target updates it): `herdr-assets add output/screenshots/<scenario>/index.html --group Screenshots --title "<short human title>" --note "<what changed>"`. Do the same for other things worth opening: docs you wrote (`--group Docs`), reports (`--group Reports`) and local URLs to check (`--group Links`). Run it from the checkout you are working in (a feature worktree has its own assets). Then tell the user it is in their sidebar and still give the path. Outside herdr, just give the paths.

## Game philosophy

- Progress comes from exploring, trying things and talking to people. Never add an objective panel, quest log, waypoint, arrow, checklist or any other UI that tells the player what to do next or where to go.
- Keep guidance general. Maps show places and the player's position, never action lists, numbered interactions or steps to follow.
- People and the world give direction: a character mentions where something is, a door explains in its own dialogue why it won't open yet, a companion reacts in a speech bubble. If players could get stuck, add a person, a line or a visible detail to the world, not a hint panel.
- The HUD only shows what the player has, can press or is next to: a key hint (key + verb, e.g. "Shift · Correr") the first time an action becomes possible, which disappears once used; a note when an item is gained; and the prompt for whatever is within reach.
- Teach by doing: each new control or system appears right before it is needed, so trying it is how it is learned.
- Gates are diegetic: anything that blocks the player is a person or thing in the world saying why.
- Show only the input device in use. Never hard-code a key or button in the HUD: use `data-glyph="<action>"`, `data-glyph-template="{confirm} Confirmar"` or `data-device="keyboard|gamepad"` (`src/input-glyphs.ts`), adding the action to `GLYPHS` with a label for the keyboard and every pad family if it is new.

## Game vocabulary and descriptions

- Classes are **ánimas** in the game. All player-facing text (UI, dialogue, banners, journal) and new docs say "ánima" (e.g. "ÁNIMA DESBLOQUEADA", "Sin ánima"); the code may keep `ClassId`/`CLASSES` as internal names.
- Skill and effect descriptions use plain, clear Spanish with a fixed shape: what it does, how strong, its kind, and to whom; then one short sentence per extra effect. No flavour text, no jokes, no exact formulas.
  - Damage: `Daño <intensidad> <físico|mágico>[ de tipo <X>] a <objetivo>. <Efecto extra>.`, e.g. `Daño alto mágico a un enemigo. Rompe el pringue.`
  - Healing: `Cura <intensidad> a <objetivo>.`, e.g. `Cura leve a todo el equipo.`
  - Buffs and debuffs: `Sube|Baja <stats> de <objetivo> durante <N> rondas.`, e.g. `Sube Fuerza y Magia de todo el equipo durante 3 rondas.`
  - Intensity from the skill's base power, against Atacar's 18: `leve` up to 20, `media` / `medio` 21–34, `alta` / `alto` 35–49, `muy alta` / `muy alto` 50 or more.
  - Targets: `a un enemigo`, `a todos los enemigos`, `a un aliado herido`, `a todo el equipo`.
  - Exception: a skill may skip this nomenclature on purpose and be more abstract or less defined (a mysterious, strange or story-driven skill whose effect the player should discover by using it). Mark it `abstract: true` in `SKILLS` (`src/battle.ts`); its description can then be evocative instead of exact, but still short, clear Spanish. Keep these rare: the default is the fixed shape.
  - `tests/battle.test.mjs` checks every skill description against this shape, skipping those marked `abstract: true`.
- The status screen's Diario is Gerard's memory and a thought he cannot shake, written cryptically; its mission line stays vague ("Entender qué está pasando."). Neither ever names a place to go, a person to talk to or an action to take.
