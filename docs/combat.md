# Base de combate y laboratorio de dificultad

El combate se divide en reglas, contenido y presentación. El núcleo no conoce a Gerard,
Matemágico, los perros ni una lista cerrada de elementos. Una acción describe costes, objetivos y
efectos; los combatientes aportan atributos, recursos, afinidades y estados. El simulador usa
esas mismas reglas sin cargar el juego ni el navegador.

Esta entrega construye la base y un banco de pruebas. Los números y nombres mecánicos del
laboratorio son provisionales: no fijan las clases, tipos ni debilidades de la aventura.
Tampoco convierten automáticamente los combates existentes en encuentros difíciles. El
equilibrado de la campaña necesita sus encuentros y sus decisiones reales: para eso está
`just fight-sim` ([fight-sim.md](fight-sim.md)), que juega los combates de la campaña con sus reglas.

## Dirección (decidido 2026-10-29)

El combate es **robusto y complejo, no infantil** (`AGENTS.md` § Game philosophy): decisiones
reales cada turno, sistemas legibles que se combinan (estados, recursos, fases, debilidades,
ánimas que se complementan) y jefes que ponen a prueba lo aprendido. El juego nace de un juego de
niños, pero no está hecho para niños: nada de simplificarlo ni de presentarlo como un juego
infantil.

## Turnos con tiempo real (dirección, 2026-10-31)

**Qué está construido** (2026-11-07): parte de esta dirección ya está en el juego y se describe en
§ *Estados en tiempo real*, que manda donde no coincidan: el reloj, Quemado (10 s, un pulso cada
2 s, niveles I → III), Cegado y las reacciones Humo, Cauterizado y Tormenta, con sus reglas
propias. Sigue sin construir: el turno aliado en paralelo, las fases separadas, quitar la
Velocidad, las barreras, las posiciones y el resto de reacciones.

**Decidido como dirección:** el combate mezcla **turnos y tiempo real**. Algunos estados no duran
rondas sino **segundos**: *Quemado* no dura 2 turnos, dura **segundos** (la idea decía 20 s; construido con 10 s). Y si antes de que se apague
cae encima **otro efecto del mismo elemento**, el estado **sube de nivel** (Quemado → Quemado II →
…). No será así para todo: solo para los estados y elementos que lo pidan. El resto sigue
midiéndose en turnos, como hoy.

**El turno aliado, en paralelo** (decidido 2026-10-31): Gerard y Aitor **no eligen uno detrás
de otro**. Los dos tienen su menú abierto a la vez y **cada uno actúa cuando elige**: en cuanto uno
selecciona algo, su ataque se ejecuta. Así **el orden lo deciden los jugadores**, no la Velocidad,
e influye (uno moja, el otro electrifica en cuanto lo ve), y deja sitio para **ataques especiales
combinados** más adelante (`docs/animas/README.md` § Combined skills).

**Fase aliada y fase enemiga, separadas** (decidido 2026-10-31): en general, primero actúa el
grupo (los dos en paralelo, como arriba) y después los enemigos. Algún combate concreto podrá
romper esa regla a propósito (un jefe que interrumpe, por ejemplo), caso por caso. El reloj de
los estados sigue corriendo en las dos fases.

**Sin Velocidad** (decidido 2026-10-31): la Velocidad **deja de ser un atributo**. El orden
aliado lo deciden los jugadores; el de la fase enemiga lo fija cada encuentro (su definición o su
IA). Pendiente en el código: hoy `src/stats.ts`, `src/battle.ts`, el laboratorio
(`src/combat-lab.ts`, la regla de atributo de velocidad) y sus pruebas aún ordenan por ella; la
sección *Orden de resolución y duración* describe ese motor actual.

**Barreras** (idea por explorar, 2026-10-31): hechizos de protección que levantan una **barrera
física y direccional** delante de alguien (encaja con las posiciones: cubre un lado o el frente).
Combinando ciertos efectos de este tipo se **refuerza**: por ejemplo, una barrera con un segundo
efecto se vuelve **espejo** y devuelve los ataques. Solo como idea; se irá explorando.

**Reacciones entre elementos** (decidido como dirección): dentro de esa misma ventana, un elemento
**distinto** no sube el nivel sino que **transforma** el estado:

| Estado activo | Llega | Resultado |
| --- | --- | --- |
| Quemado | Agua | Quita Quemado; deja **Humo**, que causa **Cegado** durante un tiempo |
| Mojado (del agua) | Eléctrico | **Parálisis** |
| Mojado | Frío | **Congelado** |
| Humo | Viento | **Arrastra el humo**: quita Humo y Cegado de ese bando y lo empuja al otro |
| Envenenado | Fuego | **Veneno ardiente**: estalla y hace daño a los enemigos **adyacentes** |
| Mojado | Fuego | **Vapor**: quita Mojado; daño leve a todos los enemigos durante un tiempo |
| Congelado | Golpe físico fuerte | **Añicos**: daño extra alto y se acaba Congelado |
| Envenenado | Agua | **Contagio**: el veneno se diluye y pasa, más débil, a los adyacentes |
| Sangrado | Fuego | **Cauterizado**: corta el Sangrado, pero el objetivo no puede curarse un tiempo |
| Humo | Eléctrico | **Tormenta**: la descarga salta entre todos los que están en el humo |

**Dos familias de elementos** (decidido 2026-10-31): los **físicos** y los **mentales**, separados.

- **Físicos, ahora**: fuego, agua, frío, eléctrico, veneno, viento y el golpe físico fuerte; sus
  estados son quemado, mojado, congelado, envenenado, sangrado, cegado por el humo, paralizado.
- **Mentales, en otro bloque más adelante**: el **Sonido** se queda para ese bloque (gusta la
  idea), con estados como desorientado; nada mental entra hasta diseñarlo aparte.
- Descartadas de la primera ronda de candidatas: choque térmico, veneno acelerado, pringue fundido
  y derribado. *Cegado + Sonido → Desorientado* espera al bloque mental.

**Cada ataque tiene un elemento** (decidido): habilidades y ataques de enemigos llevan su
elemento asociado (o ninguno), que es lo que dispara las reacciones de arriba. Las descripciones
ya lo prevén: `Daño alto mágico de tipo <X> a un enemigo.` (`AGENTS.md`).

**Tipos en los monstruos** (duda abierta): un mini sistema de tipos, **secundario**, que no defina
la estrategia: un monstruo resiste o sufre un poco más ciertos elementos (`Afinidad` ya lo
permite), sin que sea la clave de cada combate. Si entra y cómo: por decidir.

Reglas (decididas 2026-10-31):

- **Las reacciones valen en los dos bandos**: también nos afectan a nosotros. Agua sobre un aliado
  Quemado lo apaga, pero lo deja en el humo; un Veneno ardiente en un aliado alcanza a quien
  tenga al lado.
- **Posiciones fijas en el campo**: importa **quién tienes al lado** (adyacentes) y quién va
  **delante o detrás**. Las posiciones serán un dato propio de cada combatiente, separado del
  orden de actuación. Qué cambia exactamente ir delante
  o detrás (quién recibe los golpes físicos, a quién alcanza un ataque a distancia, cómo se
  cambia de sitio y cuánto cuesta): por diseñar.

Una reacción solo ocurre **mientras el primer estado sigue activo**: si se apaga antes, el segundo
elemento se aplica solo, sin reacción. En el motor encaja como una reacción del estado a una
etiqueta de daño entrante (`Estado` ya admite reacciones y `Afinidad` ya trabaja con etiquetas):
retirar el estado y aplicar otro. Así el contenido las declara sin que el motor conozca el
fuego ni el agua.

**Cuándo aflora** (decidido 2026-10-31): la dinámica **está siempre**, desde el primer combate,
pero **no aflora al principio**: los primeros combates casi no ponen dos elementos en juego, así
que no se nota. Sale cuando el juego **se complica un poco** (más ánimas con elemento, enemigos
que traen el suyo). Propuesta para enseñarlo haciendo (`AGENTS.md`): la primera reacción la
provoca un enemigo, a la vista (uno moja al grupo y otro trae electricidad), y desde ahí el
jugador ya sabe que existe.

Lo que cambia en el juego: aplicar algo ya no es solo *qué* sino *cuándo*. Encadenar a tiempo
premia el orden de los turnos y, con dos jugadores, que Gerard y Aitor se coordinen
(uno prende, el otro aviva antes de que se apague).

Decidido y propuestas:

- **El reloj corre siempre** (decidido 2026-10-31) durante el combate, también mientras se elige:
  elegir rápido importa y los menús son parte de la tensión. Solo lo para el menú de pausa.
- **El modelo.** Junto a la duración en finales de turno (sección *Orden de resolución y
  duración*), una duración en milisegundos (`durationMs`) en la definición del estado, y un modo
  de acumulación nuevo, `escalate`: volver a aplicarlo mientras sigue activo sube un nivel hasta
  un máximo y reinicia su reloj; al apagarse, desaparece entero. Cada nivel es su propia
  definición (más daño por pulso, otra afinidad, una reacción), para que el nivel alto pueda
  hacer algo distinto y no solo más.
- **Pulsos.** Un estado temporal pulsa cada cierto tiempo (construido: Quemado cada 2 s) en vez de al
  final del turno de su propietario.
- **Leerlo sin panel.** El estado se ve en el combatiente: las llamas crecen con el nivel y un
  anillo que se vacía muestra el tiempo que le queda (está en el tablero, como pide la regla del
  HUD en `AGENTS.md`).
- **Qué elementos lo usan.** Fuego primero (escala); candidatos: Sangrado de Papagato (hoy por
  rondas, `docs/animas/papagato/`), un frío que ralentiza más cuanto más se acumula, el pringue de
  la Reina. Escalar no tiene por qué ser siempre bueno para quien lo aplica: un estado en el
  enemigo podría tener un nivel alto que estalla y también afecta al grupo.
- **El laboratorio.** El simulador es por turnos y determinista; necesita un reloj simulado (lo
  que tarda cada acción en resolverse y un tiempo de decisión por política) para poder equilibrar
  estos estados con la misma semilla.

## Modelo de contenido

`src/combat/types.ts` define contratos de datos serializables. Los identificadores son cadenas
y los atributos, recursos y afinidades son mapas: el motor no tiene que conocer una clase
para permitir su comportamiento.

| Pieza | Responsabilidad |
| --- | --- |
| Combatiente | Identidad, equipo, atributos, recursos, acciones, afinidades y estados iniciales. |
| Recurso | Valor actual y máximo. La regla del encuentro identifica cuál representa la vida. |
| Acción | Objetivos, costes por recurso, enfriamiento y una secuencia ordenada de efectos. |
| Efecto | Daño, curación, cambio de recurso, aplicación o retirada de estado, o resurrección explícita. |
| Fórmula | Base y contribuciones opcionales de atributos del actor y del objetivo, mínimo y variación. |
| Estado | Duración, acumulación, modificadores, afinidades, bloqueo de acciones, efectos de turno y reacciones. |
| Afinidad | Multiplicador asociado a una etiqueta de daño. Una etiqueta sin entrada es neutral. |
| Reglas | Recurso de vida, atributo de velocidad, combinación de afinidades y límites de ejecución. |
| Comando | Actor, acción y objetivos elegidos. Representa una intención que el motor debe validar. |
| Evento | Lo que ocurrió realmente, con cantidades aplicadas. Alimenta registros y presentación. |

Las etiquetas pueden mezclarse sin declarar una jerarquía de tipos. La política del encuentro
elige cómo combinar sus multiplicadores: producto, media geométrica, mínimo o máximo. Un
valor cero representa inmunidad; no se transforma en un punto de daño por el mínimo de la
fórmula. Elegir esa política es una decisión explícita de diseño: multiplicar muchas
debilidades puede producir extremos. Debe mantenerse estable al comparar variantes.

El estado de ejecución está separado de la definición. Los costes y efectos cambian ese
estado; no reescriben la ficha original del encuentro. Los registros de eventos contienen
las cantidades efectivas tras limitar los recursos, de modo que daño excesivo y curación
excesiva no inflan los resultados.

## Ampliar sin añadir clases al motor

- **Una acción:** añadir su definición y conceder su identificador a los combatientes
  correspondientes. Componer varios efectos para un golpe que además cambie un recurso o
  aplique un estado.
- **Un recurso:** añadir una entrada a `resources` y usar su clave en `costs` o en un efecto
  `resource`. Un sistema de cargas, concentración o reservas no necesita un campo global
  nuevo. El recurso de vida se selecciona con `healthResource`. Si un destinatario no usa
  ese recurso, el efecto se omite para él sin crear una reserva nueva; así una recuperación
  de grupo funciona con clases que usan recursos distintos. Una clave inexistente en todo
  el encuentro sigue siendo un error de definición.
- **Un estado:** declarar sus modificadores, duración, acumulación y efectos o reacciones.
  Una protección, una penalización temporal o una respuesta al recibir daño son contenido.
- **Una afinidad:** usar una etiqueta en el daño y un multiplicador en el combatiente o en un
  estado. Las etiquetas del laboratorio no reservan los nombres de los tipos futuros.
- **Una clase:** construir una ficha que combine atributos, acciones, recursos y estados
  pasivos. La clase pertenece al catálogo de contenido o al equipamiento, no al planificador.
  Dos clases pueden dar acciones distintas aunque no compartan los mismos recursos.

Esta composición cubre comportamientos nuevos dentro de las operaciones disponibles. Una
operación fundamental nueva —por ejemplo, crear combatientes durante la batalla o reemplazar
el planificador por una línea temporal— requiere ampliar el contrato y su resolución, junto
con validación y pruebas. No se promete que cualquier mecánica futura sea sólo un cambio de
JSON.

Cuando una mecánica necesita calcular sus efectos a partir del estado, un efecto `custom`
puede nombrar un manejador registrado en `CombatRuntime.effects`. El manejador recibe una
instantánea congelada y el generador aleatorio del motor; devuelve efectos que se validan y
resuelven por el mismo recorrido que los declarativos. Así se puede añadir, por ejemplo, una
acción que transforme todas las cargas acumuladas en daño, sin añadir un `if` por clase al
motor:

```ts
const runtime: CombatRuntime = {
  effects: {
    discharge: ({ actor }) => {
      const charges = actor.resources.charge?.current ?? 0;
      return [
        { kind: 'resource', target: 'self', resource: 'charge', amount: -charges },
        { kind: 'damage', amount: charges * 2 },
      ];
    },
  },
};
// Acción: effects: [{ kind: 'custom', handler: 'discharge' }]
// El combatiente declara resources.charge y el manejador acompaña todas sus ejecuciones.
```

El registro contiene código de confianza del proyecto; el JSON no se evalúa como código.
Los manejadores deben usar `context.random()` y evitar reloj, red, estado global y
`Math.random()`: el determinismo del código de la extensión es un contrato de programación,
no una restricción que el motor pueda imponer a todo JavaScript. Congelar la instantánea
protege el estado del motor, pero no convierte un manejador arbitrario en un entorno aislado.
Para repetir una batalla con extensiones hay que
conservar también la versión de ese registro. Las políticas automáticas deben aprender a
valorar una acción especial si se quiere medir su utilidad táctica.

## Orden de resolución y duración

`createCombat(definition, seed, runtime?)` valida el contenido y crea un estado independiente.
`availableActions(definition, state)` enumera comandos legales sin consumir aleatoriedad.
`stepCombat(definition, state, command, runtime?)` devuelve un estado nuevo y sus eventos. Una
orden rechazada devuelve el estado original sin gastar recursos, turno ni números aleatorios.
Los errores de una extensión durante una transición también revierten esa transición.

El recorrido del turno es explícito:

1. Ordenar por velocidad efectiva al empezar la ronda; los empates conservan el orden de la
   definición. Los cambios de velocidad alteran el orden de la siguiente ronda. Saltar a
   quienes ya no viven.
2. Ejecutar los efectos de inicio del turno del siguiente combatiente vivo. Si esos efectos
   lo derrotan, pasar al siguiente. Un bloqueo de acciones deja disponible la espera, por lo
   que los estados temporales siguen avanzando.
3. Validar actor, acción concedida, objetivos, equipo, condición de vida, costes y
   enfriamiento. Los objetivos de un efecto de grupo son el conjunto completo elegible; una
   lista duplicada o parcial no puede multiplicar el daño ni abaratar una acción.
4. Pagar los costes, registrar la acción y resolver sus efectos en el orden declarado.
   Los costes de vida deben dejar al actor con vida mayor que cero; un sacrificio se expresa
   con daño explícito para producir también sus eventos y reacciones de derrota.
5. Resolver las reacciones de cada efecto antes de continuar con el siguiente. El orden es
   el de los estados y el de sus reacciones declaradas. Un mismo manejador de reacción no se
   vuelve a invocar dentro de su propia cadena, evitando rebotes infinitos. Un estado retirado
   por un efecto anterior no ejecuta sus pulsos o reacciones pendientes.
6. Ejecutar los efectos de fin de turno, reducir enfriamientos y duraciones del propietario,
   retirar estados agotados y resolver el resultado. Un estado aplicado en la propia acción
   no pulsa ni pierde duración al terminar esa misma acción.
7. Avanzar al siguiente actor o iniciar la siguiente ronda. La victoria se comprueba tras
   resolver las reacciones y el final del turno: una represalia puede causar derrota mutua.

La duración se mide en finales de turno del propietario, también cuando espera o está
impedido. Omitirla crea un estado permanente. Un enfriamiento de 1 impide usar la acción en el
siguiente turno de su propietario; en el posterior vuelve a estar disponible.

Cada combatiente mantiene una instancia por identificador de estado:

| Acumulación | Al volver a aplicarlo |
| --- | --- |
| `refresh` (predeterminada) | Reinicia duración y conserva la mayor cantidad de cargas entre la existente y la nueva. |
| `stack` | Suma cargas hasta `maxStacks` y reinicia duración. |
| `replace` | Sustituye cargas y duración. |

Todas las cargas comparten duración y procedencia: una nueva aplicación atribuye la instancia
al último aplicador. No hay todavía duraciones separadas por carga o por fuente. La retirada
puede eliminar algunas cargas o el estado entero.

Los modificadores de atributos suman primero sus contribuciones y después multiplican sus
factores; las cargas repiten ambas contribuciones. Las afinidades de estados multiplican las
del combatiente. Los pulsos y reacciones multiplican sus cantidades por las cargas; aplicar
otro estado usa las cargas explícitas de ese efecto.

En los pulsos `onTurnStart`/`onTurnEnd`, el actor de la fórmula es quien aplicó el estado y el
objetivo predeterminado (`target: 'targets'`) es su propietario. `target: 'self'` apunta
explícitamente al aplicador. En una reacción, el actor es el propietario del estado y el
objetivo predeterminado es la fuente que provocó la reacción; `target: 'source'` también
permite señalarla explícitamente. Esta distinción evita que una curación periódica cure a
quien la lanzó por accidente.

Los límites de rondas, acciones, profundidad de reacciones y efectos por transición cortan
cadenas o combates que no terminan. El resultado conserva el motivo del corte; no se oculta
como victoria. Las cantidades no finitas y las referencias inválidas se rechazan. La
curación normal no revive: existe un efecto `revive` explícito y la acción debe admitir
objetivos derrotados.

## Dónde se planta un combate

**Arenas de jefe** (`src/boss-arena.ts`, `BOSS_ARENAS`): El Campeón y La Sobremesa no pelean
donde empiezan, entre su propio decorado (su figura esperando en la peana, la masa sentada a la mesa
del melón), sino que, por el mismo cristal que un bolsillo, pasan a un escenario hecho con las
piezas del camping: sus constructores de monumentos, sus pinos con bombillas, su suelo, su agua y
su luz, con sitio para el combate (`ARENA_SPREAD`). La piscina: el agua iluminada por dentro detrás,
el muro de tablas, la silla del socorrista y la pizarra del TORNEO. El merendero: las mesas largas, la
del melón detrás del jefe, la puerta blindada abierta, el foco cálido duro sobre él y todas las
bombillas encendidas.

Un combate necesita sitio: el grupo a un lado, los enemigos al otro, uno al lado del otro con
espacio entre ellos y cada segundo un paso atrás (la cámara mira desde el sur: así Gerard y Aitor
se separan también en pantalla, no uno delante del otro; ante un gigante, abajo, al otro lado), Haru y Yuki junto a quien lleva Papagato, holgura alrededor de cada uno según su tamaño (`BODY`, `FOE_SIZE` y `ROOM` en
`src/arena.ts`), el camino libre entre los dos bandos para cada golpe y, donde los muros son
altos, terreno libre delante de cada uno hacia la cámara para que se les vea por encima
(`Environment.walls`; la torre de Uri dice 4). `stageFight` lo busca así:

1. **En terreno abierto**, donde empieza o a unos pasos (`SHIFT`, nunca atravesando un muro), con
   la formación de siempre (`formation`) y la cámara de siempre (`CAMERA.open`). Ante un gigante
   (`GIANT`, 1,5 casillas de radio o más: Vertitrón) el gigante se pone `GIANT_BACK` (1,5) casillas
   más atrás y la cámara gira `GIANT_TURN` (60°) alrededor del combate hacia la espalda del grupo
   (`fightCamera`): se le ve entero y casi de frente, el ojo en el pecho, por encima de sus hombros,
   en vez de de lado y pegado a ellos. Desde ahí el paso atrás del segundo va al otro lado, para que
   no quede uno detrás del otro.
2. **A lo largo de una calle** de al menos `STREET_WIDTH` (7) casillas de ancho, con el grupo en un
   extremo y los enemigos en el otro, y la cámara mirando a lo largo.
3. **En un bolsillo**, si no cabe en ninguno, a través de cristal (`post.snapshot` y
   `post.diffuse`, un pase del compose shader): se guarda la imagen tal como está, el combate pasa
   al bolsillo en el acto (la cámara corta con él) y la imagen, hecha de paneles de cristal pequeños
   de tamaños distintos en filas que no casan, gira panel a panel, al azar, tiqui-tiqui-tiqui, para
   mostrar el sitio nuevo: cada uno destella al girar, refleja el sitio nuevo como en un espejo,
   doblado y separado en colores, y se endereza; los que aún esperan muestran el sitio de antes
   cada vez más agitado. Cada bisel coge la luz desde su ángulo y suena un tic de cristal
   (`glass-tick`) por cada tanda. Gira en 0,85 s acelerando: pocos paneles al principio y luego
   todos de golpe (`DIFFUSE` en `src/game.ts`). Al acabar el combate, lo mismo de vuelta. Con movimiento reducido
   solo cambia. El bolsillo
   (`planPocket` en `src/arena.ts`, `src/pocket.ts`) es **el mismo trozo del lugar, ensanchado**:
   el suelo al que se llega desde donde empezó (hasta `POCKET.reach` casillas), los muros que lo
   cierran y sus cosas donde estaban (farolas, árboles, coches, la maceta con ciprés de la torre),
   con la fila o columna que pasa por ese punto copiada las veces necesarias (al menos
   `POCKET.least`) a lo ancho de por donde corre el suelo: un pasillo sigue siendo un pasillo, más
   ancho; una esquina, una esquina; una sala, la misma sala con su fuente. Los dos bandos se ponen
   `POCKET.spread` (1,5) veces más lejos que en el sitio, y cada uno más separado de su lado. Suelo y muros llevan los materiales del
   lugar, la luz es la más coloreada que había cerca, los muros del lado de la cámara se recortan
   hasta el zócalo para que se vea dentro, y donde acaba la copia el suelo se corta sobre el cielo
   del lugar, lejos de todo. Las partículas del combate (chispas, gotas, escarcha, marcas) caen,
   rebotan y se quedan en el suelo y los muros del bolsillo (`pocketWorld` en `src/arena.ts`,
   `effects.setFightStage`), nunca en los del lugar, que queda lejos y a otra altura; `just
   screenshots pocket-fx --gpu` lo muestra. Al acabar, el cristal devuelve a donde estaban. Con
   movimiento reducido solo cambia.

Así queda cada combate de la historia (`tests/arena.test.mjs`): los perros del Passatge Maresme
en su sitio (al final de la calle, una casilla al lado para no pisar una farola); el esbirro del
palacio en su sala, sin pisar los caramelos; los guardianes del palacio, dos armarios de chicle
sin sitio ante la fuente, en un bolsillo del palacio; Vertitrón en el centro de la cima, lejos
de su borde; y cualquier miedo que alcance al grupo en la rampa de la torre (pasillos de cinco
casillas entre muros altos), en un bolsillo de la torre. El probador de combates empieza donde
está Gerard y, si no hay sitio, va a un bolsillo; `&pocket` lo fuerza en cualquier lugar.

`just screenshots fight-room` lo muestra: el cristal de entrada y de salida, los bolsillos de la
torre, del palacio y de Cardedeu, Vertitrón y los perros en su sitio.

## Qué comparte hoy el juego

`src/battle.ts` sigue siendo el adaptador de la campaña: conserva los turnos del grupo y de los
enemigos, las animaciones y mensajes existentes, la huida, las ánimas de los guardianes y el
despertar de Matemágico. `src/stats.ts` conserva los nombres de atributos de la campaña.

La campaña y el laboratorio comparten las primitivas de cálculo y aplicación de daño y
curación. Las reglas narrativas siguen en el adaptador: el pringue absorbe golpes, Bernat
conserva su suelo de PV durante la escena y el despertar interrumpe el turno. El laboratorio
no interpreta estas excepciones narrativas como dificultad de un encuentro ordinario.

El planificador genérico, los estados y las reacciones pertenecen al núcleo nuevo. Aún no
sustituyen el planificador de la campaña: una habilidad nueva del laboratorio no aparece por
sí sola en el menú del juego. Para migrar un encuentro hay que declarar su contenido,
traducir sus eventos a la presentación y comprobar sus condiciones narrativas. Esta frontera
permite mantener la aventura jugable mientras se amplía el sistema.

### Maná

En la campaña las habilidades gastan **maná** (antes Secundaria y, unos días, Ánima). Cada
ánima tiene **su propio maná**, y cada personaje el suyo: el Papagato de Gerard y el de Aitor no
se gastan entre sí. Todas empiezan cada combate llenas, con 3 puntos (`MANA_POINTS` en
`src/battle.ts`), que se ven como círculos bajo los PV del ánima puesta. Una habilidad gasta su
coste; **Defender** devuelve 2 al ánima puesta, y solo a ella (`DEFEND_CHARGE`), sin pasar del máximo. Al final
de cada ronda, cada ánima que no se ha llevado **en ningún momento** de esa ronda recupera 1
(`REST_CHARGE`): quien quiera seguir usando habilidades cambia de ánima, que es lo que se busca.
Cambiar sigue siendo gratis y no gasta el turno. Sin ánima no hay maná; Bernat no tiene. El
diseño completo, con las ideas aún por probar, está en `docs/action-points.md`.

## Estados en tiempo real

En la campaña algunos estados no duran rondas sino **segundos** (`TIMED` en `src/battle.ts`).
El reloj corre siempre durante el combate: mientras los jugadores eligen y mientras todos
actúan. Solo lo paran el menú de pausa, la entrada del combate, los momentos de historia (el
despertar de Matemágico) y el final. `runClock` lo avanza cada fotograma desde
`src/battle-ui.ts`; cada pulso se ve como un número de daño y un destello en el combatiente, y
puede terminar el combate por sí solo.

**Escalar.** El mismo elemento que llega mientras el estado sigue activo lo sube un nivel, hasta
el último, y reinicia su reloj (`inflict`). Al apagarse desaparece entero. Cada nivel multiplica
el pulso base (×1, ×3, ×5 para Quemado), elegido para que mantenerlo siempre rinda más que
dejarlo apagarse y volver a empezar: subir a II exige que un pulso de II valga más del doble que
uno de I, y subir a III que valga más que uno de II y uno de I juntos. Una prueba lo comprueba
para cualquier PV y cualquier momento de reaplicación.

**El daño: fijo y proporcional con tope.** Un pulso es `nivel × (fijo + parte × min(PV máx., tope))`
(`pulseDamage`). Solo porcentual escalaría igual contra un jefe que contra un perro y el fuego
sería la mejor respuesta a todo jefe; solo fijo dejaría de importar con enemigos más grandes. La
parte proporcional cuenta los PV solo hasta el tope, así que una criatura pequeña nota el
porcentaje y un jefe recibe sobre todo la parte fija: el mismo nivel le quita una fracción mucho
menor. Quemado: 1 PV fijo más el 1 % hasta 100 PV, cada 2 s durante 10 s.

| Quemado | Pulso (perro, 54 PV) | Total en 10 s | Pulso (un enemigo de 260 PV) | Total en 10 s |
| --- | --- | --- | --- | --- |
| I | 2 | 10 (19 %) | 2 | 10 (4 %) |
| II | 5 | 25 (46 %) | 6 | 30 (12 %) |
| III | 8 | 40 (74 %) | 10 | 50 (19 %) |

Un turno de acción dura alrededor de 1,2 s de animación, así que una ronda con dos aliados y
dos o tres enemigos ronda los 6–10 s con la elección: 10 s obligan a volver a prender en la
ronda siguiente sin pensarlo mucho, o a que el otro jugador avive el fuego en la misma ronda.

**Leerlo.** Sobre el combatiente, cada estado es un icono con sus cargas o su nivel; uno
temporizado lleva además un reloj: un anillo que se vacía en el sentido de las agujas tras una
aguja que gira. En la escena arde su propio cuerpo, sea el que sea, y el fuego se extiende por él con el
nivel: I unas manchas y llamitas, II casi todo, III envuelto entero (`docs/graphics.md`; `just
screenshots burning --gpu --scale 2`).

**Se ve al caer.** Las reglas resuelven la acción al elegirla, pero la pantalla la enseña al
aterrizar (`holdBack` en `src/battle-ui.ts`): hasta su primer golpe, barras, iconos y cifras siguen
como estaban; una ráfaga baja la barra golpe a golpe, y un fuego prende con el golpe que lo trae, con su
reloj empezando ahí. En *Zarpazos de fuego* cada zarpazo tira su propia suerte (tres de cada cuatro
prenden o suben el fuego) y la tirada se ve, se oye y arde en ese zarpazo, nunca antes. `just screenshots
golpes --gpu` lo enseña.

**Reacciones entre elementos** (2026-11-05, `react` y `REACTION_RULES` en `src/battle.ts`). El
*Atacar* de Matemágico puede llevar un elemento, comprado con ecos de luz (`docs/animas/README.md` §
Ecos de luz) y elegido con X (el botón superior del mando; `cycleElement`) sobre el bloque de
Atacar, dividido en un segmento por elemento. Hace el mismo daño, no gasta nada y **no crea ningún
estado**: no quema, no moja (el Atacar de Matemágico se lanza desde donde está, con elemento o sin él:
`BattleEffect.spell`, `docs/animas/matemagico/README.md` § Casting). Solo transforma lo que el enemigo ya lleva, lo haya puesto quien lo haya
puesto, y nunca sobre un enemigo al que el propio golpe ha tumbado.

| Atacar con | Sobre | Reacción | Qué hace |
| --- | --- | --- | --- |
| Agua | Quemado | **Humo** | Apaga el fuego y deja Cegado a su nivel: sus golpes, al 70 / 50 / 30 %, 10 s |
| Fuego | Sangrado | **Cauterizado** | El golpe no abre la herida: cada carga arde de golpe, 6 PV cada una |
| Eléctrico | Cegado | **Tormenta** | La descarga salta por el humo: magia (24) a todos los cegados, y se acaba el humo |

Cegado no pulsa (`levels` vacío en `TIMED`). Cauterizado, como Sangrado y Quemado, pasa por encima de
las reglas de los miedos; Tormenta es magia y las respeta (`fearDamage`). Las reacciones que aún no
se pueden dar (Mojado, Envenenado, Congelado: nadie los pone todavía) esperan su aspecto ya hecho
en `REACTIONS` (`src/status-fx.ts`). La pantalla: el número del golpe lleva el elemento debajo, la
reacción lo dice en su color y sus PV salen al lado; la escena suelta un destello del elemento
(`statusFx.touch`) y su momento (`statusFx.react`) al caer el golpe. `just screenshots elementos --gpu`.

`just screenshots quemado --gpu` muestra Quemado I, un pulso, el reloj casi agotado y Quemado II.

**Los de Tecnópata** (2026-11-06, `docs/animas/tecnopata/`). *Sanación* (Rayo de sanación) es la
otra cara de Quemado: sus pulsos devuelven PV en vez de quitarlos (`TimedSpec.heal`), 15 s, uno cada
3 s, y vuelve a subir de nivel si se repite. *Confusión* (30 s) no hace daño: mientras dura, el
enemigo gasta su turno en un golpe normal a uno de los suyos (`CONFUSED_BLOW`, a sí mismo si está
solo) y olvida lo que había anunciado (`confusedAct`). *Encogido* (Rayo encogedor, 15 s) le quita
un 25 % de la Defensa que tenga mientras dura (`TimedSpec.cut`, en `current` y `statShifts`) y la
escena lo encoge. *Rayo de energía* alarga 5 s lo que el enemigo lleve con reloj, nunca una cura; el anillo
del reloj se mide entonces contra lo que le queda. Un estado puede además acabar con la ronda
(`Timed.until`): el *Cegado* de Explosión dura hasta que acaba el turno de los enemigos.
**Perder un turno** (`Combatant.out`): tras Explosión, Aitor no actúa la ronda siguiente (ya cuenta
como `spent` al empezarla) y Bip vuelve a formarse al acabar; si nadie del grupo puede elegir, los
enemigos vuelven a actuar. `just screenshots tecnopata-skills --gpu` lo muestra todo.

## Atributos arriba o abajo, y el resumen

Lo que sube o baja los atributos de alguien **ahora mismo** lo dice `statShifts` (`src/battle.ts`),
atributo por atributo y sumando sus causas: una mejora del grupo mientras dura (*Yuki se esconde*,
*Análisis Parálisis*), un estado que debilita por sus cargas (*Mareo*, *Llorera*), la marca de
*Ángulo exacto* en un enemigo (*▼ DEF ESP*), *Punto débil* (una bajada de Defensa sin número) y una
cebolla sin capas (su defensa rota, sin número). Cada uno lleva cuánto le queda (la más larga de sus
causas) y de dónde viene. Quien cae no muestra nada.

**Leerlo.** Mientras dura, de la cabeza del combatiente salen partículas de energía muy pequeñas
pero brillantes (`src/stat-motes.ts`, docs/graphics.md § Stats going up or down): azules que suben
si sube; rojas que caen si baja; las dos a la vez si hay de las dos cosas. Empiezan cuando pasan los
cheurones del cambio y paran al terminarse. Sobre su cabeza los estados van primero, como
iconos (si hay varios, más juntos y algo más pequeños, en una sola fila); los atributos son
secundarios y van aparte, bajo las barras, en pequeño: «▲ DEF», «▼ FUE MAG».

**El resumen.** La cruceta a izquierda o derecha (R en el teclado) abre un resumen del combate: la ronda, de quién
es el turno y cada bando, con PV (en números el grupo, en barra los enemigos), maná, estados con
lo que les queda, las reglas de los miedos (capas, plato, cuenta atrás, transparente, lo que han
anunciado) y los atributos arriba o
abajo con su causa y sus rondas. Cualquiera de los dos jugadores lo abre en cualquier momento, el
combate sigue debajo y se cierra igual, o con Volver. La pista de su tecla está junto a la ronda
hasta que se usa una vez.

**Joystick y cruceta.** En combate los menús se recorren con la cruceta arriba y abajo o con el
joystick (y las flechas en el teclado). Los lados de la cruceta quedan aparte para el resumen
(`readController` con `apart`, `src/controller.ts`), así que Habilidad y Dual se abren con Confirmar
o el joystick a la derecha, y se cierran con Volver o el joystick a la izquierda. Fuera del combate,
y en el menú de pausa, la cruceta sigue moviendo en las cuatro direcciones. Un mando con asignación
propia tiene una de las dos cosas, así que no aparta nada.

`just screenshots stat-motes --gpu` muestra las partículas subiendo, los dos a la vez, un enemigo con
cuatro estados y el resumen con el teclado y con el mando.

## Habilidades de los miedos

En la torre de Uri cada acción de un enemigo **es una habilidad** (`FOE_ABILITIES` en `src/battle.ts`,
`BattleEffect.ability`), pero **el combate nunca muestra su nombre** al usarla: ni una etiqueta sobre
el enemigo ni bajo el número del golpe. Lo que hace se ve en la escena. La que no es un golpe sin
más (`card`) se deja ver un momento antes de seguir (`BEAT.ability`); un golpe sencillo (*Peso*,
*Salpicón*, *Atravesar*, *Pisotón*, *Manotazo*) no espera, para no frenar los combates de varios.

- **Anunciar.** Lo que un enemigo prepara para su turno siguiente llega como `telegraph` y queda en
  su `intent`: una ficha en su placa, junto a *Capas n* y el plato, que **dice a quién mira**
  (*Carrerilla → Aitor*, *Vacío*, *Ojo · 3*, *Nil · 2*). En estos combates los objetivos salen del
  orden de turno, así que el nombre es exacto. La respuesta está en la ronda del grupo: Defender
  quien es el objetivo, o quitarle al enemigo lo que lo hace posible.
- **Perder el turno.** Una acción puede gastar el turno del enemigo en otra cosa (*Capa nueva*,
  *Darle la vuelta*).
- **Por tipo, nunca por ánima.** Las reglas de los miedos miran el golpe (físico, mágico, dual), si
  es golpe o pulso, y las capas; ninguna mira quién lleva qué. Sangrado y Quemado pasan por encima
  de todas ellas.
- **Partes.** Un enemigo puede tener una parte que se ataca aparte (`part`; el ojo de Vertitrón): sus
  propios PV, sin turnos, sin experiencia, y nunca bloquea la victoria. Romperla puede quitarle un
  ataque al enemigo.
- **Para siempre.** Un cambio de atributos puede durar todo el combate (`Combatant.lasting`; el
  *Grito liberador* de Vertitrón): sin rondas, y cada vez se suma.
- **Noticias.** Lo que cambia fuera de una acción (el ojo de Vertitrón que rompe un pulso de fuego o
  el Sangrado) queda en `takeNews`, que la pantalla lee tras `runClock` y `nextRound`.

Las de cada miedo y las de Vertitrón están en `docs/quests/nuria.md` § Monsters y §
Final boss.

## Ataques duales

Dos habilidades de dos ánimas, cada una elegida por quien la lleva, se hacen una sola acción
(`DUALS`, `actDual`; el diseño en `docs/animas/README.md` § Combined skills). Hoy dos, de Matemágico
y Papagato: *Zarpazos de fuego* (Foc Binari + Zarpazos) y *Punto débil* (Ángulo exacto + Zarpazo de
Haru).

**Cuándo puede ocurrir** (`dualBlock`, por orden): las dos mitades aprendidas (`level`), ese dual
sin usar aún en este combate (`used`: cada uno sale **una vez por combate**, `usedDuals`), cada uno
con el ánima de su mitad puesta (`wear`), el compañero en pie (`down`), después en el orden de
esta ronda y sin haber actuado (`acted`), maná de cada mitad en el ánima de quien la paga (`mana`)
y un enemigo al que apuntar (`target`). Solo quien actúa **antes** completa un dual.

**El turno: es una sorpresa.** En la lista de habilidades no brilla nada, no hay marcas de pareja
ni una pose de carga: el dual se descubre al elegir la habilidad que lo completa, cuando su cartel
sube mientras se apunta.

1. Con dos jugadores, mientras uno elige, el que actúa después en la ronda puede **adelantar** su
   elección en su propia mitad de la pantalla: Atacar, Habilidad o Defender, con objetivo
   (`queue`); sin Huir ni cambio de ánima. Su placa dice entonces qué ha preparado, y puede
   cambiarlo o anularlo hasta su turno.
2. Al elegir el primero una habilidad que, con la del compañero, es un dual posible ahora
   (`queuedDual`), el selector de objetivo se abre con el cartel del dual ya arriba (*armado*, ver
   abajo); volver atrás, o que el compañero quite lo suyo, lo baja.
   Al confirmar (`commit`), sale el dual. Apunta adonde apuntaba el que confirma, si
   su habilidad apunta; si no, adonde apuntaba el compañero; si no, al primer enemigo en pie. El
   compañero queda gastado esa ronda (`spent`). Si no, `act` como siempre, y lo adelantado sigue.
3. Al llegar el turno del compañero, lo adelantado se juega solo si aún vale (`takeQueued`: objetivo
   en pie, maná, habilidad puesta, mejora sin correr), tras un destello de su placa (`BEAT.queue`).
   Si ya no vale, se borra y elige de nuevo.
4. Al pasar el turno a los enemigos, o al acabar el combate, no queda nada adelantado ni gastado.

**Qué hace.** Gasta los dos turnos y la mitad de maná de cada uno; las dos ánimas cuentan como que
han luchado. Su golpe usa los atributos de quien trae la mitad de su tipo (los dos de hoy son
físicos: la Fuerza de quien lleva Papagato) y desgasta el Sangrado como cualquier golpe físico.
Contra las reglas de un enemigo cuenta como **todos los tipos** (`fearDamage` con `'dual'`): el
mejor lado de un plato, entero a través de *Transparente* y en el plato sorpresa. El fuego de *Zarpazos de fuego* se decide golpe a golpe con los
dados del combate (`roll`, mulberry32 sobre `state.seed`, sembrado con el `random` con que se creó),
nunca sobre una capa: así el simulador lo repite igual.

**Punto débil.** Deja en el enemigo una marca (`Combatant.weakSpot`, `WEAK_SPOT = 3`): la siguiente
acción que le quite PV, de quien sea y del tipo que sea, multiplica por tres cada uno de sus golpes
y la gasta (`BattleEffect.weakSpot`, `hits[].weakSpot`). Otro *Punto débil* sobre una marca viva la gasta y deja una nueva (`'renewed'`; se lee
con `markSpent` y `markLeft`). Si nadie la usa, se apaga al final de la ronda siguiente
(`weakSpotRounds`). Los pulsos de Quemado y el Sangrado no la usan ni la gastan.


**El cartel, el cine y la cámara lenta** (`armDualBanner`, `showDualBanner`, `effect.dual`;
`src/battle-motion.ts`). Es el único sitio, fuera del modo de desarrollo, donde se ven el coste
conjunto y la descripción:

- **armado**, mientras se apunta: sube entero, sus dos mitades entran cada una por su lado y chocan
  en el centro con un destello en la junta, un brillo cruza el nombre y su borde dorado respira hasta
  confirmar; suena `dual-armed` (dos notas que se juntan en una). Sin cámara lenta: aún no ha pasado;
- **al confirmar**, estalla donde estaba: el nombre da un golpe hacia fuera, el brillo vuelve a
  cruzarlo y las mitades destellan; bandas negras de cine cierran arriba y abajo (por debajo del resto
  del HUD), un destello dorado entra desde los bordes y unos rayos se abren detrás del nombre
  (`.dual-cinema`, solo opacidad y transformaciones). Las bandas se van con el cartel;
- arriba en el centro: *ATAQUE DUAL*, el nombre, quién pone qué mitad (*Gerard · Foc Binari + Aitor ·
  Zarpazos*), el maná de las dos mitades con el nombre de cada uno, y la descripción; sin teclas, en
  dorado, naranja y crema (nunca violeta ni rosa); leído, se queda solo con el nombre, para que se
  vea el resto del movimiento y lo alto de un enemigo grande (antes si ya se leyó armado);
- un parón de golpe (`DUAL_FREEZE`, 0,12 s), y la escena y el reloj del combate a ×0,35 (`DUAL_SLOW`)
  mientras está el cartel (`DUAL_BANNER`, 1 s; `DUAL_BANNER_SEEN`, 0,35 s si ya se vio ese dual), de
  vuelta a ×1 en 0,25 s (`DUAL_EASE`); después su coreografía, unos 1,9 s (`DUAL_SECONDS`), con un
  parón por impacto y el último más largo; ya vista, su preparación y su final son más cortos, y la
  pausa de después también (`BEAT.dualSeen`). El reloj del combate (Quemado, estados) va a la
  velocidad de la escena, con todas sus cámaras lentas. En total cuenta 2,4 s de reloj (`DUAL_CLOCK`);
- con *movimiento reducido* no hay coreografía ni animaciones del cartel: el dual se resuelve al
  momento (las bandas aparecen sin deslizarse);
- sus partículas, solo en la GPU; sus sonidos, los de sus dos mitades (`dualSounds`).

**En dos tiempos** (`DualSpec.charge`, Rayo solar). Su turno solo carga: quien trae su primera
mitad lo guarda (`Combatant.charge`, Bip se pone amarillo sol) y se gastan los dos turnos y el maná.
Al empezar la ronda siguiente, antes de que nadie elija, sale solo (`nextRound` → `release`, como
noticia que la pantalla muestra en cuanto cierra la ronda): barre a todos los enemigos con el daño
de quien trae la mitad de su tipo y les deja Quemado II como mínimo. Si quien lo guarda cae antes,
se pierde.

**Desarrollo.** Con `import.meta.env.DEV` el menú es Atacar · Habilidad · Dual · Defender · Huir:
*Dual* abre la lista de todos (`dualOptions`), con sus mitades, su maná y su descripción, y los que
no se pueden, con el motivo (`DualBlock`; *Ya usado en este combate* tras salir); elegir uno pone
antes el ánima necesaria si está libre y pide objetivo, con su cartel ya armado. Fuera de desarrollo el menú es Atacar · Habilidad · Defender · Huir: la opción
desconocida (*?????*) ya no existe. `docs/dev-tools.md` § Combate.

## Ejecutar el laboratorio

```sh
just combat-lab
just combat-sim --runs 500 --seed 35 --compare
just combat-sim --runs 500 --seed 35 --policy tactical --enemy-policy tactical --enemy-hp 1.2 --enemy-power 1.1 --out /tmp/combat-report.json
just combat-check
just combat-browser-check
just build
just combat-browser-check --build
just screenshots combat-lab
```

El laboratorio de escritorio se abre en `/combat-lab.html`. El escenario inicial está en
`src/combat/fixtures.ts`; es un banco sintético de tres contra tres para ejercitar el motor.
`src/combat/simulator.ts` ejecuta las políticas y calcula los resultados, y
`scripts/combat-sim.mjs` ofrece la misma simulación desde terminal. La herramienta no necesita
el renderizador 3D ni una partida guardada.

La semilla indicada corresponde a la primera corrida. `--runs` admite entre 1 y 10 000
corridas; `--enemy-hp` y `--enemy-power` admiten factores entre 0,1 y 10; `--max-rounds`
admite entre 1 y 500. `--help` enumera las opciones. Para comprobar una modificación de reglas,
ejecutar también `just check`: las pruebas de campaña comprueban que sus escenas y acciones
siguen funcionando.

Las políticas disponibles son `basic`, `random` y `tactical`. La básica prioriza ataques
gratuitos de daño directo y espera si no dispone de ellos; la aleatoria elige entre comandos
legales, incluida la espera. La táctica puntúa un paso: daño, remates, afinidades, urgencia de
curación, estados y escasez de recursos. No busca varios turnos por delante ni interpreta
manejadores personalizados. Son puntos de comparación editables en el simulador. Una
mecánica nueva puede necesitar una valoración nueva para que su política la aproveche.

`--enemy-power` modifica sólo los efectos de daño directo declarados en acciones enemigas.
Conserva el daño periódico y las reacciones del contenido: la interfaz lo llama «Daño directo
rival ×». No representa un multiplicador universal sobre todo lo que hace el equipo rival.
El consumo de recursos registra gasto bruto del grupo, separado por recurso y excluyendo PV;
recuperar un recurso no borra el gasto anterior.

## Dificultad: decisiones que importan

El objetivo es que la preparación, el orden de acciones, el uso de recursos y las respuestas
a estados cambien el resultado. Aumentar todos los PV sólo alarga los combates; aumentar todo
el daño puede eliminar decisiones. El laboratorio permite variar ambos por separado y
comparar políticas con las mismas semillas.

Un procedimiento útil para un encuentro nuevo:

1. Definir qué decisiones debería premiar, cuánto debería durar y qué recursos debería
   consumir. Registrar estas metas junto al encuentro, sin convertirlas en un panel de
   objetivos dentro de la aventura.
2. Comparar una política básica, una aleatoria y una táctica con las mismas semillas y el
   mismo contenido. Un encuentro exigente debería castigar decisiones pobres sin volver
   inútiles las buenas decisiones.
3. Revisar derrotas, empates, duración, bajas y recursos, además del porcentaje de victorias.
   Una victoria con todos los recursos y otra al límite no representan la misma presión.
4. Inspeccionar las repeticiones de casos extremos. Un bloqueo, una reacción repetitiva o una
   capacidad que nunca se usa puede revelar un problema de reglas o de la política.
5. Probar con personas en el juego. Las políticas automáticas son heurísticas; sus resultados
   no son una medición directa de la dificultad humana.

No se prescribe todavía un porcentaje de victorias universal. Depende del lugar del
encuentro, la información que el mundo ofrece, las opciones del grupo y el coste de perder.
Los combates con condiciones guionizadas deben analizarse por separado.

## Leer los resultados

El denominador de victorias, derrotas y empates incluye todas las simulaciones. Los empates
por límite de rondas no cuentan como victorias; conviene investigar su motivo. El intervalo
de Wilson del 95 % acompaña al porcentaje de victorias para evitar extraer conclusiones de
muestras pequeñas. Es una estimación sobre las semillas y políticas ejecutadas, no una
garantía sobre jugadores reales.

Cambiar una sola variable permite atribuir el efecto: PV enemigos, potencia, costes,
duraciones, acciones disponibles o política. Mantener la semilla y la configuración permite
reproducir una corrida; comparar políticas con el mismo conjunto de semillas reduce ruido,
aunque cada política puede consumir la secuencia aleatoria de forma distinta.

Los informes exportados deben conservar la configuración, las semillas, el contenido del
encuentro, los resultados por corrida y una repetición de muestra. Para reproducirlos en el
futuro también hay que conservar la versión del código y las reglas: una semilla sola no
fija el resultado si cambia el motor.

El encuentro incluido en el informe ya contiene los multiplicadores aplicados. Al repetir
esa instantánea se usa directamente: no se deben volver a aplicar los mismos factores.

## Límites deliberados

- No se define una taxonomía definitiva de clases o elementos.
- No se añade un registro de misiones, una lista de acciones pendientes ni ayudas de ruta a
  la aventura. El laboratorio es una herramienta de desarrollo.
- El equilibrio del escenario de prueba no sustituye al equilibrio de la campaña.
- La compatibilidad de partidas guardadas y la migración completa de los combates actuales
  necesitan un trabajo explícito cuando se adopten nuevas reglas en la aventura.
