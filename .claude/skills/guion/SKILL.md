---
name: guion
description: Read the suggestions, comments and changes (blocks of lines to add, lines to take out) Aitor left on the game's script (`just guion`, docs/guion-notes.json) and act on them one by one: rewrite a line as he suggests or as his comment asks, add or remove the lines he marked, keep each character's voice and the game's tone, apply it in the code, and answer each note with what was done. Use when the user says to look at the script, its notes, suggestions or comments ("mira el guion", "las notas del guion", "aplica las sugerencias", "lo que he comentado en el guion").
---

# The script's notes

Talk to the user in Spanish. The script (`just guion`, `guion.html`, docs/dev-tools.md § El guion)
shows every line the game says, who says it, where it is written and a photo of the moment. Aitor
edits lines there himself (straight into the code) and leaves the rest as notes. This skill reads
the open notes, does what they ask, answers each one and leaves the script true. Keep it to what the
notes ask.

## 0 · Read

- `git pull` first if the notes might have been written on the other machine (memory: work on main
  across machines).
- `docs/guion-notes.json`: `notes[]`, each with `entry` (the entry's id), `title`, `line` (0-based)
  and `quote` (what the line said when he wrote the note) if it is about one line, `proposal` (how he
  would write it) for a suggestion, `change` for a change to the moment's lines (below), `at` (the
  line's `file:line` when the note was written), `text` (his comment or why, may be empty), `status`
  (`abierta`, `hecha`, `descartada`), `created`, and once answered `reply` and `closed`. Work only on
  `abierta` notes.
- What the entry is now: `node --experimental-strip-types --no-warnings scripts/guion.mjs` writes
  `output/guion/guion.json`; find the entry by `id`, its lines with `speaker`, `text` and `at`
  (`file`, `line`, `col`). If the line no longer says `quote`, find it by its text in the entry, or
  in the code (`grep`), before touching anything. `output/guion/partida.json` says when it is said
  (`moments`), which helps read it in context: read the lines before and after it in the same entry
  and section.

- **Changes** (`change`): `añadir` puts the lines of `block` (each `{ speaker, text }`, in that
  order) `place` (`antes` / `despues`) the line `line` whose text was `quote`; `quitar` takes the
  line `line` (`quote`) out. Find that line by `quote` first (`at` says where it was): `line` counts
  the lines as the script showed them then, so it moves when other changes land. Several blocks on the
  same line go in the order they were made (`created`).

## 1 · Plan

Group the open notes by entry and tell Aitor in a few lines what you will do with each. A suggestion
(`proposal`) is applied as written unless it breaks a rule below; then say why and offer a version.
A comment asks for a rewrite in your words: show the new line(s) before writing them when the change
is more than a word or two, or when it changes what a character knows or what happens (memory:
propose before implementing; the story bible is docs/lore.md and docs/story-outline.md).

## 2 · Write it

- Edit the literal where the line is written (`at.file`, `at.line`), keeping its quotes; a line in
  `src/geo/<zone>.json` is also changed in `assets/geo/<zone>/zone.json` (its source). A template
  with `${…}` keeps its pieces.
- The game's rules (AGENTS.md § Game philosophy): adult tone, never a children's register; no line
  tells the player what to do or where to go (people may mention where something is); each character
  keeps their voice (read their other lines in the script, `Quien sea` filter); the Diario stays
  cryptic; ánima, never "clase". A skill or effect description follows the fixed shape in AGENTS.md.
- If the same text is quoted in a doc (docs/quests/*.md, docs/chapter-*.md, docs/castle*.md), change
  it there too. If a test pins the text (`grep -rn` it in tests/), update the test.

- **A block to add**: write each line as the entry's other lines are written (a dialogue's
  `{ speaker: '<id>', text: '…' }` in its `lines`, a look's plain string), right where `place` says.
  `speaker` is a `SPEAKERS` id (src/dialogue.ts) or a voice of `VOICES` (src/guion.ts): if it is
  neither of the dialogue's `left`/`right`, see how that dialogue shows a third voice before adding,
  and ask if it cannot. His text is applied as written, like a suggestion, unless it breaks a rule
  above.
- **A line to take out**: delete its element. Before, `grep` for anything that counts on the line or
  its index (a test, an index such as `lines[3]`, a fight or step waiting on it); if the moment would be
  left empty, ask.
- Apply an entry's changes from its last line to its first, so the earlier ones do not shift.

## 3 · Answer each note

In `docs/guion-notes.json`, on each note handled: `reply` says in one or two plain Spanish sentences
what was done and where (`Aplicada en src/friends/nuria.ts:181.` or `Reescrita: «…». Falta tu OK.`),
and:

- done → `status: "hecha"`, `closed` = now (ISO, to the second);
- waiting for his OK or a decision → keep `abierta`, with the `reply` saying what it waits for;
- not done on purpose → `descartada`, with the reason.

Never delete a note, never rewrite his `text` or `proposal`. Keep the file pretty-printed with two
spaces, the notes in their order, and add no other fields: the dev server refuses a file that
`guionNotesProblem` in `src/guion.ts` rejects. If the page is open, it reads the file on reload.

## 4 · Leave it true

- `node --experimental-strip-types --no-warnings scripts/guion.mjs` (the script reads the code
  again), `just check` (typecheck and tests).
- If a line in the middle of a moment changed a lot, retake its photo: `just guion-fotos --solo
  <entry id> --todas`.
- Commit only if he asks.

End with a short list for Aitor: each note, what was done, what waits for him, and the files changed.
