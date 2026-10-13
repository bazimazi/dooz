/**
 * The lessons in Spanish. Keys, and the English they fall back to, are
 * explained in `lessonsContent.ts`.
 */
export const lessonsContentEs: Readonly<Record<string, string>> = {
  // Classic
  'classic-three-in-a-row.title': 'Gana y bloquea',
  'classic-three-in-a-row.intro':
    'Cada partida de tres en raya gira en torno a dos preguntas, en cada jugada: ¿puedo ganar ya? ¿Y puede mi rival? Busca dos en línea con la tercera casilla vacía — si son tuyas, complétala; si son suyas, bloquéala.',
  'classic-three-in-a-row.1.prompt': 'Tienes dos en línea. Complétala.',
  'classic-three-in-a-row.1.hint': 'Tu diagonal va de esquina a esquina pasando por el centro.',
  'classic-three-in-a-row.1.success': 'Tres en raya. Busca siempre primero tu propia victoria.',
  'classic-three-in-a-row.1.wrong': 'Eso no hace tres en raya — mira a lo largo de la diagonal.',
  'classic-three-in-a-row.2.prompt': 'Tu rival tiene dos en línea. Detenlo.',
  'classic-three-in-a-row.2.hint': 'Sus dos marcas bajan por la diagonal. Ocupa el extremo.',
  'classic-three-in-a-row.2.success': 'Bloqueado. Su diagonal está muerta.',
  'classic-three-in-a-row.2.wrong': 'Aún le queda una casilla que completa su diagonal.',
  'classic-three-in-a-row.3.prompt': 'Tú tienes dos en línea, y tu rival también. ¿Qué va primero?',
  'classic-three-in-a-row.3.hint':
    'Una victoria termina la partida antes de que su amenaza importe.',
  'classic-three-in-a-row.3.success':
    'Ganar va antes que bloquear — tu rival ya no tiene otra jugada.',
  'classic-three-in-a-row.3.wrong':
    'Puedes ganar en esta jugada. Aprovéchala antes de preocuparte por la suya.',
  'classic-forks.title': 'Horquillas',
  'classic-forks.intro':
    'Una horquilla es una sola jugada que crea dos amenazas a la vez. Tu rival solo puede bloquear una, así que la otra gana. Casi todas las partidas de tres en raya que no acaban en empate se deciden con una horquilla.',
  'classic-forks.1.prompt': 'Crea dos amenazas con una sola jugada.',
  'classic-forks.1.hint':
    'Busca una casilla que se alinee con dos de tus marcas en líneas distintas.',
  'classic-forks.1.success': 'Dos amenazas. Bloquee la que bloquee, la otra gana.',
  'classic-forks.1.wrong': 'Eso crea como mucho una amenaza — la bloquea y te quedas sin nada.',
  'classic-forks.2.prompt':
    'Tu rival tiene esquinas opuestas. Frena la horquilla antes de que ocurra.',
  'classic-forks.2.hint':
    'Una esquina parece lo natural, y esa es la trampa. Crea una amenaza propia desde un borde.',
  'classic-forks.2.success':
    'Un borde le obliga a responderte, y nunca consigue la jugada libre que necesita una horquilla.',
  'classic-forks.2.wrong':
    'Una esquina aquí le deja tomar la otra esquina con dos amenazas a la vez.',
  'classic-first-reply.title': 'La primera respuesta',
  'classic-first-reply.intro':
    'Clásico es empate si ambos bandos juegan bien, pero solo una respuesta a cada apertura lo mantiene así. La marca de apertura decide dónde debes responder: una esquina pide el centro; el centro pide una esquina.',
  'classic-first-reply.1.prompt':
    'Tu rival abrió en una esquina. Encuentra la única respuesta que aguanta.',
  'classic-first-reply.1.hint':
    'Cualquier otra casilla le deja una forma de hacerte una horquilla más adelante.',
  'classic-first-reply.1.success':
    'El centro. Contra una esquina es la única respuesta que empata.',
  'classic-first-reply.1.wrong':
    'Eso pierde contra un juego perfecto: una apertura en esquina exige el centro.',
  'classic-first-reply.2.prompt': 'Tu rival abrió en el centro. Responde.',
  'classic-first-reply.2.hint': 'Los bordes pierden contra el centro. Las esquinas aguantan.',
  'classic-first-reply.2.success':
    'Una esquina. Desde ahí puedes frenar cualquier horquilla que intente.',
  'classic-first-reply.2.wrong': 'Un borde contra el centro pierde sin remedio. Toma una esquina.',
  'classic-first-reply.3.prompt':
    'Tu rival abrió en un borde. Varias respuestas aguantan — encuentra una.',
  'classic-first-reply.3.hint': 'El centro, el borde opuesto o una esquina junto a su marca.',
  'classic-first-reply.3.success':
    'Eso aguanta. Una apertura en borde es la que más opciones te da.',
  'classic-first-reply.3.wrong': 'Esa pierde: le deja una horquilla dentro de dos jugadas.',

  // Grid 6
  'grid-6-open-three.title': 'Tres abiertos y tres cerrados',
  'grid-6-open-three.intro':
    'En Cuadrícula 6 necesitas cuatro en línea. Un tres con ambos extremos vacíos es abierto: puede convertirse en cuatro por cualquiera de los dos lados, así que ya son dos amenazas. Un tres con un extremo bloqueado es cerrado — una sola amenaza, fácil de frenar.',
  'grid-6-open-three.1.prompt': 'Convierte tus dos en un tres abierto.',
  'grid-6-open-three.1.hint': 'Alarga tu fila justo a su lado, dejando libres ambos extremos.',
  'grid-6-open-three.1.success':
    'Un tres abierto: el cuatro espera en ambos extremos, y tu rival solo puede cubrir uno.',
  'grid-6-open-three.1.wrong':
    'Si dejas un hueco, el tres solo tiene una forma de llegar a cuatro.',
  'grid-6-open-three.2.prompt': 'Su tres está cerrado por un extremo. Detenlo.',
  'grid-6-open-three.2.hint': 'Tu marca ya cierra un extremo. Cierra el otro.',
  'grid-6-open-three.2.success':
    'Un tres cerrado solo tiene una forma de crecer, y acabas de quitársela.',
  'grid-6-open-three.2.wrong': 'A su fila aún le queda una casilla que hace cuatro.',
  'grid-6-open-three.3.prompt':
    'Tu rival tiene un dos abierto. Tápalo antes de que sea un tres abierto.',
  'grid-6-open-three.3.hint': 'Juega pegado a uno de los extremos de su pareja.',
  'grid-6-open-three.3.success': 'Tapado. Añada lo que añada ahora, el tres queda cerrado.',
  'grid-6-open-three.3.wrong':
    'Desde aquí aún puede hacer un tres abierto — y eso son dos amenazas.',
  'grid-6-crossing-lines.title': 'Donde se cruzan las líneas',
  'grid-6-crossing-lines.intro':
    'Dos líneas a medio construir que pasan por la misma casilla vacía son una horquilla a punto de nacer. Juega en el punto de cruce y ambas líneas se vuelven amenazas a la vez. Aprende a verlas en tu lado del tablero — y en el suyo.',
  'grid-6-crossing-lines.1.prompt': 'Tu fila y tu columna se cruzan en una casilla. Encuéntrala.',
  'grid-6-crossing-lines.1.hint':
    'Sigue tu fila hacia la derecha y tu columna hacia abajo hasta que se encuentren.',
  'grid-6-crossing-lines.1.success':
    'Ahora las dos líneas son treses con una casilla de sobra. Dos amenazas, un solo bloqueo.',
  'grid-6-crossing-lines.1.wrong':
    'Eso solo ayuda a una línea. La casilla que sirve a las dos es la horquilla.',
  'grid-6-crossing-lines.2.prompt': 'Esta vez, una diagonal y una columna. Crea dos amenazas.',
  'grid-6-crossing-lines.2.hint': 'El hueco de tu diagonal está justo encima de tu columna.',
  'grid-6-crossing-lines.2.success':
    'La diagonal y la columna amenazan cuatro. No puede cubrir las dos.',
  'grid-6-crossing-lines.2.wrong':
    'Una amenaza es fácil de bloquear. Busca la casilla que crea dos.',

  // Grid 9
  'grid-9-both-ends.title': 'Vigila los dos extremos',
  'grid-9-both-ends.intro':
    'Cinco en línea en un tablero de 9×9 significa líneas largas con espacio en ambos extremos — y huecos. Un cuatro con un hueco sigue siendo un cuatro. Un tres abierto que dejas tranquilo se convierte en un cuatro abierto, y eso ya no hay quien lo pare.',
  'grid-9-both-ends.1.prompt': 'Tu rival tiene cuatro en línea. Bloquéalo.',
  'grid-9-both-ends.1.hint': 'Un extremo ya es tuyo.',
  'grid-9-both-ends.1.success': 'Bloqueado. Un cuatro exige respuesta inmediata — siempre.',
  'grid-9-both-ends.1.wrong':
    'Hará cinco en la próxima jugada. Su extremo abierto es la única casilla que importa.',
  'grid-9-both-ends.2.prompt': 'Este cuatro tiene un hueco. Encuentra la casilla que importa.',
  'grid-9-both-ends.2.hint': 'Tapa el hueco.',
  'grid-9-both-ends.2.success': 'Un cuatro roto sigue siendo un cuatro. Los huecos cuentan.',
  'grid-9-both-ends.2.wrong': 'Hará cinco por el hueco en la próxima jugada.',
  'grid-9-both-ends.3.prompt': 'Un tres abierto. Bloquéalo antes de que sea un cuatro abierto.',
  'grid-9-both-ends.3.hint': 'Bloquea pegado al tres, no una casilla más allá.',
  'grid-9-both-ends.3.success':
    'Ahora su cuatro, si llega a hacerlo, solo tendrá un extremo abierto.',
  'grid-9-both-ends.3.wrong':
    'Demasiado lejos: aún puede hacer un cuatro abierto por ambos extremos.',

  // Gomoku
  'gomoku-13-open-threes.title': 'El tres abierto',
  'gomoku-13-open-threes.intro':
    'En gomoku, un tres abierto — tres en línea con espacio en ambos extremos — es la amenaza que importa. Si lo ignoras, se convierte en un cuatro abierto, que gana. Un tres cerrado puede esperar: solo llega a ser un cuatro que puedes bloquear.',
  'gomoku-13-open-threes.1.prompt': 'Tienes un tres abierto. Conviértelo en un cuatro abierto.',
  'gomoku-13-open-threes.1.hint': 'Añade en cualquiera de los extremos, justo al lado del tres.',
  'gomoku-13-open-threes.1.success': 'Un cuatro abierto: el cinco espera en ambos extremos.',
  'gomoku-13-open-threes.1.wrong': 'Ese cuatro solo tiene un extremo abierto — lo bloquea.',
  'gomoku-13-open-threes.2.prompt': 'Tu rival tiene dos treses. Bloquea el que importa.',
  'gomoku-13-open-threes.2.hint':
    'Tu marca ya cierra la columna. La fila está abierta por ambos extremos.',
  'gomoku-13-open-threes.2.success':
    'Bien. El tres cerrado solo puede hacer un cuatro que bloquearás a tiempo.',
  'gomoku-13-open-threes.2.wrong':
    'Eso deja su tres abierto libre para convertirse en un cuatro abierto.',
  'gomoku-15-four-three.title': 'El cuatro-tres',
  'gomoku-15-four-three.intro':
    'Un cuatro hay que responderlo al instante. Un cuatro-tres es una jugada que crea un cuatro y un tres abierto a la vez: tu rival está obligado a bloquear el cuatro, y mientras tanto el tres se convierte en un cuatro abierto. Es la forma ganadora clásica del gomoku.',
  'gomoku-15-four-three.1.prompt': 'Crea un cuatro y un tres abierto con una sola jugada.',
  'gomoku-15-four-three.1.hint': 'Tu fila y tu columna se cruzan en una casilla.',
  'gomoku-15-four-three.1.success':
    'Cuatro en horizontal, tres abierto en vertical. Tiene que bloquear el cuatro — y entonces el tres gana.',
  'gomoku-15-four-three.1.wrong':
    'Eso le da tiempo. Busca la jugada que crea el cuatro y el tres a la vez.',
  'gomoku-15-four-three.2.prompt': 'Otro cuatro-tres, en la diagonal.',
  'gomoku-15-four-three.2.hint':
    'Alarga la diagonal de modo que también complete un tres en la fila de abajo.',
  'gomoku-15-four-three.2.success':
    'Cuatro en la diagonal, tres abierto en la fila. El bloqueo llega tarde.',
  'gomoku-15-four-three.2.wrong': 'Esta no — mira dónde comparten casilla la diagonal y tu fila.',
  'gomoku-15-double-four.title': 'Primero los cuatros',
  'gomoku-15-double-four.intro':
    'Dos cuatros a la vez no se pueden bloquear los dos. Y cuando tu rival tiene un cuatro, nada de lo que estés construyendo importa hasta que lo frenes — ni siquiera un tres abierto tuyo.',
  'gomoku-15-double-four.1.prompt': 'Crea dos cuatros con una sola jugada.',
  'gomoku-15-double-four.1.hint': 'El hueco de tu fila es también el extremo de tu columna.',
  'gomoku-15-double-four.1.success': 'Un doble cuatro. Un solo bloqueo no puede frenar dos cincos.',
  'gomoku-15-double-four.1.wrong':
    'Eso crea como mucho un cuatro. Busca la casilla que comparten ambas líneas.',
  'gomoku-15-double-four.2.prompt': 'Tienes un tres abierto, pero tu rival tiene un cuatro.',
  'gomoku-15-double-four.2.hint': 'Tu tres puede esperar una jugada. Su cuatro, no.',
  'gomoku-15-double-four.2.success': 'Bloqueado. Ahora la amenaza del tablero es tu tres abierto.',
  'gomoku-15-double-four.2.wrong': 'Hará cinco antes de que tu tres tenga ocasión.',

  // Misère
  'misere-dont-finish.title': 'No completes la línea',
  'misere-dont-finish.intro':
    'En misère, hacer tres en raya pierde. Al final de la partida se acaban las casillas, y la pregunta pasa a ser qué casilla puedes jugar sin completar una línea tuya. Cuéntalas antes de mover.',
  'misere-dont-finish.1.prompt':
    'Dos de las casillas vacías completan una línea tuya. Encuentra la que no.',
  'misere-dont-finish.1.hint': 'Revisa tu fila superior y tu columna izquierda antes de jugar.',
  'misere-dont-finish.1.success':
    'A salvo — y ahora cada casilla que queda completa una línea de tu rival.',
  'misere-dont-finish.1.wrong': 'Eso completa un tres en raya tuyo. En misère, eso pierde.',
  'misere-dont-finish.2.prompt': 'La misma idea, otro tablero. ¿Qué casilla es segura?',
  'misere-dont-finish.2.hint':
    'A tu fila superior y a tu columna derecha les falta una casilla a cada una.',
  'misere-dont-finish.2.success': 'La única casilla segura — y a tu rival no le deja ninguna.',
  'misere-dont-finish.2.wrong': 'Esa casilla completa tu propia línea.',
  'misere-centre-mirror.title': 'Centro y espejo',
  'misere-centre-mirror.intro':
    'Quien empieza nunca puede perder en misère. Toma el centro y responde a cada jugada con su casilla simétrica respecto al centro. Tus marcas nunca se alinean entre sí, así que nunca serás tú quien haga tres en raya.',
  'misere-centre-mirror.1.prompt': 'Empiezas tú. ¿Dónde?',
  'misere-centre-mirror.1.hint':
    'La única casilla respecto a la que todas las demás tienen su reflejo.',
  'misere-centre-mirror.1.success':
    'El centro. Cualquier otra apertura pierde contra un juego perfecto.',
  'misere-centre-mirror.1.wrong': 'Eso pierde con juego perfecto. Empieza en el centro.',
  'misere-centre-mirror.2.prompt': 'Tu rival tomó una esquina. Refléjala.',
  'misere-centre-mirror.2.hint': 'En línea recta a través del centro, hasta el lado opuesto.',
  'misere-centre-mirror.2.success': 'La esquina opuesta. Sigue reflejando y no podrás perder.',
  'misere-centre-mirror.2.wrong':
    'Solo la casilla reflejada aguanta. Ve en línea recta a través del centro.',
  'misere-centre-mirror.3.prompt': 'Esta vez tomó un borde. Refléjalo otra vez.',
  'misere-centre-mirror.3.hint': 'El borde justo enfrente del suyo.',
  'misere-centre-mirror.3.success':
    'Reflejado. Ni tus marcas ni el centro llegan a formar línea entre sí.',
  'misere-centre-mirror.3.wrong': 'Eso pierde con juego perfecto. Responde con el borde opuesto.',

  // Vanish
  'vanish-fading-marks.title': 'La marca que se desvanece',
  'vanish-fading-marks.intro':
    'En Desvanecer solo conservas tres marcas. La más antigua se ve desvaneciéndose: sale del tablero al colocar la siguiente, así que nunca puede formar parte de la línea que hace esa jugada. Las líneas que pasan por una marca que se desvanece solo parecen amenazas.',
  'vanish-fading-marks.1.prompt': 'A tres líneas parece faltarles una casilla. Solo una es real.',
  'vanish-fading-marks.1.hint':
    'Ignora todas las líneas que pasan por tu esquina que se desvanece.',
  'vanish-fading-marks.1.success': 'La única línea sin tu marca que se desvanece. Tres en raya.',
  'vanish-fading-marks.1.wrong':
    'Tu marca que se desvanece se va al jugar, así que esa línea nunca se completa.',
  'vanish-fading-marks.2.prompt': 'Parece que tu rival tiene dos amenazas. Bloquea la real.',
  'vanish-fading-marks.2.hint': 'Una de sus líneas pasa por su propia marca que se desvanece.',
  'vanish-fading-marks.2.success':
    'Bloqueado. Su otra línea necesitaba una marca que está a punto de desaparecer.',
  'vanish-fading-marks.2.wrong': 'Eso deja abierta su línea real. La otra nunca fue una amenaza.',
  'vanish-tempo.title': 'Deja que su marca se vaya',
  'vanish-tempo.intro':
    'La marca de tu rival que se desvanece también está a punto de irse, y la casilla que deja es tuya para usarla. Alinea dos de tus marcas detrás de ella: cuando desaparezca en su jugada, tu línea se abre y no podrá cerrarla a tiempo.',
  'vanish-tempo.1.prompt':
    'La marca de tu rival que se desvanece bloquea una línea. Ponte detrás de ella.',
  'vanish-tempo.1.hint':
    'Su marca más antigua está en lo alto de una columna. Haz tuya esa columna.',
  'vanish-tempo.1.success':
    'Cuando mueva, su marca se irá y la columna será tuya para completarla.',
  'vanish-tempo.1.wrong':
    'Así lo dejas escapar. Alinea tus marcas detrás de la que está a punto de desaparecer.',
  'vanish-tempo.2.prompt': 'El mismo truco, al otro lado del tablero.',
  'vanish-tempo.2.hint': '¿Cuál de sus marcas se va ahora, y qué deja abierto?',
  'vanish-tempo.2.success':
    'Su marca que se desvanece es lo único que te estorba — y se está yendo.',
  'vanish-tempo.2.wrong': 'Esta le da tiempo para preparar una línea propia.',

  // Gravity
  'gravity-floors-and-stacks.title': 'Suelo y pilas',
  'gravity-floors-and-stacks.intro':
    'En Gravedad eliges una columna y tu marca cae hasta abajo. Una casilla solo se puede jugar cuando la de debajo está ocupada. Las filas a ras de suelo y las pilas en una columna son las primeras amenazas que buscar.',
  'gravity-floors-and-stacks.1.prompt': 'Tres a ras de suelo. Remata la fila.',
  'gravity-floors-and-stacks.1.hint':
    'Los dos extremos de tu fila están en el suelo, así que puedes jugar en cualquiera.',
  'gravity-floors-and-stacks.1.success': 'Cuatro a ras de suelo.',
  'gravity-floors-and-stacks.1.wrong': 'Esa casilla no completa tu fila.',
  'gravity-floors-and-stacks.2.prompt': 'Tu rival ha apilado tres. Tapa la columna.',
  'gravity-floors-and-stacks.2.hint': 'Suelta tu marca en su columna.',
  'gravity-floors-and-stacks.2.success': 'Tapada. Una pila solo puede crecer hacia arriba.',
  'gravity-floors-and-stacks.2.wrong': 'Soltará una cuarta encima en la próxima jugada.',
  'gravity-dont-fill-under.title': 'No llenes la de abajo',
  'gravity-dont-fill-under.intro':
    'Una amenaza puede estar sobre una casilla vacía. Nadie puede jugarla hasta que algo caiga debajo — así que quien llene esa casilla le regala la amenaza al otro. A menudo la mejor jugada es simplemente no tocar esa columna.',
  'gravity-dont-fill-under.1.prompt':
    'Su fila necesita una casilla que aún no se puede jugar. Que siga así.',
  'gravity-dont-fill-under.1.hint': 'Cualquier columna menos la que está bajo su amenaza.',
  'gravity-dont-fill-under.1.success':
    'Su amenaza sigue fuera de alcance hasta que alguien llene la casilla de debajo.',
  'gravity-dont-fill-under.1.wrong':
    'Eso llena la casilla de debajo, y tu rival cae justo encima para hacer cuatro.',
  'gravity-dont-fill-under.2.prompt':
    'Ahora la amenaza sobre la casilla vacía es tuya. Consérvala.',
  'gravity-dont-fill-under.2.hint': 'No juegues en la columna bajo tu propia amenaza.',
  'gravity-dont-fill-under.2.success':
    'Tu amenaza espera. Cada jugada suya en esa columna te regala la victoria.',
  'gravity-dont-fill-under.2.wrong':
    'Has llenado tu propia casilla: tu rival cae encima y tu amenaza desaparece.',
  'gravity-stacked-threats.title': 'Amenazas apiladas',
  'gravity-stacked-threats.intro':
    'Dos amenazas en la misma columna, una justo encima de la otra, no se pueden frenar las dos: bloquear la de abajo hace jugable la de arriba. En el suelo, un tres abierto funciona igual que en un tablero plano.',
  'gravity-stacked-threats.1.prompt': 'Crea dos amenazas, una encima de la otra.',
  'gravity-stacked-threats.1.hint':
    'Una sola jugada puede alargar tu fila y completar tres en tu diagonal.',
  'gravity-stacked-threats.1.success':
    'Tiene que bloquear la casilla de abajo, y eso pone tu segunda amenaza a tu alcance.',
  'gravity-stacked-threats.1.wrong': 'Eso crea una sola amenaza, que puede bloquear sin más.',
  'gravity-stacked-threats.2.prompt': 'Haz un tres abierto a ras de suelo.',
  'gravity-stacked-threats.2.hint':
    'Alarga tu pareja a ras de suelo, dejando libres ambos extremos.',
  'gravity-stacked-threats.2.success': 'Dos extremos jugables, un solo bloqueo. El suelo es tuyo.',
  'gravity-stacked-threats.2.wrong': 'Eso le deja una casilla que bloquear y nada más.',

  // Ultimate
  'ultimate-small-boards.title': 'Ganar tableros pequeños',
  'ultimate-small-boards.intro':
    'En Ultimate ganas tableros pequeños para ganar el grande. La casilla que eliges dentro de un tablero pequeño decide en qué tablero debe jugar tu rival — y cuando te envía a uno donde ya tienes dos en línea, quédate con ese tablero.',
  'ultimate-small-boards.1.prompt':
    'Te han enviado a un tablero donde tienes dos en línea. Gánalo.',
  'ultimate-small-boards.1.hint': 'Completa la fila inferior del tablero superior izquierdo.',
  'ultimate-small-boards.1.success': 'El tablero superior izquierdo es tuyo.',
  'ultimate-small-boards.1.wrong': 'Eso no completa tu fila en este tablero.',
  'ultimate-small-boards.2.prompt': 'Te envían al tablero central. Gánalo también.',
  'ultimate-small-boards.2.hint': 'La misma forma que antes: la fila inferior.',
  'ultimate-small-boards.2.success': 'Dos tableros en la diagonal.',
  'ultimate-small-boards.2.wrong': 'Eso no completa tu fila en el tablero central.',
  'ultimate-small-boards.3.prompt': 'Un tablero más en la diagonal gana la partida.',
  'ultimate-small-boards.3.hint': 'A tu columna izquierda de este tablero le falta una casilla.',
  'ultimate-small-boards.3.success': 'Tres tableros en línea — la partida es tuya.',
  'ultimate-small-boards.3.wrong': 'Eso no te da este tablero, y este tablero es la partida.',
  'ultimate-where-you-send.title': 'Adónde lo envías',
  'ultimate-where-you-send.intro':
    'Cada casilla que juegas envía a tu rival al tablero pequeño correspondiente. Nunca lo envíes a un tablero que pueda ganar. Y nunca lo envíes a un tablero terminado: eso le da una jugada libre en cualquier parte, incluido el tablero del que con tanto cuidado lo mantenías alejado.',
  'ultimate-where-you-send.1.prompt':
    'Aquí, dos casillas lo envían a un tablero que puede ganar. Evita las dos.',
  'ultimate-where-you-send.1.hint':
    'Busca los tableros donde ya tiene dos en línea y no juegues en las casillas que apuntan allí.',
  'ultimate-where-you-send.1.success': 'Llega a un tablero donde no tiene nada que completar.',
  'ultimate-where-you-send.1.wrong': 'Eso lo envía a un tablero donde tiene dos en línea. Lo gana.',
  'ultimate-where-you-send.2.prompt':
    'El tablero inferior derecho está terminado. Cuidado con la jugada libre.',
  'ultimate-where-you-send.2.hint':
    'Evita los tableros donde tiene dos en línea — y la casilla que apunta al tablero terminado.',
  'ultimate-where-you-send.2.success':
    'Ningún tablero que pueda ganar, y ninguna jugada libre para ir a buscarlo.',
  'ultimate-where-you-send.2.wrong':
    'Desde ahí puede ganar un tablero pequeño — directamente o con una jugada libre.',
};
