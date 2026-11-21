# Relevo: figuras de Gerard pequeño, Bernat, Mamá y Jan

Aitor (el usuario) ha pedido seguir aquí esta conversación. Háblale en español. Si te falta contexto, la
conversación entera está en
`/Users/aitoriraolagalarza/.claude-aitor/projects/-Users-aitoriraolagalarza-dev-personal-gerard-35/d944552e-ddb3-4777-a59c-3cd68c3dc6bb.jsonl`.

**Lee primero `.claude/skills/character-3d/SKILL.md` y síguela.** Es la skill nueva de este proceso (imagen de
juguete + Meshy) y puede que no te salga en la lista si tu sesión ya estaba abierta. Lee también
`tools/README.md` § Figuras en 3D y `tools/figures.toml`.

## Lo que ha pedido, literal

> [foto] este es el hermano
> La madre no se parece mucho pero ok, generalos en 3D
> Pero pasa esta conversacion a otro agente de cl-Amphos [...] y hazlo desde ahí

Antes había pedido: «si porfa, rehaz y haz a Bernat y Mama con este estilo tambien, y tambien a Gerard el pequeño».

## Estado de cada figura (actualizado)

| Figura | Estado |
| --- | --- |
| `gerard-child` | Modelo en el juego, cara bien (la boca se corrigió), mochila verde colgada del modelo (`backpack`) |
| `bernat-child` | Modelo en el juego, cara bien (detección de ojos y boca pintados, MediaPipe no la veía), mochila roja |
| `mama` | Modelo en el juego, cara bien |
| `jan-child` | `toy.png` nueva hecha y enseñada; **falta el sí de Aitor**. Después: `just character-3d jan-child --from views`, mirar `rigged.face.png`, y retratos con `just character-3d jan-child --from portrait` (sustituye el render de `public/portraits/jan-child.png`) |

Retratos: **no** `just portraits` ni retratos del modelo: salen de `toy.png` (`--from portrait`); las expresiones esperan a que Aitor apruebe los retratos.

## Qué hacer, en orden

1. **Jan:** `just character-3d jan-child --from toy --to toy`, añade la imagen a la barra lateral y enséñasela. La
   skill no deja pagar el modelo de una imagen que no ha visto. Pídele un sí de una línea, sin parar por ello lo demás.
2. **3D de los tres aprobados**, en segundo plano: `just character-3d gerard-child --from views`, igual con
   `bernat-child` y `mama`. Son unos 35 créditos de Meshy cada uno (quedan 1360) y tres imágenes de OpenAI. OpenAI ya
   tiene saldo. Las claves están en `.env`, que carga `just`: nunca lo leas ni lo imprimas. Necesita red, fuera del sandbox.
3. Mira `output/characters/3d/<id>/rigged.face.png` de cada uno: las cajas rojas deben caer sobre ojos y boca.
4. **Conectar al juego.** `just character-3d` reescribe `src/characters/<id>.json` y deja el GLB en
   `public/models/characters/`. Después hay que resolver esto, que no hice todavía:
   - **Mochila:** `BACKPACK_PARTS` en `src/game.ts:97` busca piezas por nombre (`Mochila`, `Bolsillo de mochila`,
     `Correa frontal`, `Correa de hombro`, `Hebilla de mochila`) y las enciende según `got-backpack`. En los GLB ya no
     existen. Hay que volver a colgarlas del cuerpo, para Gerard pequeño y para Bernat. Las medidas de los bloques
     están en `git show HEAD:src/characters/gerard-child.json`, y `fit` del JSON dice dónde está la espalda. Debe seguir
     pareciendo una mochila sobre una figura redondeada.
   - **Camiseta de Bernat:** `src/battle-scene.ts:1494` cambia el material llamado `Camiseta mostaza` por `allyJacket`.
     Con textura no funciona así. Mira qué pretendía y resuélvelo sin perder la textura.
   - **Ejemplo de `just character`:** `tools/character.py:254` y `tests/test_character_tool.py` usan
     `gerard-child.json` como ejemplo de personaje de primitivas. Dejará de serlo: cámbialo por `uri.json`, que sigue
     siendo de primitivas.
   - **Retratos:** de la imagen generada, nunca del modelo: `just character-3d <id> --from portrait` (Aitor rechazó los sacados del modelo). Sigue añadiendo `portrait` en `SPEAKERS` a `bernat`, `mama` y `jan`, y a `bernat` en `PORTRAITS`.
   - **Escalas:** Mamá 1.3 y Jan 1.12 ya coinciden con `src/story.ts`; Bernat y Gerard pequeño usan 1.
5. **Comprobar en el juego** (skill § 5), con `--gpu`: `just screenshots chapter-1 --gpu`, `just screenshots animas --gpu`
   y un escenario nuevo si hace falta para verlos de cerca, andando y en combate. El niño también lleva ánimas: mira el
   tinte, las orejas, el collar y la mochila. Comprueba los ojos cerrados y el habla.
6. `just check` (hoy pasa todo: tipado, 561 tests de JS, unittest de Python).

## Reglas que no hay que olvidar

- **Enseña cada iteración en la barra lateral** con `herdr-assets add <archivo> --group Screenshots --title … --note …`,
  sin abrir nada en el navegador, y haz `open` de la carpeta en Finder. Aitor pidió ver cómo va, no solo el final.
- **Nunca envíes una foto de un niño real.** Gerard pequeño sale solo de palabras y de la figura adulta. Bernat, Jan y
  Mamá, de sus fotos de adulto. Nada de terceras personas en una foto; la foto `aitor-04` no se envía nunca.
- **No hagas commit ni push sin que lo pida.** `main` tiene mucho sin subir de varias sesiones, incluida la tuya.
  Formato de commit, cuando lo pida: `feat: …`. Sin nombres de IA en ramas ni commits.
- Las figuras son juguete mate de colores planos: Aitor rechazó lo realista y lo esculpido a mano. No es un juego de
  niños: el juguete es el material, no el tono.
- Rendimiento: Aitor juega a 120 Hz; cada figura son unos 12 000 triángulos y 3 materiales.

## Lo que ya está hecho y sin commit, para no tocarlo sin querer

Gerard adulto y Aitor en GLB, `src/face.ts` (párpados y boca), `src/character-model.ts`, `tools/character_3d.py`,
`tools/character_rig.py`, `tools/figures.toml`, `scripts/portraits/`, retratos nuevos en el HUD, y las skills
`character-3d` y `side-quest`.

Limitación que ya conoce: las rayitas finas de la textura de Meshy siguen, solo se ven muy de cerca. Se probó a
tapar los bordes de sus piezas y con más de 1 píxel la textura se rompe (`GUTTER_EDGE`).

Al acabar, borra este archivo.
