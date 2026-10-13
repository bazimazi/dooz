import { defineMessages } from '@/i18n';

/**
 * What the boards say: mostly to screen readers - each board's description
 * and each square's - plus the few controls drawn on the boards themselves.
 *
 * A square's description is built from parts joined by `sep`, so each part
 * reads on its own: "row 2, column 3, empty, winning move".
 */
export const gameBoardMessages = defineMessages({
  en: {
    sep: ', ',
    position: 'row {row}, column {col}',
    empty: 'empty',
    blocked: 'blocked',
    hintWin: 'winning move',
    hintThreat: 'block opponent’s winning move',
    hintBest: 'suggested move',
    partOfWin: 'part of the winning line',

    // The flat boards.
    scrollExplore: 'Scroll to explore the board',
    boardSummary: '{size} × {size} · {length} in a row',
    fitBoard: 'Fit board',
    enlargeBoard: 'Enlarge board',
    scrollable: 'Scrollable game board',
    labelConnect4:
      'Connect Four board, seven columns of six, four in a row to win. Choose a column; your disc drops to its lowest empty slot',
    labelWild:
      '{size} by {size} Wild board, {length} in a row of either mark wins for whoever completes it. Press X or O to choose the mark',
    labelOrderChaos:
      'Order and Chaos board, {size} by {size}. Five identical marks in a row wins for Order; a full board wins for Chaos. Press X or O to choose the mark',
    labelObstacles: '{size} by {size} board with blocked squares, {length} in a row to win',
    labelPowers:
      '{size} by {size} Powers board, {length} in a row to win. Bomb and wall are chosen above the board',
    labelGravity:
      '{size} by {size} gravity board, {length} in a row to win. Choose a column; your mark drops to its lowest empty square',
    labelPente:
      '{size} by {size} Pente board. Five in a row or five captured pairs wins; flank two opposing marks to capture them',
    labelVanish:
      'Vanish board, three in a row to win. Each player keeps only their three newest marks',
    labelPlain: '{size} by {size} board, {length} in a row to win',
    labelUltimateAny:
      'Ultimate board, nine small boards. you may play in any unfinished small board',
    labelUltimateMust: 'Ultimate board, nine small boards. you must play in small board {n}',
    dropsAt: 'plays column {col} at row {row}',
    columnFull: 'column full',
    vanishesNext: 'vanishes next',
    smallBoard: 'small board {n}',
    boardWonBy: 'board won by {mark}',
    boardDrawn: 'board drawn',

    // Qubic.
    labelQubic:
      'Qubic cube: four layers of 4 by 4, four in a row in any direction wins, including through the layers. Arrow keys move within a layer; Page Up and Page Down change layer',
    layer: 'Layer {n}',
    cubeView: 'Cube view',
    turnLeft: 'Turn the cube left',
    turnRight: 'Turn the cube right',
    tiltUp: 'Tilt the cube up',
    tiltDown: 'Tilt the cube down',
    resetView: 'Reset',
    view3d: '3D view',
    flatLayers: 'Flat layers',

    // Quantum.
    labelQuantum:
      'Quantum tic-tac-toe board. Each move places a spooky mark in two squares; loops collapse into ordinary marks',
    promptCollapse:
      'A loop closed! Choose where {mark} really is — tap one of its two lit squares. The whole loop collapses from there.',
    promptClassical: 'One square left: tap it to place {mark} for good.',
    promptSpooky: 'Tap two squares for your spooky mark {mark}.',
    promptSecond: 'Now tap a second square for {mark} (or the same one to cancel).',
    changeCollapse: 'Change collapse',
    howQuantum: 'How Quantum works',
    collapsed: '{mark}, collapsed',
    spooky: 'spooky {marks}',
    collapseChoice: 'collapse choice',
    suggested: 'suggested',
  },
  es: {
    sep: ', ',
    position: 'fila {row}, columna {col}',
    empty: 'vacía',
    blocked: 'bloqueada',
    hintWin: 'jugada ganadora',
    hintThreat: 'bloquea la jugada ganadora del rival',
    hintBest: 'jugada sugerida',
    partOfWin: 'parte de la línea ganadora',

    scrollExplore: 'Desplázate para explorar el tablero',
    boardSummary: '{size} × {size} · {length} en línea',
    fitBoard: 'Ajustar tablero',
    enlargeBoard: 'Ampliar tablero',
    scrollable: 'Tablero de juego desplazable',
    labelConnect4:
      'Tablero de Conecta 4, siete columnas de seis, cuatro en línea para ganar. Elige una columna; tu ficha cae a su hueco libre más bajo',
    labelWild:
      'Tablero Salvaje de {size} por {size}: {length} en línea de cualquier marca gana para quien la complete. Pulsa X u O para elegir la marca',
    labelOrderChaos:
      'Tablero de Orden y Caos, {size} por {size}. Cinco marcas iguales en línea dan la victoria al Orden; un tablero lleno se la da al Caos. Pulsa X u O para elegir la marca',
    labelObstacles:
      'Tablero de {size} por {size} con casillas bloqueadas, {length} en línea para ganar',
    labelPowers:
      'Tablero de Poderes de {size} por {size}, {length} en línea para ganar. La bomba y el muro se eligen encima del tablero',
    labelGravity:
      'Tablero con gravedad de {size} por {size}, {length} en línea para ganar. Elige una columna; tu marca cae a su casilla libre más baja',
    labelPente:
      'Tablero de Pente de {size} por {size}. Cinco en línea o cinco parejas capturadas ganan; flanquea dos marcas rivales para capturarlas',
    labelVanish:
      'Tablero Desvanecer, tres en línea para ganar. Cada jugador conserva solo sus tres marcas más recientes',
    labelPlain: 'Tablero de {size} por {size}, {length} en línea para ganar',
    labelUltimateAny:
      'Tablero Ultimate, nueve tableros pequeños. Puedes jugar en cualquier tablero pequeño sin terminar',
    labelUltimateMust:
      'Tablero Ultimate, nueve tableros pequeños. Debes jugar en el tablero pequeño {n}',
    dropsAt: 'juega la columna {col} en la fila {row}',
    columnFull: 'columna llena',
    vanishesNext: 'desaparece a continuación',
    smallBoard: 'tablero pequeño {n}',
    boardWonBy: 'tablero ganado por {mark}',
    boardDrawn: 'tablero empatado',

    labelQubic:
      'Cubo de Qubic: cuatro capas de 4 por 4; cuatro en línea en cualquier dirección gana, también a través de las capas. Las flechas se mueven dentro de una capa; Re Pág y Av Pág cambian de capa',
    layer: 'Capa {n}',
    cubeView: 'Vista del cubo',
    turnLeft: 'Girar el cubo a la izquierda',
    turnRight: 'Girar el cubo a la derecha',
    tiltUp: 'Inclinar el cubo hacia arriba',
    tiltDown: 'Inclinar el cubo hacia abajo',
    resetView: 'Restablecer',
    view3d: 'Vista 3D',
    flatLayers: 'Capas planas',

    labelQuantum:
      'Tablero de tres en raya cuántico. Cada jugada coloca una marca fantasma en dos casillas; los bucles colapsan en marcas normales',
    promptCollapse:
      '¡Se cerró un bucle! Elige dónde está realmente {mark}: toca una de sus dos casillas iluminadas. Todo el bucle colapsa a partir de ahí.',
    promptClassical: 'Queda una casilla: tócala para colocar {mark} definitivamente.',
    promptSpooky: 'Toca dos casillas para tu marca fantasma {mark}.',
    promptSecond: 'Ahora toca una segunda casilla para {mark} (o la misma para cancelar).',
    changeCollapse: 'Cambiar el colapso',
    howQuantum: 'Cómo funciona el Cuántico',
    collapsed: '{mark}, colapsada',
    spooky: 'fantasma {marks}',
    collapseChoice: 'opción de colapso',
    suggested: 'sugerida',
  },
  fr: {
    sep: ', ',
    position: 'ligne {row}, colonne {col}',
    empty: 'vide',
    blocked: 'bloquée',
    hintWin: 'coup gagnant',
    hintThreat: 'bloquez le coup gagnant adverse',
    hintBest: 'coup suggéré',
    partOfWin: 'fait partie de la ligne gagnante',

    scrollExplore: 'Faites défiler pour explorer le plateau',
    boardSummary: '{size} × {size} · {length} alignés',
    fitBoard: 'Ajuster le plateau',
    enlargeBoard: 'Agrandir le plateau',
    scrollable: 'Plateau de jeu défilant',
    labelConnect4:
      'Plateau de Puissance 4, sept colonnes de six, quatre alignés pour gagner. Choisissez une colonne ; votre jeton tombe dans sa case libre la plus basse',
    labelWild:
      'Plateau Sauvage de {size} sur {size} : {length} alignés de n’importe quelle marque font gagner qui les complète. Appuyez sur X ou O pour choisir la marque',
    labelOrderChaos:
      'Plateau Ordre et Chaos, {size} sur {size}. Cinq marques identiques alignées font gagner l’Ordre ; un plateau plein fait gagner le Chaos. Appuyez sur X ou O pour choisir la marque',
    labelObstacles:
      'Plateau de {size} sur {size} avec des cases bloquées, {length} alignés pour gagner',
    labelPowers:
      'Plateau Pouvoirs de {size} sur {size}, {length} alignés pour gagner. La bombe et le mur se choisissent au-dessus du plateau',
    labelGravity:
      'Plateau à gravité de {size} sur {size}, {length} alignés pour gagner. Choisissez une colonne ; votre marque tombe dans sa case libre la plus basse',
    labelPente:
      'Plateau de Pente de {size} sur {size}. Cinq alignés ou cinq paires capturées gagnent ; encadrez deux marques adverses pour les capturer',
    labelVanish:
      'Plateau Évanescence, trois alignés pour gagner. Chaque joueur ne garde que ses trois marques les plus récentes',
    labelPlain: 'Plateau de {size} sur {size}, {length} alignés pour gagner',
    labelUltimateAny:
      'Plateau Ultimate, neuf petits plateaux. Vous pouvez jouer dans n’importe quel petit plateau inachevé',
    labelUltimateMust:
      'Plateau Ultimate, neuf petits plateaux. Vous devez jouer dans le petit plateau {n}',
    dropsAt: 'joue la colonne {col} à la ligne {row}',
    columnFull: 'colonne pleine',
    vanishesNext: 'disparaît ensuite',
    smallBoard: 'petit plateau {n}',
    boardWonBy: 'plateau gagné par {mark}',
    boardDrawn: 'plateau nul',

    labelQubic:
      'Cube de Qubic : quatre couches de 4 sur 4 ; quatre alignés dans n’importe quelle direction gagnent, y compris à travers les couches. Les flèches se déplacent dans une couche ; Page préc. et Page suiv. changent de couche',
    layer: 'Couche {n}',
    cubeView: 'Vue du cube',
    turnLeft: 'Tourner le cube vers la gauche',
    turnRight: 'Tourner le cube vers la droite',
    tiltUp: 'Incliner le cube vers le haut',
    tiltDown: 'Incliner le cube vers le bas',
    resetView: 'Réinitialiser',
    view3d: 'Vue 3D',
    flatLayers: 'Couches à plat',

    labelQuantum:
      'Plateau de morpion quantique. Chaque coup place une marque fantôme dans deux cases ; les boucles s’effondrent en marques ordinaires',
    promptCollapse:
      'Une boucle s’est fermée ! Choisissez où se trouve vraiment {mark} : touchez l’une de ses deux cases éclairées. Toute la boucle s’effondre à partir de là.',
    promptClassical: 'Il reste une case : touchez-la pour placer {mark} définitivement.',
    promptSpooky: 'Touchez deux cases pour votre marque fantôme {mark}.',
    promptSecond: 'Touchez maintenant une seconde case pour {mark} (ou la même pour annuler).',
    changeCollapse: 'Changer l’effondrement',
    howQuantum: 'Comment fonctionne le Quantique',
    collapsed: '{mark}, effondrée',
    spooky: 'fantôme {marks}',
    collapseChoice: 'choix d’effondrement',
    suggested: 'suggérée',
  },
  de: {
    sep: ', ',
    position: 'Zeile {row}, Spalte {col}',
    empty: 'leer',
    blocked: 'blockiert',
    hintWin: 'Siegzug',
    hintThreat: 'Siegzug des Gegners blocken',
    hintBest: 'vorgeschlagener Zug',
    partOfWin: 'Teil der Siegreihe',

    scrollExplore: 'Scrolle, um das Brett zu erkunden',
    boardSummary: '{size} × {size} · {length} in einer Reihe',
    fitBoard: 'Brett einpassen',
    enlargeBoard: 'Brett vergrößern',
    scrollable: 'Scrollbares Spielbrett',
    labelConnect4:
      'Vier-gewinnt-Brett, sieben Spalten mit je sechs Feldern, vier in einer Reihe gewinnen. Wähle eine Spalte; dein Stein fällt auf ihr unterstes freies Feld',
    labelWild:
      'Wild-Brett, {size} mal {size}: {length} in einer Reihe aus einem beliebigen Zeichen gewinnen für den, der sie vollendet. Drücke X oder O, um das Zeichen zu wählen',
    labelOrderChaos:
      'Ordnung-und-Chaos-Brett, {size} mal {size}. Fünf gleiche Zeichen in einer Reihe gewinnen für Ordnung; ein volles Brett gewinnt für Chaos. Drücke X oder O, um das Zeichen zu wählen',
    labelObstacles:
      'Brett {size} mal {size} mit blockierten Feldern, {length} in einer Reihe gewinnen',
    labelPowers:
      'Kräfte-Brett, {size} mal {size}, {length} in einer Reihe gewinnen. Bombe und Mauer werden über dem Brett gewählt',
    labelGravity:
      'Schwerkraft-Brett, {size} mal {size}, {length} in einer Reihe gewinnen. Wähle eine Spalte; dein Zeichen fällt auf ihr unterstes freies Feld',
    labelPente:
      'Pente-Brett, {size} mal {size}. Fünf in einer Reihe oder fünf geschlagene Paare gewinnen; umschließe zwei gegnerische Zeichen, um sie zu schlagen',
    labelVanish:
      'Verblassen-Brett, drei in einer Reihe gewinnen. Jeder behält nur seine drei neuesten Zeichen',
    labelPlain: 'Brett {size} mal {size}, {length} in einer Reihe gewinnen',
    labelUltimateAny:
      'Ultimate-Brett, neun kleine Bretter. Du darfst in jedem unfertigen kleinen Brett spielen',
    labelUltimateMust: 'Ultimate-Brett, neun kleine Bretter. Du musst im kleinen Brett {n} spielen',
    dropsAt: 'spielt Spalte {col} in Zeile {row}',
    columnFull: 'Spalte voll',
    vanishesNext: 'verblasst als Nächstes',
    smallBoard: 'kleines Brett {n}',
    boardWonBy: 'Brett gewonnen von {mark}',
    boardDrawn: 'Brett unentschieden',

    labelQubic:
      'Qubic-Würfel: vier Ebenen zu 4 mal 4; vier in einer Reihe in jeder Richtung gewinnen, auch durch die Ebenen hindurch. Pfeiltasten bewegen innerhalb einer Ebene; Bild auf und Bild ab wechseln die Ebene',
    layer: 'Ebene {n}',
    cubeView: 'Würfelansicht',
    turnLeft: 'Würfel nach links drehen',
    turnRight: 'Würfel nach rechts drehen',
    tiltUp: 'Würfel nach oben kippen',
    tiltDown: 'Würfel nach unten kippen',
    resetView: 'Zurücksetzen',
    view3d: '3D-Ansicht',
    flatLayers: 'Flache Ebenen',

    labelQuantum:
      'Quanten-Tic-Tac-Toe-Brett. Jeder Zug setzt ein Spukzeichen auf zwei Felder; Schleifen kollabieren zu gewöhnlichen Zeichen',
    promptCollapse:
      'Eine Schleife hat sich geschlossen! Wähle, wo {mark} wirklich steht – tippe auf eines seiner zwei leuchtenden Felder. Die ganze Schleife kollabiert von dort aus.',
    promptClassical: 'Ein Feld bleibt: Tippe darauf, um {mark} endgültig zu setzen.',
    promptSpooky: 'Tippe auf zwei Felder für dein Spukzeichen {mark}.',
    promptSecond:
      'Tippe jetzt auf ein zweites Feld für {mark} (oder auf dasselbe, um abzubrechen).',
    changeCollapse: 'Kollaps ändern',
    howQuantum: 'So funktioniert Quanten',
    collapsed: '{mark}, kollabiert',
    spooky: 'Spuk {marks}',
    collapseChoice: 'Kollaps-Auswahl',
    suggested: 'vorgeschlagen',
  },
  fa: {
    sep: '، ',
    position: 'ردیف {row}، ستون {col}',
    empty: 'خالی',
    blocked: 'مسدود',
    hintWin: 'حرکت برنده',
    hintThreat: 'حرکت برندهٔ حریف را ببند',
    hintBest: 'حرکت پیشنهادی',
    partOfWin: 'بخشی از ردیف برنده',

    scrollExplore: 'برای دیدن صفحه پیمایش کن',
    boardSummary: '{size} × {size}، {length} در یک ردیف',
    fitBoard: 'جا دادن صفحه',
    enlargeBoard: 'بزرگ کردن صفحه',
    scrollable: 'صفحهٔ بازی قابل پیمایش',
    labelConnect4:
      'صفحهٔ چهار در یک ردیف، هفت ستون شش‌خانه‌ای، چهار در یک ردیف برنده است. یک ستون انتخاب کن؛ مهره‌ات به پایین‌ترین خانهٔ خالی آن می‌افتد',
    labelWild:
      'صفحهٔ آزاد {size} در {size}؛ {length} در یک ردیف از هر نشانی، برای کسی است که کاملش کند. برای انتخاب نشان X یا O را بزن',
    labelOrderChaos:
      'صفحهٔ نظم و آشوب، {size} در {size}. پنج نشان یکسان در یک ردیف یعنی برد نظم؛ صفحهٔ پر یعنی برد آشوب. برای انتخاب نشان X یا O را بزن',
    labelObstacles: 'صفحهٔ {size} در {size} با خانه‌های مسدود، {length} در یک ردیف برنده است',
    labelPowers:
      'صفحهٔ قدرت‌ها {size} در {size}، {length} در یک ردیف برنده است. بمب و دیوار بالای صفحه انتخاب می‌شوند',
    labelGravity:
      'صفحهٔ جاذبه {size} در {size}، {length} در یک ردیف برنده است. یک ستون انتخاب کن؛ نشانت به پایین‌ترین خانهٔ خالی آن می‌افتد',
    labelPente:
      'صفحهٔ پنته {size} در {size}. پنج در یک ردیف یا گرفتن پنج جفت برنده است؛ دو نشان حریف را از دو طرف محاصره کن تا بگیری‌شان',
    labelVanish: 'صفحهٔ محو، سه در یک ردیف برنده است. هر بازیکن فقط سه نشان تازه‌اش را نگه می‌دارد',
    labelPlain: 'صفحهٔ {size} در {size}، {length} در یک ردیف برنده است',
    labelUltimateAny: 'صفحهٔ دوز بزرگ، نُه صفحهٔ کوچک. می‌توانی در هر صفحهٔ کوچک ناتمامی بازی کنی',
    labelUltimateMust: 'صفحهٔ دوز بزرگ، نُه صفحهٔ کوچک. باید در صفحهٔ کوچک {n} بازی کنی',
    dropsAt: 'در ستون {col}، ردیف {row} می‌نشیند',
    columnFull: 'ستون پر است',
    vanishesNext: 'بعدی محو می‌شود',
    smallBoard: 'صفحهٔ کوچک {n}',
    boardWonBy: 'صفحه را {mark} برده',
    boardDrawn: 'صفحه مساوی شده',

    labelQubic:
      'مکعب کیوبیک: چهار لایهٔ ۴ در ۴؛ چهار در یک ردیف در هر جهتی برنده است، حتی از میان لایه‌ها. کلیدهای جهت درون یک لایه جابه‌جا می‌شوند؛ Page Up و Page Down لایه را عوض می‌کنند',
    layer: 'لایهٔ {n}',
    cubeView: 'نمای مکعب',
    turnLeft: 'چرخاندن مکعب به چپ',
    turnRight: 'چرخاندن مکعب به راست',
    tiltUp: 'کج کردن مکعب به بالا',
    tiltDown: 'کج کردن مکعب به پایین',
    resetView: 'بازنشانی',
    view3d: 'نمای سه‌بعدی',
    flatLayers: 'لایه‌های تخت',

    labelQuantum:
      'صفحهٔ دوز کوانتومی. هر حرکت یک نشان شبح را در دو خانه می‌گذارد؛ حلقه‌ها به نشان‌های معمولی فرو می‌ریزند',
    promptCollapse:
      'یک حلقه بسته شد! انتخاب کن {mark} واقعاً کجاست — یکی از دو خانهٔ روشنش را بزن. کل حلقه از همان‌جا فرو می‌ریزد.',
    promptClassical: 'یک خانه مانده: آن را بزن تا {mark} برای همیشه همان‌جا بماند.',
    promptSpooky: 'برای نشان شبح {mark} دو خانه را بزن.',
    promptSecond: 'حالا خانهٔ دوم را برای {mark} بزن (یا همان خانه را برای لغو).',
    changeCollapse: 'تغییر فروریزش',
    howQuantum: 'کوانتومی چطور کار می‌کند',
    collapsed: '{mark}، فروریخته',
    spooky: 'شبح {marks}',
    collapseChoice: 'گزینهٔ فروریزش',
    suggested: 'پیشنهادی',
  },
});
