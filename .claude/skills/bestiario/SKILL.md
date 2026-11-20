---
name: bestiario
description: Read the notes and "rehacer" marks Aitor left in the bestiary (`just bestiario`, docs/bestiary-notes.json) and act on them one by one: redesign or remake a monster's or a character's 3D model, redo a portrait, fix an animation, or propose a combat change; then answer each note with what was done and refresh the bestiary. Use when the user says to look at the bestiary, its notes or comments, what is marked to redo ("mira el bestiario", "las notas del bestiario", "rehaz lo marcado", "lo que he marcado").
---

# The bestiary's notes

Talk to the user in Spanish. The bestiary (`just bestiario`, `bestiario.html`, docs/dev-tools.md §
The bestiary) shows every being in the game; Aitor leaves notes on its entries and marks what to
redo. This skill reads them, does the work with the tools that already exist, writes back what was
done, and leaves the bestiary true. Keep it to what the notes ask.

## 0 · Read

- `docs/bestiary-notes.json`: `notes[]`, each with `entry` (the entry's key: `aliado:`, `anima:`,
  `enemigo:<FoeKind>`, `diseno:<figure id>`, `npc:`), `name`, `redo` (any of `modelo`, `retrato`,
  `diseño`, `animaciones`, `combate`; empty is a plain comment), `text`, `status` (`abierta`, `hecha`,
  `descartada`), `created`, and once answered `reply` and `closed`. Work only on `abierta` notes.
- What the entry is: `uv run python tools/bestiary.py` (refreshes `output/bestiary/figures.json`), then
  the figure's table in `tools/figures.toml`, its files in `output/characters/3d/<id>/`, and for a foe
  its kind in `src/castle.ts` / `src/battle.ts`. An `enemigo:<kind>` whose figure exists is the same
  work as `diseno:<id>`.
- `git pull` first if the notes might have been written on the other machine (memory: work on main
  across machines).

## 1 · Plan, and say what it costs

Group the open notes by entry and tell Aitor in a few lines what you will do with each, and what it
costs: OpenAI images are cheap (medium quality); **Meshy is about 35 credits a model with skeleton**.
Images go ahead; a Meshy model only after he has seen and approved the new image, unless his note
already says to go to 3D. A combat change is always a proposal first (memory: propose before
implementing).

## 2 · Do it, by what is marked

| Marked | What to do | With |
| --- | --- | --- |
| `diseño` | Change the figure's `about` / `view_notes` / `art` as the note says, keep the old image (`mv toy.png toy-vN.png`: the bestiary shows earlier tries), make a new one, look at it, show it | `/character-3d` skill, `just character-3d <id> --from toy --to toy` |
| `modelo` | If the design is fine, a new model from it: views, look at them, then Meshy. If the note is about the look, it is a `diseño` first. A foe with no figure yet: write its table (family, year, trait) and start at the image | `just character-3d <id> --to views`, then `--from model` |
| `retrato` | A new low-poly portrait (never from the 3D figure) | `just character <id> --only portrait --force` (tools/README.md; memory: portraits are low-poly) |
| `animaciones` | What moves where: Meshy's clips (`walking`, `running` beside a monster's GLB) or the fight's own motion (`battle-scene.ts`, the `MOTION` table in `src/bestiary-data.ts`). New motion in a fight is code: propose it first | code, model lab (`model-lab.html?monstruos`) |
| `combate` | A change to how it fights: propose it as plain moves in a table, wait for his OK, then build it and balance it | `just fight-sim`, `TARGETS` (AGENTS.md) |
| none | A comment: answer it, or fold it into the work it is about | — |

Follow the character-3d skill's rules and lessons for every image and model (fear without
childishness, traits that survive Meshy's mirror, compare to scale beside Gerard). Add each image and
gallery to herdr's sidebar as it is made (memory: show progress while working).

## 3 · Answer each note

In `docs/bestiary-notes.json`, on each note you handled: `reply` says in one or two plain Spanish
sentences what was done and where (`Nueva imagen: output/characters/3d/chivata/toy.png; la anterior
es toy-v2.png. Falta tu OK para pasarla a 3D.`), and:

- done → `status: "hecha"`, `closed` = now (ISO);
- waiting for his OK or for a decision → keep `abierta`, with the `reply` saying what it waits for;
- not done on purpose → `descartada`, with the reason.

Never delete a note, never rewrite his `text`. Keep the file pretty-printed with two spaces, the notes
in their order, and add no other fields: the page refuses a file that `notesProblem` in
`src/bestiary-notes.ts` rejects (unknown fields, a repeated `id`, an `entry` with another prefix). If the
page is open, it reads the file on reload.

## 4 · Leave the bestiary true

- `uv run python tools/bestiary.py`, then `just screenshots bestiario --gpu`, look at the shots of the
  entries you touched, and re-add the gallery: `herdr-assets add output/screenshots/bestiario/index.html
  --group Screenshots --title "Bestiario" --note "<what changed>"`. Add a shot to
  `scripts/screenshots/bestiario.json` for an entry that changed a lot.
- Anything the bestiary keeps by hand (`CASTLE_ANSWERS`, `MOTION` in `src/bestiary-data.ts`) changes
  in the same go as the thing it describes (memory: keep the bestiary updated).
- `just check` if code changed. Commit only if he asks.

End with a short list for Aitor: each note, what was done, what waits for him, and the paths.
