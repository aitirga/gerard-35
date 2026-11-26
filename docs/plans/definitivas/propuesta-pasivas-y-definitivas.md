# Pasivas nuevas y definitivas: propuesta y plan

*Documento para Aitor. Solo lectura: todo está leído en HEAD (bc653a7). Las siete piezas de feature/matemagico-expansion (Serie de Fourier, Atractor extraño, Superficie mínima, Electrólisis, Campana de Gauss, Corriente alterna y Arco voltaico) se dan por hechas. Sumatorio está cortado y Atractor cuesta 2 ecos.*

---

# Parte 1 · Pasivas nuevas

Propongo **cuatro**, una por ánima:

- **Acarreo** sustituye a Rescoldo en Matemágico.
- **Objeto encontrado** va en el nivel 6 de Dadista.
- **Sugestión** es la primera pasiva de la línea Mente de Tecnópata.
- **Al quite** es para Papagato, como opcional.

Cada una cambia una decisión, no suma un número. He recortado las reglas donde los jueces dijeron que no se leían.

Lo que ya hay en HEAD, para situarse:
- **Matemágico:** Rescoldo, Combustión, Capilaridad y Toma de tierra.
- **Tecnópata:** Telemetría, Nanitos y Redundancia.
- **Papagato:** Olor a sangre.
- **Colorista:** Remolino.
- **Dadista:** Otra vez.
- **Sincopante:** A contratiempo y Pedal.
- **Freática:** Nivel de base.

## 1. Acarreo (Matemágico)

**De dónde sale.** Es un nodo del tarro en la línea de Fuego, después de Pirámide ígnea (`factor-comun`). Cuesta 1 eco, etapa 1, y **sustituye a Rescoldo en su mismo hueco**: `passiveNode('matemagico','fuego','acarreo',1,'factor-comun',…)`. Combustión pasa a colgar de Acarreo (`after: 'acarreo'`). La línea de fuego sigue con dos pasivas y el árbol cuesta lo mismo.

Rescoldo («duran 15 s en vez de 10») es justo el «número pequeño que se suma» que el README de pasivas prohíbe desde el 2026-11-20. Si no se sustituye, no la propongo como pasiva hermana: Matemágico tendría demasiadas.

**Descripción:** «Pasiva. Si Matemágico sube el fuego de un enemigo que ya está en su nivel más alto, el nivel que sobra pasa al enemigo de al lado.»

**Regla exacta** (recortada respecto al candidato):
- **Cuándo salta:** un golpe de fuego de quien la lleva sube el Quemado de un enemigo que ya está en el tope del combate (`fireTop`: III, o IV con Combustión). Son Foc Binari, Atacar·Fuego y el fuego de más que suma Atractor extraño.
- **Qué pasa:** **un** nivel pasa al siguiente enemigo en pie de la fila (a la derecha; si no hay, a la izquierda; nunca a una parte). Es la misma regla de vecino que usan Campana de Gauss y Corriente alterna.
  - Si ese enemigo no tenía fuego, se prende a I.
  - Llega como fuego por el helper de llegadas sin daño de Atractor, así que sigue las reglas de siempre: sobre un mojado hace Vapor y sobre un empolvado hace Estallido.
- **Sin cascada:** si el vecino también está en el tope, el nivel se pierde. Así se quita la parte que los jueces veían ilegible, y elegir el extremo de la fila es una decisión de verdad.
- **El de origen conserva su nivel.** Alimentar el tope nunca es perder.
- **Qué nunca acarrea:** pulsos, latidos (Vulcano, Alterna), reacciones (Estallido, estallido de Combustión), Pirámide y el `kindle` de Campana. En la descripción basta con decir «sus golpes de fuego».
- **Libro:** `ACARREO = { levels: 1 }`.

**Qué decisión crea.** Hoy, un Foc Binari sobre un enemigo en III es solo un refresco, y la línea dice «enciende a otro». Con Acarreo, el enemigo lleno se convierte en bomba de fuego. Las preguntas pasan a ser:
- qué extremo de la fila alimentar;
- si el nivel que salta debe caer sobre el mojado (Vapor, que deja Cegado y prepara una Tormenta) o sobre el empolvado (Estallido);
- si Pirámide va antes (iguala la fila, y luego lo que salta ya no tiene dónde caer) o después.

Con Combustión, la pregunta es si se mantiene un IV como bomba para el golpe físico mientras se suben sus vecinos.

**Cómo suma con lo demás:**
- **Pirámide ígnea:** es lo contrario (iguala), así que el orden importa.
- **Combustión:** los vecinos suben a IV, y un golpe físico (garra, dado, carnero de Bip o Atacar) revienta en cadena.
- **Campana de Gauss:** deja el centro en III y los lados en II. Cada Foc Binari sobre el centro sube un lado a III, y la campana se convierte en una fila llena.
- **Atractor extraño:** lo que junta por encima del tope ya no se tira, pasa un nivel al vecino que acaba de vaciar.
- **Electrólisis:** lo que salta no es un golpe, así que **no prende el gas**. Lo prende el siguiente Foc Binari, y la ignición sigue teniendo un solo punto de entrada.
- **Serie de Fourier:** sin relación directa.
- **Histéresis** (aparcada) se apoyaba en Rescoldo. Si algún día vuelve, se reescribe.

**Cómo se lee en combate:**
- Sobre Gerard, «PASIVA · Acarreo» en oro, con el sonido `passive`, vía `note()`.
- Mensaje: «Me llevo una: el fuego salta a <enemigo>.»
- En la placa del vecino, el icono de Quemado cambia de número como en cualquier subida.
- No hay icono continuo, porque es un evento.

**Aspecto:**
- Sobre la llama del enemigo lleno sale un «1» dorado en la tipografía del anillo de unos y ceros de Gerard.
- El «1» hace un arco por encima de la fila con estela de neón (`trails.follow`) y cae en el pecho del vecino, que se aviva con el pop del número romano.
- Si el vecino está mojado, sale una bocanada de vapor.
- Sonido: un clic seco de ábaco y luego el «whoomp» del fuego.
- Oro y naranja, nunca violeta.

**Plan de implementación:**
- **`src/battle.ts`:**
  - Añadir `'acarreo'` a `PassiveId` y `PASSIVES`, con su libro `ACARREO`.
  - En el camino del golpe de fuego del actor (Foc Binari, Atacar·Fuego) y en lo que suma Atractor: leer el nivel antes de `inflict`. Si ya estaba en `fireTop`, llamar a `carry(state, actor, from, effect)` con `rowNeighbour` (el de Campana y Alterna) y `arrive(state, foe, 'quemado', 1)`.
  - Añadir `BattleEffect.carried = {from, to, steamed?}` y llamar a `note()`.
- **Quitar Rescoldo:**
  - quitar `rescoldo`, `RESCOLDO` y la ruta `bank`;
  - en `src/ecos.ts`, poner `after: 'acarreo'` en Combustión;
  - migrar las partidas guardadas: `'rescoldo'` → `'acarreo'` en `improved.passives` y `matemagico:rescoldo` → `matemagico:acarreo` en el tarro, al mismo coste de 1 eco;
  - en `src/battle-sim.ts:141,143`, cambiar el nodo en los builds `mixto` y `elementos`, y buscar `RESCOLDO` en los `--tune`.
- **Aspecto:** el salto del dígito en battle-scene (fuente de `math-figures`) y una variante del sonido de pasiva.
- **Tests:**
  - salta en III;
  - salta en IV con Combustión;
  - sobre mojado hace Vapor;
  - con el vecino en el tope se pierde;
  - ni Estallido, ni el estallido de Combustión, ni los pulsos acarrean;
  - lo que sobra en Atractor acarrea uno;
  - la partida guardada migra.
- **Probador:** se compra con el chip `improved`.
- **Capturas:** `scripts/screenshots/matemagico-pasivas.json` (tres enemigos en III, II y nada) y añadirlas a herdr.
- **Docs:** tabla de pasivas en `docs/animas/README.md` (y de paso arreglar el desfase de costes de :165-187) y `matemagico/README` § Skills.
- **progress.toml:** ítem nuevo con grep `'acarreo'`.

**Objetivo de fight-sim:**
- Antes y después, `just fight-sim check`: los objetivos que contaban con fuegos de 15 s pueden moverse.
- Pareja `acarreo-gemelos` / `acarreo-gemelos-sin` en `alumnos-3c` (o el grupo de 3 o más que mejor salga en `just fight-sim levers`), con smart y `fuego/factor-comun/acarreo`, frente a lo mismo sin el nodo.
- Pasar `skills` y `coverage`, que debe sacarla de la lista.

## 2. Objeto encontrado (Dadista)

**De dónde sale.** Es el **nivel 6** de Dadista, el único hueco vacío del juego (`EMPTY_LEVELS = { dadaista: [6] }`, src/levels.ts:43). Queda detrás de Aurelià, porque el tope de nivel en la etapa 2 es 6.

**Descripción:** «Pasiva. Si la mano está llena y un enemigo reacciona, quien la lleva recibe un dado de más, una vez por ronda. La mano puede llegar así hasta seis.»

**Regla exacta** (con el arreglo para que no sea un ingreso disfrazado):
- **Solo cuenta con la mano en su tope.** Por debajo del tope no da nada. Así no es un clon de Toma de tierra que rellena la mano cada ronda: sirve solo para pasar del tope.
- **Cuándo salta:** cualquier reacción sobre un enemigo, la ponga quien la ponga. Son las nueve con nombre (`effect.reaction`), las del polvo, el estallido de Combustión y las nuevas (la ignición del Gas y los latidos de Alterna que reaccionan). Una vez por ronda (`wearer.found !== state.round`), con quien la lleva en Dadista y en pie.
- **El dado es un reparto normal:** 2 % de Comodín (20 % si `comodinDue`). No suma Racha hasta que se gasta.
- **Tope:** seis dados. Defender y el descanso siguen parando en el tope de siempre y **nunca quitan dados** por estar por encima.
- **Libro:** `FOUND = { level: 6, perRound: 1, top: 6 }`.

**Qué decisión crea.** Gastar o guardar. Para cobrar dados encontrados hay que tener la mano llena, así que Dadista elige cada ronda entre gastar ahora o mantener la mano llena, porque viene una reacción del compañero y el sexto dado vale más que una Mano. Los tres meteoros (6 → 5 → 3 → 0) dejan de depender de Un golpe de dados, y la pareja juega a reaccionar a propósito: «esta ronda prendo al mojado, guarda la mano».

**Cómo suma con lo demás:**
- **Campana de Gauss:** en un campo mojado o empolvado, reacciona en la misma ronda.
- **Electrólisis:** la ignición cuenta como reacción.
- **Corriente alterna:** sus latidos son los primeros pulsos que reaccionan.
- **Atractor extraño:** sus llegadas reaccionan.
- **Superficie mínima:** el Humo del atacante cuenta, así que el golpe del propio enemigo le da el dado a Dadista.
- **Arco voltaico:** reacciona sobre la presa mojada o ardiendo.
- **Toma de tierra:** la misma reacción paga maná a Matemágico y un dado a Dadista. Las reacciones pasan a ser la moneda de esa pareja.
- **Un golpe de dados:** sigue llenando hasta seis de una vez. Objeto encontrado es el camino que se gana a pulso.
- **Otra vez:** no se pisan.

**Cómo se lee en combate:**
- Sobre quien la lleva, «PASIVA · Objeto encontrado» y «+1 dado», en el blanco azulado de Dadista.
- El dado por encima del tope se ve en la bandeja con un borde algo más claro, sin número.
- No hay icono en la placa.

**Aspecto:**
- De los restos de la reacción (la carbonilla del Estallido, el vapor, la chispa) sale despedido un dado pequeño de hueso mate con un filo astral.
- Hace un arco hasta quien la lleva y cae en la mano rodando, como en Agitar, con unas motas detrás.
- Es un emisor `found` en la GPU que reutiliza la malla del dado. Nunca rosa ni violeta.
- Sonido: el clic de un dado que rueda, a volumen bajo.

**Plan de implementación:**
- **Prerrequisito compartido con Un golpe de dados: la mano por encima del tope.** Se hace una sola vez (ver Parte 2, Dadista):
  - `HAND = { most: 6 }`;
  - `adjustResource` y Defender nunca restan (`Math.max(0, …)`);
  - Estrella fugaz, Da capo e `improve` no recortan;
  - las pepitas se pintan con `max(maxSecondary, secondary)`.
- **`src/levels.ts`:** quitar `dadaista: [6]` de `EMPTY_LEVELS`.
- **`src/battle.ts`:**
  - Añadir `'objeto-encontrado'` con `level: 6, anima: 'dadaista'`.
  - Añadir `FOUND`, `foundOf(state)` y un helper `found(state, effect)`.
  - Llamar a `found` desde el **gancho único `reacted()`**, el mismo que pide Q.E.D. (Parte 2), que sustituye a cada `ground()` (:3216, :4015, :4031, :4045, más :4500 y :4550). Desde la rama de la expansión, también desde `ignite()` y `electricBeat()`.
  - Fijar `effect.dealt` y llamar a `note()`.
- **Tests** (`tests/dice.test.mjs`):
  - con la mano llena, una reacción del compañero da el sexto dado;
  - con la mano a medias no da nada;
  - una segunda reacción en la ronda no da nada;
  - nunca pasa de seis;
  - Defender con seis no quita dados;
  - el Comodín tras un dúo sale con sus probabilidades.
- **Probador:** «Sin límites» ya da nivel 6. Comprobarlo con `aitor: dadaista`.
- **Capturas:** un dado que sale de un Estallido (añadir a `dadaista-astral.json` o un escenario nuevo).
- **Docs:** `dadaista/README` (fila del nivel 6, abiertos 3, 4 y 6, y § The hand's size) y la tabla de pasivas.
- **progress.toml:** ítem nuevo con grep `'objeto-encontrado'`.

**Objetivo de fight-sim:**
- El bot tiene que saber guardar la mano llena: valorar `+1 dado × MANA_WORTH × probabilidad de reacción`.
- Pareja en castillo-2, de Dadista con Matemágico llegando a Asteroide: Dadista en nivel 6 (con la pasiva) frente a nivel 5 (sin ella).
- `levers` sobre `FOUND`.

## 3. Sugestión (Tecnópata)

**De dónde sale.** Es un nodo del tarro en la línea Mente, después de Control remoto (hermano de Virus atómico). Cuesta 1 eco, etapa 1, y es la primera pasiva de esa línea: `passiveNode('tecnopata','mente','sugestion',1,'control-remoto',…)`.

**Descripción:** «Pasiva. Un enemigo confundido golpea al último enemigo al que ha apuntado un aliado, en vez de a uno al azar.»

**Regla exacta:**
- **Alcance:** mientras alguien en pie lleve Tecnópata con el nodo (alcance de equipo, como `combustor`).
- **Qué recuerda el combate:** el último enemigo al que la acción de un aliado apuntó **sola** (`state.aimed`). Los golpes a todos y los pulsos no lo cambian.
- **Qué va a ese enemigo, mientras está en pie y no es una parte:**
  - el golpe de un enemigo confundido (`confusedAct`: Confusión y el engaño de Trampantojo);
  - cada latido de Idea fija.
- **Casos límite:**
  - si el apuntado es el propio confundido, se golpea a sí mismo;
  - si no hay apuntado, o ha caído, el golpe va al azar, como hoy.
- **Lo que no cambia:**
  - Control remoto sigue pegando al más fuerte;
  - el golpe dirigido sigue siendo un golpe físico (revienta Combustión como hoy);
  - **no** gasta Sangrado ni Punto débil, que era lo de Suplantación, aparcada.

**Qué decisión crea.** Confusión deja de ser una moneda al aire: quien cierra la fase del equipo decide dónde pega el confundido. Aitor confunde y Gerard apunta su última acción al enemigo en Combustión IV, al que va a soltar un movimiento anunciado o al propio confundido. Quién confirma último importa cada ronda que hay un confundido. Además, como Idea fija late cada 5 s en tiempo real, apuntar mueve el blanco en directo.

**Cómo suma con lo demás:**
- **Combustión:** el disparo físico ahora se apunta.
- **Campana de Gauss y Atractor extraño:** ponen a un enemigo en III o IV, y el confundido lo revienta.
- **Arco voltaico:** el salto de la gata a principio de ronda también apunta.
- **Serie de Fourier:** apunta como cualquier golpe a uno.
- **El juramento de La Lealtad:** también lee el último golpe, así que se leen igual.
- **Al quite:** un enemigo atraído hacia la gata y luego confundido sigue pegando donde apunta el equipo.

**Cómo se lee en combate (condición del juez que la mantuvo):**
- Un icono continuo y sutil en la placa del enemigo apuntado: dos líneas finas que convergen, en el cian de Tecnópata.
- Solo se ve mientras hay algún enemigo confundido o una Idea fija.
- Es estado, no pista: dice a quién irá el golpe, no qué hacer.
- Al pegar, «PASIVA · Sugestión» sobre quien la lleva, y el mensaje nombra a la pareja: «El Directo, confundido, golpea a La Lealtad.»

**Aspecto:**
- Un hilo de luz cian que parpadea como mala señal, de la cabeza del confundido al enemigo apuntado.
- El confundido gira siguiendo el hilo y pega, y el hilo se rompe en motas en GPU.
- Nunca violeta: confusión no es posesión.

**Plan de implementación:**
- **`src/battle.ts`:**
  - Añadir `'sugestion'`, `sugestionOf(state)` y `state.aimed`.
  - `state.aimed` se fija en `act()`/`dualAct()` cuando el objetivo es uno solo y se limpia en `endFight`.
  - En `confusedAct` (:4901) y en el latido de Idea fija en `runClock` (:6547), elegir la víctima a partir de `state.aimed` y llamar a `note()`.
- **Interfaz:**
  - `src/status-icons.ts`: el icono `sugestion`.
  - `src/battle-ui.ts`: pintarlo en la placa apuntada.
- **Tarro y docs:**
  - `src/ecos.ts`: el nodo, con su posición en el cielo del tarro (`jar-ui`).
  - `tecnopata/README`: fila de Mente, y arreglar el padre viejo de Nanitos y el desfase de costes.
- **Tests:**
  - pega al apuntado;
  - se pega a sí mismo si es el apuntado;
  - va al azar si no hay apuntado;
  - los golpes a todos no cambian el apuntado;
  - nunca a una parte.
- **Capturas:** en `arbol-combate`, o un escenario de un confundido que revienta un IV.
- **progress.toml:** ítem nuevo con grep `'sugestion'`.

**Objetivo de fight-sim:**
- La política smart tiene que apuntar su última acción donde paga el golpe del confundido.
- Pareja `monton-sugestion` (con el nodo) frente a `monton-bien` en `alumnos-3d`.
- Vigilar que «apúntale a él mismo» no sea siempre la respuesta por defecto (`skills`).

## 4. Al quite (Papagato) · opcional

**De dónde sale.** Es un nodo del tarro de un ánima compartida, como Otra vez: `TREES.papagato = [manaNode('papagato'), al-quite]`. Cuesta 1 eco, etapa 1. **Rompe la regla del README de Papagato, «una pasiva, y no desde el principio»**, así que solo entra si Aitor la levanta. Si no, se aparca.

**Descripción:** «Pasiva. Si un enemigo ha anunciado un golpe contra un aliado y quien la lleva le golpea antes de que ese aliado actúe, el golpe irá contra quien la lleva.»

**Regla exacta:**
- **Cuándo salta:** el enemigo tiene un movimiento anunciado contra **un** aliado (`intent.target`, por ejemplo «Carrerilla → Aitor») y ese aliado aún no ha actuado en la ronda. Si quien lleva Papagato le da un golpe **elegido** (Atacar, Zarpazos, Zarpa en la llaga o un dúo), el objetivo del anuncio pasa a ser quien la lleva.
- **Arreglo del juez:** el salto automático de Acecho o Arco voltaico a principio de ronda **no cuenta**. Si no, se cumpliría solo y dejaría de ser una carrera.
- **Lo que no se toca:**
  - los movimientos «→ todos» o contra un sitio;
  - los golpes a todos los enemigos.
- **Lo que sigue funcionando:**
  - un Shock o un Cortocircuito que retrase el movimiento mantiene el nuevo objetivo;
  - las reglas propias del enemigo se aplican después (el juramento de La Lealtad ya apuntaría a la gata).

**Qué decisión crea.** Una carrera a la vista: la gata tiene que golpear antes de que actúe el aliado amenazado, y eso fija quién va primero. Si el compañero también quería ir primero (para un dúo), hay que elegir. Le da a la gata un uso protector que sigue siendo un ataque: llevarse el golpe a los PV de Haru y Yuki y a la custodia de Siete vidas para que Gerard pueda cargar ∂Q/∂t o guardar un dúo.

**Cómo suma con lo demás:**
- **Siete vidas:** la custodia se come el golpe atraído.
- **Escolta:** Bip sobre la gata pega una bomba a quien la golpee.
- **Cortina y Telón:** reducen a la mitad sobre la gata.
- **Superficie mínima sobre la gata:** quien la golpea sale mojado (o con Humo o Envenenado).
- **Arco voltaico:** la gata que espera cargada recibe el golpe y salta de vuelta.
- **Sugestión:** la complementa.
- **La lectura del chip** («leer el anuncio y responder») se mantiene: el chip cambia a la vista, no a escondidas.

**Cómo se lee en combate:**
- El chip del anuncio cambia en directo: «Carrerilla → Aitor» se desliza a «Carrerilla → Gerard».
- «PASIVA · Al quite» sobre quien la lleva, en el color de Papagato.
- Mensaje: «Haru se pone en medio: Carrerilla irá a por Gerard.»
- No hay HUD nuevo.

**Aspecto:**
- Haru no vuelve a su sitio: se queda entre el enemigo y el aliado, cola baja, hasta el final de la ronda.
- La línea del anuncio salta hacia quien la lleva en 0.25 s, con un trazo de luz como un arañazo, en GPU.
- Seco y rápido, nada mono.

**Plan de implementación:**
- **Orden de la ronda:** introduce `state.order` (los aliados que han actuado esta ronda por su cuenta), que antes venía con Plagio, aparcada. Se fija en `settle()` y `dualAct` y se limpia en `nextRound`.
- **`src/battle.ts`:**
  - Añadir `'al-quite'`.
  - Tras un golpe elegido a un solo enemigo: si `target.intent?.target` es otro aliado en pie que no está en `state.order`, se reapunta, se marca `effect.redrawn` y se llama a `note()`.
- **Interfaz:** `battle-ui` anima el cambio del chip.
- **Tarro y docs:**
  - `src/ecos.ts`: `TREES.papagato`.
  - `papagato/README` § Passives y la tabla de pasivas.
- **Tests:**
  - solo antes de que actúe el amenazado;
  - «→ todos» no cambia;
  - el salto de Acecho no cuenta;
  - Cortocircuito mantiene el nuevo objetivo.
- **Capturas:** un escenario de Papagato con el chip cambiando.
- **progress.toml:** ítem nuevo.

**Objetivo de fight-sim:**
- La política smart tiene que mandar primero a la gata contra un anuncio a uno.
- Pareja `campeon-al-quite` (con el nodo) frente a `campeon-bien`.
- Vigilar que `voz-bien` y los objetivos de La Directa no se muevan.

## Aparcadas

- **Kirchhoff** (Matemágico, el hueco eléctrico de grado III): un bonus de daño por rematar, que no sirve contra jefes en el contenido de la etapa 2. Sería la cuarta pieza eléctrica nueva. Ese hueco es de Resonancia si Aitor la quiere. Es la alternativa si dice que no a Resonancia.
- **Histéresis:** reiniciar un reloj es el verbo de Reinicio (Tecnópata), y cobrar sin gastar va contra la identidad eléctrica. Además se apoyaba en Rescoldo.
- **Suplantación:** demasiados efectos colgados (sangrado, ×3, veneno, esquirlas, hielo) sobre un golpe al azar. Sugestión da la misma pareja con menos.
- **Plagio** (Dadista 6): buena decisión de orden, pero solo sale con el dado en blanco, sus reglas de copia son largas y no da el sexto dado. Es la alternativa si Aitor rechaza Objeto encontrado.
- **Tensión superficial:** sería la primera provocación del juego, con cuatro condiciones a la vez, y rival de Al quite. Si hay provocación, que sea una sola.
- **Mordiente** (Colorista 6): invierte la regla escrita del Empolvado. Si se quiere, es una pregunta sobre la regla, no contenido que añadir.
- **Espalda con espalda:** cada ronda, un Defender para todo el equipo más polvo; un bucle de tortuga en el ánima que ya protege.
- **Sedimento** (Freática 6): un bloqueo de control (Confusión y Cegado congelados mientras pague Recarga), y parar relojes es terreno de Tecnópata y Pedal.
- **Cuenca de atracción:** es Atractor extraño gratis en cada muerte, con un desempate oculto.
- **Relamerse:** desgasta la rareza de los dúos y pisa a Da capo. Papagato ya tiene su pasiva.

---

# Parte 2 · Definitivas: estado y plan

## Estado

| Definitiva | Ánima | Estado | Lo que falta | Esfuerzo |
|---|---|---|---|---|
| Fin de fiesta | Colorista | **a medias** (jugable entera) | Pareja de TARGETS; el bot no valora Envenenado ni Cristalizado; tiempo frente a los pinchos nuevos de Cristalizado; docs viejos. Firma visual propia opcional. | S (M con el aspecto) |
| Siete vidas | Papagato | **a medias** (jugable entera) | El bot nunca la lanza (no ve la custodia), sin TARGETS, está en `coverage`. «As a dual» en el doc. Aspecto propio opcional. | S (M con el aspecto) |
| Enjambre | Tecnópata | **a medias** | Aspecto de definitiva (Bip no se deshace). Probable «−0» sobre cada enemigo. Sin TARGETS, capturas ni ítem propio. Sonido genérico. `BUILDS.mixto` no la compra. | M |
| Da capo | Sincopante | **a medias** | Sin TARGETS (está en `coverage`). La mitad del aspecto de su doc: columna, aguja, maná nota a nota, pentagrama, ¡DA CAPO!. Reglas sin decidir: dúos mayores, dados y dúos que siguen sonando. Docs. | M |
| Bajo cero | Freática | **a medias** | Ningún objetivo agrieta ni rompe el hielo (el bot no valora la grieta). Aspecto pequeño para una definitiva. Sonido genérico. Docs. | M |
| Q.E.D. | Matemágico | **solo una idea** (una fila de diseño que no se sostiene) | El diseño entero, y luego todo el cableado. | M (L con el aspecto) |
| Un golpe de dados | Dadista | **solo diseñada** | Todo el código, más el prerrequisito de la mano hasta seis. Decisiones abiertas. | L |

Ninguna está «hecha» según AGENTS.md: ninguna tiene su pareja de TARGETS.

## Lo que falta a todas

1. **La línea del tarro que dice la condición.** No está construida para ninguna, y docs/animas/README § The one that is built la deja como «Not built».
   - **Recomendación: no construirla y borrarla del doc.** Va con «sorpresa antes que pistas», y en combate ya se ve el avance: el icono dormido, la fila «Dormida · n/3» o «NN %» y el aviso «Definitiva · despierta», sin decir qué cuenta.
   - Si Aitor la quiere, sería una línea al comprar el nodo («Despierta cuando…») y nada más.
2. **Una pareja de TARGETS por definitiva**, en castillo-3, porque antes de Dirección duermen.
   - La pareja mide el **giro** (menos rondas, más PV), no ganar o perder: una definitiva es un premio, no la respuesta del combate.
   - Los números se buscan con `levers`/`optimize`, nunca a ojo.
3. **El bot (`src/battle-sim.ts`) tiene que saber valorar lo que pagan:**
   - `POISON_WORTH` y `SHARD_WORTH`, genéricos por estado;
   - la custodia de Siete vidas;
   - la grieta del hielo;
   - la mano hasta seis.
   - Y `BUILDS.mixto` tiene que comprar `tecnopata:definitiva` y `dadaista:definitiva`.
4. **Un gancho único `reacted(state, actor, effect)`**, que sustituye a cada `ground()`. Hoy hay cuatro llamadas más dos sitios de Vapor que no pasan por él. Lo usan:
   - Toma de tierra;
   - Q.E.D. (contar reacciones);
   - Objeto encontrado;
   - la expansión (`ignite`, `electricBeat`, `gather`).
   - Se hace una vez, sobre feature/matemagico-expansion o después de su merge.
5. **La mano por encima del tope** (`HAND.most = 6`): la necesitan Un golpe de dados y Objeto encontrado.
6. **Docs viejos:**
   - `docs/animas/README.md:422` («Fin de fiesta today»), § The one that is built y las filas de la tabla de Bajo cero y Da capo, que siguen como «Designed»;
   - `docs/progress.toml:1113` («hoy Fin de fiesta») y `:768`;
   - `docs/fight-sim.md` § Coverage.
7. **progress.toml:** un ítem «Las definitivas en fight-sim» que marque cuando existan las siete parejas.

## Plan de cada una

### Fin de fiesta (Colorista) · S

- **Reglas:** no cambian.
  - Propuesta: toda reacción del polvo, incluidas las llegadas de Atractor y los latidos de Alterna, pasa por `powderTurned` y cuenta para despertarla.
  - Vigilar que Remolino no levante una cortina en cada latido de Alterna.
- **Bot:** `POISON_WORTH` (0.25 × el daño esperado del equipo en sus rondas) y `SHARD_WORTH` (`POWDER_RULES.shard` × golpes previstos), junto a src/battle-sim.ts:527-528. Así se valoran también Rociada, Puñado y Polvareda.
- **Tiempo:** cuando entre `src/shard-spikes.ts`, subir `FIESTA.end` a unos 3.0, o acortar el hold de `spikes.crystallise` dentro de `fiesta()`.
- **Aspecto propio (opcional, M): «la explosión de polvo».** Es un frente de deflagración, el mismo helper `deflagrate()` que el gas de Electrólisis, así que se escribe una vez:
  1. **0–0.3 s.** Rasga las bolsas del cinturón.
  2. **0.3–0.9 s.** Los puñados se juntan en una nube mate. La rejilla PIC solo da la velocidad; no hay fluido ni bloom.
  3. **0.9–1.5 s.** El frente de llama cruza la nube visiblemente, con `fireball` bajo cada enemigo.
  4. **1.5–2.1 s.** La nube quemada cae como lluvia pesada, y luego el remojón verde.
  5. **2.1–3.0 s.** Un arco salta de enemigo en enemigo y los pinchos salen del polvo.
  6. **Fin.** Una mancha de todos los colores queda en el suelo durante el combate.
- **Sonido:** whoosh de pigmento, un «whump» grave con paso bajo, siseo de lluvia y un crack de vidrio por enemigo.
- **Tests:** las llegadas de Atractor y los latidos de Alterna cuentan para `finale.seen`.
- **Probador:** ya está («Sin límites» y el chip `prismatico:definitiva`).
- **TARGETS:** `fiesta-gemelos` (smart, `gerard:matemagico+aitor:prismatico`, FLOOR_3, menos rondas y más PV) frente a `fiesta-gemelos-sin-ella` (`ban: ['fin-de-fiesta']`) en `alumnos-3c`.
  - Vigilar la cadena Fiesta → Atractor → Fourier sobre un jefe con `skills`.
- **Capturas:** regenerar `prismatico` y `polvo-fx` (`--gpu`) y añadirlas a herdr.
- **progress.toml:** «Definitivas: su pareja en TARGETS», con grep `fiesta-gemelos`.
- **Docs:** `prismatico/README:212-213` (la puerta del castillo ya está hecha) y § Implementation (`ultiProgress`, sonido, `crecimiento.json`).
- **Preguntas:**
  - ¿Le damos plano propio?
  - Cortina y Superficie mínima en el mismo aliado: ¿veneno instantáneo?
  - ¿El gas de Electrólisis sobre un empolvado hace también Estallido?
  - ¿Hace falta un tope en lo que Atractor junta tras la Fiesta?

### Siete vidas (Papagato) · S

- **Reglas:** no cambian.
  - Propuesta: un dúo multigolpe (los dados de la Campana, los latidos de Alterna) gasta la herida solo con su primer golpe en cada enemigo, como Cacería.
- **Bot:** en `value()`:
  - `LIVES_WORTH × (aliados que el próximo golpe tumbaría)`, con el mismo «+30 si coming ≥ hp» que cura y Defender;
  - un `LIVES_IDLE` pequeño cuando no hay amenaza;
  - un `wakeWorth` cuando un golpe deja la herida en 4;
  - un evento `siete-vidas` en `Run.events`.
- **Aspecto propio (opcional, M): «rebobinado de partículas».**
  - La banda `rewind` en `fight-particles` graba ~0.35 s del impacto y lo reproduce al revés.
  - La sangre (`bloodspray`) se retrae y se convierte en un hilo blanco de Yuki.
  - Plano a plano:
    1. **Lanzamiento.** Las garras de Haru, como hoy. Yuki deja en cada aliado una silueta de gato de partículas a sus pies (unas 300, sembradas con `surface-samples`), en blanco hueso con un filo verde.
    2. **Mientras aguanta.** Las siluetas respiran con el pulso de la custodia.
    3. **Al salvar.** La pelea se para, la silueta salta delante, el golpe se «des-ocurre», el −N pasa a +N y la silueta estalla en motas verdes que suben.
    4. **Al cerrar.** Las demás siluetas se deshacen a la vez.
- **Sonido:** el impacto al revés, un ronroneo grave y `rise`. Sustituye al `cue('heal')`.
- **Tests:**
  - Arco voltaico (también el medio salto) despierta la definitiva;
  - el orden custodia → salto en la gata que espera;
  - Superficie mínima delante de un golpe letal no gasta la custodia;
  - la Campana y la Alterna gastan solo con su primer golpe.
- **Probador:** ya está. Decidir si «Sin límites» respeta el «una vez».
- **TARGETS:** `reina-con-siete-vidas` (FULL_DICE con Aitor en Papagato, smart, `happens: {'siete-vidas': [≥.3, …]}`, más PV) frente a `reina-sin-custodia` (`ban`) en el combate de la Reina posterior a Dirección. Alternativa: sujetarla con `skills` sobre `reina-toma-a-aitor`.
- **Capturas:** regenerar `papagato-crece` (07-10), más el plano del rebobinado si se aprueba.
- **progress.toml:** ítem del rebobinado, con grep `rewind` en `src/fight-particles.ts`.
- **Docs:** `papagato/README` («as a dual» → «una habilidad de quien la lleva»), quitarla de § To build y actualizar `fight-sim.md`.
- **Preguntas:**
  - ¿Aspecto propio o el de hoy?
  - ¿Primer golpe por enemigo para los dúos multigolpe?
  - ¿En qué combate se sujeta?
  - ¿«Sin límites» deja relanzarla?

### Enjambre (Tecnópata) · M

- **Reglas:** las de Aitor del 2026-11-21, sin cambios.
  - Arreglo: `effect.hits` deja de llevar daños 0 (probable «−0 · Enjambre» en battle-ui ~:2385).
  - Nueva rama `effect.planted && skill === 'enjambre'` en la interfaz, con un pop «Bomba al máximo» por enemigo escalonado a 0.36 + i·0.06 s.
- **Expansión:** el merge de bombas de Atractor guarda `age = (min(top, p1+p2) − base)/perSecond`, no la suma de edades, que contaría dos veces la base. Corriente alterna conserva su fuerza al reiniciarse.
- **Aspecto: «red de rastro», Physarum en compute WGSL.**
  - Va en `src/physarum.ts`: de 32 a 64 k agentes y un rastro de 512² en ping-pong. Puesta en escena en `src/swarm-fx.ts`.
  - Plano a plano (contacto ~1.6 s, fin 3.2 s):
    1. **0–0.5 s.** Bip sube y se agrieta (lattice `morph`).
    2. **0.5–0.8 s.** Se suelta en una bandada `swarm` de 4 a 6 k puntos.
    3. **0.8–1.4 s.** Cae al suelo y nace la red, que se agarra a cada enemigo y adelgaza hasta el árbol eficiente.
    4. **1.4–1.9 s.** Un fluido `fluido-nanitos` sube por cada cuerpo y cierra la bomba con un *clank*.
    5. **1.9–2.4 s.** Un pulso blanco recorre la red y los relojes giran hacia atrás.
    6. **2.4–3.2 s.** Bip se rehace.
  - La red **se queda** latiendo en rojo al unísono con los pitidos de las bombas hasta que estallan.
  - Cian, blanco y grafito; nunca violeta. Con movimiento reducido, solo un destello. Medir con `just perf`.
- **Sonido:**
  - `swarm-buzz` al empezar;
  - `data-chirp` en la red;
  - un `clink` por enemigo;
  - un `beep` al unísono;
  - `rewind` en el reinicio.
- **Tests:**
  - reinicia los relojes de los enemigos y no la Sanación de los aliados;
  - sus propias bombas al tope no la vuelven a despertar;
  - Explosión justo después cobra cada bomba a 50;
  - el merge de bombas de Atractor.
- **Probador:** ya está (chip `tecnopata:definitiva` y «Sin límites»).
- **TARGETS:**
  - Añadir `tecnopata:definitiva` a `BUILDS.mixto`.
  - `gemelos-tercero-enjambre` (party TECH, FLOOR_3, smart, menos rondas) frente a `gemelos-tercero-sin-enjambre` (`ban`).
  - `check` antes y después.
- **Capturas:**
  - `scripts/screenshots/enjambre.json` (`--gpu`): despierta, la grabación, la red latiendo y Explosión cobrando.
  - Tecnópata en `definitivas-dormidas.json`.
- **progress.toml:**
  - «Tecnópata: la definitiva Enjambre» (grep `id: 'enjambre'`);
  - «Enjambre: la red de Bips» (grep `physarum`);
  - «Enjambre: su pareja de objetivos».
- **Docs:**
  - `tecnopata/README` § Look y § For the balance;
  - `animas/README`: «los relojes de cada enemigo», no «de todo el campo»;
  - `graphics.md` § Physarum.
- **Preguntas:**
  - ¿Bip deshecho solo durante el lanzamiento o hasta el estallido (con coste)?
  - ¿Vale la red de moho?
  - Atractor después de Enjambre: ¿tope de 50 o lo que sobra hace algo?
  - ¿Solo relojes enemigos?
  - ¿En qué combate se sujeta?

### Da capo (Sincopante) · M

- **Reglas.** Hay que decidir:
  - si devuelve los dúos mayores (hoy sí);
  - qué hace con la mano de dados (propuesta: vuelve a la mano con la que empezó, no a seis);
  - qué pasa con un dúo cuyo estado sigue sonando (propuesta: se puede relanzar y **refresca** reloj y fuerza, nunca dos iguales a la vez).
- **Bot:** en `ecoWorth`, valorar el tercer eco cuando Da capo está comprada y dormida.
- **Aspecto: «rebobinado del campo»** (2.4 s).
  - El motor de partículas guarda un muestreo disperso de lo vivo (16 k cada 0.1 s durante unos 6 s) y lo reproduce al revés en nácar.
  - Encima, un fluido `fluido-nacar`: blanco, espuma de mar `#8fe3c4` y oro pálido.
  - Plano a plano:
    1. **0–0.4 s.** Los tres ecos forman una columna.
    2. **0.4–1.0 s.** El rebobinado, y la aguja de Compás da una vuelta atrás.
    3. **1.0–1.6 s.** La ola de nácar cruza el equipo y el maná se llena punto a punto (60 ms y una nota cada uno).
    4. **1.6–2.2 s.** Un pentagrama de cinco líneas (la retícula `string` de Alterna) con los nombres de los dúos devueltos, que se encienden.
    5. **2.2–2.4 s.** ¡DA CAPO!
  - Con movimiento reducido, solo el maná y los nombres.
- **Sonido:** reverberación de 2.8 s (ConvolverNode) en la rama de los ecos, `eco-pip` por punto de maná y el acorde Fa+La+Do en vez de `heal`.
- **Tests:**
  - dúo mayor según lo que decida Aitor;
  - el relanzamiento refresca y no duplica (Vulcano y Alterna);
  - la mano de Dadista;
  - Alterna disponible justo después.
- **Probador:** opcional, un preset «Da capo» con `usedDuals` de prueba.
- **TARGETS:**
  - Primero `just fight-sim run --fights delegada-3 …` para ver si el acorde llega.
  - `delegada-da-capo` (`happens: {'acorde-de-ecos': [1, …]}`, más dúos, menos rondas) frente a `delegada-sin-da-capo` (`ban`).
  - Si domina, la palanca es llenar solo el maná de las ánimas puestas.
- **Capturas:** `da-capo.json`: el acorde, la grabación, **el segundo Rayo solar saliendo** y el icono gastado.
- **progress.toml:** «Da capo entera» (grep `rewindField` o `fluido-nacar`) y su pareja.
- **Docs:**
  - `animas/README`: la fila pasa a **Built**;
  - `sincopante/README`: § Beat by beat y el abierto de balance;
  - `graphics.md`.
- **Preguntas:**
  - ¿Dúos mayores?
  - ¿La mano de dados?
  - ¿Relanzar dúos que siguen sonando?
  - ¿Vale el rebobinado del campo?
  - ¿Delegada o la Reina?

### Bajo cero (Freática) · M

- **Reglas:** no cambian.
  - Propuesta: un enemigo solo Mojado **no** se congela (congela lo que muestran las celdas).
  - Las piezas nuevas:
    - Fourier cuenta cada golpe como una grieta, y Congelado como un icono;
    - Electrólisis no hace nada al congelado;
    - Campana de Gauss derrite una marca;
    - Alterna ni agrieta ni derrite;
    - Arco voltaico cuenta 2.
- **Bot (lo primero):**
  - `ICE_CRACK_WORTH`: cada grieta vale `iceBreakPower × escala ÷ blows`;
  - un empujón para llevar a III al enemigo más hondo cuando la definitiva está comprada y sin usar.
- **Aspecto: «nucleación del agua sobreenfriada»**, un phase field de Kobayashi en GPU (contacto ~0.9 s, fin ~2.6 s).
  - Va en `src/frost-fx.ts`, sobre una textura de 256².
  - Plano a plano:
    1. **0.00 s.** La sonda baja y toca el suelo (esto construye también el lanzamiento pendiente de la sonda).
    2. **0.00–0.55 s.** Helechos de escarcha corren por el suelo hasta cada celda.
    3. **0.55 s.** Un frente de congelación barre el agua.
    4. **0.9 s.** Las celdas se bloquean.
  - Las olas de Riada o Golpe de ariete que sigan fuera se congelan en plena cresta.
  - Cámara: hit-stop de 0.2 s, golpe de zoom, gradación fría y bloom.
  - Blancos y cian pálido (`#dff8ff`, `#bfeff6`).
- **Sonido:** `ice-form`, `ice-crack` por grieta, `ice-shatter` en lugar de `crit` y `ice-tick` mientras aguanta.
- **Tests:** las interacciones con las siete piezas, en `tests/freatica.test.mjs`.
- **Probador:** ya está. Opcional, un chip «Hielo».
- **TARGETS:**
  - `delegada-bajo-cero-bien` frente a `delegada-bajo-cero-sin-ella` (`ban`);
  - de guarda, `reina-con-bajo-cero` sujetando `happens.suyo`, para que un minuto de hielo no se salte las fases;
  - `levers` sobre `crecida.rules.blows`, `breakTop`, `breakLow`, `frozen` e `ice`.
- **Capturas:** `bajo-cero.json` (`--gpu`): sonda, helechos, frente, ola congelada, Hielo 4/8 y la rotura.
- **progress.toml:**
  - «Bajo cero con su momento de definitiva» (grep `createFrostFx`);
  - «Bajo cero sujeto por un objetivo»;
  - corregir la nota de :768.
- **Docs:** `animas/README:461` → Built, `freatica/README` § Sound e Implementation, y `graphics.md`.
- **Preguntas:**
  - ¿Mojado como una marca?
  - ¿Fourier rompe 6 de 8 de un golpe?
  - ¿El segundo polo de Alterna salta a los congelados?
  - ¿Los momentos de guion de los jefes atraviesan el hielo?
  - ¿Vale el aspecto con sus cuatro sonidos?

### Q.E.D. (Matemágico) · M (L con el aspecto)

- **Diseño propuesto**, porque la fila actual no funciona (fuego y agua se anulan, y la electricidad no tiene estado propio que dejar):
  - **Condición:** 3 reacciones **distintas** en el combate, de quien sea, con Matemágico puesta y en pie. El estallido de Combustión no cuenta. En la placa se ve «n/3».
  - **Efecto:** una vez, sin maná. A cada enemigo le llega un golpe mágico alto (40) del elemento que **reacciona** con lo que lleva, en el orden «cobra, prende, moja» (eléctrico, fuego, agua). Si nada reacciona, lo quema.
    - Solo usa los elementos comprados; sin ninguno, es no elemental.
    - Cada golpe pasa por el `react()` de siempre.
  - **Libro:** `QED = { need: 3, power: 40, perLemma: 5, most: 60 }`.
  - **Descripción** (`abstract`): «Lo demuestra: a cada enemigo le llega, muy fuerte, el elemento que reacciona con lo que lleva. Si nada reacciona, lo quema.»
- **Cableado:**
  - `state.proof`;
  - el gancho `reacted()` de arriba;
  - casos en `ultiReady`, `ultiUsed` y `ultiProgress`;
  - la rama junto a Fin de fiesta (:3906);
  - `effect.proof`.
  - Se construye **después del merge** de la expansión, porque toca los mismos caminos.
- **Aspecto: «red de flujo» de un potencial complejo** (contacto 2.4 s).
  1. **0–0.5 s.** El anillo de ceros sube en columna.
  2. **0.5–1.5 s.** El bolígrafo escribe un lema por reacción vista (△ + ϟ ⇒ …), en neón, y cierra con ∎ y hit-stop.
  3. **1.5–1.9 s.** Líneas de corriente y equipotenciales de W(z) en oro sobre el suelo, calculadas una vez en CPU, en menos de 1 ms, en `src/field-lines.ts`.
  4. **1.9–2.4 s.** Partículas siguiendo `conj(W′)` con una ley `potential`, que cambian de materia en cada canal.
  5. **Contacto.** Escalonado cada 0.08 s, con las reacciones de siempre.
  6. **Fin.** Los ceros vuelven al anillo.
  - Nunca violeta ni rosa.
- **Sonido:** un rasgueo y un parcial por lema, un golpe seco en ∎, ruido barrido hacia cada enemigo y, en el contacto, el sonido de cada reacción.
- **Tests:**
  - despierta a la tercera reacción distinta y no repitiendo;
  - cuentan las llegadas de Atractor y los latidos de Alterna;
  - el orden «cobra, prende, moja»;
  - sin elementos, sale no elemental;
  - una sola vez;
  - sus reacciones no despiertan nada;
  - `ultiProgress`.
  - En `tests/ecos.test.mjs`: en :25 el ejemplo velado pasa a ser `dadaista`, y en :48 se añade Matemágico.
- **Probador:** sale solo en cuanto exista la habilidad.
- **TARGETS:** `BUILDS.mixto` y una pareja en un grupo de tres del tercer piso, `<pelea>-qed` frente a `<pelea>-sin-qed`. Vigilar Campana → Q.E.D.
- **Capturas:** `matemagico-qed.json` y un bloque en `definitivas-dormidas`.
- **progress.toml:** ítem con grep `id: 'qed'`.
- **Docs:** `matemagico/README` § Definitiva (con la tabla que lee `scripts/animas.mjs`) y `animas/README:457`.
- **Preguntas:**
  - ¿Vale «cobra, prende, moja»?
  - ¿Cuentan las reacciones del polvo?
  - ¿Las de cualquiera?
  - ¿+5 por cada reacción por encima de 3?
  - ¿Umbral de 3 o de 4?
  - ¿Respeta la Combustión IV?
  - ¿Se permite la red de oro un segundo?
  - ¿Recuperamos el eco del «Acabar» del final?

### Un golpe de dados (Dadista) · L

- **Primero, la mano hasta seis** (compartida con Objeto encontrado):
  - `HAND.most = 6`;
  - Defender y el descanso nunca restan;
  - Estrella fugaz, Da capo e `improve` no recortan;
  - las pepitas con `max(maxSecondary, secondary)`;
  - tests en `dice.test.mjs`.
- **Reglas:**
  - **Despierta** cuando `ownCrit` llega al 100 % (base + Racha ×10, con el ×2 de Ases en dúo). Sigue despierta aunque se gaste la Racha.
  - **Efecto:** un dado de luz sobre cada enemigo. Poder 40, mágico no elemental, crítico seguro; gasta el Punto débil y respeta caparazón y reflejo. **No gasta la Racha** y llena la mano hasta seis.
  - Para distinguirla de Asteroide, cada dado cae con la **estrella del Comodín** hacia arriba.
  - **Descripción:** «Daño mágico no elemental alto a todos los enemigos. Golpe crítico seguro. Llena la mano hasta seis dados.»
  - No toca el gas, lo que junta Atractor, el agua ni la cuenta de Fourier.
- **Cableado:**
  - `state.coup`;
  - `wakeCoup` en `spendDie` y en Ases;
  - casos en `ultiReady`, `ultiUsed` y `ultiProgress` (en %);
  - la rama junto a `rain` (:3809).
- **Aspecto: «el collage»**, un pase `collage` en `src/post.ts`:
  1. **0–0.4 s.** Baja la noche y los dados de la mano suben.
  2. **0.4–1.0 s.** El fotograma se rasga en 5 a 7 tiras de papel marfil, con un cielo de estrellas detrás y una regla roja.
  3. **1.0–1.5 s.** Una constelación de tinta une a los enemigos.
  4. **1.5–2.3 s.** Grandes dados de lattice `box` caen con una lente bajo su peso.
  5. **Contacto.** Hit-stop de 0.25 s, la estrella bermellón y `fluido-luz` en charcos.
  6. **2.3–3.0 s.** Seis dados de cristal vuelven a la mano y las tiras se pegan algo torcidas.
  - Con movimiento reducido, sin tiras ni lentes.
- **Sonido:** `rise`, `rasgado` (papel), tres `clink` y, en el impacto, `slam`, `crit`, `glass-tick` y `dados-mano`.
- **Tests:**
  - despierta exactamente al 100 %;
  - con Ases despierta a la mitad de Racha;
  - sigue despierta tras Dados astrales;
  - una vez por combate;
  - crítico seguro;
  - no gasta la Racha;
  - mano a 6 con tope 4 y con tope 5;
  - rompe el meteoro.
  - Cambiar `tests/crecimiento.test.mjs:32` para que use `matemagico:definitiva` como la que sigue dormida.
- **Probador:** sale solo.
- **TARGETS:**
  - el bot guarda la Racha cuando la definitiva está comprada y dormida;
  - `BUILDS.mixto`;
  - `gemelos-tercero-golpe-de-dados` frente a `gemelos-tercero-sin-definitiva`.
- **Capturas:** `dadaista-definitiva.json` y un bloque en `definitivas-dormidas`.
- **progress.toml:** el ítem de :661-667 marca solo con el id `un-golpe-de-dados`. Añadir «Dadista: la mano hasta seis».
- **Docs:** `animas/README` (:155-157, :367, :422, :463, :486) y `dadaista/README`.
- **Preguntas:**
  - ¿Cuenta el ×2 de Ases?
  - ¿Sigue despierta tras gastar la Racha?
  - ¿La mano hasta seis como regla general?
  - ¿Poder 40 y caras normales?
  - ¿La estrella del Comodín o una cara al azar?
  - ¿Palabras del poema en las tiras?

## Orden recomendado

1. **Lo común, en una rama limpia** (otros agentes trabajan en main):
   - el valor del bot (veneno, esquirlas, custodia, grieta);
   - `BUILDS.mixto` con las siete definitivas;
   - los docs viejos;
   - borrar la línea del tarro, si Aitor dice que sí.
   - Pasar `just fight-sim check`.
2. **Las parejas de TARGETS de las cinco construidas**, de la más barata a la más cara: Fin de fiesta, Siete vidas, Bajo cero, Enjambre (con el arreglo del «−0» y sus tests) y Da capo (tras las decisiones de reglas). Cada una sale de `coverage`.
3. **Merge de feature/matemagico-expansion**, y después el gancho `reacted()`.
4. **Pasivas de reglas puras:** Sugestión, y Acarreo con la migración de Rescoldo. Al quite, si se aprueba.
5. **La mano hasta seis**, después **Objeto encontrado** y después **Un golpe de dados**.
6. **Q.E.D.**, sobre `reacted()`.
7. **Los aspectos propios, uno a uno con `just perf`**, solo los que apruebe Aitor. Orden sugerido: Enjambre (le falta más), Bajo cero, Da capo, Siete vidas y Fin de fiesta.

---

# Lo que tienes que decidir

1. **¿Acarreo sustituye a Rescoldo?** Supone migrar las partidas guardadas y mover Combustión para que cuelgue de Acarreo. Sin cascada: si el vecino ya está en el tope, el nivel se pierde.
2. **¿Llenamos el nivel 6 de Dadista con Objeto encontrado?** Solo con la mano llena, para pasar del tope. Su README decía «esperar a jugar los meteoros». La alternativa es Plagio.
3. **¿Sugestión como primera pasiva de Mente?** Con el icono de apuntado en la placa, y sin gastar Sangrado.
4. **¿Al quite?** Rompe «una pasiva» de Papagato y sería la única provocación del juego.
5. **El hueco eléctrico de grado III:** ¿Resonancia, Kirchhoff o vacío?
6. **¿Borramos la línea del tarro que dice la condición, para todas las definitivas?** La recomiendo borrar.
7. **Q.E.D.:** ¿vale el diseño «cobra, prende, moja» con 3 reacciones distintas? Faltan sus otras seis preguntas.
8. **Un golpe de dados:** ¿cuenta el ×2 de Ases? ¿Sigue despierta tras gastar la Racha? ¿La mano hasta seis como regla general?
9. **Da capo:** ¿devuelve los dúos mayores? ¿Qué pasa con la mano de dados? ¿Se pueden relanzar dúos que siguen sonando?
10. **Bajo cero:** ¿un enemigo solo Mojado se congela como una marca? ¿Fourier rompe 6 de 8 de un golpe?
11. **Enjambre:** ¿Bip deshecho hasta el estallido (con coste) o solo durante el lanzamiento? ¿Solo los relojes enemigos?
12. **Aspectos propios:** ¿cuáles apruebas? Physarum (Enjambre), nucleación (Bajo cero), rebobinado del campo (Da capo), rebobinado y siluetas (Siete vidas), explosión de polvo (Fin de fiesta), red de flujo (Q.E.D.) y collage (Un golpe de dados).
13. **¿En qué combate sujetamos cada pareja?** Propuesta:
    - Gemelos de tercero para Fin de fiesta, Enjambre y Un golpe de dados;
    - Delegada para Da capo y Bajo cero;
    - la Reina para Siete vidas.
