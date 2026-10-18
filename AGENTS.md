# Project instructions

- The game is played exclusively on computers. Target desktop browsers and computer input when designing and implementing features.
- Mobile support and mobile viewport/device checks are not required. Do not spend time on mobile-specific layouts or verification unless explicitly requested.
- Use uv for Python package and project management.
- Format commit messages as `type: verb in infinitive + description` (for example, `feat: add character panel`).
- Maintain the existing justfile with clearly named, grouped commands for setup, dev, build, run, checks, and applicable data/database/export workflows. Follow project and sibling justfile conventions; terminal colors must respect NO_COLOR and non-interactive output.
- Name git branches with a type prefix matching the change: `feat/`, `bugfix/`, `hotfix/`, `docs/`, `refactor/`, `chore/`, `test/` (for example, `feat/character-panel`). Never create branches starting with `claude/`.
- After visual or gameplay changes, capture progress with `just screenshots <scenario>` (add or update a scenario in `scripts/screenshots/` for new features) and share the key screenshots with the user.

## Game philosophy

- Progress comes from exploring, trying things and talking to people. Never add an objective panel, quest log, waypoint, arrow, checklist or any other UI that tells the player what to do next or where to go.
- People and the world give direction: a character mentions where something is, a door explains in its own dialogue why it won't open yet, a companion reacts in a speech bubble. If players could get stuck, add a person, a line or a visible detail to the world, not a hint panel.
- The HUD only shows what the player has, can press or is next to: a key hint (key + verb, e.g. "Shift · Correr") the first time an action becomes possible, which disappears once used; a note when an item is gained; and the prompt for whatever is within reach.
- Teach by doing: each new control or system appears right before it is needed, so trying it is how it is learned.
- Gates are diegetic: anything that blocks the player is a person or thing in the world saying why.
- The status screen's Diario is Gerard's memory and a thought he cannot shake, written cryptically; its mission line stays vague ("Entender qué está pasando."). Neither ever names a place to go, a person to talk to or an action to take.
