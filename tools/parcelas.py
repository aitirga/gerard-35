"""Las parcelas: a word-clue puzzle for the campsite (docs/quests/universidad.md § Càmping Eurosport).

A grid of pitches, each with a word on its sign. The reception's blackboard gives one clue at a
time (a word and a number); the pitches that go with it are the friends'. A wrong pitch wakes its
tent (a fight); the black pitch puts every lantern out.

Claude composes a puzzle from the word bank, the rules below check it, and a second Claude, who
only sees the grid and the clues, tries to solve it. A puzzle is kept only if that guesser does as
well as the level asks. Two levels:

Both use the original game's board: 5 × 5 words and 9 to find.

  prueba      easy, for development: printed, plain JSON, and a page to try it in a browser
  produccion  very hard, for the real day: sealed (compressed) and never printed, so nobody plays it
              before then

  just parcelas prueba
  just parcelas produccion          # refuses to replace the sealed one without --force
  just parcelas prueba --dry-run    # the prompt, no API call
"""
import argparse
import base64
import html
import json
import re
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BANK = ROOT / "assets/parcelas/palabras.txt"
OUT = ROOT / "src/parcelas"
PAGE = ROOT / "output/parcelas/prueba.html"
ATTEMPTS = 3

LEVELS = {
    # Both are the original game's board: 5 × 5 words, 9 to find, one that ends it, the rest wrong.
    "prueba": {
        "cols": 5, "rows": 5, "clues": [3, 3, 3],
        "style": "Easy and obvious: each clue is a word anyone would link to its targets at first sight. "
                 "Wrong words are clearly unrelated to every clue, and the black word is unrelated to all of them.",
        # The guesser must find every target and never take the black word.
        "hits": 1.0, "black": "never",
    },
    "produccion": {
        "cols": 5, "rows": 5, "clues": [4, 3, 2],
        "style": "Very hard but fair, for two clever players who know each other well and want a real challenge. "
                 "Each clue links its targets through a sideways connection (a shared use, a place, an expression, "
                 "a double meaning, a memory of that campsite), never a synonym or an obvious category. Several wrong "
                 "words tempt for every clue, and the black word is the most tempting wrong answer of the four-word "
                 "clue. Once the link is seen, each target must fit without doubt and no wrong word may fit as well.",
        # The guesser must find at least half the targets and never take the black word as its first guess for a clue.
        "hits": .5, "black": "not-first", "sealed": True,
    },
}

WORD = re.compile(r"^[A-ZÁÉÍÓÚÜÑÇ]+$")


def load_bank(path: Path = BANK) -> list[str]:
    words = [line.split("#")[0].strip().upper() for line in path.read_text().splitlines()]
    return sorted({w for w in words if w})


def stem(word: str) -> str:
    plain = word.translate(str.maketrans("ÁÉÍÓÚÜ", "AEIOUU"))
    return plain[:5]


def validate(puzzle: dict, level: str, bank: list[str] | None = None) -> list[str]:
    """Problems with a puzzle, as sentences Claude can fix; empty when it is sound."""
    spec, errors = LEVELS[level], []
    pitches = puzzle.get("pitches")
    size = spec["cols"] * spec["rows"]
    if not isinstance(pitches, list) or len(pitches) != size:
        return [f"There must be exactly {size} pitches ({spec['cols']} columns by {spec['rows']} rows)."]
    words = [p.get("word", "") if isinstance(p, dict) else "" for p in pitches]
    roles = [p.get("role") if isinstance(p, dict) else None for p in pitches]
    for word in words:
        if not WORD.match(word):
            errors.append(f"{word!r} must be one word in capitals, letters only.")
        elif bank is not None and word not in bank:
            errors.append(f"{word} is not in the word bank.")
    if len(set(words)) != len(words):
        errors.append("Every pitch needs a different word.")
    if roles.count("black") != 1:
        errors.append('Exactly one pitch must have the role "black".')
    if any(r not in ("ours", "tent", "black") for r in roles):
        errors.append('Every role must be "ours", "tent" or "black".')
    clues = puzzle.get("clues")
    if not isinstance(clues, list) or [c.get("count") for c in clues if isinstance(c, dict)] != spec["clues"]:
        errors.append(f"There must be {len(spec['clues'])} clues with counts {spec['clues']}, in that order.")
        return errors
    seen = []
    for clue in clues:
        word, targets = clue.get("word", ""), clue.get("targets", [])
        if not WORD.match(word):
            errors.append(f"The clue {word!r} must be one word in capitals, letters only.")
        clash = [w for w in words if w and (stem(w) == stem(word) or w in word or word in w)]
        if clash:
            errors.append(f"The clue {word} is too close to the pitch word {clash[0]}: it would give it away.")
        if not isinstance(targets, list) or len(targets) != clue.get("count") or not all(isinstance(t, int) for t in targets):
            errors.append(f"The clue {word} must list exactly {clue.get('count')} pitch indexes as targets.")
            continue
        for t in targets:
            if not 0 <= t < size or roles[t] != "ours":
                errors.append(f"The clue {word} points at pitch {t}, which is not an \"ours\" pitch.")
        seen += targets
    ours = [i for i, r in enumerate(roles) if r == "ours"]
    if sorted(seen) != ours:
        errors.append(f'Every "ours" pitch must be the target of exactly one clue (ours: {ours}, targets: {sorted(seen)}).')
    return errors


def score(puzzle: dict, guesses: list[list[str]]) -> dict:
    """How the guesser did: per clue it stops at the first wrong pitch, as at the real table."""
    role = {p["word"]: p["role"] for p in puzzle["pitches"]}
    targets = [{puzzle["pitches"][t]["word"] for t in c["targets"]} for c in puzzle["clues"]]
    hits, black, black_first = 0, False, False
    for i, clue in enumerate(puzzle["clues"]):
        picks = [g.upper() for g in (guesses[i] if i < len(guesses) else [])][:clue["count"]]
        for n, pick in enumerate(picks):
            if pick in targets[i]:
                hits += 1
                continue
            if role.get(pick) == "black":
                black, black_first = True, black_first or n == 0
            break
    total = sum(c["count"] for c in puzzle["clues"])
    return {"hits": hits, "total": total, "black": black, "black_first": black_first}


def passes(result: dict, level: str) -> bool:
    spec = LEVELS[level]
    if spec["black"] == "never" and result["black"] or spec["black"] == "not-first" and result["black_first"]:
        return False
    return result["hits"] >= spec["hits"] * result["total"]


COMPOSE = """You design the word-clue puzzle of a campsite in "Gerard 35", a birthday game. Two friends, Gerard and
Aitor, will solve it together in Spanish. They went camping for years at Càmping Eurosport (a pool, near the
beach) with their university friends Anna, Álvaro, Miquel, Sarah, Soraya and Nico; their ritual was a photo of
everyone with a melon; they played a lot of board games there.

The grid has {size} pitches ({cols} columns by {rows} rows, row by row). Each pitch has one word on its sign and
one role: "ours" (a clue points at it), "tent" (a wrong answer) or "black" (the one never to pick).
Clues come one at a time, each a single Spanish word in capitals with a number: the number of "ours" pitches it
points at. Counts, in order: {counts}. So {ours} pitches are "ours", one is "black", the rest are tents.

Difficulty: {style}

Rules: pitch words come only from the word bank below, all different. A clue word is not on the grid and does not
share a root with a grid word. No proper names as clues. Prefer the group's own world (the campsite, the beach,
summer, board games, the friends) where it makes the puzzle better, never at the cost of fairness.

Word bank: {bank}

Answer with JSON only:
{{"pitches": [{{"word": "…", "role": "ours|tent|black"}}, …], "clues": [{{"word": "…", "count": n, "targets": [pitch indexes]}}, …],
"why": ["one short line per clue on the link, for the designers"]}}"""

GUESS = """You are playing a Spanish word-clue game. The grid of words:
{words}
Clues come one at a time with a number. For each clue, in order, list the grid words you would pick, best first,
exactly as many as its number. A word picked for an earlier clue is already taken. One word on the grid ends the
game if picked; avoid anything you are unsure of.
Clues: {clues}
Answer with JSON only: {{"guesses": [["WORD", …], …]}}"""


def compose_prompt(level: str, bank: list[str]) -> str:
    spec = LEVELS[level]
    return COMPOSE.format(size=spec["cols"] * spec["rows"], cols=spec["cols"], rows=spec["rows"],
                          counts=", ".join(map(str, spec["clues"])), ours=sum(spec["clues"]),
                          style=spec["style"], bank=", ".join(bank))


def text_of(blocks) -> str:
    return "".join(getattr(b, "text", "") for b in blocks if getattr(b, "type", "") == "text")


def parse(text: str):
    start, end = text.find("{"), text.rfind("}")
    try:
        return json.loads(text[start:end + 1]) if start >= 0 else None
    except json.JSONDecodeError:
        return None


def ask(claude, system: str, messages: list, log=print, tries: int = 3):
    """One reply, asked again when a safety filter stops it by mistake (it happens now and then, at random)."""
    for n in range(1, tries + 1):
        try:
            return claude.reply(system, messages)
        except SystemExit as stop:
            if "refusal" not in str(stop) or n == tries:
                raise
            log(f"  the reply was stopped by a filter; asking again ({n + 1}/{tries})")


def make(level: str, claude, bank: list[str], log=print) -> tuple[dict, dict]:
    """A puzzle that passes the rules and the guesser, within a few attempts."""
    messages = [{"role": "user", "content": compose_prompt(level, bank)}]
    for attempt in range(1, ATTEMPTS + 1):
        blocks = ask(claude, "You design fair, clever word puzzles.", messages, log)
        puzzle = parse(text_of(blocks)) or {}
        problems = validate(puzzle, level, bank)
        if not problems:
            words = [p["word"] for p in puzzle["pitches"]]
            clues = ", ".join(f"{c['word']} · {c['count']}" for c in puzzle["clues"])
            answer = parse(text_of(ask(claude, "You play word games carefully.",
                                                [{"role": "user", "content": GUESS.format(words=", ".join(words), clues=clues)}], log)))
            result = score(puzzle, (answer or {}).get("guesses", []))
            log(f"  attempt {attempt}: guesser found {result['hits']} of {result['total']}"
                + (", stepped on the black pitch" if result["black"] else ""))
            if passes(result, level):
                return puzzle, result
            problems = [f"A careful player who never saw your notes found {result['hits']} of {result['total']} targets"
                        + (" and picked the black pitch" + (" first" if result["black_first"] else "") if result["black"] else "")
                        + ". Make the links fairer where they failed, keeping the level's difficulty."]
        else:
            log(f"  attempt {attempt}: {len(problems)} rule problems")
        messages += [{"role": "assistant", "content": blocks},
                     {"role": "user", "content": "Fix these and answer with the whole JSON again:\n- " + "\n- ".join(problems)}]
    raise SystemExit(f"No puzzle passed after {ATTEMPTS} attempts; nothing was written.")


def finished(puzzle: dict, level: str) -> dict:
    spec = LEVELS[level]
    return {"version": 1, "level": level, "cols": spec["cols"], "rows": spec["rows"],
            "pitches": [{"word": p["word"], "role": p["role"]} for p in puzzle["pitches"]],
            "clues": [{"word": c["word"], "count": c["count"], "targets": c["targets"]} for c in puzzle["clues"]]}


def seal(puzzle: dict) -> dict:
    """Not encryption: it only keeps the answers from being read by accident before the day."""
    raw = zlib.compress(json.dumps(puzzle, ensure_ascii=False).encode(), 9)
    return {"version": 1, "level": puzzle["level"], "sealed": base64.b64encode(raw).decode()}


def unseal(sealed: dict) -> dict:
    return json.loads(zlib.decompress(base64.b64decode(sealed["sealed"])))


def page(puzzle: dict) -> str:
    """A page to try the test puzzle: click a pitch to choose it."""
    data = html.escape(json.dumps(puzzle, ensure_ascii=False), quote=False)
    return PAGE_TEMPLATE.replace("__DATA__", data).replace("__COLS__", str(puzzle["cols"]))


PAGE_TEMPLATE = """<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Las parcelas · prueba</title>
<style>
:root{--bg:#1d1f17;--card:#e9dfc4;--ink:#2a2a20;--ours:#f3c860;--tent:#7d7f63;--black:#0c0c0c;--muted:#b9b59c}
body{margin:0;background:var(--bg);color:#f2ecd8;font:16px/1.4 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}
main{width:min(720px,100% - 32px);padding:24px 0}
h1{font-size:15px;letter-spacing:.14em;color:var(--muted);font-weight:600;margin:0 0 16px}
#board{background:#2c2f22;border:2px solid #4a4d38;border-radius:6px;padding:18px;text-align:center;margin-bottom:18px}
#clue{font:700 34px/1.1 Georgia,serif;letter-spacing:.06em}
#note{color:var(--muted);margin-top:6px;min-height:1.4em}
#grid{display:grid;grid-template-columns:repeat(__COLS__,1fr);gap:10px}
button{appearance:none;border:0;border-radius:4px;padding:22px 6px;background:var(--card);color:var(--ink);
font:700 15px/1 system-ui,sans-serif;letter-spacing:.05em;cursor:pointer;box-shadow:0 3px 0 #9f977c}
button:hover{transform:translateY(-1px)}
button.ours{background:var(--ours);box-shadow:0 0 18px #f3c86099}
button.tent{background:var(--tent);color:#d9d6c3;box-shadow:none}
button.black{background:var(--black);color:#666;box-shadow:none}
button:disabled{cursor:default;transform:none}
footer{color:var(--muted);font-size:13px;margin-top:16px}
</style></head><body><main>
<h1>CÀMPING EUROSPORT · LAS PARCELAS · PRUEBA</h1>
<div id="board"><div id="clue"></div><div id="note"></div></div>
<div id="grid"></div>
<footer>Pulsa una parcela para elegirla. Las correctas encienden su farol; una equivocada despierta su tienda (un combate); la negra apaga todos los faroles.</footer>
</main>
<script id="data" type="application/json">__DATA__</script>
<script>
const P = JSON.parse(document.getElementById('data').textContent);
const grid = document.getElementById('grid'), clue = document.getElementById('clue'), note = document.getElementById('note');
let lit = new Set(), fights = 0;
const current = () => P.clues.find(c => !c.targets.every(t => lit.has(t)));
function draw(msg = '') {
  const c = current();
  clue.textContent = c ? `${c.word} · ${c.count}` : 'PASO ABIERTO';
  note.textContent = msg || (c ? '' : `Hecho con ${fights} combate${fights === 1 ? '' : 's'}.`);
}
P.pitches.forEach((p, i) => {
  const b = document.createElement('button');
  b.textContent = p.word;
  b.onclick = () => {
    if (!current()) return;
    if (p.role === 'ours') { lit.add(i); b.className = 'ours'; b.disabled = true; draw('El farol se enciende.'); }
    else if (p.role === 'tent') { fights++; b.className = 'tent'; b.disabled = true; draw('La tienda se despierta: combate.'); }
    else {
      fights++; lit = new Set(); b.className = 'black';
      grid.querySelectorAll('button.ours').forEach(o => { o.className = ''; o.disabled = false; });
      draw('Se apagan todos los faroles. Combate duro, y a empezar de nuevo.');
    }
  };
  grid.append(b);
});
draw();
</script></body></html>
"""


def run(argv=None, root: Path = ROOT, claude=None, log=print) -> Path | None:
    parser = argparse.ArgumentParser(prog="just parcelas", description=__doc__.split("\n\n")[0])
    parser.add_argument("level", choices=LEVELS)
    parser.add_argument("--bank", type=Path, default=root / BANK.relative_to(ROOT), help="word bank, one word per line")
    parser.add_argument("--force", action="store_true", help="replace an existing sealed production puzzle")
    parser.add_argument("--dry-run", action="store_true", help="show the prompt; call no API")
    args = parser.parse_args(argv)
    bank = load_bank(args.bank)
    target = root / OUT.relative_to(ROOT) / f"{args.level}.json"
    if args.dry_run:
        log(compose_prompt(args.level, bank))
        return None
    sealed = LEVELS[args.level].get("sealed", False)
    if sealed and target.exists() and not args.force:
        raise SystemExit(f"{target.relative_to(root)} already holds the sealed puzzle; pass --force to replace it.")
    if claude is None:
        import providers
        claude = providers.claude()
    log(f"Composing the {args.level} puzzle from {len(bank)} words…")
    puzzle, result = make(args.level, claude, bank, log)
    puzzle = finished(puzzle, args.level)
    target.parent.mkdir(parents=True, exist_ok=True)
    if sealed:
        target.write_text(json.dumps(seal(puzzle), indent=2) + "\n")
        log(f"Sealed in {target.relative_to(root)}: {puzzle['cols']}×{puzzle['rows']} pitches, {len(puzzle['clues'])} clues; "
            f"the guesser found {result['hits']} of {result['total']}. Its words are not shown.")
        return target
    target.write_text(json.dumps(puzzle, ensure_ascii=False, indent=2) + "\n")
    out = root / PAGE.relative_to(ROOT)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page(puzzle))
    log(f"Wrote {target.relative_to(root)} and {out.relative_to(root)}; the guesser found {result['hits']} of {result['total']}.")
    return target


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT / "tools"))
    run()
