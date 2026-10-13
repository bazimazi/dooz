/**
 * The lessons in German. Keys, and the English they fall back to, are
 * explained in `lessonsContent.ts`.
 */
export const lessonsContentDe: Readonly<Record<string, string>> = {
  // Classic
  'classic-three-in-a-row.title': 'Gewinnen und blockieren',
  'classic-three-in-a-row.intro':
    'Jede Partie Tic-Tac-Toe dreht sich um zwei Fragen, bei jedem Zug: Kann ich jetzt gewinnen – und kann es mein Gegner? Achte auf zwei in einer Reihe mit leerem drittem Feld – deine zum Vollenden, seine zum Stoppen.',
  'classic-three-in-a-row.1.prompt': 'Du hast zwei in einer Reihe. Vollende sie.',
  'classic-three-in-a-row.1.hint': 'Deine Diagonale läuft von Ecke zu Ecke durch die Mitte.',
  'classic-three-in-a-row.1.success':
    'Drei in einer Reihe. Prüfe immer zuerst, ob du selbst gewinnen kannst.',
  'classic-three-in-a-row.1.wrong':
    'Das ergibt keine drei in einer Reihe – schau entlang der Diagonale.',
  'classic-three-in-a-row.2.prompt': 'Dein Gegner hat zwei in einer Reihe. Halte ihn auf.',
  'classic-three-in-a-row.2.hint': 'Seine zwei laufen die Diagonale hinunter. Nimm ihr Ende.',
  'classic-three-in-a-row.2.success': 'Blockiert. Seine Diagonale ist tot.',
  'classic-three-in-a-row.2.wrong': 'Er hat noch ein Feld, das seine Diagonale vollendet.',
  'classic-three-in-a-row.3.prompt': 'Ihr habt beide zwei in einer Reihe. Was kommt zuerst?',
  'classic-three-in-a-row.3.hint': 'Ein Sieg beendet das Spiel, bevor seine Drohung zählt.',
  'classic-three-in-a-row.3.success': 'Gewinnen schlägt Blockieren – er bekommt keinen Zug mehr.',
  'classic-three-in-a-row.3.wrong':
    'Du kannst mit diesem Zug gewinnen. Tu es, bevor du dich um seine Drohung kümmerst.',
  'classic-forks.title': 'Gabeln',
  'classic-forks.intro':
    'Eine Gabel ist ein Zug, der zwei Drohungen auf einmal schafft – eine Doppeldrohung. Dein Gegner kann nur eine davon blockieren, also gewinnt die andere. Fast jede entschiedene Partie Tic-Tac-Toe wird durch eine Gabel entschieden.',
  'classic-forks.1.prompt': 'Schaffe mit einem Zug zwei Drohungen.',
  'classic-forks.1.hint':
    'Such ein Feld, das auf zwei verschiedenen Linien mit je einem deiner Zeichen liegt.',
  'classic-forks.1.success': 'Zwei Drohungen. Welche er auch blockiert – die andere gewinnt.',
  'classic-forks.1.wrong':
    'Das schafft höchstens eine Drohung – er blockiert sie, und du hast nichts.',
  'classic-forks.2.prompt':
    'Er hält gegenüberliegende Ecken. Verhindere die Gabel, bevor sie entsteht.',
  'classic-forks.2.hint':
    'Eine Ecke wirkt naheliegend – genau das ist die Falle. Schaffe von einem Randfeld aus eine eigene Drohung.',
  'classic-forks.2.success':
    'Ein Randfeld zwingt ihn, dir zu antworten, und er bekommt nie den freien Zug, den eine Gabel braucht.',
  'classic-forks.2.wrong':
    'Eine Ecke lässt ihn hier die andere Ecke nehmen – mit zwei Drohungen auf einmal.',
  'classic-first-reply.title': 'Die erste Antwort',
  'classic-first-reply.intro':
    'Klassisch endet bei gutem Spiel auf beiden Seiten unentschieden – doch auf jede Eröffnung hält nur eine Antwort das Unentschieden. Das Zeichen des Eröffnenden entscheidet, wo du antworten musst: Eine Ecke verlangt die Mitte, die Mitte verlangt eine Ecke.',
  'classic-first-reply.1.prompt':
    'Er hat in einer Ecke eröffnet. Finde die einzige Antwort, die hält.',
  'classic-first-reply.1.hint': 'Jedes andere Feld lässt ihm später eine Gabel gegen dich.',
  'classic-first-reply.1.success':
    'Die Mitte. Gegen eine Ecke ist sie die einzige Antwort, die zum Unentschieden führt.',
  'classic-first-reply.1.wrong':
    'Das verliert bei perfektem Spiel: Eine Eckeröffnung verlangt die Mitte.',
  'classic-first-reply.2.prompt': 'Er hat in der Mitte eröffnet. Antworte.',
  'classic-first-reply.2.hint': 'Randfelder verlieren gegen die Mitte. Ecken halten.',
  'classic-first-reply.2.success':
    'Eine Ecke. Von dort lässt sich jede Gabel abwehren, die er versucht.',
  'classic-first-reply.2.wrong':
    'Ein Randfeld gegen die Mitte verliert zwangsläufig. Nimm eine Ecke.',
  'classic-first-reply.3.prompt':
    'Er hat auf einem Randfeld eröffnet. Mehrere Antworten halten – finde eine.',
  'classic-first-reply.3.hint':
    'Die Mitte, das gegenüberliegende Randfeld oder eine Ecke neben seinem Zeichen.',
  'classic-first-reply.3.success': 'Das hält. Eine Randeröffnung lässt dir die meiste Wahl.',
  'classic-first-reply.3.wrong': 'Das verliert: Es lässt ihm zwei Züge später eine Gabel.',

  // Grid 6
  'grid-6-open-three.title': 'Offene und geschlossene Drei',
  'grid-6-open-three.intro':
    'In Raster 6 brauchst du vier in einer Reihe. Eine Drei mit zwei freien Enden ist offen: Sie kann an beiden Enden zum Vierer werden, ist also schon zwei Drohungen. Eine Drei mit einem blockierten Ende ist geschlossen – eine Drohung, leicht zu stoppen.',
  'grid-6-open-three.1.prompt': 'Mach aus deinen zwei eine offene Drei.',
  'grid-6-open-three.1.hint': 'Verlängere deine Reihe direkt daneben und halte beide Enden frei.',
  'grid-6-open-three.1.success':
    'Eine offene Drei: An beiden Enden wartet ein Vierer, und er kann nur eins abdecken.',
  'grid-6-open-three.1.wrong': 'Lässt du eine Lücke, hat die Drei nur einen Weg zum Vierer.',
  'grid-6-open-three.2.prompt': 'Seine Drei ist an einem Ende geschlossen. Stopp sie.',
  'grid-6-open-three.2.hint': 'Dein Zeichen schließt schon ein Ende. Schließ das andere.',
  'grid-6-open-three.2.success':
    'Eine geschlossene Drei kann nur auf eine Art wachsen – und die hast du gerade genommen.',
  'grid-6-open-three.2.wrong': 'Seine Reihe hat noch ein Feld, das vier ergibt.',
  'grid-6-open-three.3.prompt':
    'Er hat eine offene Zwei. Schließ sie an einem Ende ab, bevor eine offene Drei daraus wird.',
  'grid-6-open-three.3.hint': 'Setz direkt an ein Ende seines Paars.',
  'grid-6-open-three.3.success':
    'Abgeschlossen. Was er jetzt auch anlegt – die Drei ist geschlossen.',
  'grid-6-open-three.3.wrong':
    'Von hier kann er noch eine offene Drei bauen – und das sind zwei Drohungen.',
  'grid-6-crossing-lines.title': 'Wo sich Linien kreuzen',
  'grid-6-crossing-lines.intro':
    'Zwei halb gebaute Linien, die durch dasselbe leere Feld laufen, sind eine Gabel im Wartestand. Besetze den Kreuzungspunkt, und beide Linien werden auf einmal zu Drohungen. Lerne, sie auf deiner Seite des Bretts zu sehen – und auf seiner.',
  'grid-6-crossing-lines.1.prompt':
    'Deine Zeile und deine Spalte treffen sich auf einem Feld. Finde es.',
  'grid-6-crossing-lines.1.hint':
    'Folge deiner Zeile nach rechts und deiner Spalte nach unten, bis sie sich treffen.',
  'grid-6-crossing-lines.1.success':
    'Beide Linien sind jetzt Dreierreihen mit Platz für ein viertes Zeichen. Zwei Drohungen, nur ein Block.',
  'grid-6-crossing-lines.1.wrong':
    'Das hilft nur einer Linie. Das Feld, das beiden dient, ist die Gabel.',
  'grid-6-crossing-lines.2.prompt':
    'Diesmal eine Diagonale und eine Spalte. Schaffe zwei Drohungen.',
  'grid-6-crossing-lines.2.hint': 'Die Lücke in deiner Diagonale liegt direkt über deiner Spalte.',
  'grid-6-crossing-lines.2.success':
    'Diagonale und Spalte drohen beide mit vier. Er kann nicht beide abdecken.',
  'grid-6-crossing-lines.2.wrong':
    'Eine Drohung ist leicht zu blockieren. Finde das Feld, das zwei schafft.',

  // Grid 9
  'grid-9-both-ends.title': 'Beide Enden im Blick',
  'grid-9-both-ends.intro':
    'Fünf in einer Reihe auf einem 9×9-Brett heißt: lange Linien mit Platz an beiden Enden – und Lücken. Ein Vierer mit einem Loch ist immer noch ein Vierer. Eine offene Drei, die du ignorierst, wird zum offenen Vierer, und den stoppt nichts mehr.',
  'grid-9-both-ends.1.prompt': 'Er hat vier in einer Reihe. Blockiere sie.',
  'grid-9-both-ends.1.hint': 'Ein Ende gehört schon dir.',
  'grid-9-both-ends.1.success': 'Blockiert. Ein Vierer verlangt sofort eine Antwort – immer.',
  'grid-9-both-ends.1.wrong':
    'Er macht im nächsten Zug fünf. Sein offenes Ende ist das einzige Feld, das zählt.',
  'grid-9-both-ends.2.prompt': 'Dieser Vierer hat eine Lücke. Finde das Feld, das zählt.',
  'grid-9-both-ends.2.hint': 'Füll das Loch.',
  'grid-9-both-ends.2.success':
    'Ein unterbrochener Vierer ist immer noch ein Vierer. Lücken zählen.',
  'grid-9-both-ends.2.wrong': 'Er macht im nächsten Zug fünf – durch die Lücke.',
  'grid-9-both-ends.3.prompt':
    'Eine offene Drei. Blockiere sie, bevor sie zum offenen Vierer wird.',
  'grid-9-both-ends.3.hint': 'Blockiere direkt an der Drei, nicht ein Feld weiter draußen.',
  'grid-9-both-ends.3.success': 'Macht er jetzt einen Vierer, hat der nur noch ein offenes Ende.',
  'grid-9-both-ends.3.wrong':
    'Zu weit weg: Er kann noch einen Vierer bauen, der an beiden Enden offen ist.',

  // Gomoku
  'gomoku-13-open-threes.title': 'Die offene Drei',
  'gomoku-13-open-threes.intro':
    'Im Gomoku ist die offene Drei – drei in einer Reihe mit Platz an beiden Enden – die Drohung, die zählt. Ignorierst du sie, wird daraus ein offener Vierer, und der gewinnt. Eine geschlossene Drei kann warten: Aus ihr wird nur ein Vierer, den du blockieren kannst.',
  'gomoku-13-open-threes.1.prompt': 'Du hast eine offene Drei. Mach daraus einen offenen Vierer.',
  'gomoku-13-open-threes.1.hint': 'Setz an eines der beiden Enden, direkt neben die Drei.',
  'gomoku-13-open-threes.1.success': 'Ein offener Vierer: An beiden Enden wartet die Fünf.',
  'gomoku-13-open-threes.1.wrong': 'Dieser Vierer hat nur ein offenes Ende – er blockiert ihn.',
  'gomoku-13-open-threes.2.prompt': 'Er hat zwei Dreierreihen. Blockiere die, die zählt.',
  'gomoku-13-open-threes.2.hint':
    'Dein Zeichen schließt die Spalte schon ab. Die Zeile ist an beiden Enden offen.',
  'gomoku-13-open-threes.2.success':
    'Richtig. Aus der geschlossenen Drei wird nur ein Vierer, den du rechtzeitig blockierst.',
  'gomoku-13-open-threes.2.wrong':
    'Damit kann seine offene Drei ungehindert zum offenen Vierer werden.',
  'gomoku-15-four-three.title': 'Die Vier-Drei',
  'gomoku-15-four-three.intro':
    'Ein Vierer muss sofort beantwortet werden. Eine Vier-Drei ist ein Zug, der gleichzeitig einen Vierer und eine offene Drei schafft: Dein Gegner muss den Vierer blockieren, und währenddessen wird die Drei zum offenen Vierer. Das ist die klassische Gewinnform des Gomoku.',
  'gomoku-15-four-three.1.prompt': 'Schaffe mit einem Zug einen Vierer und eine offene Drei.',
  'gomoku-15-four-three.1.hint': 'Deine Zeile und deine Spalte treffen sich auf einem Feld.',
  'gomoku-15-four-three.1.success':
    'Vier waagerecht, eine offene Drei senkrecht. Er muss den Vierer blockieren – dann gewinnt die Drei.',
  'gomoku-15-four-three.1.wrong':
    'Das gibt ihm Zeit. Finde den Zug, der Vierer und Drei zugleich schafft.',
  'gomoku-15-four-three.2.prompt': 'Noch eine Vier-Drei, diesmal auf der Diagonale.',
  'gomoku-15-four-three.2.hint':
    'Verlängere die Diagonale so, dass sie auch in der Zeile darunter eine Drei vollendet.',
  'gomoku-15-four-three.2.success':
    'Ein Vierer auf der Diagonale, eine offene Drei in der Zeile. Der Block kommt zu spät.',
  'gomoku-15-four-three.2.wrong':
    'Nicht dieses – schau, wo sich die Diagonale und deine Zeile ein Feld teilen.',
  'gomoku-15-double-four.title': 'Vierer zuerst',
  'gomoku-15-double-four.intro':
    'Zwei Vierer auf einmal lassen sich nicht beide blockieren. Und hat dein Gegner einen Vierer, zählt nichts, was du gerade aufbaust, bis er gestoppt ist – nicht einmal eine eigene offene Drei.',
  'gomoku-15-double-four.1.prompt': 'Schaffe mit einem Zug zwei Vierer.',
  'gomoku-15-double-four.1.hint': 'Die Lücke in deiner Zeile ist zugleich das Ende deiner Spalte.',
  'gomoku-15-double-four.1.success':
    'Ein Doppelvierer. Ein Block kann nicht zwei Fünferreihen stoppen.',
  'gomoku-15-double-four.1.wrong':
    'Das ergibt höchstens einen Vierer. Finde das Feld, das beide Linien teilen.',
  'gomoku-15-double-four.2.prompt': 'Du hast eine offene Drei, aber er hat einen Vierer.',
  'gomoku-15-double-four.2.hint': 'Deine Drei kann einen Zug warten. Sein Vierer nicht.',
  'gomoku-15-double-four.2.success':
    'Blockiert. Jetzt ist deine offene Drei die Drohung auf dem Brett.',
  'gomoku-15-double-four.2.wrong': 'Er macht fünf, bevor deine Drei überhaupt eine Chance bekommt.',

  // Misère
  'misere-dont-finish.title': 'Vollende die Reihe nicht',
  'misere-dont-finish.intro':
    'Bei Misère verliert, wer drei in einer Reihe hat. Spät in der Partie gehen die Felder aus, und die Frage lautet: Welches Feld kannst du besetzen, ohne eine eigene Reihe zu vollenden? Zähl sie, bevor du ziehst.',
  'misere-dont-finish.1.prompt':
    'Zwei der leeren Felder vollenden eine Reihe von dir. Finde das, das es nicht tut.',
  'misere-dont-finish.1.hint': 'Prüf deine obere Zeile und deine linke Spalte, bevor du ziehst.',
  'misere-dont-finish.1.success':
    'Sicher – und jetzt vollendet jedes verbleibende Feld eine Reihe von ihm.',
  'misere-dont-finish.1.wrong': 'Damit vollendest du eine eigene Drei. Bei Misère verliert das.',
  'misere-dont-finish.2.prompt': 'Gleiche Idee, anderes Brett. Welches Feld ist sicher?',
  'misere-dont-finish.2.hint':
    'Deiner oberen Zeile und deiner rechten Spalte fehlt jeweils nur ein Feld.',
  'misere-dont-finish.2.success': 'Das einzige sichere Feld – und ihm bleibt keins.',
  'misere-dont-finish.2.wrong': 'Dieses Feld vollendet deine eigene Reihe.',
  'misere-centre-mirror.title': 'Mitte und Spiegel',
  'misere-centre-mirror.intro':
    'Bei Misère kann der erste Spieler nie verlieren. Nimm die Mitte und beantworte dann jeden Zug mit seinem Spiegelbild durch die Mitte. Deine Zeichen liegen nie miteinander in einer Reihe, also kannst du nie derjenige sein, der drei macht.',
  'misere-centre-mirror.1.prompt': 'Du ziehst zuerst. Wohin?',
  'misere-centre-mirror.1.hint': 'Das eine Feld, durch das jedes andere Feld ein Spiegelbild hat.',
  'misere-centre-mirror.1.success':
    'Die Mitte. Jede andere Eröffnung verliert bei perfektem Spiel.',
  'misere-centre-mirror.1.wrong': 'Das verliert bei perfektem Spiel. Fang in der Mitte an.',
  'misere-centre-mirror.2.prompt': 'Er hat eine Ecke genommen. Spiegle sie.',
  'misere-centre-mirror.2.hint': 'Geradewegs durch die Mitte auf die andere Seite.',
  'misere-centre-mirror.2.success':
    'Die gegenüberliegende Ecke. Spiegle weiter, und du kannst nicht verlieren.',
  'misere-centre-mirror.2.wrong': 'Nur das Spiegelfeld hält. Geh geradewegs durch die Mitte.',
  'misere-centre-mirror.3.prompt': 'Diesmal hat er ein Randfeld genommen. Spiegle es wieder.',
  'misere-centre-mirror.3.hint': 'Das Randfeld direkt gegenüber von seinem.',
  'misere-centre-mirror.3.success':
    'Gespiegelt. Deine Zeichen und die Mitte kommen sich in keiner Reihe in die Quere.',
  'misere-centre-mirror.3.wrong':
    'Das verliert bei perfektem Spiel. Antworte mit dem gegenüberliegenden Randfeld.',

  // Vanish
  'vanish-fading-marks.title': 'Das verblassende Zeichen',
  'vanish-fading-marks.intro':
    'Im Modus Verblassen behältst du nur drei Zeichen. Dein ältestes wird verblassend gezeigt: Es verlässt das Brett, sobald du dein nächstes setzt, und kann daher nie Teil der Reihe sein, die dieser Zug bildet. Reihen durch ein verblassendes Zeichen sehen nur wie Drohungen aus.',
  'vanish-fading-marks.1.prompt': 'Drei Reihen scheinen nur ein Feld zu kurz. Nur eine ist echt.',
  'vanish-fading-marks.1.hint': 'Ignoriere jede Reihe, die durch deine verblassende Ecke läuft.',
  'vanish-fading-marks.1.success':
    'Die einzige Reihe ohne dein verblassendes Zeichen. Drei in einer Reihe.',
  'vanish-fading-marks.1.wrong':
    'Dein verblassendes Zeichen verschwindet, sobald du ziehst – diese Reihe wird nie vollständig.',
  'vanish-fading-marks.2.prompt': 'Er scheint zwei Drohungen zu haben. Blockiere die echte.',
  'vanish-fading-marks.2.hint':
    'Eine seiner Reihen läuft durch sein eigenes verblassendes Zeichen.',
  'vanish-fading-marks.2.success':
    'Blockiert. Seine andere Reihe brauchte ein Zeichen, das gleich verschwindet.',
  'vanish-fading-marks.2.wrong':
    'Damit bleibt seine echte Reihe offen. Die andere war nie eine Drohung.',
  'vanish-tempo.title': 'Lass sein Zeichen gehen',
  'vanish-tempo.intro':
    'Auch sein verblassendes Zeichen verschwindet gleich, und das Feld, das es freigibt, kannst du nutzen. Stell zwei deiner Zeichen dahinter in eine Linie: Wenn es bei seinem Zug verschwindet, öffnet sich deine Reihe, und er kann sie nicht mehr rechtzeitig schließen.',
  'vanish-tempo.1.prompt': 'Sein verblassendes Zeichen blockiert eine Reihe. Stell dich dahinter.',
  'vanish-tempo.1.hint':
    'Sein ältestes Zeichen steht oben in einer Spalte. Mach diese Spalte zu deiner.',
  'vanish-tempo.1.success':
    'Sobald er zieht, verschwindet sein Zeichen, und du kannst die Spalte vollenden.',
  'vanish-tempo.1.wrong':
    'Damit lässt du ihn davonkommen. Reih deine Zeichen hinter dem auf, das gleich verschwindet.',
  'vanish-tempo.2.prompt': 'Derselbe Trick, auf der anderen Seite des Bretts.',
  'vanish-tempo.2.hint': 'Welches seiner Zeichen verschwindet als Nächstes, und was gibt es frei?',
  'vanish-tempo.2.success':
    'Sein verblassendes Zeichen ist das Einzige, was dir im Weg steht – und es geht gerade.',
  'vanish-tempo.2.wrong': 'Das gibt ihm Zeit, eine eigene Reihe aufzubauen.',

  // Gravity
  'gravity-floors-and-stacks.title': 'Boden und Stapel',
  'gravity-floors-and-stacks.intro':
    'Bei Schwerkraft wählst du eine Spalte, und dein Zeichen fällt ganz nach unten. Ein Feld ist erst spielbar, wenn das darunter belegt ist. Reihen am Boden und Stapel in einer Spalte sind die ersten Drohungen, nach denen du suchen solltest.',
  'gravity-floors-and-stacks.1.prompt': 'Drei am Boden. Vollende sie.',
  'gravity-floors-and-stacks.1.hint':
    'Beide Enden deiner Reihe liegen am Boden, also ist jedes spielbar.',
  'gravity-floors-and-stacks.1.success': 'Vier am Boden.',
  'gravity-floors-and-stacks.1.wrong': 'Dieses Feld vollendet deine Reihe nicht.',
  'gravity-floors-and-stacks.2.prompt': 'Er hat drei gestapelt. Schließ die Spalte ab.',
  'gravity-floors-and-stacks.2.hint': 'Wirf in seine Spalte.',
  'gravity-floors-and-stacks.2.success': 'Abgeschlossen. Ein Stapel kann nur nach oben wachsen.',
  'gravity-floors-and-stacks.2.wrong': 'Im nächsten Zug wirft er ein viertes obendrauf.',
  'gravity-dont-fill-under.title': 'Füll nicht darunter',
  'gravity-dont-fill-under.intro':
    'Eine Drohung kann über einem leeren Feld schweben. Niemand kann sie spielen, bis etwas darunter landet – wer dieses Feld füllt, schenkt die Drohung also dem anderen. Oft ist der beste Zug, diese Spalte einfach zu meiden.',
  'gravity-dont-fill-under.1.prompt':
    'Seine Reihe braucht ein Feld, das noch nicht spielbar ist. Sorg dafür, dass es so bleibt.',
  'gravity-dont-fill-under.1.hint': 'Jede Spalte außer der unter seiner Drohung.',
  'gravity-dont-fill-under.1.success':
    'Seine Drohung bleibt außer Reichweite, bis jemand das Feld darunter füllt.',
  'gravity-dont-fill-under.1.wrong':
    'Das füllt das Feld darunter, und er wirft direkt darauf seinen Vierer.',
  'gravity-dont-fill-under.2.prompt':
    'Jetzt gehört die Drohung über dem leeren Feld dir. Halte sie.',
  'gravity-dont-fill-under.2.hint': 'Spiel nicht in die Spalte unter deiner eigenen Drohung.',
  'gravity-dont-fill-under.2.success':
    'Deine Drohung wartet. Jeder Zug, den er in dieser Spalte macht, schenkt dir den Sieg.',
  'gravity-dont-fill-under.2.wrong':
    'Du hast dein eigenes Feld gefüllt: Er wirft obendrauf, und deine Drohung ist weg.',
  'gravity-stacked-threats.title': 'Gestapelte Drohungen',
  'gravity-stacked-threats.intro':
    'Zwei Drohungen in derselben Spalte, eine direkt über der anderen, lassen sich nicht beide stoppen: Wer die untere blockiert, macht die obere spielbar. Am Boden funktioniert eine offene Drei genauso wie auf einem flachen Brett.',
  'gravity-stacked-threats.1.prompt': 'Schaffe zwei Drohungen, eine über der anderen.',
  'gravity-stacked-threats.1.hint':
    'Ein Zug kann deine Zeile verlängern und auf deiner Diagonale eine Drei vollenden.',
  'gravity-stacked-threats.1.success':
    'Er muss das untere Feld blockieren – und das hebt deine zweite Drohung in Reichweite.',
  'gravity-stacked-threats.1.wrong':
    'Das schafft nur eine Drohung, die er einfach blockieren kann.',
  'gravity-stacked-threats.2.prompt': 'Bau eine offene Drei am Boden.',
  'gravity-stacked-threats.2.hint': 'Verlängere dein Paar am Boden und halte beide Enden frei.',
  'gravity-stacked-threats.2.success': 'Zwei spielbare Enden, ein Block. Der Boden gehört dir.',
  'gravity-stacked-threats.2.wrong': 'Das lässt ihm ein Feld zum Blockieren und sonst nichts.',

  // Ultimate
  'ultimate-small-boards.title': 'Kleine Bretter gewinnen',
  'ultimate-small-boards.intro':
    'In Ultimate gewinnst du kleine Bretter, um das große zu gewinnen. Das Feld, das du in einem kleinen Brett wählst, bestimmt, auf welchem Brett dein Gegner als Nächstes spielen muss – und schickt er dich auf ein Brett, auf dem du schon zwei in einer Reihe hast, nimm es dir.',
  'ultimate-small-boards.1.prompt':
    'Du wurdest auf ein Brett geschickt, auf dem du zwei in einer Reihe hast. Nimm es dir.',
  'ultimate-small-boards.1.hint': 'Vollende die untere Zeile des Bretts oben links.',
  'ultimate-small-boards.1.success': 'Das Brett oben links gehört dir.',
  'ultimate-small-boards.1.wrong': 'Das vollendet deine Reihe auf diesem Brett nicht.',
  'ultimate-small-boards.2.prompt': 'Auf das mittlere Brett geschickt. Nimm auch das.',
  'ultimate-small-boards.2.hint': 'Dieselbe Form wie vorhin: die untere Zeile.',
  'ultimate-small-boards.2.success': 'Zwei Bretter auf der Diagonale.',
  'ultimate-small-boards.2.wrong': 'Das vollendet deine Reihe auf dem mittleren Brett nicht.',
  'ultimate-small-boards.3.prompt': 'Noch ein Brett auf der Diagonale gewinnt das Spiel.',
  'ultimate-small-boards.3.hint': 'Deiner linken Spalte auf diesem Brett fehlt ein Feld.',
  'ultimate-small-boards.3.success': 'Drei Bretter in einer Reihe – das Spiel gehört dir.',
  'ultimate-small-boards.3.wrong':
    'Damit nimmst du dieses Brett nicht – und dieses Brett ist das Spiel.',
  'ultimate-where-you-send.title': 'Wohin du ihn schickst',
  'ultimate-where-you-send.intro':
    'Jedes Feld, das du spielst, schickt deinen Gegner auf das passende kleine Brett. Schick ihn nie auf ein Brett, das er gewinnen kann. Und schick ihn nie auf ein entschiedenes Brett: Das gibt ihm einen freien Zug überallhin – auch auf das Brett, von dem du ihn sorgsam ferngehalten hast.',
  'ultimate-where-you-send.1.prompt':
    'Zwei Felder hier schicken ihn auf ein Brett, das er nehmen kann. Meide beide.',
  'ultimate-where-you-send.1.hint':
    'Finde die Bretter, auf denen er schon zwei in einer Reihe hat, und halte dich von den Feldern fern, die dorthin zeigen.',
  'ultimate-where-you-send.1.success':
    'Er landet auf einem Brett, auf dem er nichts zu vollenden hat.',
  'ultimate-where-you-send.1.wrong':
    'Das schickt ihn auf ein Brett, auf dem er zwei in einer Reihe hat. Er nimmt es sich.',
  'ultimate-where-you-send.2.prompt':
    'Das Brett unten rechts ist entschieden. Denk an den freien Zug.',
  'ultimate-where-you-send.2.hint':
    'Meide Bretter, auf denen er zwei in einer Reihe hat – und das Feld, das auf das entschiedene Brett zeigt.',
  'ultimate-where-you-send.2.success':
    'Kein Brett, das er nehmen kann, und kein freier Zug, um eins zu suchen.',
  'ultimate-where-you-send.2.wrong':
    'Von dort kann er ein kleines Brett gewinnen – direkt oder mit einem freien Zug.',
};
