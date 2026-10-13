import { type GameConfig, type ModeId, type VariantId, modeForConfig } from '@/game/engine';
import { type Locale, defineMessages, translate, useLocale } from '@/i18n';

/**
 * The names, taglines and rules of every game mode, in every language.
 *
 * The engine keeps its own English copy in `modes.ts` because the server reads
 * it too and has no locale; the interface reads this catalog instead, through
 * {@link modeText} or {@link useModeText}. Keys are `<modeId>.name`,
 * `<modeId>.tagline` and `<modeId>.rule1` onwards, so a mode's rules are as
 * many numbered keys as its English entry has.
 */
export const modeMessages = defineMessages({
  en: {
    'classic.name': 'Classic',
    'classic.tagline': 'Three in a row on a 3×3 board',
    'classic.rule1': 'Take turns placing your mark on an empty square.',
    'classic.rule2': 'Get three of your marks in a row — across, down or diagonally.',
    'classic.rule3': 'If the board fills with nobody in a row, the game is a draw.',

    'grid-6.name': 'Grid 6',
    'grid-6.tagline': 'Four in a row on a 6×6 board',
    'grid-6.rule1': 'Take turns placing your mark on an empty square.',
    'grid-6.rule2': 'Get four of your marks in a row — across, down or diagonally.',
    'grid-6.rule3': 'A full row is not needed: four in a line anywhere on the board wins.',

    'grid-9.name': 'Grid 9',
    'grid-9.tagline': 'Five in a row on a 9×9 board',
    'grid-9.rule1': 'Take turns placing your mark on an empty square.',
    'grid-9.rule2': 'Get five of your marks in a row — across, down or diagonally.',
    'grid-9.rule3': 'Space to build means space to be blocked: watch both ends of a run.',

    'gomoku-13.name': 'Gomoku 13',
    'gomoku-13.tagline': 'Five in a row on a 13×13 board',
    'gomoku-13.rule1': 'Take turns placing your mark on any empty point.',
    'gomoku-13.rule2': 'Get five of your marks in a row — across, down or diagonally.',
    'gomoku-13.rule3': 'An open run of three or four threatens at both ends. Block early.',

    'gomoku-15.name': 'Gomoku 15',
    'gomoku-15.tagline': 'Five in a row on a full 15×15 board',
    'gomoku-15.rule1': 'Take turns placing your mark on any empty point.',
    'gomoku-15.rule2': 'Get five of your marks in a row — across, down or diagonally.',
    'gomoku-15.rule3': 'Two open threats at once cannot both be blocked. That is how games end.',

    'misere.name': 'Misère',
    'misere.tagline': 'Three in a row on 3×3 — and it loses',
    'misere.rule1': 'Take turns placing your mark on an empty square, exactly as normal.',
    'misere.rule2': 'Getting three in a row makes you LOSE the game.',
    'misere.rule3': 'A full board with nobody forced into a line is a draw.',

    'vanish.name': 'Vanish',
    'vanish.tagline': 'Keep only your three newest marks',
    'vanish.rule1': 'Take turns placing your mark on an empty square.',
    'vanish.rule2':
      'You may only have three marks on the board. Placing a fourth removes your oldest first.',
    'vanish.rule3':
      'Your next mark to vanish is shown fading — it cannot be part of your winning line.',
    'vanish.rule4': 'Get three in a row to win. No line after 50 moves is a draw.',

    'gravity.name': 'Gravity',
    'gravity.tagline': 'Marks drop — four in a row on 7×7',
    'gravity.rule1': 'Pick a column. Your mark drops to the lowest empty square in it.',
    'gravity.rule2': 'Get four of your marks in a row — across, down or diagonally.',
    'gravity.rule3': 'A square only opens once the one beneath it is taken. Plan your stacks.',

    'ultimate.name': 'Ultimate',
    'ultimate.tagline': 'Nine small boards inside one big one',
    'ultimate.rule1': 'The big board is made of nine small 3×3 boards.',
    'ultimate.rule2': 'Win a small board by getting three in a row inside it.',
    'ultimate.rule3': 'Win the game by winning three small boards in a row.',
    'ultimate.rule4':
      'Your move decides where your opponent must play: the square you pick sends them to the matching small board.',
    'ultimate.rule5': 'If that small board is already finished, they may play anywhere.',

    'pente.name': 'Pente',
    'pente.tagline': 'Five in a row — or five captured pairs',
    'pente.rule1': 'Take turns placing your mark on any empty point of a 13×13 board.',
    'pente.rule2':
      'Flank exactly two of your opponent’s marks in a line — X O O X — and you capture them: they leave the board.',
    'pente.rule3': 'Only the mark you place captures. Moving into a flanked spot yourself is safe.',
    'pente.rule4': 'Win with five in a row, or by capturing five pairs.',

    'qubic.name': 'Qubic',
    'qubic.tagline': 'Four in a row inside a 4×4×4 cube',
    'qubic.rule1': 'The board is a cube: four layers of 4×4, stacked.',
    'qubic.rule2': 'Take turns placing your mark in any empty cell of any layer.',
    'qubic.rule3':
      'Get four in a row — within a layer, straight down through all four layers, or diagonally through the cube.',
    'qubic.rule4': 'There are 76 lines. Threats in two layers at once are how games are won.',

    'quantum.name': 'Quantum',
    'quantum.tagline': 'Every mark is in two places at once',
    'quantum.rule1':
      'Each move puts one spooky mark in two different squares at once, numbered by the move.',
    'quantum.rule2':
      'When the spooky marks form a closed loop, the loop collapses: the other player chooses where the newest mark really is, and every mark on the loop settles into one square.',
    'quantum.rule3': 'Collapsed marks are ordinary marks. Three of yours in a row wins.',
    'quantum.rule4':
      'If one collapse makes lines for both players, the line whose newest mark is older wins.',

    'gomoku-pro.name': 'Gomoku Pro',
    'gomoku-pro.tagline': 'Exactly five on 15×15, with the swap',
    'gomoku-pro.rule1': 'Take turns placing your mark on any empty point.',
    'gomoku-pro.rule2': 'Get exactly five in a row to win. Six or more in a line does not count.',
    'gomoku-pro.rule3':
      'Swap rule: after the first mark, the second player may take it as their own instead of replying. The opener then moves again.',
    'gomoku-pro.rule4': 'So open with a mark you would be happy to play either side of.',

    'connect4.name': 'Connect Four',
    'connect4.tagline': 'Drop discs — four in a row on 7×6',
    'connect4.rule1':
      'Pick one of the seven columns. Your disc drops to the lowest empty slot in it.',
    'connect4.rule2': 'Get four of your discs in a row — across, down or diagonally.',
    'connect4.rule3': 'Each column holds six discs. A full board with no line is a draw.',
    'connect4.rule4':
      'Swap rule: after the first disc, the second player may take it as their own.',

    'wild.name': 'Wild',
    'wild.tagline': 'Place X or O — any line wins for you',
    'wild.rule1': 'On your turn, choose X or O, then place it on an empty square.',
    'wild.rule2': 'Complete three in a row of either mark and you win — whoever made the line.',
    'wild.rule3': 'Every two-in-a-row is a gift to the next player. Leave none behind.',
    'wild.rule4': 'A full board with no line is a draw.',

    'wild-4.name': 'Wild 4',
    'wild-4.tagline': 'Wild rules — four in a row on 4×4',
    'wild-4.rule1': 'On your turn, choose X or O, then place it on an empty square.',
    'wild-4.rule2': 'Complete four in a row of either mark and you win.',
    'wild-4.rule3':
      'Three alike with a gap is a win waiting for the next player. Spoil lines with the other mark.',
    'wild-4.rule4': 'A full board with no line is a draw.',

    'order-chaos.name': 'Order & Chaos',
    'order-chaos.tagline': 'One builds five alike, one spoils it',
    'order-chaos.rule1':
      'One player is Order, the other is Chaos. Both may place an X or an O on any empty square.',
    'order-chaos.rule2':
      'Order wins as soon as five identical marks stand in a row — whoever placed the last one.',
    'order-chaos.rule3': 'Chaos wins if the board fills up without one. There are no draws.',
    'order-chaos.rule4':
      'Order sits in the X seat and Chaos in the O seat — the marks themselves belong to nobody.',

    'obstacles.name': 'Obstacles',
    'obstacles.tagline': 'Five in a row around rocks on 9×9',
    'obstacles.rule1':
      'A few squares are rocks: nobody can play on them and no line passes through.',
    'obstacles.rule2': 'Take turns placing your mark on an empty square.',
    'obstacles.rule3': 'Get five of your marks in a row — across, down or diagonally.',
    'obstacles.rule4': 'Every game scatters the rocks differently, always in a balanced pattern.',

    'powers.name': 'Powers',
    'powers.tagline': 'Five in a row with a bomb and a wall',
    'powers.rule1': 'Take turns placing your mark. Five in a row wins, on a 9×9 board.',
    'powers.rule2':
      'Once per game you may use a Bomb instead of placing: remove any one of your opponent’s marks.',
    'powers.rule3': 'Once per game you may build a Wall instead: block an empty square for good.',
    'powers.rule4': 'Using a power is your whole turn.',

    // Variant names, for a custom game that matches no mode.
    'variant.classic': 'Custom',
    'variant.gomoku': 'Gomoku',
    'variant.misere': 'Misère',
    'variant.gravity': 'Gravity',
    'variant.vanish': 'Vanish',
    'variant.ultimate': 'Ultimate',
    'variant.pente': 'Pente',
    'variant.qubic': 'Qubic',
    'variant.quantum': 'Quantum',
    'variant.connect4': 'Connect Four',
    'variant.wild': 'Wild',
    'variant.order-chaos': 'Order & Chaos',
    'variant.obstacles': 'Obstacles',
    'variant.powers': 'Powers',
    customConfig: '{variant} {size}×{size} · {count} in a row',
  },

  es: {
    'classic.name': 'Clásico',
    'classic.tagline': 'Tres en raya en un tablero de 3×3',
    'classic.rule1': 'Por turnos, coloca tu marca en una casilla vacía.',
    'classic.rule2': 'Pon tres de tus marcas en línea: en horizontal, vertical o diagonal.',
    'classic.rule3': 'Si el tablero se llena sin que nadie haga línea, la partida es un empate.',

    'grid-6.name': 'Cuadrícula 6',
    'grid-6.tagline': 'Cuatro en línea en un tablero de 6×6',
    'grid-6.rule1': 'Por turnos, coloca tu marca en una casilla vacía.',
    'grid-6.rule2': 'Pon cuatro de tus marcas en línea: en horizontal, vertical o diagonal.',
    'grid-6.rule3':
      'No hace falta llenar una fila entera: cuatro en línea en cualquier parte del tablero ganan.',

    'grid-9.name': 'Cuadrícula 9',
    'grid-9.tagline': 'Cinco en línea en un tablero de 9×9',
    'grid-9.rule1': 'Por turnos, coloca tu marca en una casilla vacía.',
    'grid-9.rule2': 'Pon cinco de tus marcas en línea: en horizontal, vertical o diagonal.',
    'grid-9.rule3':
      'Espacio para construir es espacio para que te bloqueen: vigila los dos extremos de cada línea.',

    'gomoku-13.name': 'Gomoku 13',
    'gomoku-13.tagline': 'Cinco en línea en un tablero de 13×13',
    'gomoku-13.rule1': 'Por turnos, coloca tu marca en cualquier punto vacío.',
    'gomoku-13.rule2': 'Pon cinco de tus marcas en línea: en horizontal, vertical o diagonal.',
    'gomoku-13.rule3':
      'Una línea abierta de tres o cuatro amenaza por ambos extremos. Bloquea pronto.',

    'gomoku-15.name': 'Gomoku 15',
    'gomoku-15.tagline': 'Cinco en línea en un tablero completo de 15×15',
    'gomoku-15.rule1': 'Por turnos, coloca tu marca en cualquier punto vacío.',
    'gomoku-15.rule2': 'Pon cinco de tus marcas en línea: en horizontal, vertical o diagonal.',
    'gomoku-15.rule3':
      'Dos amenazas abiertas a la vez no se pueden bloquear. Así terminan las partidas.',

    'misere.name': 'Misère',
    'misere.tagline': 'Tres en raya en 3×3… y pierdes',
    'misere.rule1': 'Por turnos, coloca tu marca en una casilla vacía, como siempre.',
    'misere.rule2': 'Hacer tres en raya te hace PERDER la partida.',
    'misere.rule3': 'Si el tablero se llena sin que nadie haga línea, es un empate.',

    'vanish.name': 'Desvanecer',
    'vanish.tagline': 'Solo conservas tus tres marcas más recientes',
    'vanish.rule1': 'Por turnos, coloca tu marca en una casilla vacía.',
    'vanish.rule2':
      'Solo puedes tener tres marcas en el tablero. Al colocar la cuarta, desaparece la más antigua.',
    'vanish.rule3':
      'Tu próxima marca en desaparecer se ve desvaneciéndose: no puede formar parte de tu línea ganadora.',
    'vanish.rule4': 'Haz tres en raya para ganar. Sin línea tras 50 jugadas, es un empate.',

    'gravity.name': 'Gravedad',
    'gravity.tagline': 'Las marcas caen: cuatro en línea en 7×7',
    'gravity.rule1': 'Elige una columna. Tu marca cae a la casilla vacía más baja.',
    'gravity.rule2': 'Pon cuatro de tus marcas en línea: en horizontal, vertical o diagonal.',
    'gravity.rule3':
      'Una casilla solo se abre cuando la de debajo está ocupada. Planifica tus pilas.',

    'ultimate.name': 'Ultimate',
    'ultimate.tagline': 'Nueve tableros pequeños dentro de uno grande',
    'ultimate.rule1': 'El tablero grande está formado por nueve tableros pequeños de 3×3.',
    'ultimate.rule2': 'Gana un tablero pequeño haciendo tres en raya dentro de él.',
    'ultimate.rule3': 'Gana la partida ganando tres tableros pequeños en línea.',
    'ultimate.rule4':
      'Tu jugada decide dónde debe jugar tu rival: la casilla que eliges lo envía al tablero pequeño correspondiente.',
    'ultimate.rule5': 'Si ese tablero pequeño ya ha terminado, puede jugar en cualquier parte.',

    'pente.name': 'Pente',
    'pente.tagline': 'Cinco en línea… o cinco parejas capturadas',
    'pente.rule1': 'Por turnos, coloca tu marca en cualquier punto vacío de un tablero de 13×13.',
    'pente.rule2':
      'Encierra exactamente dos marcas de tu rival en línea —X O O X— y las capturas: salen del tablero.',
    'pente.rule3': 'Solo captura la marca que colocas. Meterte tú en un hueco encerrado es seguro.',
    'pente.rule4': 'Gana con cinco en línea o capturando cinco parejas.',

    'qubic.name': 'Qubic',
    'qubic.tagline': 'Cuatro en línea dentro de un cubo de 4×4×4',
    'qubic.rule1': 'El tablero es un cubo: cuatro capas de 4×4, apiladas.',
    'qubic.rule2': 'Por turnos, coloca tu marca en cualquier celda vacía de cualquier capa.',
    'qubic.rule3':
      'Haz cuatro en línea: dentro de una capa, en vertical atravesando las cuatro capas o en diagonal a través del cubo.',
    'qubic.rule4': 'Hay 76 líneas. Las amenazas en dos capas a la vez son las que ganan partidas.',

    'quantum.name': 'Cuántico',
    'quantum.tagline': 'Cada marca está en dos sitios a la vez',
    'quantum.rule1':
      'Cada jugada pone una marca fantasmal en dos casillas distintas a la vez, numerada con la jugada.',
    'quantum.rule2':
      'Cuando las marcas fantasmales forman un ciclo cerrado, el ciclo colapsa: el otro jugador elige dónde está realmente la marca más reciente, y cada marca del ciclo se asienta en una casilla.',
    'quantum.rule3': 'Las marcas colapsadas son marcas normales. Tres tuyas en línea ganan.',
    'quantum.rule4':
      'Si un colapso crea líneas para ambos jugadores, gana la línea cuya marca más reciente sea más antigua.',

    'gomoku-pro.name': 'Gomoku Pro',
    'gomoku-pro.tagline': 'Exactamente cinco en 15×15, con intercambio',
    'gomoku-pro.rule1': 'Por turnos, coloca tu marca en cualquier punto vacío.',
    'gomoku-pro.rule2':
      'Haz exactamente cinco en línea para ganar. Seis o más en línea no cuentan.',
    'gomoku-pro.rule3':
      'Regla de intercambio: tras la primera marca, el segundo jugador puede quedársela en lugar de responder. Entonces el que abrió vuelve a mover.',
    'gomoku-pro.rule4':
      'Así que abre con una marca que te guste jugar desde cualquiera de los dos lados.',

    'connect4.name': 'Conecta 4',
    'connect4.tagline': 'Deja caer fichas: cuatro en línea en 7×6',
    'connect4.rule1': 'Elige una de las siete columnas. Tu ficha cae al hueco vacío más bajo.',
    'connect4.rule2': 'Pon cuatro de tus fichas en línea: en horizontal, vertical o diagonal.',
    'connect4.rule3': 'Cada columna admite seis fichas. Un tablero lleno sin línea es un empate.',
    'connect4.rule4':
      'Regla de intercambio: tras la primera ficha, el segundo jugador puede quedársela.',

    'wild.name': 'Salvaje',
    'wild.tagline': 'Pon X u O: cualquier línea te da la victoria',
    'wild.rule1': 'En tu turno, elige X u O y colócala en una casilla vacía.',
    'wild.rule2':
      'Completa tres en raya de cualquiera de las dos marcas y ganas, sin importar quién hizo la línea.',
    'wild.rule3': 'Cada dos en línea es un regalo para el siguiente jugador. No dejes ninguno.',
    'wild.rule4': 'Un tablero lleno sin línea es un empate.',

    'wild-4.name': 'Salvaje 4',
    'wild-4.tagline': 'Reglas salvajes: cuatro en línea en 4×4',
    'wild-4.rule1': 'En tu turno, elige X u O y colócala en una casilla vacía.',
    'wild-4.rule2': 'Completa cuatro en línea de cualquiera de las dos marcas y ganas.',
    'wild-4.rule3':
      'Tres iguales con un hueco son una victoria esperando al siguiente jugador. Estropea las líneas con la otra marca.',
    'wild-4.rule4': 'Un tablero lleno sin línea es un empate.',

    'order-chaos.name': 'Orden y Caos',
    'order-chaos.tagline': 'Uno forma cinco iguales, el otro lo impide',
    'order-chaos.rule1':
      'Un jugador es Orden y el otro, Caos. Ambos pueden poner una X o una O en cualquier casilla vacía.',
    'order-chaos.rule2':
      'Orden gana en cuanto hay cinco marcas idénticas en línea, sin importar quién puso la última.',
    'order-chaos.rule3': 'Caos gana si el tablero se llena sin ninguna. No hay empates.',
    'order-chaos.rule4':
      'Orden ocupa el puesto de X y Caos el de O; las marcas en sí no son de nadie.',

    'obstacles.name': 'Obstáculos',
    'obstacles.tagline': 'Cinco en línea entre rocas en 9×9',
    'obstacles.rule1':
      'Algunas casillas son rocas: nadie puede jugar en ellas y ninguna línea las atraviesa.',
    'obstacles.rule2': 'Por turnos, coloca tu marca en una casilla vacía.',
    'obstacles.rule3': 'Pon cinco de tus marcas en línea: en horizontal, vertical o diagonal.',
    'obstacles.rule4':
      'Cada partida reparte las rocas de forma distinta, siempre en un patrón equilibrado.',

    'powers.name': 'Poderes',
    'powers.tagline': 'Cinco en línea con una bomba y un muro',
    'powers.rule1': 'Por turnos, coloca tu marca. Cinco en línea ganan, en un tablero de 9×9.',
    'powers.rule2':
      'Una vez por partida puedes usar una Bomba en lugar de colocar: quita cualquier marca de tu rival.',
    'powers.rule3':
      'Una vez por partida puedes levantar un Muro: bloquea una casilla vacía para siempre.',
    'powers.rule4': 'Usar un poder ocupa todo tu turno.',

    'variant.classic': 'Personalizado',
    'variant.gomoku': 'Gomoku',
    'variant.misere': 'Misère',
    'variant.gravity': 'Gravedad',
    'variant.vanish': 'Desvanecer',
    'variant.ultimate': 'Ultimate',
    'variant.pente': 'Pente',
    'variant.qubic': 'Qubic',
    'variant.quantum': 'Cuántico',
    'variant.connect4': 'Conecta 4',
    'variant.wild': 'Salvaje',
    'variant.order-chaos': 'Orden y Caos',
    'variant.obstacles': 'Obstáculos',
    'variant.powers': 'Poderes',
    customConfig: '{variant} {size}×{size} · {count} en línea',
  },

  fr: {
    'classic.name': 'Classique',
    'classic.tagline': 'Trois alignés sur un plateau 3×3',
    'classic.rule1': 'À tour de rôle, placez votre symbole sur une case vide.',
    'classic.rule2':
      'Alignez trois de vos symboles : à l’horizontale, à la verticale ou en diagonale.',
    'classic.rule3': 'Si le plateau se remplit sans alignement, la partie est nulle.',

    'grid-6.name': 'Grille 6',
    'grid-6.tagline': 'Quatre alignés sur un plateau 6×6',
    'grid-6.rule1': 'À tour de rôle, placez votre symbole sur une case vide.',
    'grid-6.rule2':
      'Alignez quatre de vos symboles : à l’horizontale, à la verticale ou en diagonale.',
    'grid-6.rule3':
      'Inutile de remplir une rangée entière : quatre alignés n’importe où sur le plateau suffisent.',

    'grid-9.name': 'Grille 9',
    'grid-9.tagline': 'Cinq alignés sur un plateau 9×9',
    'grid-9.rule1': 'À tour de rôle, placez votre symbole sur une case vide.',
    'grid-9.rule2':
      'Alignez cinq de vos symboles : à l’horizontale, à la verticale ou en diagonale.',
    'grid-9.rule3':
      'De la place pour construire, c’est de la place pour être bloqué : surveillez les deux bouts d’une ligne.',

    'gomoku-13.name': 'Gomoku 13',
    'gomoku-13.tagline': 'Cinq alignés sur un plateau 13×13',
    'gomoku-13.rule1': 'À tour de rôle, placez votre symbole sur n’importe quel point libre.',
    'gomoku-13.rule2':
      'Alignez cinq de vos symboles : à l’horizontale, à la verticale ou en diagonale.',
    'gomoku-13.rule3': 'Une ligne ouverte de trois ou quatre menace des deux côtés. Bloquez tôt.',

    'gomoku-15.name': 'Gomoku 15',
    'gomoku-15.tagline': 'Cinq alignés sur un grand plateau 15×15',
    'gomoku-15.rule1': 'À tour de rôle, placez votre symbole sur n’importe quel point libre.',
    'gomoku-15.rule2':
      'Alignez cinq de vos symboles : à l’horizontale, à la verticale ou en diagonale.',
    'gomoku-15.rule3':
      'Deux menaces ouvertes à la fois ne peuvent pas être toutes deux bloquées. C’est ainsi que les parties se terminent.',

    'misere.name': 'Misère',
    'misere.tagline': 'Trois alignés sur 3×3… et c’est perdu',
    'misere.rule1': 'À tour de rôle, placez votre symbole sur une case vide, comme d’habitude.',
    'misere.rule2': 'Aligner trois symboles vous fait PERDRE la partie.',
    'misere.rule3': 'Un plateau plein sans que personne soit forcé d’aligner est une partie nulle.',

    'vanish.name': 'Évanescence',
    'vanish.tagline': 'Seuls vos trois symboles les plus récents restent',
    'vanish.rule1': 'À tour de rôle, placez votre symbole sur une case vide.',
    'vanish.rule2':
      'Vous ne pouvez avoir que trois symboles sur le plateau. En placer un quatrième retire d’abord le plus ancien.',
    'vanish.rule3':
      'Votre prochain symbole à disparaître s’estompe : il ne peut pas faire partie de votre ligne gagnante.',
    'vanish.rule4':
      'Alignez-en trois pour gagner. Sans alignement après 50 coups, la partie est nulle.',

    'gravity.name': 'Gravité',
    'gravity.tagline': 'Les symboles tombent : quatre alignés sur 7×7',
    'gravity.rule1': 'Choisissez une colonne. Votre symbole tombe sur la case libre la plus basse.',
    'gravity.rule2':
      'Alignez quatre de vos symboles : à l’horizontale, à la verticale ou en diagonale.',
    'gravity.rule3':
      'Une case ne s’ouvre que lorsque celle du dessous est prise. Prévoyez vos piles.',

    'ultimate.name': 'Ultimate',
    'ultimate.tagline': 'Neuf petits plateaux dans un grand',
    'ultimate.rule1': 'Le grand plateau est composé de neuf petits plateaux 3×3.',
    'ultimate.rule2': 'Gagnez un petit plateau en y alignant trois symboles.',
    'ultimate.rule3': 'Gagnez la partie en remportant trois petits plateaux alignés.',
    'ultimate.rule4':
      'Votre coup décide où votre adversaire doit jouer : la case choisie l’envoie sur le petit plateau correspondant.',
    'ultimate.rule5': 'Si ce petit plateau est déjà terminé, il peut jouer n’importe où.',

    'pente.name': 'Pente',
    'pente.tagline': 'Cinq alignés… ou cinq paires capturées',
    'pente.rule1':
      'À tour de rôle, placez votre symbole sur n’importe quel point libre d’un plateau 13×13.',
    'pente.rule2':
      'Encadrez exactement deux symboles adverses en ligne — X O O X — et vous les capturez : ils quittent le plateau.',
    'pente.rule3':
      'Seul le symbole que vous posez capture. Vous placer vous-même dans une position encadrée est sans danger.',
    'pente.rule4': 'Gagnez avec cinq alignés, ou en capturant cinq paires.',

    'qubic.name': 'Qubic',
    'qubic.tagline': 'Quatre alignés dans un cube 4×4×4',
    'qubic.rule1': 'Le plateau est un cube : quatre couches de 4×4 empilées.',
    'qubic.rule2':
      'À tour de rôle, placez votre symbole dans n’importe quelle case libre de n’importe quelle couche.',
    'qubic.rule3':
      'Alignez-en quatre : dans une couche, tout droit à travers les quatre couches, ou en diagonale à travers le cube.',
    'qubic.rule4':
      'Il y a 76 lignes. Les menaces sur deux couches à la fois font gagner les parties.',

    'quantum.name': 'Quantique',
    'quantum.tagline': 'Chaque symbole est à deux endroits à la fois',
    'quantum.rule1':
      'Chaque coup place un symbole fantôme dans deux cases différentes à la fois, numéroté par le coup.',
    'quantum.rule2':
      'Quand les symboles fantômes forment une boucle fermée, elle s’effondre : l’autre joueur choisit où se trouve réellement le symbole le plus récent, et chaque symbole de la boucle se fixe dans une case.',
    'quantum.rule3':
      'Les symboles effondrés sont des symboles ordinaires. Trois des vôtres alignés gagnent.',
    'quantum.rule4':
      'Si un effondrement crée des lignes pour les deux joueurs, gagne la ligne dont le symbole le plus récent est le plus ancien.',

    'gomoku-pro.name': 'Gomoku Pro',
    'gomoku-pro.tagline': 'Exactement cinq sur 15×15, avec l’échange',
    'gomoku-pro.rule1': 'À tour de rôle, placez votre symbole sur n’importe quel point libre.',
    'gomoku-pro.rule2':
      'Alignez exactement cinq symboles pour gagner. Six ou plus en ligne ne comptent pas.',
    'gomoku-pro.rule3':
      'Règle d’échange : après le premier symbole, le second joueur peut le prendre pour lui au lieu de répondre. L’ouvreur rejoue alors.',
    'gomoku-pro.rule4':
      'Ouvrez donc avec un symbole que vous seriez content de jouer d’un côté comme de l’autre.',

    'connect4.name': 'Puissance 4',
    'connect4.tagline': 'Lâchez des jetons : quatre alignés sur 7×6',
    'connect4.rule1':
      'Choisissez l’une des sept colonnes. Votre jeton tombe dans l’emplacement libre le plus bas.',
    'connect4.rule2':
      'Alignez quatre de vos jetons : à l’horizontale, à la verticale ou en diagonale.',
    'connect4.rule3':
      'Chaque colonne contient six jetons. Un plateau plein sans alignement est une partie nulle.',
    'connect4.rule4':
      'Règle d’échange : après le premier jeton, le second joueur peut le prendre pour lui.',

    'wild.name': 'Sauvage',
    'wild.tagline': 'Posez X ou O : n’importe quel alignement vous fait gagner',
    'wild.rule1': 'À votre tour, choisissez X ou O, puis placez-le sur une case vide.',
    'wild.rule2':
      'Complétez trois alignés de l’un ou l’autre symbole et vous gagnez, peu importe qui a fait la ligne.',
    'wild.rule3': 'Chaque paire alignée est un cadeau pour le joueur suivant. N’en laissez aucune.',
    'wild.rule4': 'Un plateau plein sans alignement est une partie nulle.',

    'wild-4.name': 'Sauvage 4',
    'wild-4.tagline': 'Règles sauvages : quatre alignés sur 4×4',
    'wild-4.rule1': 'À votre tour, choisissez X ou O, puis placez-le sur une case vide.',
    'wild-4.rule2': 'Complétez quatre alignés de l’un ou l’autre symbole et vous gagnez.',
    'wild-4.rule3':
      'Trois identiques avec un trou, c’est une victoire offerte au joueur suivant. Gâchez les lignes avec l’autre symbole.',
    'wild-4.rule4': 'Un plateau plein sans alignement est une partie nulle.',

    'order-chaos.name': 'Ordre et Chaos',
    'order-chaos.tagline': 'L’un aligne cinq identiques, l’autre l’en empêche',
    'order-chaos.rule1':
      'Un joueur est l’Ordre, l’autre le Chaos. Tous deux peuvent poser un X ou un O sur n’importe quelle case vide.',
    'order-chaos.rule2':
      'L’Ordre gagne dès que cinq symboles identiques sont alignés, peu importe qui a posé le dernier.',
    'order-chaos.rule3':
      'Le Chaos gagne si le plateau se remplit sans alignement. Il n’y a pas de nulle.',
    'order-chaos.rule4':
      'L’Ordre occupe la place de X et le Chaos celle de O ; les symboles eux-mêmes n’appartiennent à personne.',

    'obstacles.name': 'Obstacles',
    'obstacles.tagline': 'Cinq alignés entre des rochers sur 9×9',
    'obstacles.rule1':
      'Quelques cases sont des rochers : personne ne peut y jouer et aucune ligne ne les traverse.',
    'obstacles.rule2': 'À tour de rôle, placez votre symbole sur une case vide.',
    'obstacles.rule3':
      'Alignez cinq de vos symboles : à l’horizontale, à la verticale ou en diagonale.',
    'obstacles.rule4':
      'Chaque partie disperse les rochers différemment, toujours de façon équilibrée.',

    'powers.name': 'Pouvoirs',
    'powers.tagline': 'Cinq alignés avec une bombe et un mur',
    'powers.rule1':
      'À tour de rôle, placez votre symbole. Cinq alignés gagnent, sur un plateau 9×9.',
    'powers.rule2':
      'Une fois par partie, vous pouvez utiliser une Bombe au lieu de poser : retirez n’importe quel symbole adverse.',
    'powers.rule3':
      'Une fois par partie, vous pouvez construire un Mur : bloquez définitivement une case vide.',
    'powers.rule4': 'Utiliser un pouvoir occupe tout votre tour.',

    'variant.classic': 'Personnalisé',
    'variant.gomoku': 'Gomoku',
    'variant.misere': 'Misère',
    'variant.gravity': 'Gravité',
    'variant.vanish': 'Évanescence',
    'variant.ultimate': 'Ultimate',
    'variant.pente': 'Pente',
    'variant.qubic': 'Qubic',
    'variant.quantum': 'Quantique',
    'variant.connect4': 'Puissance 4',
    'variant.wild': 'Sauvage',
    'variant.order-chaos': 'Ordre et Chaos',
    'variant.obstacles': 'Obstacles',
    'variant.powers': 'Pouvoirs',
    customConfig: '{variant} {size}×{size} · {count} alignés',
  },

  de: {
    'classic.name': 'Klassisch',
    'classic.tagline': 'Drei in einer Reihe auf einem 3×3-Brett',
    'classic.rule1': 'Setzt abwechselnd euer Zeichen auf ein leeres Feld.',
    'classic.rule2':
      'Bringe drei deiner Zeichen in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'classic.rule3': 'Ist das Brett voll und keiner hat eine Reihe, endet das Spiel unentschieden.',

    'grid-6.name': 'Raster 6',
    'grid-6.tagline': 'Vier in einer Reihe auf einem 6×6-Brett',
    'grid-6.rule1': 'Setzt abwechselnd euer Zeichen auf ein leeres Feld.',
    'grid-6.rule2':
      'Bringe vier deiner Zeichen in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'grid-6.rule3':
      'Eine ganze Zeile ist nicht nötig: Vier in einer Linie irgendwo auf dem Brett gewinnen.',

    'grid-9.name': 'Raster 9',
    'grid-9.tagline': 'Fünf in einer Reihe auf einem 9×9-Brett',
    'grid-9.rule1': 'Setzt abwechselnd euer Zeichen auf ein leeres Feld.',
    'grid-9.rule2':
      'Bringe fünf deiner Zeichen in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'grid-9.rule3':
      'Platz zum Aufbauen ist auch Platz zum Blockieren: Behalte beide Enden einer Reihe im Blick.',

    'gomoku-13.name': 'Gomoku 13',
    'gomoku-13.tagline': 'Fünf in einer Reihe auf einem 13×13-Brett',
    'gomoku-13.rule1': 'Setzt abwechselnd euer Zeichen auf einen beliebigen freien Punkt.',
    'gomoku-13.rule2':
      'Bringe fünf deiner Zeichen in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'gomoku-13.rule3':
      'Eine offene Dreier- oder Viererreihe droht an beiden Enden. Blockiere früh.',

    'gomoku-15.name': 'Gomoku 15',
    'gomoku-15.tagline': 'Fünf in einer Reihe auf dem vollen 15×15-Brett',
    'gomoku-15.rule1': 'Setzt abwechselnd euer Zeichen auf einen beliebigen freien Punkt.',
    'gomoku-15.rule2':
      'Bringe fünf deiner Zeichen in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'gomoku-15.rule3':
      'Zwei offene Drohungen auf einmal lassen sich nicht beide blockieren. So enden Partien.',

    'misere.name': 'Misère',
    'misere.tagline': 'Drei in einer Reihe auf 3×3 – und das verliert',
    'misere.rule1': 'Setzt abwechselnd euer Zeichen auf ein leeres Feld, ganz wie gewohnt.',
    'misere.rule2': 'Wer drei in einer Reihe hat, VERLIERT das Spiel.',
    'misere.rule3':
      'Ein volles Brett, auf dem niemand zu einer Reihe gezwungen wurde, ist unentschieden.',

    'vanish.name': 'Verblassen',
    'vanish.tagline': 'Nur deine drei neuesten Zeichen bleiben',
    'vanish.rule1': 'Setzt abwechselnd euer Zeichen auf ein leeres Feld.',
    'vanish.rule2':
      'Du darfst nur drei Zeichen auf dem Brett haben. Setzt du ein viertes, verschwindet zuerst dein ältestes.',
    'vanish.rule3':
      'Dein nächstes verschwindendes Zeichen wird verblassend gezeigt – es kann nicht Teil deiner Gewinnreihe sein.',
    'vanish.rule4':
      'Drei in einer Reihe gewinnen. Gibt es nach 50 Zügen keine Reihe, ist es unentschieden.',

    'gravity.name': 'Schwerkraft',
    'gravity.tagline': 'Zeichen fallen – vier in einer Reihe auf 7×7',
    'gravity.rule1': 'Wähle eine Spalte. Dein Zeichen fällt auf das tiefste freie Feld darin.',
    'gravity.rule2':
      'Bringe vier deiner Zeichen in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'gravity.rule3': 'Ein Feld wird erst frei, wenn das darunter belegt ist. Plane deine Stapel.',

    'ultimate.name': 'Ultimate',
    'ultimate.tagline': 'Neun kleine Bretter in einem großen',
    'ultimate.rule1': 'Das große Brett besteht aus neun kleinen 3×3-Brettern.',
    'ultimate.rule2': 'Gewinne ein kleines Brett mit drei in einer Reihe darauf.',
    'ultimate.rule3': 'Gewinne das Spiel mit drei gewonnenen kleinen Brettern in einer Reihe.',
    'ultimate.rule4':
      'Dein Zug bestimmt, wo dein Gegner spielen muss: Das gewählte Feld schickt ihn auf das passende kleine Brett.',
    'ultimate.rule5': 'Ist dieses kleine Brett schon entschieden, darf er überall spielen.',

    'pente.name': 'Pente',
    'pente.tagline': 'Fünf in einer Reihe – oder fünf geschlagene Paare',
    'pente.rule1':
      'Setzt abwechselnd euer Zeichen auf einen beliebigen freien Punkt eines 13×13-Bretts.',
    'pente.rule2':
      'Schließe genau zwei gegnerische Zeichen in einer Linie ein – X O O X – und du schlägst sie: Sie verlassen das Brett.',
    'pente.rule3':
      'Nur das gesetzte Zeichen schlägt. Selbst in eine eingeschlossene Lücke zu ziehen ist sicher.',
    'pente.rule4': 'Gewinne mit fünf in einer Reihe oder durch fünf geschlagene Paare.',

    'qubic.name': 'Qubic',
    'qubic.tagline': 'Vier in einer Reihe in einem 4×4×4-Würfel',
    'qubic.rule1': 'Das Brett ist ein Würfel: vier übereinandergestapelte 4×4-Ebenen.',
    'qubic.rule2': 'Setzt abwechselnd euer Zeichen in eine beliebige freie Zelle einer Ebene.',
    'qubic.rule3':
      'Bilde vier in einer Reihe – innerhalb einer Ebene, senkrecht durch alle vier Ebenen oder diagonal durch den Würfel.',
    'qubic.rule4': 'Es gibt 76 Linien. Drohungen auf zwei Ebenen zugleich entscheiden die Partien.',

    'quantum.name': 'Quanten',
    'quantum.tagline': 'Jedes Zeichen ist an zwei Orten zugleich',
    'quantum.rule1':
      'Jeder Zug setzt ein Spukzeichen gleichzeitig auf zwei verschiedene Felder, nummeriert nach dem Zug.',
    'quantum.rule2':
      'Bilden die Spukzeichen eine geschlossene Schleife, kollabiert sie: Der andere Spieler wählt, wo das neueste Zeichen wirklich steht, und jedes Zeichen der Schleife legt sich auf ein Feld fest.',
    'quantum.rule3':
      'Kollabierte Zeichen sind normale Zeichen. Drei deiner Zeichen in einer Reihe gewinnen.',
    'quantum.rule4':
      'Erzeugt ein Kollaps Reihen für beide Spieler, gewinnt die Reihe, deren neuestes Zeichen älter ist.',

    'gomoku-pro.name': 'Gomoku Pro',
    'gomoku-pro.tagline': 'Genau fünf auf 15×15, mit Tausch',
    'gomoku-pro.rule1': 'Setzt abwechselnd euer Zeichen auf einen beliebigen freien Punkt.',
    'gomoku-pro.rule2':
      'Genau fünf in einer Reihe gewinnen. Sechs oder mehr in einer Linie zählen nicht.',
    'gomoku-pro.rule3':
      'Tauschregel: Nach dem ersten Zeichen darf der zweite Spieler es als seines übernehmen, statt zu antworten. Dann zieht der Eröffnende erneut.',
    'gomoku-pro.rule4':
      'Eröffne also mit einem Zeichen, mit dem du auf beiden Seiten gern spielen würdest.',

    'connect4.name': 'Vier gewinnt',
    'connect4.tagline': 'Scheiben fallen lassen – vier in einer Reihe auf 7×6',
    'connect4.rule1':
      'Wähle eine der sieben Spalten. Deine Scheibe fällt auf den tiefsten freien Platz darin.',
    'connect4.rule2':
      'Bringe vier deiner Scheiben in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'connect4.rule3':
      'Jede Spalte fasst sechs Scheiben. Ein volles Brett ohne Reihe ist unentschieden.',
    'connect4.rule4':
      'Tauschregel: Nach der ersten Scheibe darf der zweite Spieler sie als seine übernehmen.',

    'wild.name': 'Wild',
    'wild.tagline': 'Setze X oder O – jede Reihe lässt dich gewinnen',
    'wild.rule1': 'Wähle in deinem Zug X oder O und setze es auf ein leeres Feld.',
    'wild.rule2':
      'Vervollständige drei in einer Reihe mit einem der beiden Zeichen und du gewinnst – egal, wer die Reihe gebaut hat.',
    'wild.rule3': 'Jede Zweierreihe ist ein Geschenk für den nächsten Spieler. Lass keine liegen.',
    'wild.rule4': 'Ein volles Brett ohne Reihe ist unentschieden.',

    'wild-4.name': 'Wild 4',
    'wild-4.tagline': 'Wild-Regeln – vier in einer Reihe auf 4×4',
    'wild-4.rule1': 'Wähle in deinem Zug X oder O und setze es auf ein leeres Feld.',
    'wild-4.rule2':
      'Vervollständige vier in einer Reihe mit einem der beiden Zeichen und du gewinnst.',
    'wild-4.rule3':
      'Drei Gleiche mit einer Lücke sind ein Sieg, der auf den nächsten Spieler wartet. Verdirb Reihen mit dem anderen Zeichen.',
    'wild-4.rule4': 'Ein volles Brett ohne Reihe ist unentschieden.',

    'order-chaos.name': 'Ordnung & Chaos',
    'order-chaos.tagline': 'Einer baut fünf Gleiche, der andere verdirbt es',
    'order-chaos.rule1':
      'Ein Spieler ist Ordnung, der andere Chaos. Beide dürfen ein X oder ein O auf ein beliebiges leeres Feld setzen.',
    'order-chaos.rule2':
      'Ordnung gewinnt, sobald fünf gleiche Zeichen in einer Reihe stehen – egal, wer das letzte gesetzt hat.',
    'order-chaos.rule3':
      'Chaos gewinnt, wenn sich das Brett ohne eine solche Reihe füllt. Unentschieden gibt es nicht.',
    'order-chaos.rule4':
      'Ordnung sitzt auf dem X-Platz und Chaos auf dem O-Platz – die Zeichen selbst gehören niemandem.',

    'obstacles.name': 'Hindernisse',
    'obstacles.tagline': 'Fünf in einer Reihe zwischen Felsen auf 9×9',
    'obstacles.rule1':
      'Einige Felder sind Felsen: Niemand kann dort spielen, und keine Reihe führt hindurch.',
    'obstacles.rule2': 'Setzt abwechselnd euer Zeichen auf ein leeres Feld.',
    'obstacles.rule3':
      'Bringe fünf deiner Zeichen in eine Reihe – waagerecht, senkrecht oder diagonal.',
    'obstacles.rule4':
      'Jede Partie verteilt die Felsen anders, immer in einem ausgewogenen Muster.',

    'powers.name': 'Kräfte',
    'powers.tagline': 'Fünf in einer Reihe mit Bombe und Mauer',
    'powers.rule1':
      'Setzt abwechselnd euer Zeichen. Fünf in einer Reihe gewinnen, auf einem 9×9-Brett.',
    'powers.rule2':
      'Einmal pro Partie darfst du statt zu setzen eine Bombe einsetzen: Entferne ein beliebiges gegnerisches Zeichen.',
    'powers.rule3':
      'Einmal pro Partie darfst du stattdessen eine Mauer bauen: Sperre ein leeres Feld dauerhaft.',
    'powers.rule4': 'Eine Kraft einzusetzen kostet deinen ganzen Zug.',

    'variant.classic': 'Eigenes Spiel',
    'variant.gomoku': 'Gomoku',
    'variant.misere': 'Misère',
    'variant.gravity': 'Schwerkraft',
    'variant.vanish': 'Verblassen',
    'variant.ultimate': 'Ultimate',
    'variant.pente': 'Pente',
    'variant.qubic': 'Qubic',
    'variant.quantum': 'Quanten',
    'variant.connect4': 'Vier gewinnt',
    'variant.wild': 'Wild',
    'variant.order-chaos': 'Ordnung & Chaos',
    'variant.obstacles': 'Hindernisse',
    'variant.powers': 'Kräfte',
    customConfig: '{variant} {size}×{size} · {count} in einer Reihe',
  },

  fa: {
    'classic.name': 'کلاسیک',
    'classic.tagline': 'سه‌تا در یک ردیف روی صفحهٔ ۳×۳',
    'classic.rule1': 'به نوبت، علامتت را در یک خانهٔ خالی بگذار.',
    'classic.rule2': 'سه علامتت را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'classic.rule3': 'اگر صفحه پر شود و کسی ردیف نسازد، بازی مساوی است.',

    'grid-6.name': 'جدول ۶',
    'grid-6.tagline': 'چهارتا در یک ردیف روی صفحهٔ ۶×۶',
    'grid-6.rule1': 'به نوبت، علامتت را در یک خانهٔ خالی بگذار.',
    'grid-6.rule2': 'چهار علامتت را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'grid-6.rule3': 'لازم نیست یک ردیف کامل پر شود: چهارتا پشت سر هم در هر جای صفحه می‌برد.',

    'grid-9.name': 'جدول ۹',
    'grid-9.tagline': 'پنج‌تا در یک ردیف روی صفحهٔ ۹×۹',
    'grid-9.rule1': 'به نوبت، علامتت را در یک خانهٔ خالی بگذار.',
    'grid-9.rule2': 'پنج علامتت را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'grid-9.rule3': 'جای ساختن یعنی جای بسته‌شدن: هر دو سر ردیفت را بپا.',

    'gomoku-13.name': 'گوموکو ۱۳',
    'gomoku-13.tagline': 'پنج‌تا در یک ردیف روی صفحهٔ ۱۳×۱۳',
    'gomoku-13.rule1': 'به نوبت، علامتت را روی هر نقطهٔ خالی بگذار.',
    'gomoku-13.rule2': 'پنج علامتت را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'gomoku-13.rule3': 'ردیف باز سه‌تایی یا چهارتایی از هر دو سر تهدید می‌کند. زود ببند.',

    'gomoku-15.name': 'گوموکو ۱۵',
    'gomoku-15.tagline': 'پنج‌تا در یک ردیف روی صفحهٔ کامل ۱۵×۱۵',
    'gomoku-15.rule1': 'به نوبت، علامتت را روی هر نقطهٔ خالی بگذار.',
    'gomoku-15.rule2': 'پنج علامتت را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'gomoku-15.rule3': 'دو تهدید باز هم‌زمان را نمی‌شود با هم بست. بازی‌ها این‌طور تمام می‌شوند.',

    'misere.name': 'میزر',
    'misere.tagline': 'سه‌تا در یک ردیف روی ۳×۳ — و می‌بازی',
    'misere.rule1': 'به نوبت، علامتت را مثل همیشه در یک خانهٔ خالی بگذار.',
    'misere.rule2': 'هر کس سه‌تا در یک ردیف بسازد، بازی را می‌بازد.',
    'misere.rule3': 'اگر صفحه پر شود و کسی مجبور به ساختن ردیف نشود، بازی مساوی است.',

    'vanish.name': 'محو',
    'vanish.tagline': 'فقط سه علامت تازه‌ات می‌مانند',
    'vanish.rule1': 'به نوبت، علامتت را در یک خانهٔ خالی بگذار.',
    'vanish.rule2':
      'فقط سه علامت می‌توانی روی صفحه داشته باشی. با گذاشتن چهارمی، قدیمی‌ترینت اول پاک می‌شود.',
    'vanish.rule3':
      'علامت بعدی‌ات که محو می‌شود کم‌رنگ نشان داده می‌شود — نمی‌تواند بخشی از ردیف برنده‌ات باشد.',
    'vanish.rule4': 'با سه‌تا در یک ردیف ببر. اگر تا ۵۰ حرکت ردیفی ساخته نشود، بازی مساوی است.',

    'gravity.name': 'جاذبه',
    'gravity.tagline': 'علامت‌ها می‌افتند — چهارتا در یک ردیف روی ۷×۷',
    'gravity.rule1': 'یک ستون انتخاب کن. علامتت به پایین‌ترین خانهٔ خالی آن می‌افتد.',
    'gravity.rule2': 'چهار علامتت را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'gravity.rule3':
      'هر خانه فقط وقتی باز می‌شود که خانهٔ زیرش پر شده باشد. ستون‌هایت را حساب‌شده بچین.',

    'ultimate.name': 'دوز بزرگ',
    'ultimate.tagline': 'نُه صفحهٔ کوچک درون یک صفحهٔ بزرگ',
    'ultimate.rule1': 'صفحهٔ بزرگ از نُه صفحهٔ کوچک ۳×۳ ساخته شده است.',
    'ultimate.rule2': 'هر صفحهٔ کوچک را با سه‌تا در یک ردیف درون آن ببر.',
    'ultimate.rule3': 'بازی را با بردن سه صفحهٔ کوچک در یک ردیف ببر.',
    'ultimate.rule4':
      'حرکت تو تعیین می‌کند حریف کجا بازی کند: خانه‌ای که انتخاب می‌کنی او را به صفحهٔ کوچک متناظر می‌فرستد.',
    'ultimate.rule5': 'اگر آن صفحهٔ کوچک تمام شده باشد، حریف هر جا بخواهد می‌تواند بازی کند.',

    'pente.name': 'پنته',
    'pente.tagline': 'پنج‌تا در یک ردیف — یا گرفتن پنج جفت',
    'pente.rule1': 'به نوبت، علامتت را روی هر نقطهٔ خالی صفحهٔ ۱۳×۱۳ بگذار.',
    'pente.rule2':
      'دقیقاً دو علامت حریف را در یک خط محاصره کن — X O O X — تا آن‌ها را بگیری: از صفحه بیرون می‌روند.',
    'pente.rule3': 'فقط علامتی که می‌گذاری می‌گیرد. رفتن خودت به جای محاصره‌شده بی‌خطر است.',
    'pente.rule4': 'با پنج‌تا در یک ردیف، یا با گرفتن پنج جفت ببر.',

    'qubic.name': 'کیوبیک',
    'qubic.tagline': 'چهارتا در یک ردیف درون مکعب ۴×۴×۴',
    'qubic.rule1': 'صفحه یک مکعب است: چهار لایهٔ ۴×۴ روی هم.',
    'qubic.rule2': 'به نوبت، علامتت را در هر خانهٔ خالی از هر لایه بگذار.',
    'qubic.rule3':
      'چهارتا در یک ردیف بساز — درون یک لایه، مستقیم از میان هر چهار لایه، یا مورب از میان مکعب.',
    'qubic.rule4': '۷۶ خط وجود دارد. تهدید هم‌زمان در دو لایه راه بردن است.',

    'quantum.name': 'کوانتومی',
    'quantum.tagline': 'هر علامت هم‌زمان در دو جاست',
    'quantum.rule1':
      'هر حرکت یک علامت شبح‌وار را هم‌زمان در دو خانهٔ مختلف می‌گذارد که با شمارهٔ حرکت نام‌گذاری می‌شود.',
    'quantum.rule2':
      'وقتی علامت‌های شبح‌وار یک حلقهٔ بسته بسازند، حلقه فرو می‌ریزد: بازیکن دیگر انتخاب می‌کند تازه‌ترین علامت واقعاً کجاست، و هر علامت حلقه در یک خانه ثابت می‌شود.',
    'quantum.rule3': 'علامت‌های فروریخته علامت‌های معمولی‌اند. سه‌تا از مال تو در یک ردیف می‌برد.',
    'quantum.rule4':
      'اگر یک فروریزش برای هر دو بازیکن ردیف بسازد، ردیفی می‌برد که تازه‌ترین علامتش قدیمی‌تر است.',

    'gomoku-pro.name': 'گوموکو حرفه‌ای',
    'gomoku-pro.tagline': 'دقیقاً پنج‌تا روی ۱۵×۱۵، با قانون جابه‌جایی',
    'gomoku-pro.rule1': 'به نوبت، علامتت را روی هر نقطهٔ خالی بگذار.',
    'gomoku-pro.rule2': 'برای بردن دقیقاً پنج‌تا در یک ردیف بساز. شش‌تا یا بیشتر حساب نمی‌شود.',
    'gomoku-pro.rule3':
      'قانون جابه‌جایی: بعد از اولین علامت، بازیکن دوم می‌تواند به‌جای پاسخ‌دادن آن را مال خود کند. آن‌وقت شروع‌کننده دوباره حرکت می‌کند.',
    'gomoku-pro.rule4': 'پس با علامتی شروع کن که از هر دو طرفش راضی باشی.',

    'connect4.name': 'چهار در یک ردیف',
    'connect4.tagline': 'مهره بینداز — چهارتا در یک ردیف روی ۷×۶',
    'connect4.rule1': 'یکی از هفت ستون را انتخاب کن. مهره‌ات به پایین‌ترین جای خالی آن می‌افتد.',
    'connect4.rule2': 'چهار مهره‌ات را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'connect4.rule3': 'هر ستون شش مهره جا دارد. صفحهٔ پر بدون ردیف یعنی مساوی.',
    'connect4.rule4': 'قانون جابه‌جایی: بعد از اولین مهره، بازیکن دوم می‌تواند آن را مال خود کند.',

    'wild.name': 'آزاد',
    'wild.tagline': 'X یا O بگذار — هر ردیفی به نفع توست',
    'wild.rule1': 'در نوبتت X یا O را انتخاب کن و در یک خانهٔ خالی بگذار.',
    'wild.rule2':
      'سه‌تا در یک ردیف از هر کدام از دو علامت کامل کنی، می‌بری — مهم نیست چه کسی ردیف را ساخته.',
    'wild.rule3': 'هر دوتای پشت سر هم هدیه‌ای به بازیکن بعدی است. هیچ‌کدام را جا نگذار.',
    'wild.rule4': 'صفحهٔ پر بدون ردیف یعنی مساوی.',

    'wild-4.name': 'آزاد ۴',
    'wild-4.tagline': 'قوانین آزاد — چهارتا در یک ردیف روی ۴×۴',
    'wild-4.rule1': 'در نوبتت X یا O را انتخاب کن و در یک خانهٔ خالی بگذار.',
    'wild-4.rule2': 'چهارتا در یک ردیف از هر کدام از دو علامت کامل کنی، می‌بری.',
    'wild-4.rule3':
      'سه علامت یکسان با یک جای خالی، بردی است که منتظر بازیکن بعدی است. ردیف‌ها را با علامت دیگر خراب کن.',
    'wild-4.rule4': 'صفحهٔ پر بدون ردیف یعنی مساوی.',

    'order-chaos.name': 'نظم و آشوب',
    'order-chaos.tagline': 'یکی پنج علامت یکسان می‌چیند، دیگری خرابش می‌کند',
    'order-chaos.rule1':
      'یک بازیکن «نظم» است و دیگری «آشوب». هر دو می‌توانند X یا O را در هر خانهٔ خالی بگذارند.',
    'order-chaos.rule2':
      'نظم به محض اینکه پنج علامت یکسان در یک ردیف قرار بگیرند می‌برد — مهم نیست آخری را چه کسی گذاشته.',
    'order-chaos.rule3': 'اگر صفحه بدون چنین ردیفی پر شود، آشوب می‌برد. مساوی وجود ندارد.',
    'order-chaos.rule4': 'نظم جای X می‌نشیند و آشوب جای O — خود علامت‌ها مال هیچ‌کس نیستند.',

    'obstacles.name': 'موانع',
    'obstacles.tagline': 'پنج‌تا در یک ردیف میان صخره‌ها روی ۹×۹',
    'obstacles.rule1':
      'چند خانه صخره‌اند: کسی نمی‌تواند در آن‌ها بازی کند و هیچ ردیفی از آن‌ها نمی‌گذرد.',
    'obstacles.rule2': 'به نوبت، علامتت را در یک خانهٔ خالی بگذار.',
    'obstacles.rule3': 'پنج علامتت را در یک ردیف بچین — افقی، عمودی یا مورب.',
    'obstacles.rule4': 'هر بازی صخره‌ها را جور دیگری می‌چیند، همیشه با الگویی متعادل.',

    'powers.name': 'قدرت‌ها',
    'powers.tagline': 'پنج‌تا در یک ردیف با یک بمب و یک دیوار',
    'powers.rule1': 'به نوبت، علامتت را بگذار. پنج‌تا در یک ردیف روی صفحهٔ ۹×۹ می‌برد.',
    'powers.rule2':
      'یک بار در هر بازی می‌توانی به‌جای گذاشتن علامت از بمب استفاده کنی: یکی از علامت‌های حریف را بردار.',
    'powers.rule3':
      'یک بار در هر بازی می‌توانی به‌جایش دیوار بسازی: یک خانهٔ خالی را برای همیشه ببند.',
    'powers.rule4': 'استفاده از قدرت، کل نوبتت را می‌گیرد.',

    'variant.classic': 'سفارشی',
    'variant.gomoku': 'گوموکو',
    'variant.misere': 'میزر',
    'variant.gravity': 'جاذبه',
    'variant.vanish': 'محو',
    'variant.ultimate': 'دوز بزرگ',
    'variant.pente': 'پنته',
    'variant.qubic': 'کیوبیک',
    'variant.quantum': 'کوانتومی',
    'variant.connect4': 'چهار در یک ردیف',
    'variant.wild': 'آزاد',
    'variant.order-chaos': 'نظم و آشوب',
    'variant.obstacles': 'موانع',
    'variant.powers': 'قدرت‌ها',
    customConfig: '{variant} {size}×{size}، {count} در یک ردیف',
  },
});

type ModeKey = keyof (typeof modeMessages)['en'];

export interface ModeText {
  readonly name: string;
  readonly tagline: string;
  readonly rules: readonly string[];
}

/** A mode's name, tagline and rules in `locale` (the current one by default). */
export function modeText(id: ModeId, locale?: Locale): ModeText {
  const rules: string[] = [];
  for (let n = 1; `${id}.rule${n}` in modeMessages.en; n++) {
    rules.push(translate(modeMessages, `${id}.rule${n}` as ModeKey, undefined, locale));
  }
  return {
    name: translate(modeMessages, `${id}.name`, undefined, locale),
    tagline: translate(modeMessages, `${id}.tagline`, undefined, locale),
    rules,
  };
}

/** Just a mode's name, the common case for headers and lists. */
export function modeName(id: ModeId, locale?: Locale): string {
  return translate(modeMessages, `${id}.name`, undefined, locale);
}

/** As {@link modeText}, re-rendering when the player changes language. */
export function useModeText(id: ModeId): ModeText {
  return modeText(id, useLocale());
}

/**
 * A translator for any mode, for components that list several. Calling it
 * re-reads nothing; the hook itself is what re-renders on a language change.
 */
export function useModeTexts(): (id: ModeId) => ModeText {
  const locale = useLocale();
  return (id) => modeText(id, locale);
}

/**
 * The localized counterpart of the engine's `describeConfig`: the mode's name
 * when the config is one, else a readable description of the custom game.
 */
export function describeConfigText(config: GameConfig, locale?: Locale): string {
  const mode = modeForConfig(config);
  if (mode) return modeName(mode.id, locale);
  const variantKey = `variant.${config.variant satisfies VariantId}` as ModeKey;
  return translate(
    modeMessages,
    'customConfig',
    {
      variant: translate(modeMessages, variantKey, undefined, locale),
      size: config.size,
      count: config.winLength,
    },
    locale,
  );
}
