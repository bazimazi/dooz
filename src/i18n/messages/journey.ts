import { type Rival, type RivalId, RIVALS } from '@/features/journey/rivals';
import { type Stage, STAGES } from '@/features/journey/stages';
import { defineMessages, type Locale, translate, useLocale } from '@/i18n';

/**
 * The journey, in every language: the map's own words ({@link journeyMessages})
 * and what each rival and stage says about itself
 * ({@link journeyContentMessages}). What rivals say during a game is in
 * `journeyDialogue.ts`.
 *
 * Rival names are names, and stay as they are in every language.
 */
export const journeyMessages = defineMessages({
  en: {
    title: 'Journey',
    backHome: 'Back to home',
    starsCount: '{stars} / {max}',
    starsEarned: 'Stars earned',
    quoted: '“{text}”',

    // The card for the stage up next
    bossStage: 'Boss stage',
    upNext: 'Up next',
    upNextTitle: '{rival} · {mode}',
    stageOf: 'Stage {number} of {total} · {chapter}',
    play: 'Play',

    // A chapter
    chapterHeading: 'Chapter {number} · {chapter}',
    notMet: 'Clear the stage before to meet them.',
    chapterStars: '{stars}/{max}',
    cleared: 'Cleared',
    signature: 'Signature: {name}.',

    // A stage on the path
    stageNumber: 'Stage {number}',
    stageNumberBoss: 'Stage {number}, boss',
    rowLabel: '{stage}: {mode} against {rival}, {stars} of {max} stars',
    rowLabelLocked: '{stage}: {mode} against {rival}, {stars} of {max} stars, locked',
    rowTitle: '{number}. {mode}',
    tagBoss: 'Boss',
    tagOpens: '{rival} opens',
    tagHeadStart: 'Head start',
    tagFork: 'Fork for ★3',
    tagNoHints: 'No hints for ★3',
    tagFlawless: 'Flawless for ★3',

    // The stage sheet
    sheetLabel: 'Stage {number}: {mode}',
    sheetBoss: 'Stage {number} · Boss',
    versus: 'vs {rival} · {level} · {opener}',
    youFirst: 'you move first',
    rivalFirst: '{rival} moves first',
    setupNote: 'The board starts with marks already placed.',
    'objective.par': {
      one: 'Win in {count} move or fewer',
      other: 'Win in {count} moves or fewer',
    },
    'objective.no-hints': 'Win in {count} or fewer without a hint',
    'objective.fork': 'Win in {count} or fewer with a double threat',
    'objective.flawless': 'Win in {count} or fewer without facing a threat',
    win: 'Win',
    bestSoFar: 'Best so far',
    playAgain: 'Play again',
    faceBoss: 'Face the boss',
    back: 'Back',
  },
  es: {
    title: 'Viaje',
    backHome: 'Volver al inicio',
    starsCount: '{stars} / {max}',
    starsEarned: 'Estrellas conseguidas',
    quoted: '«{text}»',
    bossStage: 'Etapa de jefe',
    upNext: 'A continuación',
    upNextTitle: '{rival} · {mode}',
    stageOf: 'Etapa {number} de {total} · {chapter}',
    play: 'Jugar',
    chapterHeading: 'Capítulo {number} · {chapter}',
    notMet: 'Supera la etapa anterior para conocer a este rival.',
    chapterStars: '{stars}/{max}',
    cleared: 'Superado',
    signature: 'Especialidad: {name}.',
    stageNumber: 'Etapa {number}',
    stageNumberBoss: 'Etapa {number}, jefe',
    rowLabel: '{stage}: {mode} contra {rival}, {stars} de {max} estrellas',
    rowLabelLocked: '{stage}: {mode} contra {rival}, {stars} de {max} estrellas, bloqueada',
    rowTitle: '{number}. {mode}',
    tagBoss: 'Jefe',
    tagOpens: 'Abre {rival}',
    tagHeadStart: 'Ventaja inicial',
    tagFork: 'Horquilla para ★3',
    tagNoHints: 'Sin pistas para ★3',
    tagFlawless: 'Impecable para ★3',
    sheetLabel: 'Etapa {number}: {mode}',
    sheetBoss: 'Etapa {number} · Jefe',
    versus: 'contra {rival} · {level} · {opener}',
    youFirst: 'mueves tú primero',
    rivalFirst: '{rival} mueve primero',
    setupNote: 'El tablero empieza con marcas ya colocadas.',
    'objective.par': {
      one: 'Gana en {count} jugada o menos',
      other: 'Gana en {count} jugadas o menos',
    },
    'objective.no-hints': 'Gana en {count} jugadas o menos sin usar pistas',
    'objective.fork': 'Gana en {count} jugadas o menos con una doble amenaza',
    'objective.flawless': 'Gana en {count} jugadas o menos sin sufrir ninguna amenaza',
    win: 'Gana',
    bestSoFar: 'Mejor marca',
    playAgain: 'Jugar otra vez',
    faceBoss: 'Enfréntate al jefe',
    back: 'Atrás',
  },
  fr: {
    title: 'Voyage',
    backHome: 'Retour à l’accueil',
    starsCount: '{stars} / {max}',
    starsEarned: 'Étoiles gagnées',
    quoted: '« {text} »',
    bossStage: 'Étape du boss',
    upNext: 'À suivre',
    upNextTitle: '{rival} · {mode}',
    stageOf: 'Étape {number} sur {total} · {chapter}',
    play: 'Jouer',
    chapterHeading: 'Chapitre {number} · {chapter}',
    notMet: 'Termine l’étape précédente pour faire sa connaissance.',
    chapterStars: '{stars}/{max}',
    cleared: 'Terminé',
    signature: 'Spécialité : {name}.',
    stageNumber: 'Étape {number}',
    stageNumberBoss: 'Étape {number}, boss',
    rowLabel: '{stage} : {mode} contre {rival}, {stars} étoiles sur {max}',
    rowLabelLocked: '{stage} : {mode} contre {rival}, {stars} étoiles sur {max}, verrouillée',
    rowTitle: '{number}. {mode}',
    tagBoss: 'Boss',
    tagOpens: '{rival} commence',
    tagHeadStart: 'Longueur d’avance',
    tagFork: 'Fourchette pour ★3',
    tagNoHints: 'Sans indice pour ★3',
    tagFlawless: 'Sans faute pour ★3',
    sheetLabel: 'Étape {number} : {mode}',
    sheetBoss: 'Étape {number} · Boss',
    versus: 'contre {rival} · {level} · {opener}',
    youFirst: 'tu commences',
    rivalFirst: '{rival} commence',
    setupNote: 'La partie commence avec des symboles déjà placés.',
    'objective.par': {
      one: 'Gagner en {count} coup ou moins',
      other: 'Gagner en {count} coups ou moins',
    },
    'objective.no-hints': 'Gagner en {count} coups ou moins, sans indice',
    'objective.fork': 'Gagner en {count} coups ou moins, avec une double menace',
    'objective.flawless': 'Gagner en {count} coups ou moins, sans subir de menace',
    win: 'Victoire',
    bestSoFar: 'Meilleur résultat',
    playAgain: 'Rejouer',
    faceBoss: 'Affronter le boss',
    back: 'Retour',
  },
  de: {
    title: 'Reise',
    backHome: 'Zurück zum Start',
    starsCount: '{stars} / {max}',
    starsEarned: 'Gesammelte Sterne',
    quoted: '„{text}“',
    bossStage: 'Boss-Etappe',
    upNext: 'Als Nächstes',
    upNextTitle: '{rival} · {mode}',
    stageOf: 'Etappe {number} von {total} · {chapter}',
    play: 'Spielen',
    chapterHeading: 'Kapitel {number} · {chapter}',
    notMet: 'Schaffe die vorige Etappe, um diesem Rivalen zu begegnen.',
    chapterStars: '{stars}/{max}',
    cleared: 'Geschafft',
    signature: 'Markenzeichen: {name}.',
    stageNumber: 'Etappe {number}',
    stageNumberBoss: 'Etappe {number}, Boss',
    rowLabel: '{stage}: {mode} gegen {rival}, {stars} von {max} Sternen',
    rowLabelLocked: '{stage}: {mode} gegen {rival}, {stars} von {max} Sternen, gesperrt',
    rowTitle: '{number}. {mode}',
    tagBoss: 'Boss',
    tagOpens: '{rival} beginnt',
    tagHeadStart: 'Vorsprung',
    tagFork: 'Gabel für ★3',
    tagNoHints: 'Ohne Tipps für ★3',
    tagFlawless: 'Makellos für ★3',
    sheetLabel: 'Etappe {number}: {mode}',
    sheetBoss: 'Etappe {number} · Boss',
    versus: 'vs. {rival} · {level} · {opener}',
    youFirst: 'du ziehst zuerst',
    rivalFirst: '{rival} zieht zuerst',
    setupNote: 'Auf dem Brett stehen schon Zeichen.',
    'objective.par': {
      one: 'Gewinne in höchstens {count} Zug',
      other: 'Gewinne in höchstens {count} Zügen',
    },
    'objective.no-hints': 'Gewinne in höchstens {count} Zügen ohne Tipp',
    'objective.fork': 'Gewinne in höchstens {count} Zügen mit einer Doppeldrohung',
    'objective.flawless': 'Gewinne in höchstens {count} Zügen, ohne einer Drohung zu begegnen',
    win: 'Sieg',
    bestSoFar: 'Bestleistung bisher',
    playAgain: 'Nochmal spielen',
    faceBoss: 'Zum Boss',
    back: 'Zurück',
  },
  fa: {
    title: 'سفر',
    backHome: 'بازگشت به خانه',
    starsCount: '{stars} / {max}',
    starsEarned: 'ستاره‌های گرفته‌شده',
    quoted: '«{text}»',
    bossStage: 'مرحلهٔ غول آخر',
    upNext: 'بعدی',
    upNextTitle: '{rival}، {mode}',
    stageOf: 'مرحلهٔ {number} از {total}، {chapter}',
    play: 'بازی',
    chapterHeading: 'فصل {number}، {chapter}',
    notMet: 'مرحلهٔ قبل را ببر تا با او روبه‌رو شوی.',
    chapterStars: '{stars}/{max}',
    cleared: 'گذرانده‌شده',
    signature: 'حرکت ویژه: {name}.',
    stageNumber: 'مرحلهٔ {number}',
    stageNumberBoss: 'مرحلهٔ {number}، غول آخر',
    rowLabel: '{stage}: {mode} در برابر {rival}، {stars} از {max} ستاره',
    rowLabelLocked: '{stage}: {mode} در برابر {rival}، {stars} از {max} ستاره، قفل',
    rowTitle: '{number}. {mode}',
    tagBoss: 'غول آخر',
    tagOpens: '{rival} شروع می‌کند',
    tagHeadStart: 'یک قدم جلوتر',
    tagFork: 'دوشاخه برای ★۳',
    tagNoHints: 'بدون راهنما برای ★۳',
    tagFlawless: 'بی‌نقص برای ★۳',
    sheetLabel: 'مرحلهٔ {number}: {mode}',
    sheetBoss: 'مرحلهٔ {number}، غول آخر',
    versus: 'در برابر {rival}، {level}، {opener}',
    youFirst: 'تو شروع می‌کنی',
    rivalFirst: '{rival} شروع می‌کند',
    setupNote: 'صفحه با چند علامتِ از پیش چیده‌شده شروع می‌شود.',
    'objective.par': { one: 'برد در {count} حرکت یا کمتر', other: 'برد در {count} حرکت یا کمتر' },
    'objective.no-hints': 'برد در {count} حرکت یا کمتر بدون راهنما',
    'objective.fork': 'برد در {count} حرکت یا کمتر با تهدید دوگانه',
    'objective.flawless': 'برد در {count} حرکت یا کمتر بدون روبه‌رو شدن با تهدید',
    win: 'برد',
    bestSoFar: 'بهترین رکورد',
    playAgain: 'دوباره بازی کن',
    faceBoss: 'رویارویی با غول آخر',
    back: 'بازگشت',
  },
});

// ---------------------------------------------------------------------------
// Rivals and stages
// ---------------------------------------------------------------------------

/**
 * Keys are `<rivalId>.greeting`, `.gloat`, `.concede`, `.signatureName`,
 * `.signatureDescription`, `.chapterTitle` and `.chapterBlurb`; and for each
 * stage, `<stageId>.tip`, plus `.intro` and `.twist` where it has them. The
 * English is read out of `rivals.ts` and `stages.ts` rather than copied, so it
 * cannot drift; `journey.test.ts` checks each translation covers exactly
 * those keys.
 */
function english(): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const rival of RIVALS) {
    messages[`${rival.id}.greeting`] = rival.greeting;
    messages[`${rival.id}.gloat`] = rival.gloat;
    messages[`${rival.id}.concede`] = rival.concede;
    messages[`${rival.id}.signatureName`] = rival.signature.name;
    messages[`${rival.id}.signatureDescription`] = rival.signature.description;
    messages[`${rival.id}.chapterTitle`] = rival.chapter.title;
    messages[`${rival.id}.chapterBlurb`] = rival.chapter.blurb;
  }
  for (const stage of STAGES) {
    messages[`${stage.id}.tip`] = stage.tip;
    if (stage.intro) messages[`${stage.id}.intro`] = stage.intro;
    if (stage.twist) messages[`${stage.id}.twist`] = stage.twist;
  }
  return messages;
}

export const journeyContentMessages = defineMessages({
  en: english(),
  es: {
    'pip.greeting': '¡Croac! Acabo de aprender las reglas. ¿Me lo pones fácil?',
    'pip.gloat': 'Espera… ¿he ganado? ¡Suerte del principiante!',
    'pip.concede': '¡A saltar! Tienes un don natural.',
    'pip.signatureName': 'Copión',
    'pip.signatureDescription': 'Responde a tu jugada con su reflejo al otro lado del tablero.',
    'pip.chapterTitle': 'El estanque de nenúfares',
    'pip.chapterBlurb': 'Aprende el tablero contra una rana que copia más de lo que planea.',
    'mo.greeting': 'Yo siempre bloqueo. Lo que no veo es lo que viene después.',
    'mo.gloat': 'Miaugnífico. ¿Lo intentas otra vez?',
    'mo.concede': 'Hmpf. Dos amenazas a la vez es trampa. (No lo es.)',
    'mo.signatureName': 'Zarpazo',
    'mo.signatureDescription': 'Ahoga tus líneas antes de que se conviertan en amenazas.',
    'mo.chapterTitle': 'Los tejados',
    'mo.chapterBlurb': 'Un gato que lo bloquea todo. Haz dos amenazas y una pasará.',
    'sage.greeting': 'Veo tres jugadas por delante. Pon tus trampas más lejos.',
    'sage.gloat': 'La paciencia gana partidas. Uuh.',
    'sage.concede': 'Una combinación excelente. No la vi venir.',
    'sage.signatureName': 'El centro resiste',
    'sage.signatureDescription':
      'Toma el centro de cada tablero y construye hacia fuera, sin prisa.',
    'sage.chapterTitle': 'El viejo roble',
    'sage.chapterBlurb': 'Un búho que ve tres jugadas por delante. Planea cuatro.',
    'bruno.greeting': 'Tableros grandes, planes grandes. No dejes un cuatro abierto por ahí.',
    'bruno.gloat': 'Grrrandiosa partida. Para mí.',
    'bruno.concede': 'Has construido más que yo. Respeto.',
    'bruno.signatureName': 'Embestida de oso',
    'bruno.signatureDescription': 'Siempre alarga su línea más larga… y deja huecos detrás.',
    'bruno.chapterTitle': 'El gran bosque',
    'bruno.chapterBlurb':
      'Un oso que construye a lo grande. Bloquea pronto y luego construye más que él.',
    'vex.greeting': 'Cada jugada tranquila mía es una trampa. Todas.',
    'vex.gloat': 'Demasiado lento, demasiado amable. ¿Otra?',
    'vex.concede': 'Qué astucia. Qué irritante astucia.',
    'vex.signatureName': 'Trampa de zorro',
    'vex.signatureDescription': 'Jugadas tranquilas que acaban en dos amenazas a la vez.',
    'vex.chapterTitle': 'La madriguera del zorro',
    'vex.chapterBlurb':
      'Cada jugada tranquila es una trampa. Cuenta las líneas antes de responder.',
    'nyx.greeting': 'Ya he visto cómo termina esto.',
    'nyx.gloat': 'Tal como lo previ.',
    'nyx.concede': '…Eso no lo previ. Bien jugado.',
    'nyx.signatureName': 'Clarividencia',
    'nyx.signatureDescription': 'Lo anuncia en cuanto ve una victoria forzada. Suele acertar.',
    'nyx.chapterTitle': 'El velo',
    'nyx.chapterBlurb':
      'Un fantasma que calcula hasta que se agota el reloj. Solo vale una victoria forzada.',
    'pip-1.tip': 'Toma el centro y luego amenaza dos líneas a la vez.',
    'pip-2.tip':
      'Cuatro en línea. Un tres abierto —libre por ambos extremos— ya cuesta mucho de parar.',
    'pip-3.tip':
      'Solo se quedan tus tres marcas más recientes. La que se desvanece está a punto de irse.',
    'pip-4.tip': 'Aquí, hacer tres en raya pierde. Llena casillas seguras y deja a Pip sin ellas.',
    'pip-4.intro': '¿Aquí tres en raya es MALO? Croac. Tendré muchísimo cuidado.',
    'pip-5.tip': 'Pip suelta primero. Construye donde la casilla de encima sea una que quieras.',
    'pip-5.intro': '¡Yo primero! ¡Plof!',
    'pip-6.tip':
      'Las esquinas y el centro hacen horquillas: dos líneas que una sola marca no puede bloquear.',
    'pip-6.intro': 'Enséñame uno de esos trucos de dos líneas. ¡Quiero verlo!',
    'pip-7.tip': 'Un espejo no puede parar dos amenazas. Construye líneas que crucen el centro.',
    'pip-7.twist': 'Pip el copión refleja casi todas tus jugadas.',
    'mo-1.tip': 'Mo bloquea todas las amenazas, una a una. Haz dos y una pasará.',
    'mo-2.tip': 'Aquí, hacer tres en raya pierde. No dejes a Mo ningún sitio seguro donde jugar.',
    'mo-3.tip':
      'Las marcas caen. Una amenaza una casilla más arriba espera a que alguien llene la de debajo.',
    'mo-4.tip':
      'Cada dos en línea es un regalo para quien mueva después. No le dejes ninguno a Mo.',
    'mo-4.intro': '¿Cualquier marca, cualquier línea? Pues las bloqueo todas.',
    'mo-5.tip':
      'Mo empieza con la diagonal central. Bloquéala por el extremo abierto y luego construye.',
    'mo-5.intro': 'Me he quedado las casillas cómodas. Tú quédate la esquina.',
    'mo-6.tip':
      'Siete columnas, seis de alto. Las amenazas en la fila sobre una ya llena son las que duran.',
    'mo-7.tip': 'Mo ahoga cada línea que ve. Construye dos donde solo vigila una.',
    'mo-7.twist': 'Mo mueve primero y bloquea más fuerte que nunca.',
    'sage-1.tip':
      'Sage ve tres jugadas por delante. Construye formas que se conviertan en amenazas más tarde.',
    'sage-2.tip':
      'Una línea que pasa por la marca que se desvanece de Sage no es línea, para ninguno de los dos.',
    'sage-3.tip':
      'Cada casilla que eliges envía a Sage a un tablero. Mándalo a algún sitio inútil.',
    'sage-4.tip': 'A Sage le encanta el centro. En misère, el centro es un lastre: déjaselo.',
    'sage-4.intro': 'Hacer menos es un arte. Veamos quién lo domina mejor.',
    'sage-5.tip': 'Tú eres Orden. Cinco iguales en línea ganan, aunque sean marcas de Sage.',
    'sage-5.intro': 'Orden y caos. Siempre he preferido el más callado de los dos.',
    'sage-6.tip': 'Sage suelta primero en la columna central. Lucha por las casillas de al lado.',
    'sage-7.tip':
      'Primero te enviarán al tablero central. Responde mandando a Sage a algún sitio aburrido.',
    'sage-7.twist': 'Sage abre en el centro del tablero central.',
    'bruno-1.tip':
      'Cinco en línea. Un cuatro y un tres abierto a la vez no se pueden bloquear los dos.',
    'bruno-2.tip': 'Apila dos amenazas en una columna y la de abajo te regala la de arriba.',
    'bruno-3.tip': 'Juega cerca del centro y mantén tus marcas conectadas.',
    'bruno-4.tip':
      'Bruno construye largo. Dos suyas en línea con tu marca detrás son una captura esperando.',
    'bruno-4.intro': '¿Capturas? Vale. Construyo más rápido de lo que tú capturas.',
    'bruno-5.tip':
      'Las rocas cortan las líneas. Cuenta qué tramos aún tienen sitio para cinco casillas.',
    'bruno-6.tip':
      'Bruno te regala la diagonal central. Conviértela en dos amenazas antes de que la tapie.',
    'bruno-6.intro': 'Te doy ventaja. La vas a necesitar. Grrr.',
    'bruno-7.tip':
      'Bloquea sus tres abiertos al momento, por el lado que deje tus marcas conectadas.',
    'bruno-7.twist': 'Bruno mueve primero y se lanza a por cada línea que empieza.',
    'vex-1.tip': 'Moviendo primero, el juego perfecto gana en siete. Empieza en un borde.',
    'vex-2.tip': 'Gana el tablero central y nunca envíes a Vex a un tablero que pueda ganar.',
    'vex-3.tip': 'Bloquea pronto los tres abiertos. Vex los convierte en cuatros ganando tempo.',
    'vex-4.tip':
      'Las líneas atraviesan las capas. Una amenaza en dos capas a la vez es una horquilla.',
    'vex-4.intro': 'Cuatro capas. Sitio de sobra para esconder algo.',
    'vex-5.tip': 'Guarda tu bomba para la marca que mantiene unidas dos líneas de Vex.',
    'vex-6.tip':
      'Empiezas con la columna central apilada. Vex intentará que llenes las casillas bajo sus amenazas.',
    'vex-6.intro': 'Quédate la columna central. Insisto. De verdad.',
    'vex-7.tip':
      'Abre con una marca que no te importe tener en contra. Vex se queda con todo lo que valga la pena.',
    'vex-7.twist': 'Exactamente cinco, y Vex puede robarte la marca de apertura.',
    'nyx-1.tip': 'Nyx calcula hasta que se agota el reloj. Solo vale una victoria forzada.',
    'nyx-2.tip': 'Cuenta qué casillas tendrá que llenar a la fuerza cada uno.',
    'nyx-3.tip': 'La prueba final. Ataca primero y no sueltes nunca la iniciativa.',
    'nyx-4.tip':
      'Nyx lee cada envío. Gana tableros pequeños que hagan línea con los que ya tienes.',
    'nyx-5.tip':
      'Las capturas cambian la cuenta. Nunca dejes dos marcas tuyas expuestas a que te las encierren.',
    'nyx-6.tip':
      'Las filas pares e impares deciden el final. Pon tus amenazas en las filas a las que llegarás.',
    'nyx-7.tip':
      'Tienes el centro y una jugada gratis. Ataca antes de que el fantasma encuentre el camino de vuelta.',
    'nyx-7.twist': 'Nyx deja que su primera marca se vaya a la esquina. ¿Un regalo… o un cebo?',
  },
  fr: {
    'pip.greeting': 'Croâ ! Je viens d’apprendre les règles. Tu y vas doucement ?',
    'pip.gloat': 'Attends… j’ai gagné ? La chance du débutant !',
    'pip.concede': 'Hop, hop — tu as ça dans le sang.',
    'pip.signatureName': 'Copie conforme',
    'pip.signatureDescription': 'Répond à ton coup par son reflet de l’autre côté du plateau.',
    'pip.chapterTitle': 'L’Étang aux nénuphars',
    'pip.chapterBlurb':
      'Apprivoise le plateau face à une grenouille qui copie plus qu’elle ne réfléchit.',
    'mo.greeting': 'Je bloque toujours. Ce que je ne vois pas, c’est la suite.',
    'mo.gloat': 'Miaou-gnifique. On rejoue ?',
    'mo.concede': 'Pff. Deux menaces à la fois, c’est de la triche. (Non.)',
    'mo.signatureName': 'Coup de patte',
    'mo.signatureDescription': 'Étouffe tes lignes avant qu’elles ne deviennent des menaces.',
    'mo.chapterTitle': 'Les Toits',
    'mo.chapterBlurb': 'Un chat qui bloque tout. Crée deux menaces, et l’une passera.',
    'sage.greeting': 'Je vois trois coups à l’avance. Tends tes pièges plus loin que ça.',
    'sage.gloat': 'La patience gagne les parties. Hou.',
    'sage.concede': 'Une belle combinaison. Je ne l’ai pas vue venir.',
    'sage.signatureName': 'Le centre tient',
    'sage.signatureDescription':
      'Prend le milieu de chaque plateau et construit vers l’extérieur, sans bruit.',
    'sage.chapterTitle': 'Le Vieux Chêne',
    'sage.chapterBlurb': 'Un hibou qui voit trois coups à l’avance. Prévois-en quatre.',
    'bruno.greeting': 'Grands plateaux, grands projets. Ne laisse pas traîner un quatre ouvert.',
    'bruno.gloat': 'Grrr-andiose partie. Pour moi.',
    'bruno.concede': 'Tu as mieux construit que moi. Respect.',
    'bruno.signatureName': 'Charge de l’ours',
    'bruno.signatureDescription':
      'Prolonge toujours sa plus longue ligne — et laisse des trous derrière lui.',
    'bruno.chapterTitle': 'Les Grands Bois',
    'bruno.chapterBlurb': 'Un ours qui voit grand. Bloque tôt, puis construis mieux que lui.',
    'vex.greeting': 'Chacun de mes coups tranquilles est un piège. Chacun.',
    'vex.gloat': 'Trop de lenteur, trop de bonté. Encore ?',
    'vex.concede': 'Bien vu. Agaçant, mais bien vu.',
    'vex.signatureName': 'Piège à renard',
    'vex.signatureDescription': 'Des coups tranquilles qui deviennent deux menaces à la fois.',
    'vex.chapterTitle': 'La Tanière du renard',
    'vex.chapterBlurb': 'Chaque coup tranquille est un piège. Compte les lignes avant de répondre.',
    'nyx.greeting': 'J’ai déjà vu comment cela se termine.',
    'nyx.gloat': 'Comme prédit.',
    'nyx.concede': '…Cela, je ne l’avais pas prévu. Bien joué.',
    'nyx.signatureName': 'Prescience',
    'nyx.signatureDescription':
      'L’annonce dès qu’il voit une victoire forcée. Il a presque toujours raison.',
    'nyx.chapterTitle': 'Le Voile',
    'nyx.chapterBlurb':
      'Un fantôme qui calcule jusqu’à la dernière seconde. Seule une victoire forcée en viendra à bout.',
    'pip-1.tip': 'Prends le centre, puis menace deux lignes à la fois.',
    'pip-2.tip':
      'Quatre alignés. Un trois ouvert — libre aux deux bouts — est déjà difficile à arrêter.',
    'pip-3.tip':
      'Seuls tes trois symboles les plus récents restent. Celui qui s’estompe va partir.',
    'pip-4.tip':
      'Ici, aligner trois fait perdre. Remplis les cases sans danger et laisse Pip en manquer.',
    'pip-4.intro': 'Aligner trois, c’est MAL ici ? Croâ. Je vais faire super attention.',
    'pip-5.tip':
      'Pip joue en premier. Construis là où la case juste au-dessus est une case que tu veux.',
    'pip-5.intro': 'Moi d’abord ! Plouf !',
    'pip-6.tip':
      'Les coins et le centre font des fourchettes : deux lignes qu’un seul symbole ne peut pas bloquer.',
    'pip-6.intro': 'Montre-moi un de ces tours à deux lignes. Je veux voir ça !',
    'pip-7.tip':
      'Un miroir ne peut pas arrêter deux menaces. Construis des lignes qui passent par le centre.',
    'pip-7.twist': 'Pip le copieur reproduit en miroir presque chacun de tes coups.',
    'mo-1.tip': 'Mo bloque chaque menace, sans exception. Crées-en deux, et l’une passera.',
    'mo-2.tip': 'Ici, aligner trois fait perdre. Ne laisse à Mo aucune case sans danger.',
    'mo-3.tip':
      'Les symboles tombent. Une menace une case plus haut dans une colonne attend que quelqu’un remplisse celle du dessous.',
    'mo-4.tip':
      'Chaque paire alignée est un cadeau pour le joueur suivant. N’en laisse aucune à Mo.',
    'mo-4.intro': 'N’importe quel symbole, n’importe quelle ligne ? Je les bloquerai toutes.',
    'mo-5.tip':
      'Mo commence avec la diagonale du milieu. Bloque-la par son bout ouvert, puis construis.',
    'mo-5.intro': 'J’ai pris les cases confortables. Tu peux avoir le coin.',
    'mo-6.tip':
      'Sept colonnes, six de haut. Les menaces sur la rangée au-dessus d’une rangée pleine sont celles qui durent.',
    'mo-7.tip':
      'Mo étouffe chaque ligne qu’il voit. Construis-en deux là où il n’en surveille qu’une.',
    'mo-7.twist': 'Mo joue en premier et bloque plus fort que jamais.',
    'sage-1.tip':
      'Sage voit trois coups à l’avance. Construis des formes qui deviendront des menaces plus tard.',
    'sage-2.tip':
      'Une ligne qui passe par le symbole de Sage qui s’estompe n’en est pas une — pour aucun de vous deux.',
    'sage-3.tip':
      'Chaque case que tu choisis envoie Sage sur un plateau. Envoie-le là où il ne sert à rien.',
    'sage-4.tip': 'Sage adore le centre. En Misère, le centre est un fardeau — laisse-le-lui.',
    'sage-4.intro': 'En faire moins est tout un art. Voyons qui le maîtrise le mieux.',
    'sage-5.tip': 'Tu es l’Ordre. Cinq symboles identiques alignés gagnent — même ceux de Sage.',
    'sage-5.intro': 'L’Ordre et le Chaos. J’ai toujours préféré le plus calme des deux.',
    'sage-6.tip':
      'Sage joue d’abord dans la colonne du centre. Bats-toi pour les cases qui l’entourent.',
    'sage-7.tip':
      'Ton premier coup se joue sur le plateau du milieu. Réponds en envoyant Sage sur un plateau sans intérêt.',
    'sage-7.twist': 'Sage ouvre au centre du plateau central.',
    'bruno-1.tip':
      'Cinq alignés. Un quatre et un trois ouvert ensemble ne peuvent pas être bloqués tous les deux.',
    'bruno-2.tip': 'Superpose deux menaces dans une colonne : celle du bas t’offre celle du haut.',
    'bruno-3.tip': 'Joue près du centre et garde tes pierres connectées.',
    'bruno-4.tip':
      'Bruno construit long. Deux des siens alignés avec ton symbole au bout : une capture t’attend.',
    'bruno-4.intro': 'Des captures ? Soit. Je construis plus vite que tu ne prends.',
    'bruno-5.tip':
      'Les rochers coupent les lignes. Compte quelles séries ont encore cinq cases de place.',
    'bruno-6.tip':
      'Bruno t’offre la diagonale centrale. Fais-en deux menaces avant qu’il ne la mure.',
    'bruno-6.intro': 'Prends de l’avance. Tu en auras besoin. Grrr.',
    'bruno-7.tip':
      'Bloque ses trois ouverts tout de suite, du côté qui garde tes pierres connectées.',
    'bruno-7.twist': 'Bruno joue en premier et fonce sur chaque ligne qu’il commence.',
    'vex-1.tip': 'En jouant en premier, le jeu parfait gagne en sept coups. Commence sur un bord.',
    'vex-2.tip':
      'Gagne le plateau central, et n’envoie jamais Vex sur un plateau qu’il peut prendre.',
    'vex-3.tip': 'Bloque tôt les trois ouverts. Vex en fait des quatre en gardant l’initiative.',
    'vex-4.tip':
      'Les lignes traversent les couches. Une menace sur deux couches à la fois est une fourchette.',
    'vex-4.intro': 'Quatre couches. Plein de place pour cacher quelque chose.',
    'vex-5.tip': 'Garde ta Bombe pour le symbole qui relie deux lignes de Vex.',
    'vex-6.tip':
      'Tu commences avec la colonne centrale empilée. Vex va essayer de te faire remplir sous ses menaces.',
    'vex-6.intro': 'Prends la colonne centrale. J’insiste. Vraiment.',
    'vex-7.tip':
      'Ouvre avec un symbole que tu accepterais d’affronter. Vex échange tout ce qui en vaut la peine.',
    'vex-7.twist': 'Exactement cinq, et Vex peut te voler ton symbole d’ouverture.',
    'nyx-1.tip':
      'Nyx calcule jusqu’à la dernière seconde. Seule une victoire forcée en viendra à bout.',
    'nyx-2.tip': 'Compte les cases que chacun de vous sera forcé de remplir.',
    'nyx-3.tip': 'L’épreuve finale. Attaque d’abord, et ne lâche jamais l’initiative.',
    'nyx-4.tip': 'Nyx lit chaque envoi. Prends les petits plateaux alignés avec ceux que tu tiens.',
    'nyx-5.tip':
      'Les captures changent le compte. Ne laisse jamais deux des tiens exposés à un encadrement.',
    'nyx-6.tip':
      'Les rangées paires et impaires décident de la fin de partie. Garde tes menaces sur les rangées que tu atteindras.',
    'nyx-7.tip':
      'Tu as le centre et un coup gratuit. Attaque avant que le fantôme ne retrouve son chemin.',
    'nyx-7.twist': 'Nyx laisse sa première pierre dériver vers le coin. Un cadeau — ou un appât ?',
  },
  de: {
    'pip.greeting': 'Quak! Ich kenn die Regeln erst seit eben. Sei nachsichtig mit mir?',
    'pip.gloat': 'Moment… ich hab gewonnen? Anfängerglück!',
    'pip.concede': 'Hüpf weiter – du bist ein Naturtalent.',
    'pip.signatureName': 'Nachmacher',
    'pip.signatureDescription': 'Antwortet auf deinen Zug mit dessen Spiegelbild auf dem Brett.',
    'pip.chapterTitle': 'Der Seerosenteich',
    'pip.chapterBlurb':
      'Lerne das Brett kennen – gegen einen Frosch, der mehr nachmacht als plant.',
    'mo.greeting': 'Ich blockiere immer. Nur was danach kommt, seh ich nicht.',
    'mo.gloat': 'Schnurrfekt. Nochmal?',
    'mo.concede': 'Hmpf. Zwei Drohungen auf einmal ist Schummeln. (Ist es nicht.)',
    'mo.signatureName': 'Katzensprung',
    'mo.signatureDescription': 'Erstickt deine Reihen, bevor sie zu Drohungen werden.',
    'mo.chapterTitle': 'Die Dächer',
    'mo.chapterBlurb':
      'Eine Katze, die alles blockiert. Schaffe zwei Drohungen, und eine kommt durch.',
    'sage.greeting': 'Ich sehe drei Züge voraus. Leg deine Fallen weiter draußen aus.',
    'sage.gloat': 'Geduld gewinnt Partien. Huhu.',
    'sage.concede': 'Eine feine Kombination. Die habe ich nicht kommen sehen.',
    'sage.signatureName': 'Die Mitte hält',
    'sage.signatureDescription': 'Nimmt die Mitte jedes Bretts und baut still nach außen.',
    'sage.chapterTitle': 'Die alte Eiche',
    'sage.chapterBlurb': 'Eine Eule, die drei Züge vorausschaut. Plane vier.',
    'bruno.greeting': 'Große Bretter, große Pläne. Lass keine offene Vier rumliegen.',
    'bruno.gloat': 'Grrroßartiges Spiel. Für mich.',
    'bruno.concede': 'Du hast mehr gebaut als ich. Respekt.',
    'bruno.signatureName': 'Bärensturm',
    'bruno.signatureDescription': 'Verlängert stets seine längste Reihe – und lässt Lücken zurück.',
    'bruno.chapterTitle': 'Der große Wald',
    'bruno.chapterBlurb': 'Ein Bär, der groß baut. Blockiere früh, dann bau mehr als er.',
    'vex.greeting': 'Jeder stille Zug von mir ist eine Falle. Jeder einzelne.',
    'vex.gloat': 'Zu langsam, zu nett. Nochmal?',
    'vex.concede': 'Clever. Ärgerlich clever.',
    'vex.signatureName': 'Fuchsfalle',
    'vex.signatureDescription': 'Stille Züge, aus denen zwei Drohungen auf einmal wachsen.',
    'vex.chapterTitle': 'Der Fuchsbau',
    'vex.chapterBlurb': 'Jeder stille Zug ist eine Falle. Zähl die Linien, bevor du antwortest.',
    'nyx.greeting': 'Ich habe schon gesehen, wie das endet.',
    'nyx.gloat': 'Wie vorhergesehen.',
    'nyx.concede': '…Das sah ich nicht voraus. Gut gespielt.',
    'nyx.signatureName': 'Vorsehung',
    'nyx.signatureDescription':
      'Sagt es an, sobald Nyx einen erzwungenen Sieg sieht. Meist zu Recht.',
    'nyx.chapterTitle': 'Der Schleier',
    'nyx.chapterBlurb':
      'Ein Geist, der rechnet, bis die Uhr abläuft. Nur ein erzwungener Sieg genügt.',
    'pip-1.tip': 'Nimm die Mitte und drohe dann mit zwei Reihen auf einmal.',
    'pip-2.tip':
      'Vier in einer Reihe. Eine offene Drei – an beiden Enden frei – ist schon schwer zu stoppen.',
    'pip-3.tip': 'Nur deine drei neuesten Zeichen bleiben. Das verblassende ist gleich weg.',
    'pip-4.tip':
      'Hier verlieren drei in einer Reihe. Fülle sichere Felder, bis Pip keine mehr hat.',
    'pip-4.intro': 'Drei in einer Reihe ist hier SCHLECHT? Quak. Ich pass ganz doll auf.',
    'pip-5.tip': 'Pip beginnt. Baue dort, wo du das Feld darüber haben willst.',
    'pip-5.intro': 'Ich zuerst! Plopp!',
    'pip-6.tip':
      'Ecken und Mitte schaffen Gabeln: zwei Reihen, die ein einzelnes Zeichen nicht blockieren kann.',
    'pip-6.intro': 'Zeig mir mal so einen Zwei-Reihen-Trick. Den will ich sehen!',
    'pip-7.tip':
      'Ein Spiegel stoppt keine zwei Drohungen. Baue Reihen, die durch die Mitte laufen.',
    'pip-7.twist': 'Nachmacher Pip spiegelt fast jeden deiner Züge.',
    'mo-1.tip': 'Mo blockiert jede einzelne Drohung. Schaffe zwei, und eine kommt durch.',
    'mo-2.tip': 'Drei in einer Reihe verlieren hier. Lass Mo kein sicheres Feld.',
    'mo-3.tip':
      'Zeichen fallen. Eine Drohung ein Feld höher wartet, bis jemand das Feld darunter füllt.',
    'mo-4.tip': 'Jede Zweierreihe ist ein Geschenk für den, der als Nächstes zieht. Lass Mo keine.',
    'mo-4.intro': 'Jedes Zeichen, jede Reihe? Dann blockier ich eben alle.',
    'mo-5.tip':
      'Mo beginnt mit der mittleren Diagonale. Blockiere sie vom offenen Ende her, dann baue.',
    'mo-5.intro': 'Ich hab die gemütlichen Felder. Du kriegst die Ecke.',
    'mo-6.tip':
      'Sieben Spalten, sechs hoch. Drohungen in der Zeile über einer vollen halten am längsten.',
    'mo-7.tip': 'Mo erstickt jede Reihe, die Mo sieht. Baue zwei, wo Mo nur eine im Blick hat.',
    'mo-7.twist': 'Mo zieht zuerst und blockiert härter denn je.',
    'sage-1.tip': 'Sage blickt drei Züge voraus. Baue Formen, die erst später zu Drohungen werden.',
    'sage-2.tip':
      'Eine Reihe durch Sages verblassendes Zeichen ist keine Reihe – für keinen von euch.',
    'sage-3.tip':
      'Jedes Feld, das du wählst, schickt Sage auf ein Brett. Schick Sage dorthin, wo es nichts nützt.',
    'sage-4.tip': 'Sage liebt die Mitte. In Misère ist die Mitte eine Last – überlass sie Sage.',
    'sage-4.intro': 'Weniger tun ist eine Kunst. Mal sehen, wer sie besser beherrscht.',
    'sage-5.tip': 'Du bist Ordnung. Fünf Gleiche in einer Reihe gewinnen – auch aus Sages Zeichen.',
    'sage-5.intro': 'Ordnung und Chaos. Mir war stets das Stillere lieber.',
    'sage-6.tip': 'Sage setzt zuerst in die mittlere Spalte. Kämpfe um die Felder daneben.',
    'sage-7.tip':
      'Du wirst zuerst aufs mittlere Brett geschickt. Schick Sage zur Antwort auf ein ödes.',
    'sage-7.twist': 'Sage eröffnet in der Mitte des mittleren Bretts.',
    'bruno-1.tip':
      'Fünf in einer Reihe. Eine Vier und eine offene Drei zugleich lassen sich nicht beide blockieren.',
    'bruno-2.tip': 'Staple zwei Drohungen in einer Spalte – die untere bringt dir die obere.',
    'bruno-3.tip': 'Spiel nahe der Mitte und halte deine Steine verbunden.',
    'bruno-4.tip':
      'Bruno baut lang. Zwei seiner Zeichen in einer Reihe, dahinter deins: Da wartet ein Schlag.',
    'bruno-4.intro': 'Schlagen? Na gut. Ich bau schneller, als du nehmen kannst.',
    'bruno-5.tip': 'Felsen unterbrechen Reihen. Zähl, welche Linien noch Platz für fünf haben.',
    'bruno-6.tip':
      'Bruno schenkt dir die mittlere Diagonale. Mach zwei Drohungen daraus, bevor er sie zumauert.',
    'bruno-6.intro': 'Nimm einen Vorsprung. Du wirst ihn brauchen. Grrr.',
    'bruno-7.tip':
      'Blockiere seine offenen Dreien sofort – von der Seite, die deine Steine verbunden hält.',
    'bruno-7.twist': 'Bruno zieht zuerst und stürmt jede Reihe, die er beginnt.',
    'vex-1.tip': 'Wer zuerst zieht, gewinnt bei perfektem Spiel in sieben Zügen. Beginne am Rand.',
    'vex-2.tip': 'Gewinne das mittlere Brett und schick Vex nie auf ein Brett, das Vex holen kann.',
    'vex-3.tip': 'Blockiere offene Dreien früh. Vex macht daraus Vierer mit Tempo.',
    'vex-4.tip':
      'Linien laufen durch die Ebenen. Eine Drohung auf zwei Ebenen zugleich ist eine Gabel.',
    'vex-4.intro': 'Vier Ebenen. Viel Platz, um etwas zu verstecken.',
    'vex-5.tip': 'Heb deine Bombe für das Zeichen auf, das zwei von Vex’ Reihen zusammenhält.',
    'vex-6.tip':
      'Du beginnst mit gestapelter Mittelspalte. Vex will dich unter seinen Drohungen auffüllen lassen.',
    'vex-6.intro': 'Nimm die Mittelspalte. Ich bestehe darauf. Wirklich.',
    'vex-7.tip':
      'Eröffne mit einem Zeichen, gegen das du gern spielen würdest. Vex tauscht alles, was etwas taugt.',
    'vex-7.twist': 'Genau fünf – und Vex darf dein Eröffnungszeichen stehlen.',
    'nyx-1.tip': 'Nyx rechnet, bis die Uhr abläuft. Nur ein erzwungener Sieg genügt.',
    'nyx-2.tip': 'Zähl, welche Felder jeder von euch füllen muss.',
    'nyx-3.tip': 'Die letzte Prüfung. Greif zuerst an und gib die Initiative nie mehr ab.',
    'nyx-4.tip':
      'Nyx durchschaut, wohin du schickst. Nimm kleine Bretter, die mit deinen eine Linie bilden.',
    'nyx-5.tip':
      'Schläge verändern die Rechnung. Lass nie zwei deiner Zeichen zum Einschließen offen.',
    'nyx-6.tip':
      'Gerade und ungerade Zeilen entscheiden das Endspiel. Halte deine Drohungen auf Zeilen, die du erreichst.',
    'nyx-7.tip': 'Du hast die Mitte und einen Zug gratis. Greif an, bevor der Geist zurückfindet.',
    'nyx-7.twist':
      'Nyx lässt seinen ersten Stein in die Ecke treiben. Ein Geschenk – oder ein Köder?',
  },
  fa: {
    'pip.greeting': 'قور قور! تازه قانون‌ها رو یاد گرفتم. هوامو داری؟',
    'pip.gloat': 'صبر کن… من بردم؟ شانس مبتدی!',
    'pip.concede': 'یه جست حسابی — تو ذاتاً بلدی.',
    'pip.signatureName': 'تقلیدچی',
    'pip.signatureDescription': 'به حرکتت با قرینهٔ آینه‌ای‌اش در آن سوی صفحه جواب می‌دهد.',
    'pip.chapterTitle': 'برکهٔ نیلوفر',
    'pip.chapterBlurb': 'صفحه را در برابر قورباغه‌ای یاد بگیر که بیشتر تقلید می‌کند تا نقشه بکشد.',
    'mo.greeting': 'من همیشه راهتو می‌بندم. چیزی که نمی‌بینم، اون چیزیه که بعدش میاد.',
    'mo.gloat': 'بی‌نقص، خرخر. دوباره؟',
    'mo.concede': 'هه. دوتا تهدید هم‌زمان تقلبه. (نیست.)',
    'mo.signatureName': 'خیز گربه',
    'mo.signatureDescription': 'ردیف‌هایت را پیش از آنکه تهدید شوند خفه می‌کند.',
    'mo.chapterTitle': 'پشت‌بام‌ها',
    'mo.chapterBlurb': 'گربه‌ای که همه‌چیز را می‌بندد. دو تهدید بساز تا یکی رد شود.',
    'sage.greeting': 'من سه حرکت جلوتر را می‌بینم. دام‌هایت را دورتر از آن پهن کن.',
    'sage.gloat': 'صبر بازی می‌برد. هو.',
    'sage.concede': 'ترکیبی زیبا. آمدنش را ندیدم.',
    'sage.signatureName': 'مرکز پابرجاست',
    'sage.signatureDescription': 'وسط هر صفحه را می‌گیرد و آرام‌آرام به بیرون می‌سازد.',
    'sage.chapterTitle': 'بلوط کهن',
    'sage.chapterBlurb': 'جغدی که سه حرکت جلوتر را می‌بیند. تو برای چهار حرکت نقشه بکش.',
    'bruno.greeting': 'صفحهٔ بزرگ، نقشهٔ بزرگ. چهارتایی باز رو همین‌جوری ول نکن.',
    'bruno.gloat': 'بازی محشرررری بود. برای من.',
    'bruno.concede': 'از من بیشتر ساختی. احترام.',
    'bruno.signatureName': 'هجوم خرس',
    'bruno.signatureDescription':
      'همیشه بلندترین ردیفش را ادامه می‌دهد — و پشت سرش رخنه جا می‌گذارد.',
    'bruno.chapterTitle': 'جنگل بزرگ',
    'bruno.chapterBlurb': 'خرسی که بزرگ می‌سازد. زود ببند، بعد بیشتر از او بساز.',
    'vex.greeting': 'هر حرکت بی‌صدای من یه تله‌ست. همه‌شون.',
    'vex.gloat': 'زیادی کُندی، زیادی مهربون. دوباره؟',
    'vex.concede': 'زرنگی. به‌طرز اعصاب‌خردکنی زرنگی.',
    'vex.signatureName': 'تلهٔ روباه',
    'vex.signatureDescription': 'حرکت‌های بی‌صدایی که به دو تهدید هم‌زمان تبدیل می‌شوند.',
    'vex.chapterTitle': 'لانهٔ روباه',
    'vex.chapterBlurb': 'هر حرکت بی‌صدا یک تله است. پیش از جواب دادن، ردیف‌ها را بشمار.',
    'nyx.greeting': 'پایان این بازی را پیش‌تر دیده‌ام.',
    'nyx.gloat': 'چنان‌که پیش‌بینی شده بود.',
    'nyx.concede': '…این را پیش‌بینی نکرده بودم. خوب بازی کردی.',
    'nyx.signatureName': 'پیشگویی',
    'nyx.signatureDescription':
      'همین که برد اجباری را ببیند، اعلامش می‌کند. معمولاً هم درست می‌گوید.',
    'nyx.chapterTitle': 'پرده',
    'nyx.chapterBlurb': 'شبحی که تا تمام شدن وقت جست‌وجو می‌کند. فقط برد اجباری کارساز است.',
    'pip-1.tip': 'مرکز را بگیر، بعد هم‌زمان دو ردیف را تهدید کن.',
    'pip-2.tip':
      'چهارتا در یک ردیف. سه‌تایی باز — که هر دو سرش خالی است — همین حالا هم به‌سختی بسته می‌شود.',
    'pip-3.tip': 'فقط سه علامت تازه‌ات می‌مانند. آن کم‌رنگ دارد می‌رود.',
    'pip-4.tip':
      'اینجا سه‌تا در یک ردیف می‌بازد. خانه‌های امن را پر کن و بگذار خانه‌های امن Pip تمام شود.',
    'pip-4.intro': 'اینجا سه‌تا پشت هم بده؟ قور. حسابی مواظبم.',
    'pip-5.tip': 'Pip اول مهره می‌اندازد. جایی بساز که خانهٔ بالایی‌اش همانی باشد که می‌خواهی.',
    'pip-5.intro': 'من اول! شلپ!',
    'pip-6.tip': 'گوشه‌ها و مرکز دوشاخه می‌سازند: دو ردیف که یک علامت نمی‌تواند هر دو را ببندد.',
    'pip-6.intro': 'یکی از اون حقه‌های دوردیفه رو نشونم بده. می‌خوام ببینم!',
    'pip-7.tip': 'آینه نمی‌تواند جلوی دو تهدید را بگیرد. ردیف‌هایی بساز که از مرکز می‌گذرند.',
    'pip-7.twist': 'Pip تقلیدچی تقریباً هر حرکتت را آینه‌وار تکرار می‌کند.',
    'mo-1.tip': 'Mo تک‌تک تهدیدها را می‌بندد. دوتا بساز تا یکی رد شود.',
    'mo-2.tip': 'اینجا سه‌تا در یک ردیف می‌بازد. هیچ جای امنی برای Mo باقی نگذار.',
    'mo-3.tip':
      'علامت‌ها می‌افتند. تهدیدی که یک خانه بالاتر در ستون است، منتظر می‌ماند تا کسی خانهٔ زیرش را پر کند.',
    'mo-4.tip':
      'هر دوتای پشت سر هم هدیه‌ای است به هر کسی که بعد حرکت کند. برای Mo هیچ‌کدام را جا نگذار.',
    'mo-4.intro': 'هر علامتی، هر ردیفی؟ همه‌شونو می‌بندم.',
    'mo-5.tip': 'Mo با قطر میانی شروع می‌کند. از سر بازش ببند، بعد بساز.',
    'mo-5.intro': 'خونه‌های راحت رو من برداشتم. گوشه مال تو.',
    'mo-6.tip':
      'هفت ستون، شش ردیف ارتفاع. تهدیدهایی که درست بالای یک ردیف پر قرار دارند ماندگارند.',
    'mo-7.tip': 'Mo هر ردیفی را که ببیند خفه می‌کند. دوتا بساز، جایی که فقط یکی را زیر نظر دارد.',
    'mo-7.twist': 'Mo اول حرکت می‌کند و سخت‌تر از همیشه می‌بندد.',
    'sage-1.tip': 'Sage سه حرکت جلوتر را می‌بیند. شکل‌هایی بساز که بعدها تهدید شوند.',
    'sage-2.tip': 'ردیفی که از علامت رو به محو Sage بگذرد اصلاً ردیف نیست — برای هیچ‌کدامتان.',
    'sage-3.tip': 'هر خانه‌ای که انتخاب می‌کنی Sage را به یک صفحه می‌فرستد. جایی بی‌فایده بفرستش.',
    'sage-4.tip': 'Sage عاشق مرکز است. در میزر مرکز دردسر است — بگذار مال او باشد.',
    'sage-4.intro': 'کمتر کار کردن هنر است. ببینیم کدام‌یک از ما بیشتر از آن دارد.',
    'sage-5.tip':
      'تو «نظم» هستی. هر پنج علامت یکسان در یک ردیف می‌برد — حتی اگر علامت‌های Sage باشند.',
    'sage-5.intro': 'نظم و آشوب. من همیشه آن آرام‌تر را ترجیح داده‌ام.',
    'sage-6.tip': 'Sage اول در ستون وسط مهره می‌اندازد. برای خانه‌های کنارش بجنگ.',
    'sage-7.tip':
      'اول به صفحهٔ وسط فرستاده می‌شوی. جوابش این است که Sage را جایی کسل‌کننده بفرستی.',
    'sage-7.twist': 'Sage در مرکزِ صفحهٔ مرکزی شروع می‌کند.',
    'bruno-1.tip': 'پنج‌تا در یک ردیف. یک چهارتایی و یک سه‌تایی باز را با هم نمی‌شود بست.',
    'bruno-2.tip': 'دو تهدید را در یک ستون روی هم بچین؛ تهدید پایینی، بالایی را برایت می‌برد.',
    'bruno-3.tip': 'نزدیک مرکز بازی کن و مهره‌هایت را به هم وصل نگه دار.',
    'bruno-4.tip':
      'Bruno بلند می‌سازد. دو علامت پشت سر هم از او که علامت تو آن سرشان باشد، گرفتنی است که منتظر توست.',
    'bruno-4.intro': 'گرفتن؟ باشه. من سریع‌تر از اونی که تو بگیری می‌سازم.',
    'bruno-5.tip': 'صخره‌ها ردیف‌ها را می‌شکنند. بشمار کدام خط‌ها هنوز پنج خانه جا دارند.',
    'bruno-6.tip':
      'Bruno قطر مرکزی را به تو می‌بخشد. پیش از آنکه دورش دیوار بکشد، دو تهدید از آن بساز.',
    'bruno-6.intro': 'یه کم جلو بیفت. لازمت می‌شه. غرررر.',
    'bruno-7.tip': 'سه‌تایی‌های بازش را فوراً ببند، از سمتی که مهره‌هایت به هم وصل بمانند.',
    'bruno-7.twist': 'Bruno اول حرکت می‌کند و هر ردیفی را که شروع کند با عجله پیش می‌برد.',
    'vex-1.tip': 'اگر اول حرکت کنی، بازی بی‌نقص در هفت حرکت می‌برد. از لبه شروع کن.',
    'vex-2.tip': 'صفحهٔ مرکزی را ببر، و هیچ‌وقت Vex را به صفحه‌ای نفرست که می‌تواند بگیرد.',
    'vex-3.tip':
      'سه‌تایی‌های باز را زود ببند. Vex آن‌ها را به چهارتایی‌هایی تبدیل می‌کند که وادارت می‌کنند جواب بدهی.',
    'vex-4.tip': 'خط‌ها از میان لایه‌ها می‌گذرند. تهدید هم‌زمان در دو لایه یعنی دوشاخه.',
    'vex-4.intro': 'چهار لایه. کلی جا برای قایم کردن یه چیزی.',
    'vex-5.tip': 'بمبت را برای علامتی نگه دار که دو ردیف Vex را به هم وصل کرده.',
    'vex-6.tip':
      'بازی را با ستون مرکزیِ چیده‌شده شروع می‌کنی. Vex سعی می‌کند مجبورت کند زیر تهدیدهایش را پر کنی.',
    'vex-6.intro': 'ستون وسط مال تو. اصرار دارم. جدی.',
    'vex-7.tip':
      'با علامتی شروع کن که حاضر باشی در برابرش هم بازی کنی. Vex هر چیزی را که ارزش داشتن داشته باشد مال خود می‌کند.',
    'vex-7.twist': 'دقیقاً پنج‌تا، و Vex ممکن است علامت شروعت را بدزدد.',
    'nyx-1.tip': 'Nyx تا تمام شدن وقت جست‌وجو می‌کند. فقط برد اجباری کارساز است.',
    'nyx-2.tip': 'بشمار هر کدامتان مجبور می‌شوید کدام خانه‌ها را پر کنید.',
    'nyx-3.tip': 'آزمون نهایی. اول حمله کن، و هرگز ابتکار عمل را از دست نده.',
    'nyx-4.tip':
      'Nyx هر فرستادنی را می‌خواند. صفحه‌های کوچکی را بگیر که با آن‌هایی که داری در یک ردیف قرار می‌گیرند.',
    'nyx-5.tip': 'گرفتن‌ها حساب را عوض می‌کنند. هرگز دوتا از علامت‌هایت را در معرض محاصره نگذار.',
    'nyx-6.tip':
      'ردیف‌های زوج و فرد پایان بازی را تعیین می‌کنند. تهدیدهایت را روی ردیف‌هایی نگه دار که به آن‌ها می‌رسی.',
    'nyx-7.tip': 'مرکز و یک حرکت آزاد با توست. پیش از آنکه شبح راه برگشتش را پیدا کند حمله کن.',
    'nyx-7.twist': 'Nyx می‌گذارد اولین مهره‌اش به گوشه بلغزد. هدیه — یا طعمه؟',
  },
});

export interface RivalText {
  /** One line, said before the first game. */
  readonly greeting: string;
  readonly gloat: string;
  readonly concede: string;
  readonly signature: { readonly name: string; readonly description: string };
  readonly chapter: { readonly title: string; readonly blurb: string };
}

export interface StageText {
  readonly tip: string;
  readonly intro?: string;
  readonly twist?: string;
}

/** A rival's own words in `locale` (the current one by default). */
export function rivalText(rival: Rival | RivalId, locale?: Locale): RivalText {
  const id = typeof rival === 'string' ? rival : rival.id;
  const text = (field: string) =>
    translate(journeyContentMessages, `${id}.${field}`, undefined, locale);
  return {
    greeting: text('greeting'),
    gloat: text('gloat'),
    concede: text('concede'),
    signature: { name: text('signatureName'), description: text('signatureDescription') },
    chapter: { title: text('chapterTitle'), blurb: text('chapterBlurb') },
  };
}

/** A stage's tip, and its intro and twist where it has them, in `locale`. */
export function stageText(stage: Stage, locale?: Locale): StageText {
  const text = (field: string) =>
    translate(journeyContentMessages, `${stage.id}.${field}`, undefined, locale);
  return {
    tip: text('tip'),
    ...(stage.intro ? { intro: text('intro') } : {}),
    ...(stage.twist ? { twist: text('twist') } : {}),
  };
}

/** A stage's third-star objective, as the stage sheet lists it. */
export function objectiveText(stage: Stage, locale?: Locale): string {
  const count = stage.objective === 'par' ? stage.par[1] : stage.par[0];
  return translate(journeyMessages, `objective.${stage.objective}`, { count }, locale);
}

/** The journey's text helpers bound to the current language, re-rendering on a change. */
export function useJourneyText(): {
  rival: (rival: Rival | RivalId) => RivalText;
  stage: (stage: Stage) => StageText;
  objective: (stage: Stage) => string;
} {
  const locale = useLocale();
  return {
    rival: (rival) => rivalText(rival, locale),
    stage: (stage) => stageText(stage, locale),
    objective: (stage) => objectiveText(stage, locale),
  };
}
