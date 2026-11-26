## Por qué no se sostuvo Q.E.D.

Q.E.D. quería que cada elemento de Gerard dejara su estado en cada enemigo, y eso se rompe con sus propias reglas. El fuego y el agua se anulan: agua sobre algo que arde da Humo, y fuego sobre algo mojado da Vapor. El segundo golpe borra lo que dejó el primero, así que «cada elemento deja su estado» acaba dejando casi nada. La electricidad no tiene estado propio: Shock y Conducción solo existen cuando hay agua, y por su cuenta no deja nada. El arreglo («a cada enemigo, el elemento que reacciona con lo que lleva, después de tres reacciones distintas») tenía dos problemas. Convertía la definitiva en un juego de emparejar colores. Y su condición era contar sucesos a lo largo del combate, no algo que se ve en el campo. Además, contar reacciones ya lo hacen otras piezas: Toma de tierra da maná por reacción, Objeto encontrado da un dado por reacción y Fin de fiesta despierta con las reacciones del polvo. Las tres opciones de abajo no cuentan reacciones ni reparten elementos. Son tres maneras de ver lo mismo, la responsabilidad: **hacerlo todo (y pagarlo), pasárselo al otro, o parar**.

Para las tres vale lo mismo: no hay línea en el tarro que diga la condición (se borra, como pediste), se usa una vez por combate y sin maná, despierta con «Definitiva · despierta» y la fila dormida de la placa enseña n/N.

---

## 1. Horas extra (línea de Fuego)

**La idea:** Gerard lo hace todo a la vez: actúa tres veces seguidas sin maná y después se queda agotado.

**Qué la despierta:** todos los enemigos en pie arden a la vez en Quemado III o más, mientras alguien en pie lleva Matemágico.
- Es la línea de Fuego («apila») llevada al final sobre todo el campo. Se ve en el número romano de cada placa.
- La fila dormida enseña n/N: enemigos en III frente a enemigos en pie.
- Contra un jefe solo basta con el III en él, o en todas sus partes visibles.
- Arreglo a «es dura contra grupos grandes»: Pirámide ígnea hace que el tamaño del grupo no importe. Basta llevar a uno a III con tres Foc Binari y lanzar Pirámide, que iguala la fila. Vulcano y Campana de Gauss son otros caminos.
- Que caiga un enemigo no la rompe, porque cuentan solo los que siguen en pie. Lo que sí la rompe es el agua del compañero. Esa tensión es buena y se habla entre los dos.

**Qué hace:**
- Quien la usa actúa enseguida tres veces seguidas, y ninguna de las tres gasta maná.
- Las tres pueden ser cualquier cosa menos una definitiva o un dúo, y se puede cambiar de ánima entre ellas.
- Después queda **Agotado durante 1 ronda**, la siguiente. Solo puede Atacar (con su elemento) o Defender, y Defender no le devuelve maná. Lo marca un icono continuo en la placa.
- Libro: `HORAS_EXTRA = { actions: 3, spent: 1 }`, con `spent` entre 1 y 2 según fight-sim.
- Arreglo a «se lee como un castigo»: el precio baja de 2 rondas a 1. Así es claramente un premio con factura, y no al revés.

**Descripción** (`abstract: true`): «Quien la usa actúa tres veces seguidas sin gastar maná. Después queda agotado: durante una ronda solo puede atacar o defender.»

**Qué cambia en cómo se juega:**
- **Antes de despertar:** el fuego deja de ir todo a un enemigo. Hay que repartirlo y sostenerlo, y no se puede mojar a nadie que arde.
- **Rescoldo** tiene por fin un trabajo claro: sus 15 s, frente a 10, son el margen para tener a todos en III a la vez.
- **Después:** la decisión es cuándo quemarse.
  - Tres acciones gratis pagan lo caro: Integral impropia, Resonancia sobre un congelado, Foc Binari a IV y luego Atacar físico para que estalle Combustión.
  - También pueden rematar una fase.
  - Pero la ronda siguiente el compañero tiene que cubrirle. Usarla al final de una fase es seguro; en mitad de la pelea, contra un jefe que va a por el más débil, es una apuesta.
- **Va en contra:** Atractor extraño, que junta los fuegos en uno y deja limpios a los demás, y Electrólisis o Superficie mínima, que mojan. Las dos cosas se ven en las placas.

**Qué dice de Gerard:** es «Lo calcula todo. Hasta lo que no hace falta.» llevado a su final. Puede con todo a la vez, y lo paga. Es la crítica del juego dicha en una regla, sin moraleja: no castiga trabajar, cobra el no parar. Usarla bien es saber cuándo merece la pena y tener a alguien al lado para la ronda de después.

**Cómo se ve** (contacto unos 2,2 s más las acciones). Técnica nueva: cronofotografía de neón, como las fotos de Marey.
1. **0–0,5 s:** el anillo de unos y ceros acelera hasta fundirse en una banda de oro sólida, con un zumbido que sube.
2. **Cada una de las tres acciones** sale con su animación de siempre. Al empezar cada una, se queda en el sitio una copia congelada de Gerard en esa pose: una nube densa de puntos de oro tomada de `surface-samples` en ese fotograma, no un contorno de tubo, como pidieron los jueces. A la tercera hay tres Gerards de luz en abanico.
3. **Mientras tanto,** la banda del anillo se recalienta: de oro a blanco y de blanco a un naranja sucio.
4. **Al acabar,** las copias pasan de una en una de oro a gris ceniza y se deshacen en dígitos que caen al suelo. El anillo se para y queda a sus pies como ceros fríos. Durante la ronda de Agotado vuelve dígito a dígito, y en la placa hay un icono continuo: un lápiz gastado hasta la goma, que respira.

Nunca violeta ni rosa.

**Coste: M.**
- **Reglas:** hace falta la infraestructura de «actuar otra vez». Agitar ya conserva el turno, y eso es un precedente. Además, el estado Agotado (`skillsFor` deja solo Atacar y Defender, y `DEFEND_CHARGE` vale 0 mientras dura), un caso en `ultiReady`, `ultiUsed` y `ultiProgress`, y el despertar en `inflict` sobre Quemado.
- **Bot:** tiene que valorar tres acciones frente a una ronda sin habilidades.
- **TARGETS:** una pareja en un grupo de tres del tercer piso.
- **Aspecto:** M. Las copias congeladas son partículas quietas sobre las muestras de superficie, así que gastan poca CPU.

---

## 2. Te toca (línea de Cálculo)

**La idea:** Gerard deja de calcular y le pasa el bolígrafo al otro: un aliado actúa dos veces seguidas sin maná.

**Qué la despierta:** una **Serie de Fourier da sus seis golpes**, es decir, cae sobre un enemigo con cinco estados distintos en la placa, y la lanza quien lleve Matemágico.
- Es la cadena de Cálculo («poner, juntar, contar») llevada al final: ya lo ha contado todo.
- Se ve en los seis iconos de la placa y en los seis números.
- La fila dormida enseña n/6: los golpes que daría Fourier sobre la placa más llena.
- Arreglo a «despierta pronto y fácil»: la condición anterior (▲ en el aliado, ▼ en el enemigo y un golpe) se conseguía en dos acciones. Llenar una placa pide a los dos jugadores, porque Gerard solo no llega a cinco estados (fuego y agua se anulan). Atractor extraño es el camino de Cálculo para juntarlos.
- Si cuesta demasiado, el umbral baja a cinco golpes con `levers`.

**Qué hace:**
- Ocupa el turno de quien la usa.
- Elige a un aliado en pie que no sea él. Ese aliado actúa enseguida, fuera de orden, dos veces seguidas y sin gastar maná.
- Las dos acciones pueden ser cualquier cosa de su ánima menos una definitiva o un dúo, y puede cambiar de ánima entre ellas.
- Si aún no había actuado en esa ronda, conserva también su turno normal.
- Libro: `TE_TOCA = { actions: 2 }`.
- Arreglo a «la ganancia neta es solo +1»: lo que gana de verdad es maná, porque son dos grado III gratis, hasta 6 de maná. La pareja de TARGETS tiene que medir al menos una ronda menos. Si no llega, `actions` sube a 3.

**Descripción** (`abstract: true`): «Quien la usa deja de calcular. Un aliado actúa ahora dos veces seguidas sin gastar maná.»

**Qué cambia en cómo se juega:**
- **Antes de despertar:** los dos construyen una placa entre los dos. Cada uno pone lo suyo (Sangrado, Bomba, Polvo, Ángulo, fuego), Atractor lo junta y Fourier lo cuenta.
- **Después:** la decisión es cuándo y a quién pasar el turno:
  - enseguida, para cobrar dos veces la placa llena;
  - más tarde, cuando dos acciones gratis del compañero despierten su propia definitiva (dos aguas de Freática llevan a la tercera marca y Bajo cero despierta en el acto; dos Zarpazos llevan la herida a cinco y despierta Siete vidas);
  - a quién, si hay un tercero en el equipo.
- **El precio:** Gerard renuncia a su daño de ese turno.
- Es distinta de Da capo, que devuelve dúos y maná a los dos: esta da acciones, y a uno solo.

**Qué dice de Gerard:** el hombre que lo calcula todo hace lo más exacto que puede hacer, que es dejar que lo haga otro. A los 35 es profesor y secretario de la escuela, y todo pasa por sus manos. No es renunciar a la responsabilidad, es repartirla. Casi siempre el otro es el otro jugador, Aitor.

**Cómo se ve** (contacto 2,0 s). Técnica nueva: construcción con regla y compás en neón.
1. **0–0,4 s:** su círculo se abre pero no forma ninguna figura. Por primera vez, el anillo de unos y ceros deja de girar y los dígitos se quedan quietos en el aire.
2. **0,4–0,9 s:** un Gerard de luz (nube densa de puntos de oro desde `surface-samples`) se despega de él y da un paso atrás. El Gerard de verdad se queda en penumbra.
3. **0,9–1,5 s:** la pluma de luz cruza en arco hasta el aliado. Desde sus pies, un brazo de compás barre arcos completos hacia la fila enemiga, y cada intersección estalla en una cuenta de oro. Son arcos genéricos, no adivinan jugadas.
4. **1,5–2,0 s:** la pluma se posa en la mano del aliado. En su placa aparece un icono continuo, una plumilla con ×2.
5. **Arreglo a «el premio no se ve»:** en cada una de sus dos acciones, al elegir objetivo, la pluma traza primero una recta de oro del aliado a ese objetivo, que toma el color de su ánima justo antes del golpe. Al gastarse la segunda, la pluma vuelve como un cero y el anillo de Gerard vuelve a girar.

Nunca violeta ni rosa.

**Coste: M.**
- **Reglas:** la misma infraestructura de acciones extra que Horas extra (`state.extra = { id, left: 2, free: true }`), el objetivo filtrado a otro aliado, y que `battle-ui` reabra el menú de ese aliado.
- **Despertar:** en la resolución de Fourier.
- **Bot:** tiene que valorar dos acciones del aliado.
- **Dependencias:** necesita Fourier y Atractor mergeados.
- **Aspecto:** S–M (son tubos que se revelan, como en `math-figures.ts`).

---

## 3. Por cero (línea de Cálculo, la otra cara)

**La idea:** cualquier cosa multiplicada por cero es cero. Durante dos rondas, las defensas de todos los enemigos valen nada y el tiempo se para para ellos. Solo cuentan los golpes.

**Qué la despierta:** todos los enemigos en pie llevan a la vez una bajada (▼), mientras alguien en pie lleva Matemágico.
- Es Ángulo exacto («prepara») llevado a todo el campo, igual que Horas extra lleva el fuego a todos.
- Cuenta cualquier ▼, la ponga quien la ponga: Ángulo, Mareo, Encogido.
- Se ve en las flechas de cada placa (`statShifts`). La fila dormida enseña n/N.
- Contra un enemigo solo hace falta su ▼ y, además, un ▲ en todo el equipo (Análisis Parálisis). Así no basta con 1 maná.

**Qué hace,** durante esta ronda y la siguiente (`ZERO = { rounds: 2 }`), a todos los enemigos en pie:
- **Defensa y Espíritu valen 0.** Con una Defensa media de 10 contra golpes de 16 a 26, cada golpe entra con unos +10, que en golpes pequeños es casi el doble.
- **Sus estados con reloj se paran:** ni pulsan ni se gastan. El fuego no quema y la bomba no corre, pero todo sigue puesto. Envenenado sigue dando ×1,25 a cada golpe, las esquirlas de Cristalizado siguen ahí, Combustión IV espera su golpe físico y el hielo no se derrite.
- **Arreglo a «borra la respuesta del jefe»:** las resistencias y las debilidades **no se tocan**, ni las capas (el pringue), ni el reparto entre las partes de un jefe. Vertitrón sigue resistiendo lo eléctrico.
- Ángulo exacto no suma nada mientras dura, porque nada baja de 0.

**Descripción** (forma fija, sin `abstract`): «Baja Defensa y Espíritu de todos los enemigos durante 2 rondas. Bajan hasta cero, y sus estados con reloj se paran mientras tanto.»

**Qué cambia en cómo se juega:**
- **Arreglo a «es solo un Ángulo gigante»:** al parar los relojes, deja de ser solo un multiplicador y obliga a cambiar de juego.
  - Durante dos rondas el daño de los relojes vale cero y el número de golpes lo vale todo, porque cada golpe recupera la defensa entera. Ganan Serie de Fourier (hasta 6), Zarpazos, los dados de la Campana, los latidos de Corriente alterna y cada salto de Conducción.
  - Lo que estaba quemando se queda esperando.
- **Antes de lanzarla:** la pregunta es qué se quiere congelado en el tiempo. Un hielo de Bajo cero recién puesto (no se derrite y la rotura sale máxima), un IV de Combustión listo para estallar o un veneno que amplifica. Frente a eso, cuánto daño de reloj se pierde.
- El giro se ve en los números, que de pronto son el doble.

**Qué dice de Gerard:** su fuego siempre han sido los unos: hacer, calcular, cumplir. El cero es lo que nunca se permite, que es parar. La definitiva dice que el cero es el número más fuerte: deja en nada las corazas, y por un momento el reloj deja de correr. Es la crítica del juego a la rutina como armadura, dicha en su propio idioma.

**Cómo se ve:**
1. **0–0,4 s:** el anillo de Gerard gira más deprisa. Los unos se apagan y solo quedan encendidos los ceros.
2. **0,4–0,9 s:** el bolígrafo escribe «× 0» enorme en el aire. El cero se suelta y crece hasta ser un aro de oro con partículas que corren por dentro, como en un acelerador.
3. **0,9–1,5 s:** técnica nueva, la piel de ceros. El aro rodea la fila y baja sobre ella. La superficie de cada enemigo se cubre de miles de ceros diminutos: glifos SDF orientados a la normal sobre `surface-samples`. Luego se pelan con ruido de rizo y caen. Debajo, el enemigo queda en luz cruda, sin brillo.
4. **Durante 2 rondas:**
   - un anillo fino gira a los pies de cada enemigo;
   - sus partículas de estado (llamas, humo, gotas) se quedan **quietas en el aire**, congeladas en su fotograma;
   - en la placa hay un icono 0 que respira;
   - cada golpe suelta un pequeño destello de ceros.
5. **Fin:** los anillos se cierran en un punto, las partículas vuelven a moverse y los unos se encienden otra vez.

Oro, negro y blanco; nunca violeta ni rosa.

**Coste: M.**
- **Reglas: S.**
  - Una marca `zeroed` que `current` lee como Defensa y Espíritu a 0.
  - `runClock` se salta a esos enemigos mientras dura.
  - El despertar, después de cada cambio de `statShifts`.
  - Casos en `ultiReady`, `ultiUsed` y `ultiProgress`.
- **Bot:** golpes previstos por la defensa media, y preferir ráfagas mientras dura.
- **Aspecto: M.**
  - Un glifo SDF nuevo y el aro, que es un anillo de partículas con velocidad tangencial.
  - Congelar las partículas de estado es poner a 0 la escala de tiempo de ese ancla.
  - Los fluidos van aparte, porque comparten la rejilla de presión.

---

## Recomendación

Recomiendo **Horas extra**. Es la que mejor dice lo que el juego critica (hacerlo todo y pagarlo) en una regla que se lee sola. Su condición es la línea de Fuego llevada al final y se ve en todas las placas. Le da a Rescoldo un trabajo claro, que era lo que pedías. Con el arreglo de Agotado a una ronda, es un premio con factura y no un castigo.

**Te toca** es la alternativa si prefieres la lectura esperanzada (repartir, y el otro eres tú). Las dos dan acciones, así que solo se construye una.

**Por cero** es la más barata en reglas y la más clara en números, pero es la que menos sorprende.

Para preguntarte, si eliges Horas extra:
- ¿Agotado dura 1 ronda o 2?
- ¿Se permite un dúo entre las tres acciones?
- Contra un jefe por partes, ¿cuentan todas las partes o solo el cuerpo?