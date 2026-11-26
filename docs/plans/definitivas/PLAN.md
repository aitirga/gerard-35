# Plan: definitivas, pasivas nuevas y Resonancia

Escrito el 2026-11-26 para retomarlo en otra sesión. Todo está **aprobado por Aitor** (decisiones del
2026-11-25, abajo). No hay nada construido todavía.

**Base:** la rama `feature/matemagico-expansion`, con las siete piezas nuevas ya hechas: Serie de Fourier,
Atractor extraño, Superficie mínima, Electrólisis, Campana de Gauss, Corriente alterna y Arco voltaico.
Mientras la expansión no esté en main, este trabajo sale de esa rama, porque toca los mismos caminos
(`src/battle.ts`, `src/battle-sim.ts`).

**Documentos de detalle**, en esta misma carpeta:
- `propuesta-pasivas-y-definitivas.md`: el estudio completo. Trae el estado de cada definitiva, lo que le
  falta, su plan plano a plano y los TARGETS propuestos. **Ojo:** ahí aún aparecen Acarreo y Al quite como
  propuestas y Q.E.D. como diseño. Las tres quedan anuladas por las decisiones de abajo.
- `opciones-definitiva-matemagico.md`: las tres alternativas a Q.E.D. Aitor eligió la § 1, **Horas extra**.

---

## Decisiones de Aitor (2026-11-25)

### Pasivas
- **Rescoldo se queda tal cual** («ya me gusta, gestiónalo bien»).
  - No se sustituye y Combustión sigue colgando de donde cuelga.
  - Solo hay que asegurarse de que funciona bien con lo nuevo: Horas extra le da un trabajo claro, porque sus 15 s permiten tener a todos los enemigos en III a la vez. También que fight-sim la cubre (`coverage`).
- **Objeto encontrado:** sí. Va en el nivel 6 de Dadista.
- **Sugestión:** sí. Es la primera pasiva de la línea Mente de Tecnópata.
- **Al quite:** no.
- **Acarreo:** aparcada.
- **Plagio:** aparcada. Era la alternativa a Objeto encontrado: el dado en blanco copiaba la acción del compañero.
- **Resonancia:** sí, construirla como estaba diseñada. Va en el hueco de grado III eléctrico. Kirchhoff queda fuera.
- **Borrar la línea del tarro que dice la condición de las definitivas.** Está en los docs y no está construida: se quita la mención y no se construye. Es por sorpresa: en combate ya se ve el avance con el icono dormido, n/N, y el aviso «Definitiva · despierta».

### Definitivas
- **Todos los aspectos propios aprobados:**
  - Physarum para Enjambre;
  - nucleación para Bajo cero;
  - rebobinado del campo para Da capo;
  - rebobinado y siluetas para Siete vidas;
  - explosión de polvo para Fin de fiesta;
  - collage para Un golpe de dados;
  - cronofotografía de neón para Horas extra.
- **Matemágico: Horas extra**, que sustituye a Q.E.D. Las dos versiones de Q.E.D. quedan rechazadas: no reproponer nada que cuente reacciones ni que reparta elementos.
  - **Despierta** cuando todos los enemigos en pie están a la vez en Quemado III o más, mientras alguien en pie lleva Matemágico.
    - Contra un jefe con partes, solo cuenta el cuerpo.
    - La fila dormida enseña n/N.
  - **Qué hace:** quien la usa actúa tres veces seguidas sin maná.
    - No vale un dúo ni una definitiva como acción.
    - Puede cambiar de ánima entre acciones.
  - **Después:** queda **Agotado 1 ronda**. Solo puede Atacar, con su elemento, o Defender, y Defender no le devuelve maná. Tiene un icono continuo: un lápiz gastado hasta la goma.
  - **Libro:** `HORAS_EXTRA = { actions: 3, spent: 1 }`.
  - **Descripción** (`abstract: true`): «Quien la usa actúa tres veces seguidas sin gastar maná. Después queda agotado: durante una ronda solo puede atacar o defender.»
  - **Aspecto:**
    - el anillo se funde en una banda de oro;
    - en cada acción, una copia congelada de Gerard en nube de puntos de oro (`surface-samples`);
    - al final, las tres copias pasan a ceniza y caen en dígitos;
    - el anillo se queda a sus pies y se rehace durante el Agotado.
- **Un golpe de dados (Dadista):**
  - **Despertar:** el ×2 de Ases en dúo cuenta para despertarla, y sigue despierta aunque se gaste la Racha.
  - **Aspecto:** cada dado cae con la estrella del Comodín. En las tiras del collage, fragmentos en español del poema de Mallarmé.
- **Mano hasta 6:** solo para Un golpe de dados y Objeto encontrado. No es regla general: el resto de fuentes de dados sigue parando en el tope normal, y Defender o el descanso nunca quitan los dados de más.
- **Da capo (Sincopante):**
  - devuelve también los dúos mayores;
  - un dúo que sigue sonando se puede relanzar y **refresca** reloj y fuerza: nunca hay dos iguales a la vez;
  - la mano de dados vuelve a la mano inicial del combate, no a seis.
- **Bajo cero (Freática):**
  - un enemigo solo Mojado **no** se congela: solo las celdas con agua;
  - cada golpe de Serie de Fourier cuenta como una grieta.
- **Enjambre (Tecnópata):**
  - Bip queda deshecho solo durante el lanzamiento, unos 3 s, sin coste;
  - reinicia **solo** los relojes de los enemigos.
- **Siete vidas / multigolpe:** un dúo multigolpe (los dados de Campana, los latidos de Alterna) gasta la herida de Sangrado solo con su primer golpe en cada enemigo, como Cacería.
- **Probador, «Sin límites»:** deja relanzar la definitiva sin límite.
- **Preguntas menores:** usar las recomendaciones del documento de propuesta, incluidos los combates de sujeción propuestos:
  - Gemelos de tercero para Fin de fiesta, Enjambre y Un golpe de dados;
  - Delegada para Da capo y Bajo cero;
  - la Reina para Siete vidas.

---

## Estado de partida (auditoría del 2026-11-25)

Ninguna definitiva está acabada según AGENTS.md: ninguna tiene su pareja de TARGETS.

| Definitiva | Ánima | Estado | Lo que falta | Esfuerzo |
|---|---|---|---|---|
| Fin de fiesta | Colorista | Jugable | TARGETS; el bot no valora Envenenado ni Cristalizado; el tiempo frente a los pinchos de Cristalizado; docs viejos; aspecto propio | S (M con aspecto) |
| Siete vidas | Papagato | Jugable | El bot nunca la lanza; TARGETS; aparece en `coverage`; aspecto propio | S (M) |
| Enjambre | Tecnópata | A medias | Aspecto (Bip no se deshace); probable «−0» sobre cada enemigo; TARGETS, capturas, ítem; `BUILDS.mixto` no la compra | M |
| Da capo | Sincopante | A medias | TARGETS; la mitad del aspecto; las reglas de arriba; docs | M |
| Bajo cero | Freática | A medias | Ningún objetivo rompe el hielo (el bot no valora la grieta); el aspecto se queda pequeño; sonido; docs | M |
| Horas extra | Matemágico | Nueva | Todo | M |
| Un golpe de dados | Dadista | Solo diseñada | Todo, más la mano hasta 6 | L |

---

## Orden de trabajo

Cada paso va en su propia rama o worktree; nunca se edita el checkout principal, porque otros agentes trabajan ahí. Después de cada cambio de reglas, `just fight-sim check` antes y después.

### 1. Lo común
- **El bot (`src/battle-sim.ts`) aprende a valorar lo que pagan las definitivas:**
  - `POISON_WORTH` y `SHARD_WORTH`, genéricos por estado;
  - la custodia de Siete vidas: `LIVES_WORTH` × los aliados que el siguiente golpe tumbaría, con un `LIVES_IDLE` pequeño;
  - la grieta del hielo: `ICE_CRACK_WORTH`;
  - la mano hasta 6;
  - `wakeWorth` para preparar cada condición;
  - `BUILDS.mixto` compra las siete definitivas.
- **Un gancho único `reacted(state, actor, effect)`** que sustituye a cada `ground()`: hoy son cuatro llamadas, más dos sitios de Vapor que no pasan por él. Lo usan Toma de tierra, Objeto encontrado y la expansión (`ignite`, `electricBeat`, `gather`).
- **Borrar de los docs** la línea del tarro que dice la condición:
  - `docs/animas/README.md` § The one that is built: «Not built: the line at the jar…»;
  - § Definitivas: «The jar says the condition…».
- **Docs viejos:**
  - `docs/animas/README.md`: «Fin de fiesta today», las filas de Bajo cero y Da capo, y la fila de Q.E.D., que pasa a Horas extra;
  - `docs/progress.toml`: «hoy Fin de fiesta» y el ítem de Freática;
  - `docs/fight-sim.md` § Coverage.
- **progress.toml:** un ítem «Las definitivas en fight-sim» que marque cuando existan las siete parejas.

### 2. Las cinco jugables: reglas decididas, TARGETS y aspecto propio

De la más barata a la más cara. Planes plano a plano en `propuesta-pasivas-y-definitivas.md` § Plan de cada una.
1. **Fin de fiesta**
   - Toda reacción del polvo cuenta para despertarla, también las llegadas de Atractor y los latidos de Alterna (`powderTurned`).
   - El tiempo frente a `src/shard-spikes.ts`.
   - Aspecto: la explosión de polvo, con el helper `deflagrate()` que comparte con el gas de Electrólisis.
   - TARGETS: `fiesta-gemelos` frente a `fiesta-gemelos-sin-ella`, en alumnos-3c.
2. **Siete vidas**
   - El multigolpe gasta la herida solo con el primer golpe en cada enemigo.
   - Valor del bot.
   - Aspecto: rebobinado de partículas (una banda `rewind` en `fight-particles`) y las siluetas de Yuki.
   - TARGETS: `reina-con-siete-vidas` frente a `reina-sin-custodia`.
   - Docs: «as a dual» pasa a «una habilidad de quien la lleva».
3. **Bajo cero**
   - Solo Mojado no congela; Fourier cuenta una grieta por golpe; `ICE_CRACK_WORTH`.
   - Aspecto: la nucleación, con un phase field de Kobayashi en la GPU (`src/frost-fx.ts`), más el lanzamiento de la sonda.
   - Cuatro sonidos de hielo.
   - TARGETS: `delegada-bajo-cero-bien` frente a `delegada-bajo-cero-sin-ella`, y de guarda `reina-con-bajo-cero`.
4. **Enjambre**
   - Arreglar el «−0».
   - Reinicia solo los relojes de los enemigos.
   - Bip deshecho solo durante el lanzamiento.
   - El merge de bombas de Atractor usa `age = (min(top, p1+p2) − base) / perSecond`.
   - Aspecto: Physarum en compute WGSL (`src/physarum.ts`, `src/swarm-fx.ts`); la red se queda latiendo hasta que estallan las bombas.
   - TARGETS: `gemelos-tercero-enjambre` frente a `-sin-enjambre`.
5. **Da capo**
   - Reglas de arriba: los dúos mayores sí, relanzar refresca, la mano inicial.
   - Valor del tercer eco en `ecoWorth`.
   - Aspecto: el rebobinado del campo, el fluido de nácar y el pentagrama con la retícula `string` de Alterna.
   - TARGETS: `delegada-da-capo` frente a `delegada-sin-da-capo`.

### 3. Pasivas y Resonancia
- **Sugestión** (Tecnópata, línea Mente: 1 eco tras Control remoto, etapa 1)
  - **Regla:** un enemigo confundido (Confusión o Trampantojo), y cada latido de Idea fija, golpea al último enemigo al que apuntó en solitario la acción de un aliado (`state.aimed`).
  - Si no hay apuntado, o ha caído, el golpe va al azar.
  - Tiene icono de apuntado en la placa.
  - Detalle en la propuesta § 3.
- **Resonancia** (Matemágico, grado III eléctrico, 2 ecos, 2 maná, 38 eléctrico)
  - Descripción: «Daño mágico eléctrico alto a un enemigo. Si está congelado, rompe el hielo de golpe.»
  - Va con Congelado, que ya existe por Bajo cero.
  - Diseño en `docs/animas/matemagico/README.md` § Grade III.
  - Necesita su figura en el círculo, su TARGETS y su ítem.

### 4. La mano hasta 6, después Objeto encontrado, después Un golpe de dados
- **Mano hasta 6:** `HAND.most = 6`, solo para las dos fuentes. Ni Defender ni el descanso restan; Estrella fugaz, Da capo e `improve` no recortan. Tests en `dice.test.mjs`.
- **Objeto encontrado** (nivel 6 de Dadista; quitar `dadaista: [6]` de `EMPTY_LEVELS` en `src/levels.ts`)
  - «Pasiva. Si la mano está llena y un enemigo reacciona, quien la lleva recibe un dado de más, una vez por ronda. La mano puede llegar así hasta seis.»
  - Usa el gancho `reacted()`.
  - Libro: `FOUND = { level: 6, perRound: 1, top: 6 }`.
- **Un golpe de dados**
  - Despierta al 100 % de Crítico, con el ×2 de Ases incluido, y sigue despierta.
  - Un dado de luz por enemigo: 40 de daño mágico no elemental, crítico seguro, con la estrella del Comodín.
  - No gasta la Racha y llena la mano hasta 6.
  - Descripción: «Daño mágico no elemental alto a todos los enemigos. Golpe crítico seguro. Llena la mano hasta seis dados.»
  - Aspecto: el collage, con un pase `collage` en `src/post.ts`, tiras con fragmentos del poema de Mallarmé y dados de retícula `box`.
  - TARGETS: `gemelos-tercero-golpe-de-dados` frente a `-sin-definitiva`.
  - Cambiar `tests/crecimiento.test.mjs:32`, porque hoy usa `matemagico:definitiva` como la que sigue dormida.

### 5. Horas extra (Matemágico)
- **Infraestructura de «actuar otra vez»:** `state.extra = { id, left, free }`. Agitar ya conserva el turno, y es el precedente.
- **Agotado:** `skillsFor` deja solo Atacar y Defender, y `DEFEND_CHARGE` vale 0 mientras dura.
- **Despertar:** en `inflict` de Quemado; el cuerpo del jefe cuenta y sus partes no.
- **Casos** en `ultiReady`, `ultiUsed` y `ultiProgress` (n/N).
- **Bot:** que valore tres acciones frente a una ronda sin habilidades.
- **TARGETS:** una pareja en un grupo de tres del tercer piso.
- **Aspecto:** la cronofotografía de neón.

### 6. Al cerrar
- Una pasada de los aspectos con `just perf`: Aitor juega a 120 Hz, así que el frame de CPU no puede pasar de 8,3 ms.
- Un escenario de capturas por pieza (`just screenshots <x> --gpu`), añadido al sidebar de herdr.
- `just progress --audit`, `npm test` y `just fight-sim check` (`coverage` sin ninguna de ellas).
- **Docs:** cada README de ánima, `docs/animas/README.md` (§ Definitivas y § Passives) y `docs/graphics.md` con las técnicas nuevas.

---

## Lo que ya hay hecho (feature/matemagico-expansion)

Resumen en herdr («Expansión de Matemágico: resumen»).
- **Motor nuevo:**
  - leyes de partícula (Lorenz, Galton);
  - volumen espejo paraboloide;
  - ignición y flotación;
  - retículas `catenoid` (película) y `string` (cuerda), con el máximo de retículas en 8;
  - `DuoStage.figure()` / `draw()`;
  - síntesis aditiva.
- **Se puede reutilizar aquí:**
  - la ignición, para la explosión de polvo de Fin de fiesta;
  - `string`, para el pentagrama de Da capo;
  - las nubes de puntos de `surface-samples`, para las copias de Horas extra y las siluetas de Siete vidas.
- **Abierto de la expansión:**
  - Atractor extraño y Electrólisis no deciden ningún combate en el simulador: el bot solo mira dos jugadas por delante.
  - `npm test` sigue sin salir verde por tres objetivos que ya fallaban en main: `cebollon-nivel-2`, `plato-sin-duales` y `directo-con-tecnopata`.
