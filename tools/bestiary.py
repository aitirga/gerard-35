"""What the bestiary (`just bestiario`, src/bestiary.ts) needs from outside src/: every figure of
tools/figures.toml and which of its files exist, written to output/bestiary/figures.json.

The page reads the game's own data for everything else; a figure added to figures.toml, or a step of
`just character-3d` run for it, shows up there on the next `just bestiario` with nothing else to edit.
"""
import json
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output" / "bestiary" / "figures.json"
# What each step of `just character-3d` leaves in output/characters/3d/<id>/ (tools/character_3d.py).
STEPS = {"front": "front.png", "toy": "toy.png", "left": "left.png", "right": "right.png", "back": "back.png",
         "model": "model.glb", "rigged": "rigged.glb", "walking": "walking.glb", "running": "running.glb"}
# Where the game step puts a figure, by its kind.
FOLDERS = {"person": "characters", "monster": "monsters", "creature": "creatures"}


def figures(root: Path = ROOT) -> list[dict]:
    rows = tomllib.loads((root / "tools" / "figures.toml").read_text())
    made = []
    for key, row in rows.items():
        folder = root / "output" / "characters" / "3d" / key
        kind = row.get("kind", "person")
        files = {step: f"output/characters/3d/{key}/{name}" for step, name in STEPS.items() if (folder / name).exists()}
        # Earlier tries of the image (toy-v1.png…), kept beside it when a design was redone.
        earlier = sorted(f"output/characters/3d/{key}/{path.name}" for path in folder.glob("toy-*.png")) if folder.exists() else []
        game = FOLDERS[kind]
        made.append({
            "id": key, "name": row.get("name", key), "kind": kind, "about": row.get("about", ""), "cues": row.get("cues", ""),
            "height": row.get("height"), "files": files, "earlier": earlier,
            "game": {"glb": (root / "public" / "models" / game / f"{key}.glb").exists(), "spec": (root / "src" / game / f"{key}.json").exists()},
        })
    return made


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = figures()
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")
    print(f"{OUT.relative_to(ROOT)}: {len(rows)} figures")


if __name__ == "__main__":
    main()
