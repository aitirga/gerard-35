"""Generate a character's portrait, conversation expressions, full-body reference and 3D model.

  portrait     photos + previous artwork + notes -> transparent head-and-shoulders portrait (OpenAI)
  expressions  portrait + one expression each    -> the same portrait with another face (OpenAI)
  fullbody     portrait + the same references    -> front A-pose full-body image (OpenAI)
  model        full-body image + portrait        -> primitives file for the game (Claude),
                                                    or a textured GLB with --modeler meshy

Every run is kept in output/characters/<name>/<timestamp>/ (prompts, references,
results) and the results are then installed where the game and assets/ expect them.
Run `just character --help` for the options.
"""
import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

import character_model
import providers

ROOT = Path(__file__).resolve().parent.parent
STEPS = ("portrait", "expressions", "fullbody", "model")
MAX_IMAGES = 16  # OpenAI image edits accept up to 16 inputs.
MAX_PHOTOS = 10
STYLE_ANCHORS = 3  # Artwork of other characters, so a new character matches the game.

STYLE = ("stylised low-poly digital painting with visible triangular facets on skin, hair and clothes, "
         "warm soft lighting, friendly expression and clean readable shapes")

PORTRAIT_PROMPT = """Create the in-game portrait of {who} for "Gerard 35", a cozy birthday adventure game.
{guide}
Style: {style}. Match the style, framing and finish of the game artwork.
Framing: head and shoulders, slight three-quarter view, face in the upper half, shoulders cropped by the bottom edge.
Likeness: keep the recognisable features from the photos (face shape, eyes, nose, hair, glasses if any), not their background or lighting.
Background: fully transparent. No shadow, frame or text.{notes}"""

FULLBODY_PROMPT = """Create a full-body reference of {who} for "Gerard 35"; it will be turned into the in-game 3D model.
{guide}
Pose: standing straight facing the camera, front view, A-pose (arms straight and about 30 degrees away from the body), feet slightly apart, relaxed expression.
Framing: the whole body from the top of the head to the soles of the shoes, centred with a small margin, nothing cropped.
Style: {style}, as a stylised low-poly game character with slightly chunky proportions and simple solid shapes. Flat, even lighting without cast shadows so it reads well in 3D.
Background: fully transparent. No ground shadow or text.{notes}"""

EXPRESSION_PROMPT = """Edit the in-game portrait of {who} for "Gerard 35" so the character shows another expression in a conversation.
Image 1 is the approved portrait. Keep exactly the same character, face, hair, glasses if any, outfit, colours, art style, lighting, framing, size and position. Change only the facial expression, plus a small head tilt or gesture if the expression asks for one.
Expression: {expression}. Make it clear and readable at small size, warm and cartoon-friendly, never scary.
Background: fully transparent. No shadow, frame or text.{notes}"""

# Built-in conversation expressions; ask for others with name=description. The plain portrait is the neutral one.
EXPRESSIONS = {
    "sorprendido": "surprised: eyebrows raised high, eyes wide open, mouth open in a small round O",
    "riendo": "laughing out loud: eyes squeezed shut with joy, wide open smiling mouth, head tilted back slightly",
    "triste": "sad: inner eyebrows raised, eyes looking down, small downturned mouth",
    "enfadado": "grumpy and annoyed: eyebrows pulled down and together, pouting mouth, cheeks a little puffed",
    "pensativo": "thoughtful: eyes looking up to one side, lips pressed to one side, one eyebrow raised",
    "preocupado": "worried: eyebrows raised and knitted together, nervous wobbly smile",
}
DEFAULT_EXPRESSIONS = ("sorprendido", "riendo", "triste", "enfadado", "pensativo")

MESHY_OPTIONS = {"ai_model": "latest", "pose_mode": "a-pose", "should_texture": True, "enable_pbr": False,
                 "should_remesh": True, "topology": "triangle"}


def parse(argv):
    parser = argparse.ArgumentParser(prog="just character", description=__doc__.split("\n\n")[0],
                                     formatter_class=argparse.RawDescriptionHelpFormatter,
                                     epilog=(
                                         "examples:\n"
                                         "  just character bernat --description 'Best friend of Gerard, 9 years old, red hoodie'\n"
                                         "  just character gerard --variant child --only portrait --dry-run\n"
                                         "  just character gerard --variant child --only fullbody model --force"))
    parser.add_argument("id", help="character id used by the game, e.g. gerard or bernat")
    parser.add_argument("--variant", help="age or outfit variant, e.g. child (gives gerard-child)")
    parser.add_argument("--photos", nargs="+", type=Path, metavar="PATH",
                        help="photos or folders (default: assets/references/characters/<id>/)")
    parser.add_argument("--context", nargs="+", type=Path, default=[], metavar="PATH",
                        help="extra artwork for context, after the character's own assets/characters/<id>/ images")
    parser.add_argument("--description", default="", help="appearance, age, outfit, personality…")
    parser.add_argument("--only", nargs="+", choices=STEPS, default=list(STEPS), metavar="STEP",
                        help="run only some steps: portrait, expressions, fullbody, model (default: all)")
    parser.add_argument("--expressions", nargs="+", type=expression, metavar="NAME[=DESCRIPTION]",
                        default=[(name, EXPRESSIONS[name]) for name in DEFAULT_EXPRESSIONS],
                        help=f"conversation expressions (default: {' '.join(DEFAULT_EXPRESSIONS)}; built in: "
                             f"{', '.join(EXPRESSIONS)}); e.g. 'guino=winking one eye with a cheeky grin'")
    parser.add_argument("--modeler", choices=("claude", "meshy"), default="claude",
                        help="claude: primitives in src/characters/ (default); meshy: GLB in public/models/characters/")
    parser.add_argument("--polycount", type=int, default=20000, help="Meshy: target triangles (default 20000)")
    parser.add_argument("--force", action="store_true", help="overwrite existing installed results")
    parser.add_argument("--dry-run", action="store_true", help="show references, prompts and targets; call no API")
    return parser.parse_args(argv)


def expression(value: str) -> tuple[str, str]:
    name, _, description = value.partition("=")
    name = name.strip().lower()
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name):
        raise argparse.ArgumentTypeError(f"{name!r}: use lowercase letters, digits and dashes, without accents")
    description = description.strip() or EXPRESSIONS.get(name)
    if not description:
        raise argparse.ArgumentTypeError(f"describe {name!r} as {name}=description (built in: {', '.join(EXPRESSIONS)})")
    return name, description


def update_manifest(path: Path, name: str, expressions: list[str]):
    """src/portraits.json lists the expressions each portrait has, so conversations know what exists."""
    manifest = json.loads(path.read_text()) if path.exists() else {}
    manifest[name] = sorted(set(manifest.get(name, [])) | set(expressions))
    lines = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in sorted(manifest.items()))
    path.write_text(f"{{\n{lines}\n}}\n")


def images_in(paths: list[Path], warn=print) -> list[Path]:
    found = []
    for path in paths:
        for file in sorted(path.iterdir()) if path.is_dir() else [path]:
            if file.suffix.lower() in providers.MIME:
                found.append(file)
            elif file.is_file() and not file.name.startswith("."):
                warn(f"  skipping {file}: use PNG, JPEG or WebP (e.g. export HEIC photos as JPEG)")
    return found


class Character:
    def __init__(self, root: Path, args):
        self.root, self.args = root, args
        suffix = f"-{args.variant}" if args.variant else ""
        self.name = args.id + suffix
        self.who = f'the character "{args.id}"' + (f" ({args.variant} version)" if args.variant else "")
        folder = root / "assets/characters" / args.id
        self.targets = {
            "portrait": [folder / f"portrait{suffix}-transparent.png", root / "public/portraits" / f"{self.name}.png"],
            "expressions": [path for paths in self.expression_targets(args.expressions).values() for path in paths],
            "fullbody": [folder / f"fullbody{suffix}.png"],
            "model": [root / "src/characters" / f"{self.name}.json"] if args.modeler == "claude"
            else [root / "public/models/characters" / f"{self.name}.glb"],
        }
        missing = [p for p in args.photos or [] if not p.exists()] + [p for p in args.context if not p.exists()]
        if missing:
            raise SystemExit("Not found: " + ", ".join(map(str, missing)))
        photos = [p.resolve() for p in args.photos or [root / "assets/references/characters" / args.id]]
        self.photos = images_in([p for p in photos if p.exists()])[:MAX_PHOTOS]
        own = images_in([folder]) if folder.is_dir() else []
        others = sorted(p for p in (root / "assets/characters").glob("*/portrait*.png") if p.parent != folder)
        extra = images_in([p.resolve() for p in args.context])
        self.context = list(dict.fromkeys(extra + own + others[:STYLE_ANCHORS]))
        if not (self.photos or args.description or own):
            raise SystemExit(f"Give photos (assets/references/characters/{args.id}/ or --photos) or a --description.")

    def expression_targets(self, expressions):
        folder, suffix = self.root / "assets/characters" / self.args.id, self.name[len(self.args.id):]
        return {name: [folder / f"portrait{suffix}-{name}-transparent.png", self.root / "public/portraits" / f"{self.name}-{name}.png"]
                for name, _ in expressions}

    def notes(self) -> str:
        return f"\nCharacter notes: {self.args.description}" if self.args.description else ""

    def references(self, first: tuple[str, list[Path]] | None = None):
        """The images to send and a sentence telling the model what each group is."""
        groups = [first] if first else []
        groups += [("photos of the real person", self.photos),
                   ("existing game artwork: copy its art style, and if it shows this same character "
                    "keep the identity, outfit and colours consistent", self.context)]
        images, guide, start = [], [], 1
        for label, paths in groups:
            paths = [p for p in paths if p not in images][:MAX_IMAGES - len(images)]
            if paths:
                span = f"Image {start} is" if len(paths) == 1 else f"Images {start}-{start + len(paths) - 1} are"
                guide.append(f"{span} {label}.")
                images += paths
                start += len(paths)
        return images, " ".join(guide) or "There are no reference images; follow the notes."

    def check_targets(self, log=print):
        taken = [p for step in self.args.only for p in self.targets[step] if p.exists()]
        if taken and not self.args.force:
            message = "Already exists (pass --force to replace):\n" + "\n".join(
                f"  {p.relative_to(self.root)}" for p in taken)
            if not self.args.dry_run:
                raise SystemExit(message)
            log(message)

    def source(self, step: str, produced: dict) -> Path:
        """A previous step's result: from this run, else the installed one."""
        path = produced.get(step) or self.targets[step][0]
        if not path.exists() and not self.args.dry_run:
            raise SystemExit(f"Missing {path.relative_to(self.root)}: run the {step} step first.")
        return path


def run(argv=None, root: Path = ROOT, images=None, meshy=None, claude=None, log=print) -> Path | None:
    args = parse(argv)
    root = root.resolve()
    character = Character(root, args)
    character.check_targets(log)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = root / "output/characters" / character.name / stamp
    produced, meta = {}, {"character": character.name, "steps": args.only, "description": args.description}

    def rel(paths):
        return [str(p.relative_to(root)) if p.is_relative_to(root) else str(p) for p in paths]

    def image_step(step, template, size, first=None):
        refs, guide = character.references(first)
        prompt = template.format(who=character.who, guide=guide, style=STYLE, notes=character.notes())
        log(f"\n== {step}: {len(refs)} reference images")
        for i, ref in enumerate(rel(refs), 1):
            log(f"  {i:>2}. {ref}")
        if args.dry_run:
            log(prompt)
            produced[step] = character.targets[step][0]
            return
        client = images or providers.openai_images()
        log(f"  generating with {client.model}…")
        produced[step] = out / f"{step}.png"
        out.mkdir(parents=True, exist_ok=True)
        produced[step].write_bytes(client.create(prompt, refs, size))
        meta[step] = {"model": client.model, "prompt": prompt, "references": rel(refs)}

    if "portrait" in args.only:
        image_step("portrait", PORTRAIT_PROMPT, "1024x1024")
    if "expressions" in args.only:
        portrait = character.source("portrait", produced)
        log(f"\n== expressions from {rel([portrait])[0]}")
        produced["expressions"], prompts, client = {}, {}, None
        for name, description in args.expressions:
            prompts[name] = EXPRESSION_PROMPT.format(who=character.who, expression=description, notes=character.notes())
            log(f"  {name}: {description}")
            if args.dry_run:
                continue
            client = client or images or providers.openai_images()
            out.mkdir(parents=True, exist_ok=True)
            produced["expressions"][name] = out / f"expression-{name}.png"
            produced["expressions"][name].write_bytes(client.create(prompts[name], [portrait], "1024x1024"))
        if args.dry_run:
            log(prompts[args.expressions[0][0]])
        else:
            meta["expressions"] = {"model": client.model, "source": rel([portrait])[0], "prompts": prompts}
    if "fullbody" in args.only:
        portrait = character.source("portrait", produced)
        image_step("fullbody", FULLBODY_PROMPT, "1024x1536",
                   ("the approved portrait of this character: keep the same face, hair, outfit and colours", [portrait]))
    if "model" in args.only and args.modeler == "claude":
        fullbody = character.source("fullbody", produced)
        portrait = produced.get("portrait") or character.targets["portrait"][0]
        images_for_claude = [("Full-body reference of the character (front, A-pose):", fullbody)]
        if portrait.exists() or args.dry_run:
            images_for_claude.append(("Portrait of the character:", portrait))
        target = character.targets["model"][0]
        example = (("The character's current file: improve it to match the references", target) if target.exists()
                   else ("Example file, the hand-built protagonist Gerard as a child: match its scale, conventions "
                         "and level of detail, not its outfit", root / "src/characters/gerard-child.json"))
        log(f"\n== model: Claude designs primitives from {', '.join(rel([p for _, p in images_for_claude]))}"
            f"\n  example: {rel([example[1]])[0]}")
        if not args.dry_run:
            client = claude or providers.claude()
            log(f"  designing with {client.model}…")
            messages = character_model.request(character.name, character.who, character.notes(), images_for_claude, example)
            spec = character_model.design(client, messages, character.name, log)
            out.mkdir(parents=True, exist_ok=True)
            produced["model"] = out / "model.json"
            produced["model"].write_text(character_model.dump(spec))
            meta["model"] = {"provider": "claude", "model": client.model, "parts": len(spec["parts"]),
                             "references": rel([p for _, p in images_for_claude]), "example": rel([example[1]])[0]}
    if "model" in args.only and args.modeler == "meshy":
        options = {**MESHY_OPTIONS, "target_polycount": args.polycount}
        fullbody = character.source("fullbody", produced)
        log(f"\n== model: Meshy image-to-3D from {rel([fullbody])[0]}\n  {json.dumps(options)}")
        if not args.dry_run:
            client = meshy or providers.meshy()
            task_id = client.start(fullbody.read_bytes(), **options)
            log(f"  task {task_id}")
            task = client.wait(task_id, log)
            out.mkdir(parents=True, exist_ok=True)
            produced["model"] = out / "model.glb"
            produced["model"].write_bytes(client.download(task["model_urls"]["glb"]))
            if task.get("thumbnail_url"):
                (out / "model-preview.png").write_bytes(client.download(task["thumbnail_url"]))
            meta["model"] = {"provider": "meshy", "task": task_id, "options": options,
                             "source": rel([fullbody])[0], "credits": task.get("consumed_credits")}

    log("\n== install")
    expression_targets = character.expression_targets(args.expressions)
    installs = [(produced.get("expressions", {}).get(name), target) for name, targets in expression_targets.items()
                for target in targets] if "expressions" in args.only else []
    installs += [(produced.get(step), target) for step in args.only if step != "expressions"
                 for target in character.targets[step]]
    for source, target in installs:
        log(f"  {target.relative_to(root)}")
        if not args.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    if "expressions" in args.only:
        manifest = root / "src/portraits.json"
        log(f"  {manifest.relative_to(root)} ({character.name}: {', '.join(expression_targets)})")
        if not args.dry_run:
            update_manifest(manifest, character.name, list(expression_targets))
    if args.dry_run:
        log("\nDry run: nothing was generated or written.")
        return None
    (out / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    log(f"\nRun kept in {out.relative_to(root)}")
    if "model" in args.only and args.modeler == "claude":
        log(f"Preview it in the game: just dev-character {character.name}")
    dialogue = root / "src/dialogue.ts"
    if {"portrait", "expressions"} & set(args.only) and dialogue.exists() \
            and f"portrait: '{character.name}'" not in dialogue.read_text():
        log(f"Conversations use it once its speaker in src/dialogue.ts has portrait: '{character.name}'.")
    return out


if __name__ == "__main__":
    try:
        run(sys.argv[1:])
    except KeyboardInterrupt:
        sys.exit(130)
