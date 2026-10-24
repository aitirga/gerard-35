# Matemágico

Status: playable · Comes from: Gerard himself, from the start

## Identity

- Gerard's everyday self: he calculates everything, even what doesn't need it.
- Motto: *"Lo calcula todo. Hasta lo que no hace falta."*
- Colour: gold `#f3cf78`.
- Look: his own clothes (no recolour); grown-up Gerard shows his thoughts when he wears it.
- Interface: the game's default gold interface.

## Stats

Magia +1, Espíritu +1.

## Signature: overthinking

Support through calculation: a party boost and a heal.

## Skills per level

| Level | Skill | Cost | Base | Description |
| --- | --- | --- | --- | --- |
| 1 | Análisis Parálisis | 10 | +3 boost | `Sube Fuerza y Magia de todo el equipo durante 3 rondas.` |
| 1 | Cardioide | 8 | 24 heal | `Cura media a un aliado herido.` |
| 2+ | _open_ | | | |

## Combined skills

| With | Idea |
| --- | --- |
| Papagato | Gerard calculates the angle, Haru lands it: a sure hit on the weakest spot |

## Implementation

Built: `matemagico` in `ClassId`, `CLASS_STATS`, `SKILLS` (`src/battle.ts`), `CLASSES`
(`src/classes.ts`), the default interface; Gerard's from the start.

To do: its level table once levels exist.

## Open

- What it learns at levels 2 and 3.
