"""Claude designs a character as primitives in the game's format (src/character-model.ts).

Claude sees the full-body reference, the portrait, the notes and an existing character
file as the example; the tool validates the answer and sends any problems back for a fix.
"""
import json
import re
from pathlib import Path

import providers

SHAPES = {"box", "sphere", "cylinder", "cone", "ring"}
ATTACH = {"body", "head", "arm", "leg"}
PART_KEYS = {"name", "shape", "material", "attach", "position", "scale", "rotation", "mirror", "thickness"}
REPAIRS = 2
GROUND = 0.02  # Where the soles should end, in body coordinates (the example's shoes).

SYSTEM = """You build the 3D characters of "Gerard 35", a cozy birthday adventure game rendered with PlayCanvas \
under an orthographic isometric camera. A character is a JSON file of primitives that the game assembles, rigs and \
animates. You receive reference images and an example file; reply with the new character's JSON only, no prose.

Format:
{
  "id": string, "name": string (display name, Spanish),
  "materials": {"<key>": {"name": string (Spanish), "color": "#rrggbb", "gloss"?: 0-100 (default 20)}},
  "rig": {"head": [x,y,z] neck pivot, "headScale": [x,y,z], "arm": [x,y,z] shoulder pivot, "leg": [x,y,z] hip pivot},
  "parts": [{"name": string (Spanish), "shape": "box"|"sphere"|"cylinder"|"cone"|"ring", "material": "<key>",
             "attach": "body"|"head"|"arm"|"leg", "position": [x,y,z], "scale": [x,y,z],
             "rotation"?: [x,y,z] Euler degrees, "mirror"?: boolean, "thickness"?: number}]
}

Coordinates: y is up, +z is the character's front (the face looks toward +z), x is sideways. Units match the example; \
the soles of the shoes sit at y = 0.02 in body coordinates. Shapes are unit primitives and scale is the full size: \
box edges, sphere diameters, cylinder and cone diameter (x, z) and height (y). A "ring" is an open outline in the \
x-y plane facing +z (glasses rims, hoops): scale is [x radius, y radius, depth] and thickness is the line width.

Attachment and animation:
- "body" parts are relative to the body origin; the body breathes and leans.
- "head" parts are relative to rig.head and scaled by rig.headScale; the head nods and glances.
- "arm" and "leg" parts are relative to rig.arm and rig.leg, which are given for the +x side; the game builds both \
sides by mirroring. Limbs swing around their pivot while walking, so they hang downwards (negative y).
- "mirror": true copies a body or head part to -x (ears, eyes, straps); give the +x copy.
- Required names: the eyes are head parts named "Ojo" (they blink by scaling y) and each leg's shoe is a leg part \
named "Zapatilla" (it keeps the foot on the ground). Use other descriptive Spanish names freely.

Style: chunky, friendly, low-poly proportions in the spirit of the example, with clear silhouettes and the outfit's \
main colours. Players see the character small and from above, so favour a few readable shapes and colour blocks \
(roughly 25-80 parts) over tiny details; anything thinner than 0.01 disappears. Adults are taller than the child \
example (about 1.7-1.8 to the top of the head instead of 1.4) with smaller heads relative to their bodies."""


def vec3(value) -> bool:
    return isinstance(value, list) and len(value) == 3 and all(
        isinstance(n, (int, float)) and not isinstance(n, bool) for n in value)


def validate(spec) -> list[str]:
    if not isinstance(spec, dict):
        return ["The top level must be a JSON object."]
    errors = [f"Missing top-level key {key!r}." for key in ("id", "name", "materials", "rig", "parts") if key not in spec]
    materials = spec.get("materials")
    if not isinstance(materials, dict) or not materials:
        errors.append("materials must be a non-empty object.")
        materials = {}
    for key, m in materials.items():
        if not (isinstance(m, dict) and isinstance(m.get("name"), str)
                and re.fullmatch(r"#[0-9a-fA-F]{6}", str(m.get("color")))
                and set(m) <= {"name", "color", "gloss"}
                and isinstance(m.get("gloss", 0), (int, float)) and 0 <= m.get("gloss", 0) <= 100):
            errors.append(f"Material {key!r} needs a name, a #rrggbb color and an optional gloss 0-100.")
    rig = spec.get("rig")
    if not (isinstance(rig, dict) and all(vec3(rig.get(k)) for k in ("head", "headScale", "arm", "leg"))):
        errors.append("rig needs head, headScale, arm and leg as [x, y, z].")
        rig = None
    parts = spec.get("parts")
    if not isinstance(parts, list) or not parts:
        return errors + ["parts must be a non-empty list."]
    for i, part in enumerate(parts):
        label = f"Part {i} ({part.get('name', '?')})" if isinstance(part, dict) else f"Part {i}"
        if not isinstance(part, dict):
            errors.append(f"{label} must be an object.")
            continue
        if extra := set(part) - PART_KEYS:
            errors.append(f"{label} has unknown keys {sorted(extra)}.")
        if not isinstance(part.get("name"), str):
            errors.append(f"{label} needs a name.")
        if part.get("shape") not in SHAPES:
            errors.append(f"{label} shape must be one of {sorted(SHAPES)}.")
        if part.get("material") not in materials:
            errors.append(f"{label} uses an undefined material {part.get('material')!r}.")
        if part.get("attach") not in ATTACH:
            errors.append(f"{label} attach must be one of {sorted(ATTACH)}.")
        if not vec3(part.get("position")):
            errors.append(f"{label} position must be [x, y, z].")
        if not (vec3(part.get("scale")) and all(n > 0 for n in part["scale"])):
            errors.append(f"{label} scale must be three positive numbers.")
        if "rotation" in part and not vec3(part["rotation"]):
            errors.append(f"{label} rotation must be [x, y, z] degrees.")
    named = lambda attach, name: [p for p in parts if isinstance(p, dict) and p.get("attach") == attach and p.get("name") == name]
    if not named("head", "Ojo"):
        errors.append('The eyes must be head parts named "Ojo".')
    feet = named("leg", "Zapatilla")
    if not feet:
        errors.append('Each leg needs a shoe: a leg part named "Zapatilla".')
    elif rig and not errors:
        sole = min(rig["leg"][1] + f["position"][1] - f["scale"][1] / 2 for f in feet)
        if abs(sole - GROUND) > 0.05:
            errors.append(f"The soles end at y = {sole:.3f} in body coordinates; move the legs or shoes so they end "
                          f"at {GROUND} (rig.leg y + Zapatilla y - Zapatilla height / 2).")
    return errors


def parse(text: str):
    """The JSON object in Claude's answer, tolerating a code fence around it."""
    start, end = text.find("{"), text.rfind("}")
    try:
        return json.loads(text[start:end + 1]) if start >= 0 else None, None
    except json.JSONDecodeError as error:
        return None, f"The answer is not valid JSON: {error}."


def dump(spec: dict) -> str:
    """Pretty JSON with one material or part per line, like the hand-written files."""
    line = lambda value: json.dumps(value, ensure_ascii=False)
    materials = ",\n".join(f"    {line(k)}: {line(v)}" for k, v in spec["materials"].items())
    parts = ",\n".join(f"    {line(p)}" for p in spec["parts"])
    return (f'{{\n  "id": {line(spec["id"])},\n  "name": {line(spec["name"])},\n'
            f'  "materials": {{\n{materials}\n  }},\n  "rig": {line(spec["rig"])},\n  "parts": [\n{parts}\n  ]\n}}\n')


def request(name: str, who: str, notes: str, images: list[tuple[str, Path]], example: tuple[str, Path]) -> list:
    content = []
    for caption, path in images:
        content += [{"type": "text", "text": caption}, providers.image_block(path)]
    label, file = example
    content.append({"type": "text", "text": f"{label}:\n{file.read_text()}\n\n"
                                            f'Design {who}. Use "{name}" as the id.{notes}'})
    return [{"role": "user", "content": content}]


def design(claude, messages: list, name: str, log=print) -> dict:
    for attempt in range(REPAIRS + 1):
        blocks = claude.reply(SYSTEM, messages)
        spec, problem = parse("".join(b.text for b in blocks if b.type == "text"))
        errors = [problem] if problem else validate(spec)
        if not errors:
            spec["id"] = name
            return spec
        log(f"  attempt {attempt + 1}: {len(errors)} problems, asking Claude to fix them")
        # Append-only: the previous answer goes back unchanged, then the problems.
        messages += [{"role": "assistant", "content": blocks},
                     {"role": "user", "content": "The file has problems:\n- " + "\n- ".join(errors[:30])
                                                 + "\nReply with the whole corrected JSON only."}]
    raise SystemExit("Claude could not produce a valid character file:\n- " + "\n- ".join(errors[:30]))
