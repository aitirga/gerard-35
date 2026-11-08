# Herramientas

Scripts locales para producir assets e ideas durante el proyecto. Se ejecutan con
`just` (grupo **Tools**), nunca se despliegan (`.dockerignore` solo deja pasar el
juego y la API) y pueden usar APIs de IA de pago con las claves de `.env`.

| Comando | Qué hace | APIs |
| --- | --- | --- |
| `just character <id> …` | Retrato, expresiones para conversaciones, cuerpo entero y modelo 3D de un personaje | OpenAI Images, Claude (o Meshy) |
| `just dev-character <nombre>` | Abre el juego jugando con ese personaje | — |
| `just geo <zona>` | Descarga un lugar real (OpenStreetMap + referencias de Google Maps) y lo construye como escenario jugable; ver [docs/environment-styling.md](../docs/environment-styling.md) | OpenStreetMap, Google Maps (opcional) |
| `just texture-fetch …` · `just texture-photo …` · `just texture-panot …` · `just textures` | Materiales reales para los lugares: descarga texturas CC0 (Poly Haven, ambientCG), endereza fachadas de fotos propias o de Wikimedia Commons con licencia libre (CC0, CC BY, CC BY-SA), dibuja el panot de Barcelona y lista la biblioteca de `public/textures/` (créditos en el `texture.json` de cada una); ver [docs/environment-styling.md § Real materials](../docs/environment-styling.md#real-materials) | Poly Haven, ambientCG, Wikimedia Commons |
| `just music-loop <archivo>` · `just music-seam <archivo> <inicio> <fin>` | Encuentra dónde hace bucle una canción (tempo, primeras notas, uniones candidatas) y escribe la unión en `output/music/` para escucharla; ver [docs/audio.md](../docs/audio.md) | — (ffmpeg local) |

## `just character`

```
fotos de assets/references/characters/<id>/  ┐
arte previo de assets/characters/<id>/ y     ├─► portrait ─┬─► expressions (OpenAI)
  retratos de otros personajes (estilo)      │   (OpenAI)    └─► fullbody ─► model
--description "…"                            ┘                   (OpenAI)    (Claude)
```

1. **portrait**: retrato de cabeza y hombros, fondo transparente, estilo low-poly del juego.
   Es la cara neutra de las conversaciones.
2. **expressions**: el mismo retrato con otra expresión. OpenAI edita solo la cara del
   retrato aprobado, así que encuadre, ropa y estilo no cambian. Por defecto genera
   `sorprendido`, `riendo`, `triste`, `enfadado` y `pensativo` (también existe
   `preocupado`), y cualquier otra con `nombre=descripción`.
3. **fullbody**: el personaje entero de frente en A-pose, usando el retrato nuevo como
   primera referencia para que cara, ropa y colores coincidan.
4. **model**: Claude (`claude-opus-5-5`) diseña el personaje con primitivas, igual que se
   hizo a mano con Gerard: ve el cuerpo entero, el retrato, las notas y
   `src/characters/gerard-child.json` como ejemplo (o el archivo actual del personaje si
   ya existe, para mejorarlo). La herramienta valida el resultado (formato, materiales,
   ojos `Ojo`, zapatillas `Zapatilla` que tocan el suelo) y le devuelve los problemas para
   que los corrija, hasta dos veces. Con `--modeler meshy` genera en cambio un GLB
   texturizado con Meshy (el juego aún no carga GLB).

Cada paso usa el resultado del anterior de la misma ejecución o, si no se ejecutó, el
que ya está instalado. Así se puede revisar el retrato antes de seguir:

```bash
just character bernat --description 'Mejor amigo de Gerard, 9 años, sudadera roja' --only portrait
# revisar public/portraits/bernat.png y repetir con --force si no convence
just character bernat --only fullbody model
just dev-character bernat                         # jugar con él
just character gerard --variant child --only expressions --expressions preocupado 'guino=winking one eye with a cheeky grin'
just character bernat --only model --force        # otra versión, mejorando la actual
just character gerard --variant child --dry-run   # referencias, prompts y destinos, sin llamar a ninguna API
just character --help
```

Resultados instalados (`<name>` es `<id>` o `<id>-<variant>`):

| Archivo | Uso |
| --- | --- |
| `assets/characters/<id>/portrait[-variant]-transparent.png` | Fuente del retrato (local, ignorado por git) |
| `public/portraits/<name>.png` | Retrato que sirve el juego |
| `assets/characters/<id>/portrait[-variant]-<expresión>-transparent.png` | Fuente de cada expresión |
| `public/portraits/<name>-<expresión>.png` | Expresión que sirve el juego |
| `src/portraits.json` | Qué expresiones tiene cada retrato (lo actualiza la herramienta) |
| `assets/characters/<id>/fullbody[-variant].png` | Referencia de cuerpo entero para el 3D |
| `src/characters/<name>.json` | Modelo 3D del juego (Claude) |
| `public/models/characters/<name>.glb` | Modelo GLB (solo con `--modeler meshy`) |

Nunca sobrescribe un archivo instalado sin `--force`, y lo comprueba antes de llamar a
ninguna API. Cada ejecución queda en `output/characters/<name>/<fecha>/` (imágenes,
modelo y `meta.json` con prompts y referencias usadas).

Claves en `.env` (ver `.env.example`): `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` (o un
perfil de `ant auth login`); `MESHY_API_KEY` solo para `--modeler meshy`. Opcionales:
`OPENAI_IMAGE_MODEL` (por defecto `gpt-image-2.5-sunburst`) y `CLAUDE_MODEL` (por defecto
`claude-opus-5-5`). Las fotos deben ser PNG, JPEG o WebP; exporta los HEIC del iPhone a JPEG.

### Expresiones en las conversaciones

Cada línea de diálogo puede pedir una expresión; si ese retrato aún no la tiene, se usa el
retrato normal (y en desarrollo sale un aviso en la consola):

```ts
{ speaker: 'gerard', text: '¿¡Tres perros!?', expression: 'sorprendido' }
```

La misma línea cambia también la cara del personaje en el mundo y le mueve la boca mientras se
escribe. El sistema está en [src/face.ts](../src/face.ts) y sirve para cualquier personaje, con lo que
tenga: aplasta los ojos, estira la boca y mueve la cabeza. En un modelo hecho desde fotos los ojos están
pintados: baja sobre ellos un párpado de su piel, y un hueso estira la boca pintada. Así parpadea, duerme,
guiña y habla, pero no cambia de gesto del todo.

```ts
faceOf(model).show('sorprendido');   // hasta nuevo aviso
faceOf(model).show('dolor', .5);     // medio segundo y vuelve
faceOf(model).show();                // vuelve ya
faceOf(model).talk(true);            // la boca se mueve
faceOf(model).update(dt, { animate });  // cada fotograma, quien anime al modelo
```

Hay `neutro`, `contento`, `riendo`, `sorprendido`, `triste`, `enfadado`, `preocupado`, `pensativo`,
`decidido`, `dolor`, `dormido` y `guino`. Para añadir una, una fila más en `EXPRESSIONS`. Para verlas
todas: `just screenshots expresiones --gpu`.

La cara del que habla cambia en cada línea y la del que escucha se queda como estaba. El
hablante necesita `portrait: '<name>'` en `SPEAKERS` ([src/dialogue.ts](../src/dialogue.ts));
la herramienta avisa si falta.

### Formato de personaje

`src/characters/*.json` lo lee [src/character-model.ts](../src/character-model.ts), que
monta el personaje y su rig para las animaciones de andar, reposo y combate:

- `materials`: clave → `{name, color, gloss?}`.
- `rig`: pivotes de cuello (`head`, con `headScale`), hombro (`arm`) y cadera (`leg`),
  dados para el lado +x.
- `parts`: primitivas (`box`, `sphere`, `cylinder`, `cone` o `ring` para monturas) con
  `attach` `body`, `head`, `arm` o `leg`. Brazos y piernas se construyen en los dos lados;
  `mirror: true` duplica una pieza del cuerpo o la cabeza en −x. `scale` es el tamaño total.
- +z es el frente del personaje y las suelas acaban en y = 0,02.
- `fit` (opcional): dónde se visten las ánimas en este cuerpo (`collar`, `chest`, `back`), si no es
  donde lo tiene el reparto de primitivas.

### Figuras en 3D: `just character-3d`

Gerard a los 35 y Aitor son figuras hechas desde sus fotos, porque tienen que reconocerse, y así se hace
también a quien se invente y a los monstruos: el proceso entero lo lleva la skill `/character-3d`. Su archivo
trae `glb` (el modelo, bajo `public/`), y sus `parts` son cajas medidas que solo representan su cuerpo en
los tests. Lo hace [character_3d.py](character_3d.py), con una tabla por figura en
[figures.toml](figures.toml):

```sh
just character-3d aitor --dry-run             # qué haría y qué enviaría
just character-3d aitor --from toy --to toy   # otra imagen, para mirarla antes de pagar el modelo
just character-3d aitor --from views          # y de ahí al juego
just character-3d aitor                       # solo lo que falte
```

| Paso | De qué a qué | Con |
| --- | --- | --- |
| `front` | Fotos con ropa → cuerpo entero de frente, fiel a la persona. Solo si hay fotos | OpenAI |
| `toy` | Ese frente, dos fotos de la cara y una captura del juego (`assets/references/characters/game-style.png`) → la misma persona como figura de juguete del juego | OpenAI |
| `views` | `toy` → el mismo personaje de izquierda, derecha y espalda | OpenAI |
| `model` | `toy` y las tres vistas → GLB con textura, unos 30 créditos | Meshy |
| `rig` | El modelo → el mismo con esqueleto, unos 5 créditos. Solo personas: Meshy no riggea otra cosa | Meshy |
| `game` | Lo convierte al rig del juego ([character_rig.py](character_rig.py)) y escribe los dos archivos | local |
| `portrait` | `toy.png` → el retrato de conversaciones y menús, en `public/portraits/`. Solo personas | OpenAI |

Con `kind = "creature"` el resultado va a `public/models/creatures/` y `src/creatures/`, sin esqueleto:
una pieza con las partes de los miedos de Uri, para clonarla en un combate (`buildCreature`).

- **Privacidad:** a OpenAI solo van las fotos listadas en `figures.toml`; a Meshy, solo las imágenes
  estilizadas. Una foto que no deba salir de este ordenador no se lista. Las fotos no están en git.
- **Parecido y estilo:** se deciden en `toy`, y es barato. Aprueba esa imagen antes de pagar el modelo.
  Las formas grandes y los colores planos son lo que la integra con el reparto y el mundo; lo fotográfico,
  no. Por eso se le pide a Meshy poca malla (12 000 triángulos) y una textura de plástico mate.
- `character_rig.py` junta los 24 huesos de Meshy en los del juego y baja los brazos a una pose relajada.
  Separa la ropa en materiales para que las ánimas la tiñan, y suaviza las normales. Con MediaPipe
  encuentra ojos y boca en el modelo, en local (guarda lo que encuentra en `rigged.face.json` y una
  imagen para comprobarlo en `rigged.face.png`): la boca lleva un hueso, y los ojos un nodo donde el
  juego pone sus párpados (`lids`).
- `clean_shaven` en `figures.toml` borra de la textura un bigote con el que venía el modelo, sin pagar otro.
- **El modelo 3D es solo para el mundo del juego.** Los retratos de conversaciones, menús y combate salen de la
  imagen generada: el paso `portrait` los dibuja desde `toy.png`, y `just character-3d <id> --expressions` añade las
  expresiones que falten, una imagen cada una.
- A un niño real nunca se le envían fotos: se dibuja con palabras y `art` (imágenes del juego, como la figura
  de su yo adulto).
- La altura de las caderas va también en `hip` de [src/bed.ts](../src/bed.ts): un test comprueba que coincidan.

El juego usa `gerard-child.json` como protagonista; en desarrollo, `?character=<name>`
(o `just dev-character <name>`) carga otro. Un test de Python valida todos los archivos.

## Añadir una herramienta

- Un script por herramienta en `tools/<nombre>.py`, ejecutable con `uv run`.
- Clientes de API compartidos en [providers.py](providers.py): uno fino por proveedor y una
  fábrica que lee su clave de `.env`. Claude usa el SDK oficial `anthropic` (dependencia
  de desarrollo, fuera de la imagen de producción).
- Una receta en el grupo `Tools` del `justfile` con `[positional-arguments]` y `"$@"`.
- Historial en `output/<herramienta>/` y copia a su destino final sin pisar nada sin `--force`.
- Ofrecer `--dry-run` cuando la herramienta gaste créditos.
- Tests en `tests/test_<nombre>_tool.py` con proveedores falsos; `just test` los ejecuta.
