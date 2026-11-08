"""Make a game figure in 3D: a toy of a real person, of someone invented, or of a monster.

  front  clothed photos + who they are          -> full-body front view, a faithful likeness (OpenAI). Only with photos.
  toy    all that + a screenshot of the game    -> the figure as a toy of the game's world (OpenAI)
  views  toy                                    -> the same figure from the left, right and back (OpenAI)
  model  toy + views                            -> textured GLB (Meshy multi-image-to-3d)
  rig    model                                  -> the same with a skeleton (Meshy rigging). Only people.
  game   rigged or plain model                  -> public/models/<characters|creatures>/<id>.glb and src/<characters|creatures>/<id>.json
  portrait  toy                                 -> public/portraits/<id>.png for conversations and menus (OpenAI). Only people.

The 3D model is for the game's world only: what people see of a face in a conversation, a menu or a fight's plate
is the generated image. --expressions adds a portrait's expressions, each one image.

Who can be made is in tools/figures.toml. The photos only go to OpenAI, and only those listed there.
Meshy sees the stylised images alone. A step whose result exists is kept, so nothing is paid for
twice; --from STEP makes that step and the ones after it again. Everything stays in
output/characters/3d/<id>/. Run `just character-3d --help` for the options.
"""
import argparse
import base64
import json
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

import character
import character_model
import character_rig
import providers

ROOT = Path(__file__).resolve().parent.parent
STEPS = ("front", "toy", "views", "model", "rig", "game", "portrait")
VIEWS = ("left", "right", "back")
SIZE = "1024x1536"
PORTRAIT_SIZE = "1024x1024"
# Few polygons and flat colour: a toy figure, like the game's cast, not a scan of someone.
MESHY_OPTIONS = {"ai_model": "latest", "should_texture": True, "enable_pbr": False, "should_remesh": True,
                 "topology": "triangle", "target_polycount": 12000, "texture_resolution": "2k", "target_formats": ["glb"],
                 "texture_prompt": "A toy figure of matte moulded plastic in flat solid colours, exactly the colours of the images. "
                                   "No skin pores, no stubble hairs, no fabric weave, no folds, no painted shading or highlights. "
                                   "The face stays simple and painted on, with clean edges."}
# Only a person has a pose Meshy can rig.
PERSON_OPTIONS = {"pose_mode": "a-pose"}
# A screenshot of the game, for the style: its world and its figures.
GAME_STYLE = "game-style.png"


@dataclass
class Figure:
    name: str
    about: str
    height: float
    kind: str = "person"
    photos: list[str] = field(default_factory=list)
    art: list[str] = field(default_factory=list)  # From the project's root; drawn from words and these, never photos.
    face_photos: list[str] = field(default_factory=list)
    cues: str = ""
    scale: float = 1
    clean_shaven: bool = False
    backpack: dict[str, str] = field(default_factory=dict)  # A school backpack's colours (bag, straps), built in the game.
    view_notes: dict[str, str] = field(default_factory=dict)


FRONT_PROMPT = """Create a full-body character sheet front view of the person in the photos, as a stylised 3D game character: a clean, appealing render like a modern animated film or a premium collectible figure, with smooth forms and soft even lighting. Not a photo, not realistic skin, not low-poly, not childish.

THE MOST IMPORTANT THING IS LIKENESS: anyone who knows them must recognise them instantly. Study all the photos and keep their exact face shape and proportions, eye shape and colour, brows, nose, mouth, ears, hairline and hair, simplified but faithful. Slightly large head, about 1 to 5 head-to-body, adult proportions.

Pose: standing straight, facing the camera, A-pose: arms straight and about 30 degrees away from the body, palms facing inward, fingers together, feet slightly apart, neutral relaxed expression with mouth closed. The whole body from the top of the hair to the soles of the shoes, centred with a small margin, nothing cropped.
Flat, even, shadowless lighting. Plain light grey background. No text, no logos, no ground shadow.
"""

SURFACES = """SURFACES: flat solid colours with no texture at all. No pores, no painted shading, no wrinkles, no fabric weave, no folds, no shine. Plain blocks of colour with at most one or two simple details. Tasteful, like a designer toy for adults: not a baby's cartoon, not realistic."""

BACKDROP = "Flat, even, shadowless lighting on a plain light grey background. No text, no logos, no ground shadow."

A_POSE = "facing the camera, arms straight about 30 degrees from the body, feet slightly apart, whole body from the top of the head to the soles, nothing cropped"

PERSON_BODY = """WHAT THEY ARE: a small toy figure of moulded matte plastic, a close relative of the figures in the screenshot, a little rounder and better made. A big head, about a third of their whole height: a soft rounded block in the shape of their own face. A chunky rounded-block torso, short thick arms and legs, simple blocky hands with no fingers, chunky rounded shoes. Hair is one solid sculpted piece with a few big smooth chunks, like a toy's snap-on hair: no strands. The face is painted on and very simple: small solid dark oval eyes with one tiny highlight, simple flat brows, a small bump of a nose, a small plain mouth line. Any facial hair is one flat painted patch of a single colour, not hairs."""

TOY_FROM_PHOTOS = """Redraw this person as a toy figure that belongs in the game world shown in the last image. The first image shows their build and clothes, the next ones are real photos of their face, and the last one is a screenshot of the game: its matte, softly lit miniature world and its chunky little figures.

WHO THEY ARE: they must still be recognisable to whoever knows them, but only through large simple shapes and colours, the way a good custom toy does it: {cues}.

""" + PERSON_BODY + "\n\n" + SURFACES + """

Keep the same pose, framing and outfit colours as the first image: """ + A_POSE + ". " + BACKDROP

TOY_FROM_WORDS = """Draw this person as a toy figure that belongs in the game world shown in the last image, a screenshot of the game: its matte, softly lit miniature world and its chunky little figures. Any image before it shows who they are, a photo or a figure of the same game: take from it what makes them recognisable, as large simple shapes and colours, never its realism, its lighting or its clothes.

WHO THEY ARE: {about}

""" + PERSON_BODY + "\n\n" + SURFACES + """

Pose: """ + A_POSE + ". " + BACKDROP

TOY_CREATURE = """Draw this creature as a toy figure that belongs in the game world shown in the image, a screenshot of the game: its matte, softly lit miniature world and its chunky little figures.

WHAT IT IS: {about}

HOW IT LOOKS: one solid figure of moulded matte plastic, a relative of the figures in the screenshot. Big simple shapes and nothing small, with a strong silhouette that reads from a high camera. It is a real threat in a game for adults: heavy and unsettling, never cute. No big sparkling eyes, no smile, no joke.

""" + SURFACES + """

Pose: standing on the ground by itself, facing the camera, its parts clearly apart from each other, the whole figure in frame, nothing cropped, no base or plinth. """ + BACKDROP

VIEW_PROMPT = """This image is the approved front view of a stylised 3D game figure. Draw the same figure from another camera, as one more view of the same turnaround sheet for building the 3D model.

View: {view}.

Keep EVERYTHING identical to the front view: same figure and face, same shapes and proportions, same colours, same style and finish, same pose. Only the camera moves. {extra}
Flat even shadowless lighting, plain light grey background, no text, no logos."""

VIEW_ANGLES = {
    "left": "exact side view from the figure's left: the camera is 90 degrees round, so it faces the right of the image in pure profile",
    "right": "exact side view from the figure's right: the camera is 90 degrees round, so it faces the left of the image in pure profile",
    "back": "exact back view: the camera is 180 degrees round, we see its back and the back of its head",
}

PORTRAIT_PROMPT = """The image is the approved figure of a character in a game. Draw its portrait, for the game's conversations and menus: exactly this same figure, the same image style and finish, seen closer.

Framing: head and shoulders, a slight three-quarter view, filling the frame: the face in the upper half and the shoulders cut by the bottom edge.
Keep exactly the same face, head shape, hair, glasses if any, clothes, colours, matte moulded finish and soft even light.
Background: fully transparent. No shadow, frame or text."""

EXPRESSION_PROMPT = """The image is the approved portrait of a character in a game. Draw the same portrait with another expression.

Keep exactly the same figure, head shape, hair, glasses if any, clothes, colours, finish, light, framing and size. Change only the painted face and, a little, the tilt of the head.
Expression: {expression}. Clear at a small size, serious enough for a game for adults, never a cartoon grimace.
Background: fully transparent. No shadow, frame or text."""

FIGURES = {key: Figure(**row) for key, row in tomllib.loads((ROOT / "tools" / "figures.toml").read_text()).items()}


def parse(argv):
    parser = argparse.ArgumentParser(prog="just character-3d", description=__doc__.split("\n\n")[0],
                                     formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split("\n\n", 1)[1])
    parser.add_argument("id", choices=sorted(FIGURES), help="who: a table of tools/figures.toml")
    parser.add_argument("--from", dest="start", choices=STEPS, help="make this step and the ones after it again")
    parser.add_argument("--to", dest="stop", choices=STEPS, help="stop after this step: look at the image before paying for the model")
    parser.add_argument("--expressions", nargs="*", metavar="NAME", choices=sorted(character.EXPRESSIONS),
                        help=f"only the portrait's expressions not made yet: these, or all ({', '.join(character.EXPRESSIONS)})")
    parser.add_argument("--dry-run", action="store_true", help="show what would be made and sent; call no API")
    return parser.parse_args(argv)


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def run(argv=None, root: Path = ROOT, images=None, meshy=None, log=print) -> Path:
    args = parse(argv)
    figure, out = FIGURES[args.id], root / "output" / "characters" / "3d" / args.id
    person = figure.kind == "person"
    out.mkdir(parents=True, exist_ok=True)
    photos = root / "assets" / "references" / "characters"
    style = photos / GAME_STYLE
    tasks_file = out / "tasks.json"
    tasks = json.loads(tasks_file.read_text()) if tasks_file.exists() else {}
    # A portrait comes from the toy, so a new model alone doesn't make another one.
    redo = tuple(s for s in STEPS[STEPS.index(args.start):] if s != "portrait" or args.start in ("front", "toy", "portrait")) if args.start else ()
    allowed = STEPS[:STEPS.index(args.stop) + 1] if args.stop else STEPS
    # Asking for a portrait never pays for a model that isn't there.
    if args.start == "portrait" or args.expressions is not None:
        allowed = ("portrait",)

    def pending(step: str, *results: Path) -> bool:
        """Whether a step has to run, saying so; with --dry-run it never does."""
        if step not in allowed:
            return False
        if step not in redo and all(path.exists() for path in results):
            log(f"== {step}: already made, kept")
            return False
        log(f"== {step}: {', '.join(path.name for path in results)}")
        return not args.dry_run

    def draw(prompt: str, references: list[Path], target: Path, size: str = SIZE, background: str = "opaque"):
        client = images or providers.openai_images()
        log(f"  OpenAI: {', '.join(path.name for path in references) or 'no images'}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(client.create(prompt, references, size, background=background))

    front, toy = out / "front.png", out / "toy.png"
    if figure.photos and pending("front", front):
        draw(FRONT_PROMPT + figure.about, [photos / photo for photo in figure.photos], front)
    if pending("toy", toy):
        if figure.photos:
            draw(TOY_FROM_PHOTOS.format(cues=figure.cues), [front, *(photos / photo for photo in figure.face_photos), style], toy)
        else:
            draw((TOY_FROM_WORDS if person else TOY_CREATURE).format(about=figure.about), [*(root / image for image in figure.art), *(photos / photo for photo in figure.face_photos), style], toy)
    sides = [out / f"{view}.png" for view in VIEWS]
    if pending("views", *sides):
        for view, side in zip(VIEWS, sides):
            draw(VIEW_PROMPT.format(view=VIEW_ANGLES[view], extra=figure.view_notes.get(view, "")), [toy], side)

    model, rigged = out / "model.glb", out / "rigged.glb"
    if pending("model", model):
        client = meshy or providers.meshy()
        log("  Meshy: toy.png, " + ", ".join(side.name for side in sides))
        options = {**MESHY_OPTIONS, **(PERSON_OPTIONS if person else {})}
        tasks["model"] = client.start_views([data_uri(toy), *map(data_uri, sides)], **options)
        tasks_file.write_text(json.dumps(tasks, indent=1))
        model.write_bytes(client.download(client.wait(tasks["model"], log, kind="multi-image-to-3d")["model_urls"]["glb"]))
    if person and pending("rig", rigged):
        client = meshy or providers.meshy()
        rigged.with_suffix(".face.json").unlink(missing_ok=True)  # A new model has its face somewhere else.
        tasks["rig"] = client.start_rig(tasks["model"], figure.height)
        tasks_file.write_text(json.dumps(tasks, indent=1))
        rigged.write_bytes(client.download(client.wait(tasks["rig"], log, kind="rigging")["result"]["rigged_character_glb_url"]))

    folder = "characters" if person else "creatures"
    target = root / "public" / "models" / folder / f"{args.id}.glb"
    described = root / "src" / folder / f"{args.id}.json"
    if pending("game", target, described):
        if person:
            glb, spec = character_rig.convert(rigged, args.id, figure.name, figure.scale, figure.clean_shaven)
            if figure.backpack: spec["backpack"] = figure.backpack
        else:
            glb, spec = character_rig.convert_creature(model, args.id, figure.name, figure.height)
        target.parent.mkdir(parents=True, exist_ok=True)
        described.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(glb)
        described.write_text(character_model.dump(spec) if person else json.dumps(spec, ensure_ascii=False, indent=2) + "\n")
        log(f"  {target.relative_to(root)} ({len(glb) / 1e6:.1f} MB), {described.relative_to(root)}")
    portrait = root / "public" / "portraits" / f"{args.id}.png"
    if person and pending("portrait", portrait):
        if not toy.exists():
            raise SystemExit(f"{args.id} has no toy image yet: just character-3d {args.id} --to toy")
        shaven = " One change from the image: remove the moustache. The skin between the nose and the mouth is plain and clean, with no facial hair at all." if figure.clean_shaven else ""
        draw(PORTRAIT_PROMPT + shaven, [toy], portrait, PORTRAIT_SIZE, "transparent")
    if person and args.expressions is not None:
        names = args.expressions or list(character.EXPRESSIONS)
        wanted = {name: portrait.with_name(f"{args.id}-{name}.png") for name in names}
        for name, file in wanted.items():
            if not file.exists() and not args.dry_run:
                log(f"== expression: {file.name}")
                draw(EXPRESSION_PROMPT.format(expression=character.EXPRESSIONS[name]), [portrait], file, PORTRAIT_SIZE, "transparent")
        if not args.dry_run:
            character.update_manifest(root / "src" / "portraits.json", args.id, names)
    return out


if __name__ == "__main__":
    run()
