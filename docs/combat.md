# Base de combate y laboratorio de dificultad

El combate se divide en reglas, contenido y presentación. El núcleo no conoce a Gerard,
Noísta, los perros ni una lista cerrada de elementos. Una acción describe costes, objetivos y
efectos; los combatientes aportan atributos, recursos, afinidades y estados. El simulador usa
esas mismas reglas sin cargar el juego ni el navegador.

Esta entrega construye la base y un banco de pruebas. Los números y nombres mecánicos del
laboratorio son provisionales: no fijan las clases, tipos ni debilidades de la aventura.
Tampoco convierten automáticamente los combates existentes en encuentros difíciles. El
equilibrado de la campaña necesita sus encuentros y sus decisiones reales.

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

## Qué comparte hoy el juego

`src/battle.ts` sigue siendo el adaptador de la campaña: conserva los turnos del grupo y de los
enemigos, las animaciones y mensajes existentes, la huida, las ánimas de los guardianes y el
despertar de Noísta. `src/stats.ts` conserva los nombres de atributos de la campaña.

La campaña y el laboratorio comparten las primitivas de cálculo y aplicación de daño y
curación. Las reglas narrativas siguen en el adaptador: el pringue absorbe golpes, Bernat
conserva su suelo de PV durante la escena y el despertar interrumpe el turno. El laboratorio
no interpreta estas excepciones narrativas como dificultad de un encuentro ordinario.

El planificador genérico, los estados y las reacciones pertenecen al núcleo nuevo. Aún no
sustituyen el planificador de la campaña: una habilidad nueva del laboratorio no aparece por
sí sola en el menú del juego. Para migrar un encuentro hay que declarar su contenido,
traducir sus eventos a la presentación y comprobar sus condiciones narrativas. Esta frontera
permite mantener la aventura jugable mientras se amplía el sistema.

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
