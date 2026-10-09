# Herramientas

Scripts locales para producir assets e ideas durante el proyecto. Se ejecutan con
`just` (grupo **Tools**), nunca se despliegan (`.dockerignore` solo deja pasar el
juego y la API) y pueden usar APIs de IA de pago con las claves de `.env`.

| Comando | Qué hace | APIs |
| --- | --- | --- |
| `just character <id> …` | Retrato, expresiones para conversaciones, cuerpo entero y modelo 3D de un personaje | OpenAI Images, Claude (o Meshy) |
| `just dev-character <nombre>` | Abre el juego jugando con ese personaje | — |

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
