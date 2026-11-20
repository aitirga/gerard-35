"""Make a game figure in 3D: a toy of a real person, of someone invented, or of a monster.

  front  clothed photos + who they are          -> full-body front view, a faithful likeness (OpenAI). Only with photos.
  toy    all that + a screenshot of the game    -> the figure as a toy of the game's world (OpenAI)
  views  toy                                    -> the same figure from the left, right and back (OpenAI)
  model  toy + views                            -> textured GLB (Meshy multi-image-to-3d)
  rig    model                                  -> the same with a skeleton (Meshy rigging). People and monsters.
  anim   rigged model + `animations`            -> one GLB with a clip per action of Meshy's library (monsters)
  game   rigged or plain model                  -> public/models/<characters|monsters|creatures>/<id>.glb and src/<same>/<id>.json

A monster (kind "monster") is a foe with two arms and two legs: it gets Meshy's skeleton and its walking
and running clips, and no face. A creature (kind "creature") is one piece, with no skeleton. An animal (kind
"animal", Nuria's cats) is a toy like the people on four legs: Meshy cannot rig it, so the game step cuts
it to the game's own cat skeleton (src/cat-gait.ts). Someone held (kind "held", Nil) is a toy like the people
in one piece, sitting as if carried: the person who `carries` it holds it in the game.

The 3D model is for the game's world only. Portraits for conversations, menus and fight plates are low-poly
paintings made with `just character <id> --only portrait`, never drawn from this figure or rendered from its model.

Who can be made is in tools/figures.toml. The photos only go to OpenAI, and only those listed there.
Meshy sees the stylised images alone. A step whose result exists is kept, so nothing is paid for
twice; --from STEP makes that step and the ones after it again. Everything stays in
output/characters/3d/<id>/. Run `just character-3d --help` for the options.
"""
import argparse
import base64
import io
import json
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, UnidentifiedImageError

import animal_rig
import character_model
import character_rig
import providers

ROOT = Path(__file__).resolve().parent.parent
STEPS = ("front", "toy", "views", "model", "rig", "anim", "game")
VIEWS = ("left", "right", "back")
SIZE = "1024x1536"
# Few polygons and flat colour: a toy figure, like the game's cast, not a scan of someone.
MESHY_OPTIONS = {"ai_model": "latest", "should_texture": True, "enable_pbr": False, "should_remesh": True,
                 "topology": "triangle", "target_polycount": 12000, "texture_resolution": "2k", "target_formats": ["glb"],
                 "texture_prompt": "A toy figure of matte moulded plastic in flat solid colours, exactly the colours of the images. "
                                   "No skin pores, no stubble hairs, no fabric weave, no folds, no painted shading or highlights. "
                                   "The face stays simple and painted on, with clean edges."}
# A monster is no toy: matte, but made of what it is made of.
MONSTER_TEXTURE = ("A sculpted figure of matte material, exactly the colours and surfaces of the images: large areas of colour, "
                   "texture only in big shapes (stretched gum, a dry crust, a crack). No fine noise, no glossy highlights, "
                   "no painted light or shadow.")
# Only what has two arms and two legs has a pose Meshy can rig.
PERSON_OPTIONS = {"pose_mode": "a-pose"}
RIGGED = ("person", "monster")
# The clips Meshy's rigging gives a monster, beside its model: only the skeleton's motion.
CLIPS = ("walking", "running")
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
    # A monster's moves from Meshy's animation library, by action id (GET /openapi/v1/animations/library):
    # up to ten, 3 credits each, all in one file, a clip each, named as the library names them.
    animations: list[int] = field(default_factory=list)
    # A creature with wings: how far from its middle, in metres, its body ends and its wings begin. The
    # game gets the wings as their own nodes, hinged there, to beat them (`character_rig.convert_creature`).
    wings: float = 0
    # Who this person carries in their arms, a figure of kind "held" (Uri carries Nil): the game puts it there.
    carries: str = ""


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

# Monsters and creatures share the game's world, its light and its scale of detail, not its friendliness:
# Aitor asked for fear (2026-11-19), and a toy's finish made them cute.
MONSTER_LOOK = """HOW IT LOOKS: one sculpted figure of matte material for a dark game for adults, like a puppet made for a stop-motion horror film or a boss of such a game: big simple shapes and nothing small, a strong silhouette that reads from a high camera. It must be unsettling or menacing: weight, presence, proportions that are a little wrong where it is a monster. Never cute, never a cartoon, no big eyes, no smile, no joke. No gore, no blood, no realistic skin.

SURFACES: matte, a few large areas of colour. Texture only where it tells what it is made of (stretched gum, a dry crust, a crack), and in big shapes: no fine noise, no glossy highlights, no painted light or shadow."""

TOY_MONSTER = """Draw this monster as a figure that belongs in the game world shown in the last image, a screenshot of the game: its matte, softly lit miniature world and its chunky figures. Any image before it is another figure of the same family, or this same one in another form: the words below say which, and what to keep of it.

WHAT IT IS: {about}

""" + MONSTER_LOOK + """

Pose: """ + A_POSE + ", hands and arms clearly apart from the body. " + BACKDROP

# A pet is a toy of the cast's world, like the people, on four legs: never a monster's look.
TOY_ANIMAL = """Draw this animal as a toy figure that belongs in the game world shown in the last image, a screenshot of the game: its matte, softly lit miniature world and its chunky little figures. The images before it are real photos of this very animal: keep what makes it itself (its coat's colours and where its patches are, its eye colour, its build, how long its fur is) as large simple shapes and colours, never the photo's realism or its lighting.

WHO IT IS: {about}

WHAT IT IS: a small toy figure of moulded matte plastic, a close relative of the figures in the screenshot, a little rounder and better made. A slightly big rounded head, a rounded body, four sturdy rounded legs and a thick tail. Fur is one solid sculpted surface: long fur is a few big smooth tufts, never strands. The face is painted on and simple: eyes in their own colour with a dark pupil and one tiny highlight, a small nose, no mouth line, no whiskers. Each patch of the coat is one flat area of its colour with clean edges.

""" + SURFACES + """

Pose: seen straight from the front, the camera level with it and the animal facing it squarely and symmetrically (never three quarters), standing square on all four straight legs, all four paws flat on the ground and clearly apart from each other, the tail raised up behind it in a gentle curve and clear of the body, head level looking at the camera, the whole animal from the tips of its ears to its paws and tail, nothing cropped, no base. """ + BACKDROP

# Someone small another figure carries (Nil in Uri's arms): a toy like the people, sitting as if held.
TOY_HELD = """Draw this person as a toy figure that belongs in the game world shown in the last image, a screenshot of the game: its matte, softly lit miniature world and its chunky little figures. Any image before it is an image of the same game showing who they are: take from it what makes them recognisable, as large simple shapes and colours, never its realism or its lighting.

WHO THEY ARE: {about}

WHAT THEY ARE: a small toy figure of moulded matte plastic, a close relative of the figures in the screenshot, made to be carried in another figure's arms. A big rounded head, a soft rounded body, short thick rounded arms and legs, simple rounded hands and feet with no fingers or toes. Hair is one solid sculpted piece: no strands. The face is painted on and very simple: small solid dark oval eyes with one tiny highlight, a small bump of a nose, a small plain mouth.

""" + SURFACES + """

Pose: sitting upright on nothing as if held up in someone's arms, facing the camera squarely, legs bent forward and a little apart, arms a little raised and clear of the body, the whole figure in frame, nothing cropped, no one holding them, no base, no chair. """ + BACKDROP

TOY_CREATURE = """Draw this creature as a figure that belongs in the game world shown in the last image, a screenshot of the game: its matte, softly lit miniature world and its chunky figures. Any image before it is another figure of the same family, or this same one in another form: the words below say which, and what to keep of it.

WHAT IT IS: {about}

""" + MONSTER_LOOK + """

Pose: on the ground by itself, facing the camera, its parts clearly apart from each other, the whole figure in frame, nothing cropped, no base or plinth. """ + BACKDROP

VIEW_PROMPT = """This image is the approved front view of a stylised 3D game figure. Draw the same figure from another camera, as one more view of the same turnaround sheet for building the 3D model.

View: {view}.

Keep EVERYTHING identical to the front view: same figure and face, same shapes and proportions, same colours, same style and finish, same pose. Only the camera moves. {extra}
Flat even shadowless lighting, plain light grey background, no text, no logos."""

VIEW_ANGLES = {
    "left": "exact side view from the figure's left: the camera is 90 degrees round, so it faces the right of the image in pure profile",
    "right": "exact side view from the figure's right: the camera is 90 degrees round, so it faces the left of the image in pure profile",
    "back": "exact back view: the camera is 180 degrees round, we see its back and the back of its head",
}

FIGURES = {key: Figure(**row) for key, row in tomllib.loads((ROOT / "tools" / "figures.toml").read_text()).items()}


def parse(argv):
    parser = argparse.ArgumentParser(prog="just character-3d", description=__doc__.split("\n\n")[0],
                                     formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split("\n\n", 1)[1])
    parser.add_argument("id", choices=sorted(FIGURES), help="who: a table of tools/figures.toml")
    parser.add_argument("--from", dest="start", choices=STEPS, help="make this step and the ones after it again")
    parser.add_argument("--to", dest="stop", choices=STEPS, help="stop after this step: look at the image before paying for the model")
    parser.add_argument("--dry-run", action="store_true", help="show what would be made and sent; call no API")
    return parser.parse_args(argv)


def data_uri(path: Path) -> str:
    """An image for Meshy as a high-quality JPEG: a sheet of four PNGs is ~8 MB of base64 and its upload
    timed out on a slow line (2026-11-19); the same views as JPEG are about an eighth of that."""
    try:
        image = Image.open(path).convert("RGB")
    except UnidentifiedImageError:  # Not an image Pillow reads: sent as it is.
        return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def run(argv=None, root: Path = ROOT, images=None, meshy=None, log=print) -> Path:
    args = parse(argv)
    figure, out = FIGURES[args.id], root / "output" / "characters" / "3d" / args.id
    person, rigged_kind, animal, held = figure.kind == "person", figure.kind in RIGGED, figure.kind == "animal", figure.kind == "held"
    out.mkdir(parents=True, exist_ok=True)
    photos = root / "assets" / "references" / "characters"
    style = photos / GAME_STYLE
    tasks_file = out / "tasks.json"
    tasks = json.loads(tasks_file.read_text()) if tasks_file.exists() else {}
    redo = STEPS[STEPS.index(args.start):] if args.start else ()
    allowed = STEPS[:STEPS.index(args.stop) + 1] if args.stop else STEPS

    def pending(step: str, *results: Path) -> bool:
        """Whether a step has to run, saying so; with --dry-run it never does."""
        if step not in allowed:
            return False
        if step not in redo and all(path.exists() for path in results):
            log(f"== {step}: already made, kept")
            return False
        log(f"== {step}: {', '.join(path.name for path in results)}")
        return not args.dry_run

    def draw(prompt: str, references: list[Path], target: Path):
        client = images or providers.openai_images()
        log(f"  OpenAI: {', '.join(path.name for path in references) or 'no images'}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(client.create(prompt, references, SIZE, background="opaque"))

    front, toy = out / "front.png", out / "toy.png"
    if figure.photos and pending("front", front):
        draw(FRONT_PROMPT + figure.about, [photos / photo for photo in figure.photos], front)
    if pending("toy", toy):
        if figure.photos:
            draw(TOY_FROM_PHOTOS.format(cues=figure.cues), [front, *(photos / photo for photo in figure.face_photos), style], toy)
        else:
            prompt = TOY_FROM_WORDS if person else TOY_MONSTER if rigged_kind else TOY_ANIMAL if animal else TOY_HELD if held else TOY_CREATURE
            draw(prompt.format(about=figure.about), [*(root / image for image in figure.art), *(photos / photo for photo in figure.face_photos), style], toy)
    sides = [out / f"{view}.png" for view in VIEWS]
    if pending("views", *sides):
        for view, side in zip(VIEWS, sides):
            draw(VIEW_PROMPT.format(view=VIEW_ANGLES[view], extra=figure.view_notes.get(view, "")), [toy], side)

    model, rigged = out / "model.glb", out / "rigged.glb"
    # A paid Meshy task whose result never arrived (a dropped connection) is picked up again, not paid
    # twice: unless its step is redone, or an image it was made from is newer than the task.
    started = tasks_file.stat().st_mtime if tasks_file.exists() else 0
    current = all(path.exists() and path.stat().st_mtime <= started for path in [toy, *sides])
    fresh = set()
    if pending("model", model):
        client = meshy or providers.meshy()
        if tasks.get("model") and "model" not in redo and current:
            log(f"  Meshy: picking up task {tasks['model']}")
        else:
            log("  Meshy: toy.png, " + ", ".join(side.name for side in sides))
            options = {**MESHY_OPTIONS, **({} if person or animal or held else {"texture_prompt": MONSTER_TEXTURE}), **(PERSON_OPTIONS if rigged_kind else {})}
            tasks["model"] = client.start_views([data_uri(toy), *map(data_uri, sides)], **options)
            tasks.pop("rig", None)
            fresh.add("model")
            tasks_file.write_text(json.dumps(tasks, indent=1))
        model.write_bytes(client.download(client.wait(tasks["model"], log, kind="multi-image-to-3d")["model_urls"]["glb"]))
    clips = [out / f"{clip}.glb" for clip in CLIPS] if figure.kind == "monster" else []
    if rigged_kind and pending("rig", rigged, *clips):
        client = meshy or providers.meshy()
        rigged.with_suffix(".face.json").unlink(missing_ok=True)  # A new model has its face somewhere else.
        if tasks.get("rig") and "rig" not in redo and "model" not in fresh:
            log(f"  Meshy: picking up rig {tasks['rig']}")
        else:
            tasks["rig"] = client.start_rig(tasks["model"], figure.height)
            fresh.add("rig")
            tasks_file.write_text(json.dumps(tasks, indent=1))
        result = client.wait(tasks["rig"], log, kind="rigging")["result"]
        rigged.write_bytes(client.download(result["rigged_character_glb_url"]))
        animations = result.get("basic_animations") or {}
        for clip, path in zip(CLIPS, clips):
            path.write_bytes(client.download(animations.get(f"{clip}_armature_glb_url") or animations[f"{clip}_glb_url"]))

    actions = out / "actions.glb"
    if figure.kind == "monster" and figure.animations and pending("anim", actions):
        client = meshy or providers.meshy()
        if tasks.get("anim") and "anim" not in redo and not fresh and tasks.get("anim_of") == figure.animations:
            log(f"  Meshy: picking up animations {tasks['anim']}")
        else:
            log(f"  Meshy: animations {figure.animations} ({3 * len(figure.animations)} credits)")
            tasks["anim"], tasks["anim_of"] = client.start_animations(tasks["rig"], figure.animations), figure.animations
            tasks_file.write_text(json.dumps(tasks, indent=1))
        actions.write_bytes(client.download(client.wait(tasks["anim"], log, kind="animations")["result"]["animation_glb_url"]))

    folder = "characters" if person else "monsters" if rigged_kind else "animals" if animal else "held" if held else "creatures"
    target = root / "public" / "models" / folder / f"{args.id}.glb"
    described = root / "src" / folder / f"{args.id}.json"
    if pending("game", target, described):
        if person:
            glb, spec = character_rig.convert(rigged, args.id, figure.name, figure.scale, figure.clean_shaven)
            if figure.backpack: spec["backpack"] = figure.backpack
            if figure.carries: spec["carries"] = figure.carries
        elif rigged_kind:
            # Meshy's own skeleton for now, and its clips beside it: the game's rig for foes is still to come.
            moves = ([*CLIPS, "actions"] if actions.exists() and figure.animations else [*CLIPS])
            glb, spec = rigged.read_bytes(), {"id": args.id, "name": figure.name, "glb": f"models/monsters/{args.id}.glb",
                                              "clips": {clip: f"models/monsters/{args.id}-{clip}.glb" for clip in moves}, "height": figure.height}
            target.parent.mkdir(parents=True, exist_ok=True)
            for clip, path in zip(moves, [*clips, actions]):
                (target.parent / f"{args.id}-{clip}.glb").write_bytes(path.read_bytes())
        elif animal:
            glb, spec = animal_rig.convert(model, args.id, figure.name, figure.height / figure.scale)
        elif held:
            glb, spec = character_rig.convert_held(model, args.id, figure.name, figure.height / figure.scale)
        else:
            glb, spec = character_rig.convert_creature(model, args.id, figure.name, figure.height, figure.wings)
        target.parent.mkdir(parents=True, exist_ok=True)
        described.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(glb)
        described.write_text(character_model.dump(spec) if person else json.dumps(spec, ensure_ascii=False, indent=2) + "\n")
        log(f"  {target.relative_to(root)} ({len(glb) / 1e6:.1f} MB), {described.relative_to(root)}")
    return out


if __name__ == "__main__":
    run()
