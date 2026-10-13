import { defineMessages } from '@/i18n';

/**
 * The rule sets' own words: the reminder line under the board, the scores
 * some of them keep, and the choices above the board (which mark, which power,
 * the swap).
 */
export const gameVariantMessages = defineMessages({
  en: {
    // Above the board.
    markToPlace: 'Mark to place',
    markToPlaceEither: 'Mark to place (either side may use both)',
    swapOpening: 'Swap — take the opening mark',
    action: 'Action',
    place: 'Place',
    placeMark: 'Place a mark',
    bomb: 'Bomb ×{count}',
    bombName: 'Bomb: remove an opponent mark, {count} left',
    wall: 'Wall ×{count}',
    wallName: 'Wall: block an empty square, {count} left',

    // Under the board.
    qubic:
      'Four in a row in any direction — across a layer, down through the layers or corner to corner of the cube.',
    quantum: 'Spooky marks sit in two squares until a loop forces them to collapse.',
    misere: 'Avoid three in a row — making a line loses.',
    gravity: 'Choose a column · Four in a row wins.',
    ultimateAny: 'Choose any unfinished small board.',
    ultimateMust: 'Play in the highlighted small board ({n}).',
    ultimateWin: 'Win three small boards in a row.',
    vanishKeep: 'Keep three marks · The dashed mark vanishes on your next move.',
    vanishLast: 'Last move before a draw',
    vanishLeft: { one: '{count} move until a draw', other: '{count} moves until a draw' },
    pente: 'Flank two marks to capture them · Five in a row or five pairs wins.',
    captured: '{mark} has captured {count} of {total} pairs',
    order: 'Order',
    chaos: 'Chaos',
    toMove: '{role} to move.',
    orderWins: 'Five alike in a row — Order wins.',
    chaosWins: 'The board filled without a line — Chaos wins.',
    orderWants: 'wants five alike in a row',
    chaosWants: 'wants a full board',
    eitherMark: 'Either side may place an X or an O.',
    connect4: 'Choose a column · Four in a row wins · Each column holds six.',
    wildTwo: 'Place X or O · A line of either wins for you · Never leave two alike with a gap.',
    wildThree: 'Place X or O · A line of either wins for you · Never leave three alike with a gap.',
    obstacles: 'Rocks are dead squares — no line runs through them · Five in a row wins.',
    swapFirst:
      'Swap rule: your opponent may take your first mark as their own, so open with one you would play either side of.',
    swapSecond:
      'Swap rule: take the opening mark as your own with the Swap button, or reply as normal.',
    proFirst: 'Pro rule: the first mark goes in the centre.',
    proSecond: 'Pro rule: this mark must be at least {count} squares from the centre.',
    exact: 'Exactly five wins — six or more in a line does not count.',
    powersSeat: 'Bomb {bomb} · Wall {wall}',
    powersLeft: 'Powers left',
    powersRule:
      'A bomb removes an opponent mark; a wall blocks a square. Either is your whole turn.',
  },
  es: {
    markToPlace: 'Marca a colocar',
    markToPlaceEither: 'Marca a colocar (ambos bandos pueden usar las dos)',
    swapOpening: 'Cambio: quédate con la marca de apertura',
    action: 'Acción',
    place: 'Colocar',
    placeMark: 'Colocar una marca',
    bomb: 'Bomba ×{count}',
    bombName: {
      one: 'Bomba: quita una marca rival, queda {count}',
      other: 'Bomba: quita una marca rival, quedan {count}',
    },
    wall: 'Muro ×{count}',
    wallName: {
      one: 'Muro: bloquea una casilla vacía, queda {count}',
      other: 'Muro: bloquea una casilla vacía, quedan {count}',
    },

    qubic:
      'Cuatro en línea en cualquier dirección: a lo largo de una capa, atravesando las capas o de esquina a esquina del cubo.',
    quantum: 'Las marcas fantasma ocupan dos casillas hasta que un bucle las obliga a colapsar.',
    misere: 'Evita el tres en línea: formar una línea pierde.',
    gravity: 'Elige una columna · Cuatro en línea ganan.',
    ultimateAny: 'Elige cualquier tablero pequeño sin terminar.',
    ultimateMust: 'Juega en el tablero pequeño resaltado ({n}).',
    ultimateWin: 'Gana tres tableros pequeños en línea.',
    vanishKeep: 'Conserva tres marcas · La marca discontinua desaparece en tu próxima jugada.',
    vanishLast: 'Última jugada antes del empate',
    vanishLeft: {
      one: '{count} jugada para el empate',
      other: '{count} jugadas para el empate',
    },
    pente: 'Flanquea dos marcas para capturarlas · Cinco en línea o cinco parejas ganan.',
    captured: '{mark} ha capturado {count} de {total} parejas',
    order: 'Orden',
    chaos: 'Caos',
    toMove: 'Mueve {role}.',
    orderWins: 'Cinco iguales en línea: gana el Orden.',
    chaosWins: 'El tablero se llenó sin línea: gana el Caos.',
    orderWants: 'quiere cinco iguales en línea',
    chaosWants: 'quiere un tablero lleno',
    eitherMark: 'Cualquiera de los dos puede colocar una X o una O.',
    connect4: 'Elige una columna · Cuatro en línea ganan · Cada columna tiene seis huecos.',
    wildTwo:
      'Coloca X u O · Una línea de cualquiera te da la victoria · Nunca dejes dos iguales con un hueco.',
    wildThree:
      'Coloca X u O · Una línea de cualquiera te da la victoria · Nunca dejes tres iguales con un hueco.',
    obstacles:
      'Las rocas son casillas muertas: ninguna línea pasa por ellas · Cinco en línea ganan.',
    swapFirst:
      'Regla del cambio: tu rival puede quedarse tu primera marca, así que abre con una que jugarías con cualquier bando.',
    swapSecond:
      'Regla del cambio: quédate con la marca de apertura con el botón Cambio, o responde con normalidad.',
    proFirst: 'Regla pro: la primera marca va en el centro.',
    proSecond: 'Regla pro: esta marca debe estar al menos a {count} casillas del centro.',
    exact: 'Solo cinco exactos ganan: seis o más en línea no cuentan.',
    powersSeat: 'Bomba {bomb} · Muro {wall}',
    powersLeft: 'Poderes restantes',
    powersRule:
      'Una bomba quita una marca rival; un muro bloquea una casilla. Cualquiera de los dos ocupa todo tu turno.',
  },
  fr: {
    markToPlace: 'Marque à poser',
    markToPlaceEither: 'Marque à poser (chaque camp peut utiliser les deux)',
    swapOpening: 'Échange : prendre la marque d’ouverture',
    action: 'Action',
    place: 'Poser',
    placeMark: 'Poser une marque',
    bomb: 'Bombe ×{count}',
    bombName: {
      one: 'Bombe : retire une marque adverse, {count} restante',
      other: 'Bombe : retire une marque adverse, {count} restantes',
    },
    wall: 'Mur ×{count}',
    wallName: {
      one: 'Mur : bloque une case vide, {count} restant',
      other: 'Mur : bloque une case vide, {count} restants',
    },

    qubic:
      'Quatre alignés dans n’importe quelle direction : dans une couche, à travers les couches ou d’un coin à l’autre du cube.',
    quantum:
      'Les marques fantômes occupent deux cases jusqu’à ce qu’une boucle les force à s’effondrer.',
    misere: 'Évitez d’en aligner trois : former une ligne fait perdre.',
    gravity: 'Choisissez une colonne · Quatre alignés gagnent.',
    ultimateAny: 'Choisissez n’importe quel petit plateau inachevé.',
    ultimateMust: 'Jouez dans le petit plateau en surbrillance ({n}).',
    ultimateWin: 'Gagnez trois petits plateaux alignés.',
    vanishKeep: 'Gardez trois marques · La marque en pointillés disparaît à votre prochain coup.',
    vanishLast: 'Dernier coup avant le nul',
    vanishLeft: { one: '{count} coup avant le nul', other: '{count} coups avant le nul' },
    pente: 'Encadrez deux marques pour les capturer · Cinq alignés ou cinq paires gagnent.',
    captured: {
      one: '{mark} a capturé {count} paire sur {total}',
      other: '{mark} a capturé {count} paires sur {total}',
    },
    order: 'Ordre',
    chaos: 'Chaos',
    toMove: 'Au tour de {role}.',
    orderWins: 'Cinq identiques alignées : l’Ordre gagne.',
    chaosWins: 'Le plateau s’est rempli sans ligne : le Chaos gagne.',
    orderWants: 'veut cinq identiques alignées',
    chaosWants: 'veut un plateau plein',
    eitherMark: 'Chaque camp peut poser un X ou un O.',
    connect4:
      'Choisissez une colonne · Quatre alignés gagnent · Chaque colonne contient six cases.',
    wildTwo:
      'Posez X ou O · Une ligne de l’une ou l’autre vous fait gagner · Ne laissez jamais deux identiques avec un trou.',
    wildThree:
      'Posez X ou O · Une ligne de l’une ou l’autre vous fait gagner · Ne laissez jamais trois identiques avec un trou.',
    obstacles:
      'Les rochers sont des cases mortes : aucune ligne ne les traverse · Cinq alignés gagnent.',
    swapFirst:
      'Règle de l’échange : votre adversaire peut prendre votre première marque, alors ouvrez avec une que vous joueriez dans les deux camps.',
    swapSecond:
      'Règle de l’échange : prenez la marque d’ouverture avec le bouton Échange, ou répondez normalement.',
    proFirst: 'Règle pro : la première marque se pose au centre.',
    proSecond: 'Règle pro : cette marque doit être à au moins {count} cases du centre.',
    exact: 'Exactement cinq gagnent : six ou plus alignés ne comptent pas.',
    powersSeat: 'Bombe {bomb} · Mur {wall}',
    powersLeft: 'Pouvoirs restants',
    powersRule:
      'Une bombe retire une marque adverse ; un mur bloque une case. Chacun occupe tout votre tour.',
  },
  de: {
    markToPlace: 'Zu setzendes Zeichen',
    markToPlaceEither: 'Zu setzendes Zeichen (beide Seiten dürfen beide nutzen)',
    swapOpening: 'Tausch – das Eröffnungszeichen übernehmen',
    action: 'Aktion',
    place: 'Setzen',
    placeMark: 'Ein Zeichen setzen',
    bomb: 'Bombe ×{count}',
    bombName: 'Bombe: ein gegnerisches Zeichen entfernen, noch {count}',
    wall: 'Mauer ×{count}',
    wallName: 'Mauer: ein leeres Feld blockieren, noch {count}',

    qubic:
      'Vier in einer Reihe in jeder Richtung – quer durch eine Ebene, hinab durch die Ebenen oder von Ecke zu Ecke des Würfels.',
    quantum: 'Spukzeichen stehen auf zwei Feldern, bis eine Schleife sie zum Kollaps zwingt.',
    misere: 'Vermeide drei in einer Reihe – wer eine Reihe bildet, verliert.',
    gravity: 'Wähle eine Spalte · Vier in einer Reihe gewinnen.',
    ultimateAny: 'Wähle ein beliebiges unfertiges kleines Brett.',
    ultimateMust: 'Spiele im hervorgehobenen kleinen Brett ({n}).',
    ultimateWin: 'Gewinne drei kleine Bretter in einer Reihe.',
    vanishKeep:
      'Behalte drei Zeichen · Das gestrichelte Zeichen verblasst bei deinem nächsten Zug.',
    vanishLast: 'Letzter Zug vor dem Unentschieden',
    vanishLeft: {
      one: 'Noch {count} Zug bis zum Unentschieden',
      other: 'Noch {count} Züge bis zum Unentschieden',
    },
    pente:
      'Umschließe zwei Zeichen, um sie zu schlagen · Fünf in einer Reihe oder fünf Paare gewinnen.',
    captured: '{mark} hat {count} von {total} Paaren geschlagen',
    order: 'Ordnung',
    chaos: 'Chaos',
    toMove: '{role} ist am Zug.',
    orderWins: 'Fünf gleiche in einer Reihe – Ordnung gewinnt.',
    chaosWins: 'Das Brett ist ohne Reihe voll – Chaos gewinnt.',
    orderWants: 'will fünf gleiche in einer Reihe',
    chaosWants: 'will ein volles Brett',
    eitherMark: 'Beide Seiten dürfen ein X oder ein O setzen.',
    connect4: 'Wähle eine Spalte · Vier in einer Reihe gewinnen · Jede Spalte fasst sechs.',
    wildTwo:
      'Setze X oder O · Eine Reihe aus einem von beiden lässt dich gewinnen · Lass nie zwei gleiche mit einer Lücke liegen.',
    wildThree:
      'Setze X oder O · Eine Reihe aus einem von beiden lässt dich gewinnen · Lass nie drei gleiche mit einer Lücke liegen.',
    obstacles:
      'Felsen sind tote Felder – keine Reihe führt durch sie · Fünf in einer Reihe gewinnen.',
    swapFirst:
      'Tauschregel: Dein Gegner darf dein erstes Zeichen übernehmen, also eröffne mit einem, das du auf beiden Seiten spielen würdest.',
    swapSecond:
      'Tauschregel: Übernimm das Eröffnungszeichen mit der Tausch-Schaltfläche oder antworte ganz normal.',
    proFirst: 'Pro-Regel: Das erste Zeichen kommt in die Mitte.',
    proSecond:
      'Pro-Regel: Dieses Zeichen muss mindestens {count} Felder von der Mitte entfernt sein.',
    exact: 'Genau fünf gewinnen – sechs oder mehr in einer Reihe zählen nicht.',
    powersSeat: 'Bombe {bomb} · Mauer {wall}',
    powersLeft: 'Verbleibende Kräfte',
    powersRule:
      'Eine Bombe entfernt ein gegnerisches Zeichen; eine Mauer blockiert ein Feld. Beides ist dein ganzer Zug.',
  },
  fa: {
    markToPlace: 'نشانی که می‌گذاری',
    markToPlaceEither: 'نشانی که می‌گذاری (هر دو طرف می‌توانند از هر دو استفاده کنند)',
    swapOpening: 'جابه‌جایی — نشان شروع را برای خودت بردار',
    action: 'کنش',
    place: 'گذاشتن',
    placeMark: 'گذاشتن نشان',
    bomb: 'بمب ×{count}',
    bombName: 'بمب: یک نشان حریف را بردار، {count} تا مانده',
    wall: 'دیوار ×{count}',
    wallName: 'دیوار: یک خانهٔ خالی را مسدود کن، {count} تا مانده',

    qubic: 'چهار در یک ردیف در هر جهتی — در یک لایه، از میان لایه‌ها یا از گوشه تا گوشهٔ مکعب.',
    quantum: 'نشان‌های شبح در دو خانه می‌مانند تا یک حلقه وادارشان کند فرو بریزند.',
    misere: 'از سه در یک ردیف دوری کن — هر که ردیف بسازد می‌بازد.',
    gravity: 'یک ستون انتخاب کن، چهار در یک ردیف برنده است.',
    ultimateAny: 'هر صفحهٔ کوچک ناتمامی را انتخاب کن.',
    ultimateMust: 'در صفحهٔ کوچک روشن‌شده ({n}) بازی کن.',
    ultimateWin: 'سه صفحهٔ کوچک در یک ردیف را ببر.',
    vanishKeep: 'سه نشان نگه دار، نشان خط‌چین در حرکت بعدی‌ات محو می‌شود.',
    vanishLast: 'آخرین حرکت پیش از مساوی',
    vanishLeft: { other: '{count} حرکت تا مساوی' },
    pente: 'دو نشان را از دو طرف محاصره کن تا بگیری‌شان، پنج در یک ردیف یا پنج جفت برنده است.',
    captured: '{mark} تاکنون {count} جفت از {total} جفت را گرفته',
    order: 'نظم',
    chaos: 'آشوب',
    toMove: 'نوبت {role} است.',
    orderWins: 'پنج نشان یکسان در یک ردیف — نظم برد.',
    chaosWins: 'صفحه بدون ردیف پر شد — آشوب برد.',
    orderWants: 'پنج نشان یکسان در یک ردیف می‌خواهد',
    chaosWants: 'صفحهٔ پر می‌خواهد',
    eitherMark: 'هر دو طرف می‌توانند X یا O بگذارند.',
    connect4: 'یک ستون انتخاب کن، چهار در یک ردیف برنده است، هر ستون شش خانه دارد.',
    wildTwo:
      'X یا O بگذار، ردیفی از هر کدام برای تو برد است، هرگز دو نشان یکسان را با یک جای خالی رها نکن.',
    wildThree:
      'X یا O بگذار، ردیفی از هر کدام برای تو برد است، هرگز سه نشان یکسان را با یک جای خالی رها نکن.',
    obstacles: 'سنگ‌ها خانه‌های مرده‌اند — هیچ ردیفی از آن‌ها نمی‌گذرد، پنج در یک ردیف برنده است.',
    swapFirst:
      'قانون جابه‌جایی: حریفت می‌تواند نخستین نشانت را مال خود کند، پس با نشانی شروع کن که حاضری با هر طرفش بازی کنی.',
    swapSecond:
      'قانون جابه‌جایی: با دکمهٔ جابه‌جایی نشان شروع را مال خودت کن، یا مثل همیشه جواب بده.',
    proFirst: 'قانون حرفه‌ای: نخستین نشان در مرکز گذاشته می‌شود.',
    proSecond: 'قانون حرفه‌ای: این نشان باید دست‌کم {count} خانه از مرکز فاصله داشته باشد.',
    exact: 'فقط دقیقاً پنج برنده است — شش یا بیشتر در یک ردیف حساب نمی‌شود.',
    powersSeat: 'بمب {bomb}، دیوار {wall}',
    powersLeft: 'قدرت‌های باقی‌مانده',
    powersRule: 'بمب یک نشان حریف را برمی‌دارد؛ دیوار یک خانه را می‌بندد. هر کدام کل نوبت توست.',
  },
});
