import type { DialogueTable } from '@/features/journey/dialogue';

/**
 * What the journey rivals say, in German. Line for line with
 * `journeyDialogueEn` in `journeyDialogue.ts`: the same pools, each the same
 * length, in the same order.
 */
export const journeyDialogueDe: DialogueTable = {
  pip: {
    greeting: {
      any: [
        'Quak! Neues Brett, neue Regeln. Ich liebe neue Regeln!',
        'Ich hab die Regeln zweimal gelesen. Na ja, einmal. So halb.',
      ],
      classic: [
        'Drei in einer Reihe! Ich kann bis drei zählen. Pass auf!',
        'Neun Felder, wie neun Seerosenblätter. Hopp, hopp!',
      ],
      grid: ['Vier in einer Reihe auf einem großen Teich? So viele Blätter!'],
      misere: ['Moment, drei in einer Reihe ist hier SCHLECHT? Quak… notiert.'],
      vanish: ['Meine Zeichen verschwinden? Wie Seifenblasen! Plopp!'],
      gravity: ['Hier fällt alles runter. Manchmal sogar Frösche.'],
      ultimate: ['Bretter in Brettern? Mir dreht sich der Kopf. Quak!'],
      gomoku: ['Fünf in einer Reihe auf einem Riesenteich! Ich verlauf mich bestimmt.'],
    },
    rematch: [
      'Nochmal? Juhu! Ich hab geübt. So ungefähr eine Minute.',
      'Revanche! Diesmal merk ich mir, welches Zeichen meins ist.',
      'Auf ein Neues! Ich verspreche, weniger zu blinzeln.',
    ],
    bossIntro: [
      'Ich hab dich beobachtet. Jetzt mach ich dir alles nach. Ha!',
      'Heute bin ich ein ganz großer Frosch. Quak!',
      'Was du machst, mach ich auch. Das ist der Plan. Der ganze Plan.',
    ],
    firstThreat: [
      'Oh, ist das eine Reihe?',
      'Zwei in einer Reihe! War ich das?',
      'Guck mal, guck! Eine Reihe! Fast!',
    ],
    threat: ['Quak? Quak!', 'War das etwa Absicht?', 'Noch eine! Glaub ich.'],
    fork: ['Zwei Reihen?! Quak quak quak!', 'Moment, kannst du beide blocken? Kannst du?'],
    blocked: [
      'Bupp. Geblockt! Das hab ich gesehen.',
      'Nicht auf meinem Seerosenblatt!',
      'Ha! Platsch – geblockt.',
      'Ich bin dazwischengehüpft. Mit Absicht. Meistens.',
    ],
    signature: [
      'Nachmacher! Alles, was du tust, tu ich auch.',
      'Quak – ich nehm das Feld gegenüber von deinem.',
      'Spieglein, Spieglein auf dem Teich!',
    ],
    worry: [
      'Oh-oh.',
      'Moment, Moment, Moment—',
      'Ist das erlaubt?',
      'Das sieht nach einer Reihe aus. Huch.',
    ],
    playerFork: [
      'Zwei Reihen?! Das ist unfair. Ist das fair?',
      'Ich hab nur einen Hüpfer!',
      'Welche blockier ich? Beide? Hilfe!',
    ],
    comeback: ['Ich bin zurück! Glaub ich! Quak!', 'Puh. Noch bin ich dabei!'],
    nearLoss: ['Ich seh’s kommen. Schluck.', 'Ist das… das Ende vom Teich?', 'Quak… oh nein.'],
    win: [
      'Moment… ich hab gewonnen? Anfängerglück!',
      'GEWONNEN! Das muss ich jedem Frosch erzählen, den ich kenne.',
      'Quak! Das war eine richtige Reihe und alles!',
    ],
    loss: [
      'Hüpf weiter – du bist ein Naturtalent.',
      'Quak. Du bist echt gut darin.',
      'Bringst du mir den Trick mal bei?',
    ],
    draw: [
      'Keiner hat gewonnen? Dann haben wir beide gewonnen! Oder?',
      'Unentschieden! Wie ein Seerosenblatt mit zwei Fröschen drauf.',
      'Teich voll, keine Reihe. Quak.',
    ],
  },

  mo: {
    greeting: {
      any: [
        'Ich blockiere immer. Nur was danach kommt, seh ich nicht.',
        'Na gut. Ein Spiel. Dann Nickerchen.',
      ],
      classic: [
        'Neun Felder. Ich setz mich auf das, das du willst.',
        'Klassisch. Wie ein Sonnenstrahl auf der Fensterbank.',
      ],
      grid: ['Größeres Brett heißt nur: mehr Stellen, dich zu blockieren.'],
      misere: [
        'Bloß keine drei in einer Reihe. Ich mach eh nie was. Einfach.',
        'Misère. Mein Liebling. Nichtstun ist eine Kunst.',
      ],
      vanish: ['Deine Zeichen verschwinden auch. Dann muss ich sie nicht mal blockieren.'],
      gravity: [
        'Alles fällt. Ich lande immer auf den Pfoten.',
        'Spalten stapeln. Wie Tassen vom Tisch schubsen, nur rückwärts.',
      ],
      ultimate: ['Neun Bretter, um dich zu blockieren. Schnurr.'],
      gomoku: ['Fünf in einer Reihe auf so einem großen Brett? Ich bin überall.'],
    },
    rematch: [
      'Nochmal? Mein Nickerchen war noch nicht fertig.',
      'Noch mehr Blockieren gefällig? Na gut.',
      'Revanche. Ich blockiere dasselbe, nur schneller.',
    ],
    bossIntro: [
      'Das ist mein Dach. Auf meinem Dach macht keiner eine Reihe.',
      'Neun Leben. Mindestens eins musst du mir nehmen.',
      'Ich hab alles blockiert, was du versucht hast. Streng dich an.',
    ],
    firstThreat: ['Dein Zug. Wähl weise.', 'Oh, eine Reihe? Aus Versehen.'],
    threat: ['Pfoten weg von dem Feld.', 'Mrrau.', 'Das gehört mir. Außer du blockierst es.'],
    fork: [
      'Zwei? Hm. Ich greife sonst nicht an. Gewöhn dich nicht dran.',
      'Sieh an. Sogar ich krieg zwei hin.',
    ],
    blocked: [
      'Blockiert. Natürlich.',
      'Erwischt.',
      'Ich hab mich draufgesetzt. Jetzt ist es mein Feld.',
      'Da wolltest du hin? Da war ich schon.',
    ],
    signature: [
      'Zack. Deine kleine Reihe ist weg.',
      'Ich ersticke Reihen, bevor sie schnurren.',
      'Das wäre eine Drohung geworden. Wäre.',
    ],
    worry: ['Hab ich gesehen. Wahrscheinlich.', 'Fauch.', 'Hmpf. Blockiere gleich.'],
    playerFork: [
      'Zwei Drohungen auf einmal sind Schummeln. (Sind sie nicht.)',
      'Ich kann nur auf einem Feld sitzen. Frech.',
      'Fauch! Wo kommt die zweite her?',
    ],
    comeback: [
      'Siehst du? Alles blockiert. Jetzt bin ich dran.',
      'Schnurr. Alles wieder im Griff.',
    ],
    nearLoss: ['Mir gefällt nicht, wohin das führt.', 'Mein Schwanz zuckt. Schlechtes Zeichen.'],
    win: [
      'Schnurrfekt. Nochmal?',
      'Du bist mir ins Nickerchen gelaufen. Lass das.',
      'Meins. Wie immer.',
    ],
    loss: [
      'Hmpf. Zwei Drohungen auf einmal ist Schummeln. (Ist es nicht.)',
      'Na gut. Du hast das Feld gefunden, auf dem ich nicht saß.',
      'Ich bin auf der Fensterbank. Schmollen.',
    ],
    draw: [
      'Keiner kommt durch. Genau wie ich’s mag.',
      'Unentschieden. Ich hab alles blockiert. Wie versprochen.',
      'Patt. Schnurr.',
    ],
  },

  sage: {
    greeting: {
      any: [
        'Ich sehe drei Züge voraus. Leg deine Fallen weiter draußen aus.',
        'Neue Regeln sind alte Muster in neuem Gefieder.',
      ],
      classic: ['Selbst neun Felder bergen Lektionen für ein ganzes Leben.'],
      grid: [
        'Die Mitte eines Bretts ist mehr wert als seine Ränder. Merk dir das.',
        'Vier in einer Reihe. Baue Formen, keine Linien.',
      ],
      misere: ['In Misère gewinnt der Geduldige, indem er weniger tut.'],
      vanish: [
        'Eine Reihe durch ein verblassendes Zeichen ist keine Reihe.',
        'Achte darauf, welches deiner Zeichen geht. Ich tue es immer.',
      ],
      gravity: ['Jede Spalte ist ein Versprechen. Zähl, wer seines hält.'],
      ultimate: [
        'Jedes Feld, das du wählst, schickt mich irgendwohin. Wähle weise.',
        'Neun Bretter. Zuerst das mittlere, wie immer.',
      ],
      gomoku: ['Auf einem weiten Brett ist Geduld eine Waffe.'],
    },
    rematch: [
      'Noch einmal. Gut. Übung macht den Meister.',
      'Zeig mir, was du gelernt hast. Huhu.',
      'In der zweiten Partie zeigt sich die Lektion.',
    ],
    bossIntro: [
      'Du bist weit gekommen. Nun zeig mir, dass du weiter sehen kannst.',
      'Die Eiche steht seit hundert Jahren. Mal sehen, ob du sie bewegst.',
      'Ich halte die Mitte. Du wirst um mich herum müssen.',
    ],
    firstThreat: ['Bedenke die Folgen.', 'Eine kleine Frage, die du beantworten musst.'],
    threat: [
      'Drei Züge voraus, vergiss das nicht.',
      'Huhu, huhu.',
      'Beantworte diese mit Bedacht.',
    ],
    fork: [
      'Zwei Wege, und du kannst nur einen gehen.',
      'Geduld hat aus einem Zug zwei Drohungen gemacht.',
    ],
    blocked: [
      'Eine gute Idee. Nicht gut genug.',
      'Das sah ich schon vor drei Zügen kommen.',
      'Huhu. Geschlossen.',
      'Die offensichtliche Drohung ist am leichtesten zu stoppen.',
    ],
    signature: [
      'Die Mitte hält.',
      'Ich nehme die Mitte. Alles Weitere folgt.',
      'Von der Mitte aus kann ich jede Linie wählen.',
    ],
    worry: ['Interessant…', 'Ein durchdachter Zug.', 'Darüber muss ich nachdenken.'],
    playerFork: ['Ah. Zwei auf einmal. Gut gebaut.', 'Du hast vier Züge vorausgesehen. Ich drei.'],
    comeback: ['Das Blatt wendet sich. Wie immer.', 'Geduld hat sich ausgezahlt. Huhu.'],
    nearLoss: [
      'Ich sehe das Ende. Es ist nicht meins.',
      'Eine feine Kombination. Die sah ich nicht kommen.',
    ],
    win: [
      'Geduld gewinnt Partien. Huhu.',
      'Du hast das Brett gespielt. Ich dich.',
      'Sieh dir noch mal Zug vier an. Da fiel die Entscheidung.',
    ],
    loss: [
      'Eine feine Kombination. Die habe ich nicht kommen sehen.',
      'Der Schüler überrascht den Lehrer. Gut.',
      'Vier Züge voraus. Ich muss weiter blicken.',
    ],
    draw: [
      'Gleichgewicht. Keiner von uns hat geirrt.',
      'Ein Unentschieden ist eine Lektion für beide.',
      'Ausgeglichen. Huhu. Nennen wir es Weisheit.',
    ],
  },

  bruno: {
    greeting: {
      any: [
        'Große Bretter, große Pläne. Lass keine offene Vier rumliegen.',
        'Neues Spiel, alter Plan: größer bauen als du.',
      ],
      classic: ['Kleines Brett. Platz zum Bauen find ich trotzdem.'],
      grid: ['Viel Platz. Ich mag Platz. Platz für Reihen.'],
      misere: ['Nicht bauen? Was anderes kann ich doch gar nicht.'],
      vanish: ['Meine Zeichen fallen weg? Dann bau ich eben schneller.'],
      gravity: [
        'Stapeln! Spalten sind nur Türme, die noch werden wollen.',
        'Die Schwerkraft ist auf meiner Seite. Ich bin schwer.',
      ],
      ultimate: ['Neun Bretter, neun Baustellen.'],
      gomoku: [
        'DAS ist ein Brett. Platz für die längste Reihe der Welt.',
        'Fünfzehn mal fünfzehn. Grrr. Ich rieche schon die Vierer.',
      ],
    },
    rematch: [
      'Noch nicht genug? Ich hab noch mehr.',
      'Runde zwei. Mit Hunger bau ich schneller.',
      'Nochmal! Diesmal längere Reihen.',
    ],
    bossIntro: [
      'Du hast es in meinen Wald geschafft. Keiner geht ohne Bärenumarmung.',
      'Meinen größten Bau hab ich für dich aufgehoben.',
      'Jeder Baum in diesem Wald ist eine Reihe, die ich vollendet hab.',
    ],
    firstThreat: ['Lücke gefunden. Gehört jetzt mir.', 'Da ist die erste. Es kommen mehr.'],
    threat: ['Schicht auf Schicht.', 'Grrr.', 'Blockier das. Und das nächste.', 'Noch ein Ziegel.'],
    fork: [
      'Zwei Reihen, ein Zug für dich. Grrrandios.',
      'Bärensturm! Such dir aus, was du blockierst.',
      'Zwei auf einmal gebaut. Bären können das.',
    ],
    blocked: [
      'Geblockt. Glaub ich.',
      'Prankenhieb.',
      'Das nicht. Den Platz brauch ich.',
      'Durch einen Bären baust du nicht hindurch.',
    ],
    signature: ['Länger! Immer länger!', 'Bärensturm. Halt mit.', 'Ich hör nie auf zu bauen. Nie.'],
    worry: ['Uff. Großer Zug.', 'Du baust da was.', 'Hmm. Das ist eine echte Reihe.'],
    playerFork: [
      'Zwei?! Du baust ja mehr als ein Bär.',
      'Grr. Beide blockieren geht nicht. Oder?',
      'Jetzt spielst du mein Spiel.',
    ],
    comeback: ['Wieder oben. Wo Bären hingehören.', 'Abgeschüttelt. Es wird weitergebaut.'],
    nearLoss: ['Uff. Ich seh’s. Das ist eine große Reihe.', 'Das wird wehtun.'],
    win: [
      'Grrroßartiges Spiel. Für mich.',
      'Die längste Reihe gewinnt. Es war meine.',
      'Bärenumarmung! Der Bärenumarmung entkommt keiner.',
    ],
    loss: [
      'Du hast mehr gebaut als ich. Respekt.',
      'Hm. Du hast alles blockiert, was ich gebaut hab.',
      'Gutes Spiel. Darauf ess ich erst mal Honig.',
    ],
    draw: [
      'Keiner fertig? Zu viele Mauern.',
      'Patt. Bären hassen das.',
      'So viel gebaut, und nichts vorzuweisen. Grr.',
    ],
  },

  vex: {
    greeting: {
      any: [
        'Jeder stille Zug von mir ist eine Falle. Jeder einzelne.',
        'Neue Regeln? Neue Fallen. Derselbe Fuchs.',
      ],
      classic: ['Neun Felder. Neun Orte, um etwas zu verstecken.'],
      grid: ['Viel Platz für etwas, das du nicht bemerkst.'],
      misere: ['Dich eine Reihe vollenden lassen? Meine liebste Art von Falle.'],
      vanish: [
        'Dein ältestes Zeichen geht gleich. Vergessen?',
        'Perfekt gespielt, gewinnt man Verblassen in dreizehn Zügen. Ich kenne die dreizehn.',
      ],
      gravity: ['Das Feld unter meiner Drohung darfst du füllen. Irgendwann.'],
      ultimate: [
        'Ich schick dich an einen hübschen Ort. Er wird dir nicht gefallen.',
        'Jedes Feld ist eine Adresse. Ich weiß, wohin sie führen.',
      ],
      gomoku: ['Großes Brett. Viele stille Ecken für einen Fuchs.'],
    },
    rematch: [
      'Zu langsam, zu nett. Nochmal?',
      'Schon zurück? Die Fallen sind neu gestellt.',
      'Nochmal? Ich hab neue Tricks. Manche sind sogar die alten.',
    ],
    bossIntro: [
      'Willkommen im Bau. Achte auf den Boden.',
      'Meine Fallen hast du überstanden. Jetzt die, die ich dir nicht gezeigt hab.',
      'Alles, was du hier siehst, ist Köder.',
    ],
    firstThreat: ['Hast du die kommen sehen?', 'Da hast du was zu tun.', 'Da. Antworte.'],
    threat: [
      'Tick, tack.',
      'Noch eine kleine Falle.',
      'Und noch eine.',
      'Viel zu tun, viel zu tun.',
    ],
    fork: [
      'Schnapp. Zwei auf einmal.',
      'Der stille Zug? Der hatte Zähne.',
      'Fuchsfalle. Such dir ein Bein aus.',
    ],
    blocked: [
      'Niedlich.',
      'Die hab ich dir gelassen. Ehrlich.',
      'Zu. Du hast es angekündigt.',
      'Blockiert. War übrigens ein Köder.',
    ],
    signature: [
      'Stiller Zug. Zähl die Linien, die hindurchgehen.',
      'Hier gibt’s nichts zu sehen. Noch nicht.',
      'Der wird in drei Zügen wichtig.',
    ],
    worry: ['Nicht schlecht. Nicht genug.', 'Ich lass es durchgehen.', 'Hm. Du passt auf.'],
    playerFork: [
      'Oh, du stellst eine Falle? Mir? Frech.',
      'Zwei Drohungen. Clever. Ärgerlich clever.',
      'Na sowas. Das ist mein Trick.',
    ],
    comeback: ['Und der Fuchs schlüpft raus.', 'Fast hättest du mich gehabt. Fast.'],
    nearLoss: ['Ah. Ich seh’s. Ich hasse es, dass ich’s seh.', 'Hm. Die Falle war deine.'],
    win: [
      'Zu langsam, zu nett. Nochmal?',
      'Schnapp. Jeder stille Zug, schon vergessen?',
      'Du bist direkt dran vorbeigelaufen. Zweimal.',
    ],
    loss: [
      'Clever. Ärgerlich clever.',
      'Du hast die Falle hinter der Falle gefunden.',
      'Na gut. Du darfst einen Blick in meinen Bau werfen.',
    ],
    draw: [
      'Unentschieden? Keine Falle ist zugeschnappt.',
      'Patt. Wie unfüchsisch.',
      'Wir haben beide alles gesehen. Langweilig.',
    ],
  },

  nyx: {
    greeting: {
      any: ['Ich habe schon gesehen, wie das endet.', 'Du kommst. Wie vorhergesehen.'],
      classic: ['Neun Felder. Jede Partie darin habe ich gesehen.'],
      grid: ['Jede Linie auf diesem Brett bin ich schon gegangen.'],
      misere: ['Du wirst das letzte Feld füllen. Das tust du immer.'],
      vanish: ['Alles verblasst. Deine Zeichen zuerst.'],
      gravity: [
        'Ich habe jedes Feld jeder Spalte gezählt. Zweimal.',
        'Hinab, immer hinab. Wie alles.',
      ],
      ultimate: ['Neun Bretter. Einundachtzig Pfade. Ein Ende.'],
      gomoku: ['Fünfzehn mal fünfzehn. Genug Raum, dich zu verirren.'],
    },
    rematch: ['Noch einmal. Das Ende ändert sich nicht.', 'Du kehrst zurück. Alle kehren zurück.'],
    bossIntro: [
      'Dies ist das letzte Brett. Ich sah dich darauf schon verlieren.',
      'Alles, was du gelernt hast, hat dich hergeführt. Es wird nicht reichen.',
      'Der Schleier ist dünn heute Nacht. Tritt hindurch.',
    ],
    firstThreat: ['Unausweichlich.', 'Der erste Faden. Zieh daran.'],
    threat: ['Du bist drei Züge zu spät.', 'Ich sehe jedes Ende.', 'Noch ein Faden.'],
    fork: ['Zwei Enden. Beide meins.', 'Beide hältst du nicht auf.'],
    blocked: ['Nein.', 'Vorhergesehen. Geschlossen.', 'Dieses Ende geschieht nicht.', 'Aufgelöst.'],
    signature: [
      'Jetzt sehe ich das Ende. Zähl mit mir.',
      'Erzwungen. Von hier gehört mir jeder Weg.',
      'Das Ende steht geschrieben. Lies es Zug um Zug.',
    ],
    worry: ['…', 'Unerwartet.', 'Ein Kräuseln im Muster.'],
    playerFork: ['…Zwei. Zwei sah ich nicht.', 'Das Muster bricht.'],
    comeback: ['Das Muster fügt sich wieder.', 'Wie es immer kommen sollte.'],
    nearLoss: ['…Ich sehe ein Ende, das nicht meins ist.', 'So fühlt sich also Überraschung an.'],
    win: [
      'Wie vorhergesehen.',
      'Es endete, wo ich es sagte.',
      'Noch einmal, wenn du willst. Es endet gleich.',
    ],
    loss: [
      '…Das sah ich nicht voraus. Gut gespielt.',
      'Du bist aus dem Muster getreten. Bemerkenswert.',
      'Der Schleier hebt sich. Du hast weiter gesehen als ich.',
    ],
    draw: [
      'Gleichgewicht. Auch das sah ich voraus. Meistens.',
      'Keines der Enden kam. Seltsam.',
      'Das Muster hält. Für uns beide.',
    ],
  },
};
