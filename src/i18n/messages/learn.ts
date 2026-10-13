import { defineMessages } from '@/i18n';

/** The how-to-play screen and the first-launch walkthrough. */
export const learnMessages = defineMessages({
  en: {
    howToPlay: 'How to play',
    backHome: 'Back to home',

    // The walkthrough
    stepOf: 'Step {step} of {total}',
    skip: 'Skip',
    'step1.title': 'Place your mark',
    'step1.body': 'Tap any empty square to play there. You are X and you move first.',
    'step1.success': 'Your mark is down. Now the other player takes a turn.',
    'step1.middle':
      'Nice. The middle sits on four different lines. Now the other player takes a turn.',
    'step2.title': 'Win the game',
    'step2.body':
      'Three of your marks in a row wins — across, down or diagonally. Find the square that finishes it.',
    'step2.success': 'That is three in a row. The line lights up when a game is won.',
    'step3.title': 'Block the other player',
    'step3.body': 'O is one move from winning down the left side. Take that square before they do.',
    'step3.success':
      'Blocked. Watching your opponent’s lines matters as much as building your own.',
    tryAgain: 'Look for the marked square and try again.',
    nextUp: 'Next up: {mode}',
    startPlaying: 'Start playing',
    next: 'Next',

    // The how-to-play screen
    walkthroughTitle: 'Three moves, thirty seconds',
    walkthroughBody:
      'Place a mark, win a game and block an opponent — on a real board, not a diagram.',
    startWalkthrough: 'Start the walkthrough',
    mode: 'Mode',
    board: 'Board',
    boardSize: '{size} × {size}',
    cubeSize: '{size} × {size} × {size}',
    inARow: 'In a row',
    clock: 'Clock',
    clockMinutes: '{count} min',
    clockValue: '{time} + {count}s',
    ranked: 'Ranked',
    rankedYes: 'Yes',
    rankedNo: 'Casual only',
    practiceHints: 'Practice with hints',
    playBot: 'Play the bot',
    playRanked: 'Play ranked',
    goodToKnow: 'Good to know',
    'tip.ranked.title': 'Ranked vs casual.',
    'tip.ranked.body':
      'Only ranked games move your rating. Leaving one early counts as a resignation.',
    'tip.clocks.title': 'Clocks.',
    'tip.clocks.body':
      'Every online game is timed, with a few seconds added after each move. Running out loses the game.',
    'tip.disconnect.title': 'Disconnections.',
    'tip.disconnect.body':
      'Your seat is held for {count} seconds and your clock keeps running. Come back and you carry on where you were.',
    'tip.practice.title': 'Practice mode.',
    'tip.practice.body':
      'Hints ring the square that wins and the one you must block, you can take moves back, and the target button asks the engine what it would play.',
    'tip.journey.title': 'Journey.',
    'tip.journey.body':
      '{rivals} rivals, {stages} stages, every mode. You always move first; win in fewer moves for more stars.',
    'tip.puzzles.title': 'Puzzles.',
    'tip.puzzles.body':
      'Every one is a proven forced win. A new daily puzzle arrives each day — solve them on consecutive days to build a streak.',
    'tip.pieces.title': 'Pieces.',
    'tip.pieces.body':
      'Win against the bot, solve puzzles and earn journey stars to unlock new piece sets in Settings.',
  },

  es: {
    howToPlay: 'Cómo jugar',
    backHome: 'Volver al inicio',
    stepOf: 'Paso {step} de {total}',
    skip: 'Saltar',
    'step1.title': 'Coloca tu marca',
    'step1.body': 'Toca cualquier casilla vacía para jugar ahí. Eres X y mueves primero.',
    'step1.success': 'Tu marca está puesta. Ahora le toca al otro jugador.',
    'step1.middle':
      'Bien. El centro está en cuatro líneas distintas. Ahora le toca al otro jugador.',
    'step2.title': 'Gana la partida',
    'step2.body':
      'Tres de tus marcas en línea ganan: en horizontal, vertical o diagonal. Encuentra la casilla que la completa.',
    'step2.success': 'Eso es tres en raya. La línea se ilumina cuando se gana una partida.',
    'step3.title': 'Bloquea al otro jugador',
    'step3.body':
      'A O le falta una jugada para ganar por el lado izquierdo. Ocupa esa casilla antes que él.',
    'step3.success':
      'Bloqueado. Vigilar las líneas de tu rival importa tanto como construir las tuyas.',
    tryAgain: 'Busca la casilla marcada y vuelve a intentarlo.',
    nextUp: 'A continuación: {mode}',
    startPlaying: 'Empezar a jugar',
    next: 'Siguiente',
    walkthroughTitle: 'Tres jugadas, treinta segundos',
    walkthroughBody:
      'Coloca una marca, gana una partida y bloquea a un rival, en un tablero real y no en un diagrama.',
    startWalkthrough: 'Empezar el tutorial',
    mode: 'Modo',
    board: 'Tablero',
    boardSize: '{size} × {size}',
    cubeSize: '{size} × {size} × {size}',
    inARow: 'En línea',
    clock: 'Reloj',
    clockMinutes: '{count} min',
    clockValue: '{time} + {count} s',
    ranked: 'Clasificatoria',
    rankedYes: 'Sí',
    rankedNo: 'Solo amistosas',
    practiceHints: 'Practicar con pistas',
    playBot: 'Jugar contra el bot',
    playRanked: 'Jugar clasificatoria',
    goodToKnow: 'Conviene saber',
    'tip.ranked.title': 'Clasificatorias y amistosas.',
    'tip.ranked.body':
      'Solo las partidas clasificatorias cambian tu puntuación. Abandonar una antes de tiempo cuenta como rendirse.',
    'tip.clocks.title': 'Relojes.',
    'tip.clocks.body':
      'Todas las partidas en línea tienen tiempo, con unos segundos extra tras cada jugada. Si se te acaba, pierdes.',
    'tip.disconnect.title': 'Desconexiones.',
    'tip.disconnect.body':
      'Tu sitio se guarda durante {count} segundos y tu reloj sigue corriendo. Vuelve y continúas donde lo dejaste.',
    'tip.practice.title': 'Modo práctica.',
    'tip.practice.body':
      'Las pistas marcan la casilla que gana y la que debes bloquear, puedes deshacer jugadas y el botón de diana pregunta al motor qué jugaría.',
    'tip.journey.title': 'Viaje.',
    'tip.journey.body':
      '{rivals} rivales, {stages} etapas, todos los modos. Siempre mueves primero; gana en menos jugadas para conseguir más estrellas.',
    'tip.puzzles.title': 'Puzles.',
    'tip.puzzles.body':
      'Cada uno es una victoria forzada demostrada. Cada día llega un puzle diario nuevo: resuélvelos en días seguidos para crear una racha.',
    'tip.pieces.title': 'Piezas.',
    'tip.pieces.body':
      'Gana al bot, resuelve puzles y consigue estrellas del viaje para desbloquear nuevos juegos de piezas en Ajustes.',
  },

  fr: {
    howToPlay: 'Comment jouer',
    backHome: 'Retour à l’accueil',
    stepOf: 'Étape {step} sur {total}',
    skip: 'Passer',
    'step1.title': 'Placez votre symbole',
    'step1.body': 'Touchez une case vide pour y jouer. Vous êtes X et vous commencez.',
    'step1.success': 'Votre symbole est posé. C’est maintenant au tour de l’autre joueur.',
    'step1.middle':
      'Bien joué. Le centre se trouve sur quatre lignes différentes. C’est maintenant au tour de l’autre joueur.',
    'step2.title': 'Gagnez la partie',
    'step2.body':
      'Trois de vos symboles alignés gagnent — à l’horizontale, à la verticale ou en diagonale. Trouvez la case qui complète la ligne.',
    'step2.success': 'Trois alignés ! La ligne s’illumine quand une partie est gagnée.',
    'step3.title': 'Bloquez l’autre joueur',
    'step3.body': 'O est à un coup de gagner sur le côté gauche. Prenez cette case avant lui.',
    'step3.success':
      'Bloqué. Surveiller les lignes adverses compte autant que construire les vôtres.',
    tryAgain: 'Repérez la case marquée et réessayez.',
    nextUp: 'Ensuite : {mode}',
    startPlaying: 'Commencer à jouer',
    next: 'Suivant',
    walkthroughTitle: 'Trois coups, trente secondes',
    walkthroughBody:
      'Placez un symbole, gagnez une partie et bloquez un adversaire — sur un vrai plateau, pas un schéma.',
    startWalkthrough: 'Lancer le tutoriel',
    mode: 'Mode',
    board: 'Plateau',
    boardSize: '{size} × {size}',
    cubeSize: '{size} × {size} × {size}',
    inARow: 'À aligner',
    clock: 'Pendule',
    clockMinutes: '{count} min',
    clockValue: '{time} + {count} s',
    ranked: 'Classé',
    rankedYes: 'Oui',
    rankedNo: 'Amical uniquement',
    practiceHints: 'S’entraîner avec des indices',
    playBot: 'Affronter le bot',
    playRanked: 'Jouer en classé',
    goodToKnow: 'Bon à savoir',
    'tip.ranked.title': 'Classé ou amical.',
    'tip.ranked.body':
      'Seules les parties classées modifient votre classement. Quitter une partie avant la fin compte comme un abandon.',
    'tip.clocks.title': 'Pendules.',
    'tip.clocks.body':
      'Chaque partie en ligne est chronométrée, avec quelques secondes ajoutées après chaque coup. Tomber à zéro fait perdre la partie.',
    'tip.disconnect.title': 'Déconnexions.',
    'tip.disconnect.body':
      'Votre place est gardée {count} secondes et votre pendule continue de tourner. Revenez et reprenez là où vous en étiez.',
    'tip.practice.title': 'Mode entraînement.',
    'tip.practice.body':
      'Les indices entourent la case gagnante et celle que vous devez bloquer, vous pouvez annuler des coups, et le bouton cible demande au moteur ce qu’il jouerait.',
    'tip.journey.title': 'Voyage.',
    'tip.journey.body':
      '{rivals} rivaux, {stages} étapes, tous les modes. Vous commencez toujours ; gagnez en moins de coups pour plus d’étoiles.',
    'tip.puzzles.title': 'Puzzles.',
    'tip.puzzles.body':
      'Chacun est un gain forcé démontré. Un nouveau puzzle du jour arrive chaque jour — résolvez-les plusieurs jours de suite pour construire une série.',
    'tip.pieces.title': 'Pièces.',
    'tip.pieces.body':
      'Battez le bot, résolvez des puzzles et gagnez des étoiles du voyage pour débloquer de nouveaux jeux de pièces dans les Réglages.',
  },

  de: {
    howToPlay: 'Spielanleitung',
    backHome: 'Zurück zum Start',
    stepOf: 'Schritt {step} von {total}',
    skip: 'Überspringen',
    'step1.title': 'Setze dein Zeichen',
    'step1.body': 'Tippe auf ein leeres Feld, um dort zu spielen. Du bist X und beginnst.',
    'step1.success': 'Dein Zeichen steht. Jetzt ist der andere Spieler dran.',
    'step1.middle':
      'Gut. Die Mitte liegt auf vier verschiedenen Linien. Jetzt ist der andere Spieler dran.',
    'step2.title': 'Gewinne das Spiel',
    'step2.body':
      'Drei deiner Zeichen in einer Reihe gewinnen – waagerecht, senkrecht oder diagonal. Finde das Feld, das die Reihe vollendet.',
    'step2.success':
      'Das sind drei in einer Reihe. Die Linie leuchtet auf, wenn ein Spiel gewonnen ist.',
    'step3.title': 'Blockiere den anderen Spieler',
    'step3.body':
      'O fehlt nur ein Zug zum Sieg an der linken Seite. Nimm dieses Feld, bevor O es tut.',
    'step3.success':
      'Blockiert. Die Reihen des Gegners im Blick zu behalten ist so wichtig wie eigene zu bauen.',
    tryAgain: 'Such das markierte Feld und versuch es noch einmal.',
    nextUp: 'Als Nächstes: {mode}',
    startPlaying: 'Los geht’s',
    next: 'Weiter',
    walkthroughTitle: 'Drei Züge, dreißig Sekunden',
    walkthroughBody:
      'Setze ein Zeichen, gewinne ein Spiel und blockiere einen Gegner – auf einem echten Brett, nicht in einem Diagramm.',
    startWalkthrough: 'Einführung starten',
    mode: 'Modus',
    board: 'Brett',
    boardSize: '{size} × {size}',
    cubeSize: '{size} × {size} × {size}',
    inARow: 'In einer Reihe',
    clock: 'Uhr',
    clockMinutes: '{count} Min.',
    clockValue: '{time} + {count} s',
    ranked: 'Gewertet',
    rankedYes: 'Ja',
    rankedNo: 'Nur ungewertet',
    practiceHints: 'Mit Hinweisen üben',
    playBot: 'Gegen den Bot spielen',
    playRanked: 'Gewertet spielen',
    goodToKnow: 'Gut zu wissen',
    'tip.ranked.title': 'Gewertet oder ungewertet.',
    'tip.ranked.body':
      'Nur gewertete Partien verändern deine Wertung. Wer vorzeitig geht, gibt auf.',
    'tip.clocks.title': 'Uhren.',
    'tip.clocks.body':
      'Jede Online-Partie läuft auf Zeit, mit ein paar Sekunden Zugabe nach jedem Zug. Wer keine Zeit mehr hat, verliert.',
    'tip.disconnect.title': 'Verbindungsabbrüche.',
    'tip.disconnect.body':
      'Dein Platz bleibt {count} Sekunden frei und deine Uhr läuft weiter. Komm zurück und mach dort weiter, wo du warst.',
    'tip.practice.title': 'Übungsmodus.',
    'tip.practice.body':
      'Hinweise markieren das Gewinnfeld und das Feld, das du blockieren musst, du kannst Züge zurücknehmen, und die Zielscheibe fragt die Engine, was sie spielen würde.',
    'tip.journey.title': 'Reise.',
    'tip.journey.body':
      '{rivals} Rivalen, {stages} Etappen, jeder Modus. Du ziehst immer zuerst; gewinne in weniger Zügen für mehr Sterne.',
    'tip.puzzles.title': 'Rätsel.',
    'tip.puzzles.body':
      'Jedes ist ein bewiesener erzwungener Sieg. Jeden Tag kommt ein neues Tagesrätsel – löse sie an aufeinanderfolgenden Tagen für eine Serie.',
    'tip.pieces.title': 'Figuren.',
    'tip.pieces.body':
      'Besiege den Bot, löse Rätsel und sammle Reisesterne, um in den Einstellungen neue Figurensets freizuschalten.',
  },

  fa: {
    howToPlay: 'آموزش بازی',
    backHome: 'بازگشت به خانه',
    stepOf: 'مرحلهٔ {step} از {total}',
    skip: 'رد شدن',
    'step1.title': 'علامتت را بگذار',
    'step1.body': 'روی هر خانهٔ خالی بزن تا آنجا بازی کنی. تو X هستی و اول حرکت می‌کنی.',
    'step1.success': 'علامتت گذاشته شد. حالا نوبت بازیکن دیگر است.',
    'step1.middle': 'آفرین. خانهٔ وسط روی چهار خط مختلف است. حالا نوبت بازیکن دیگر است.',
    'step2.title': 'بازی را ببر',
    'step2.body':
      'سه علامتت در یک ردیف می‌برد — افقی، عمودی یا مورب. خانه‌ای را پیدا کن که ردیف را کامل می‌کند.',
    'step2.success': 'این یعنی سه‌تا در یک ردیف. وقتی بازی برده شود، خط روشن می‌شود.',
    'step3.title': 'جلوی بازیکن دیگر را بگیر',
    'step3.body': 'O یک حرکت تا بردن در ستون چپ فاصله دارد. پیش از او آن خانه را بگیر.',
    'step3.success':
      'بسته شد. حواست به ردیف‌های حریف باشد؛ این به اندازهٔ ساختن ردیف خودت مهم است.',
    tryAgain: 'خانهٔ علامت‌دار را پیدا کن و دوباره امتحان کن.',
    nextUp: 'بعدی: {mode}',
    startPlaying: 'شروع بازی',
    next: 'بعدی',
    walkthroughTitle: 'سه حرکت، سی ثانیه',
    walkthroughBody:
      'یک علامت بگذار، یک بازی ببر و جلوی حریف را بگیر — روی یک صفحهٔ واقعی، نه یک نمودار.',
    startWalkthrough: 'شروع آموزش',
    mode: 'حالت',
    board: 'صفحه',
    boardSize: '{size} × {size}',
    cubeSize: '{size} × {size} × {size}',
    inARow: 'تعداد در ردیف',
    clock: 'ساعت',
    clockMinutes: '{count} دقیقه',
    clockValue: '{time} + {count} ثانیه',
    ranked: 'رتبه‌ای',
    rankedYes: 'بله',
    rankedNo: 'فقط دوستانه',
    practiceHints: 'تمرین با راهنما',
    playBot: 'بازی با ربات',
    playRanked: 'بازی رتبه‌ای',
    goodToKnow: 'خوب است بدانی',
    'tip.ranked.title': 'رتبه‌ای یا دوستانه.',
    'tip.ranked.body':
      'فقط بازی‌های رتبه‌ای امتیازت را تغییر می‌دهند. ترک زودهنگام بازی تسلیم حساب می‌شود.',
    'tip.clocks.title': 'ساعت‌ها.',
    'tip.clocks.body':
      'همهٔ بازی‌های آنلاین زمان‌دارند و بعد از هر حرکت چند ثانیه اضافه می‌شود. تمام شدن وقت یعنی باختن بازی.',
    'tip.disconnect.title': 'قطع اتصال.',
    'tip.disconnect.body':
      'جایت {count} ثانیه نگه داشته می‌شود و ساعتت همچنان کار می‌کند. برگرد و از همان‌جا ادامه بده.',
    'tip.practice.title': 'حالت تمرین.',
    'tip.practice.body':
      'راهنماها خانهٔ برنده و خانه‌ای را که باید ببندی نشان می‌دهند، می‌توانی حرکت‌ها را پس بگیری و دکمهٔ هدف از موتور بازی می‌پرسد چه حرکتی می‌کرد.',
    'tip.journey.title': 'سفر.',
    'tip.journey.body':
      '{rivals} حریف، {stages} مرحله، همهٔ حالت‌ها. همیشه تو اول حرکت می‌کنی؛ با حرکت‌های کمتر ببر تا ستارهٔ بیشتری بگیری.',
    'tip.puzzles.title': 'معماها.',
    'tip.puzzles.body':
      'هر کدام یک برد اجباری اثبات‌شده است. هر روز یک معمای روزانهٔ تازه می‌رسد — در روزهای پیاپی حلشان کن تا زنجیره بسازی.',
    'tip.pieces.title': 'مهره‌ها.',
    'tip.pieces.body':
      'ربات را ببر، معما حل کن و ستاره‌های سفر را جمع کن تا مجموعه‌مهره‌های تازه در تنظیمات باز شوند.',
  },
});
