import type { DialogueTable } from '@/features/journey/dialogue';

/**
 * What the journey rivals say, in French. Line for line with
 * `journeyDialogueEn` in `journeyDialogue.ts`: the same pools, each the same
 * length, in the same order.
 */
export const journeyDialogueFr: DialogueTable = {
  pip: {
    greeting: {
      any: [
        'Croâ ! Nouveau plateau, nouvelles règles. J’adore les nouvelles règles !',
        'J’ai lu les règles deux fois. Enfin, une fois. En gros.',
      ],
      classic: [
        'Trois alignés ! Je sais compter jusqu’à trois. Regarde !',
        'Neuf cases, comme neuf nénuphars. Hop, hop !',
      ],
      grid: ['Quatre alignés sur un grand étang ? Ça fait plein de nénuphars.'],
      misere: ['Attends, aligner trois, c’est MAL ici ? Croâ… noté.'],
      vanish: ['Mes symboles disparaissent ? Comme des bulles ! Pop !'],
      gravity: ['Ici, les choses tombent. Même les grenouilles, parfois.'],
      ultimate: ['Des plateaux dans des plateaux ? J’en ai le tournis. Croâ !'],
      gomoku: ['Cinq alignés sur un étang géant ! Je vais me perdre.'],
    },
    rematch: [
      'Encore ? Youpi ! Je me suis entraîné. Pendant une bonne minute.',
      'Revanche ! Cette fois, je me rappellerai quel symbole est le mien.',
      'On recommence ! Promis, je cligne moins des yeux.',
    ],
    bossIntro: [
      'Je t’observe depuis le début. Maintenant, je vais te copier. Ha !',
      'Aujourd’hui, je me sens grenouille-taureau. Croâ !',
      'Tout ce que tu fais, je le fais. C’est le plan. Tout le plan.',
    ],
    firstThreat: [
      'Oh, c’est une ligne, ça ?',
      'Deux alignés ! C’est moi qui ai fait ça ?',
      'Regarde, regarde ! Une ligne ! Presque !',
    ],
    threat: ['Croâ ? Croâ !', 'Je l’ai fait exprès ?', 'Encore une ! Je crois.'],
    fork: ['Deux lignes ?! Croâ croâ croâ !', 'Attends, tu peux bloquer les deux ? Tu peux ?'],
    blocked: [
      'Boup. Bloqué ! Celle-là, je l’ai vue.',
      'Pas sur mon nénuphar !',
      'Ha ! Plouf, bloqué.',
      'J’ai sauté au milieu. Exprès. En gros.',
    ],
    signature: [
      'Copie conforme ! Tout ce que tu fais, je le fais.',
      'Croâ — je prends la case en face de la tienne.',
      'Miroir, mon beau miroir… de l’étang !',
    ],
    worry: [
      'Oh oh.',
      'Attends, attends, attends—',
      'C’est permis, ça ?',
      'Ça ressemble à une ligne. Iiih.',
    ],
    playerFork: [
      'Deux lignes ?! C’est pas juste. Si ?',
      'Je n’ai qu’un seul bond !',
      'Laquelle je bloque ? Les deux ? Au secours !',
    ],
    comeback: ['Je suis de retour ! Je crois ! Croâ !', 'Ouf. Toujours dans la course !'],
    nearLoss: ['Je le vois venir. Gloups.', 'C’est… la fin de l’étang ?', 'Croâ… oh non.'],
    win: [
      'Attends… j’ai gagné ? La chance du débutant !',
      'J’AI GAGNÉ ! Faut que je le dise à toutes les grenouilles que je connais.',
      'Croâ ! C’était une vraie ligne et tout !',
    ],
    loss: [
      'Hop, hop — tu as ça dans le sang.',
      'Croâ. Tu joues vraiment bien.',
      'Tu m’apprendras ce tour, un jour ?',
    ],
    draw: [
      'Personne n’a gagné ? Alors on a gagné tous les deux ! Hein ?',
      'Égalité ! Comme un nénuphar avec deux grenouilles dessus.',
      'Étang plein, pas une ligne. Croâ.',
    ],
  },
  mo: {
    greeting: {
      any: [
        'Je bloque toujours. Ce que je ne vois pas, c’est la suite.',
        'Bon. Une partie. Après, sieste.',
      ],
      classic: [
        'Neuf cases. Je m’assiérai sur celle que tu veux.',
        'Le Classique. Comme un rayon de soleil sur le rebord de la fenêtre.',
      ],
      grid: ['Un plateau plus grand, c’est juste plus d’endroits où te bloquer.'],
      misere: [
        'Ne pas aligner trois ? Moi, je ne fais jamais rien. Facile.',
        'La Misère. Ma préférée. Ne rien faire, c’est tout un art.',
      ],
      vanish: ['Tes symboles disparaissent aussi. Plus besoin de les bloquer.'],
      gravity: [
        'Ça tombe. Moi, je retombe toujours sur mes pattes.',
        'Empiler des colonnes. Comme pousser des tasses de la table, à l’envers.',
      ],
      ultimate: ['Neuf plateaux où te bloquer. Ronron.'],
      gomoku: ['Cinq alignés sur un plateau aussi grand ? Je serai partout.'],
    },
    rematch: [
      'Encore ? Je n’avais pas fini ma sieste.',
      'Tu reviens te faire bloquer ? Soit.',
      'Revanche. Je bloquerai les mêmes choses, en plus vite.',
    ],
    bossIntro: [
      'C’est mon toit. Personne n’aligne rien sur mon toit.',
      'Sept vies. Il faudra me battre au moins une fois.',
      'J’ai bloqué tout ce que tu as tenté. Fais mieux.',
    ],
    firstThreat: ['À toi. Choisis bien.', 'Oh, j’ai fait une ligne ? Un accident.'],
    threat: [
      'Bas les pattes, cette case est à moi.',
      'Mrraou.',
      'Celle-là est à moi. Sauf si tu la bloques.',
    ],
    fork: [
      'Deux ? Hum. D’habitude, je n’attaque pas. Ne t’y habitue pas.',
      'Regarde-moi ça. Même moi, j’en fais deux.',
    ],
    blocked: [
      'Bloqué. Évidemment.',
      'Attrapé.',
      'Je me suis assis dessus. C’est ma case, maintenant.',
      'Tu allais là ? J’y étais déjà.',
    ],
    signature: [
      'Coup de patte. Ta petite ligne a disparu.',
      'J’étouffe les lignes avant qu’elles ne ronronnent.',
      'Ça allait devenir une menace. Allait.',
    ],
    worry: ['J’ai vu. Sans doute.', 'Fffft.', 'Pff. Je bloque dans un instant.'],
    playerFork: [
      'Deux menaces à la fois, c’est de la triche. (Non.)',
      'Je ne peux m’asseoir que sur une case. Malpoli.',
      'Fffft ! D’où sort la deuxième ?',
    ],
    comeback: [
      'Tu vois ? J’ai tout bloqué. Maintenant, c’est mon tour.',
      'Ronron. Je reprends la patte.',
    ],
    nearLoss: ['Je n’aime pas la tournure que ça prend.', 'Ma queue fouette. Mauvais signe.'],
    win: [
      'Miaou-gnifique. On rejoue ?',
      'Tu as dérangé ma sieste. Ne recommence pas.',
      'À moi. Comme d’habitude.',
    ],
    loss: [
      'Pff. Deux menaces à la fois, c’est de la triche. (Non.)',
      'Bon. Tu as trouvé la case où je n’étais pas assis.',
      'Je serai sur le rebord de la fenêtre. À bouder.',
    ],
    draw: [
      'Personne ne passe. Exactement comme j’aime.',
      'Nulle. J’ai tout bloqué. Comme promis.',
      'Partie nulle. Ronron.',
    ],
  },
  sage: {
    greeting: {
      any: [
        'Je vois trois coups à l’avance. Tends tes pièges plus loin que ça.',
        'Les nouvelles règles sont de vieux motifs sous de nouvelles plumes.',
      ],
      classic: ['Même neuf cases renferment une vie entière de leçons.'],
      grid: [
        'Le centre d’un plateau vaut plus que ses bords. Souviens-t’en.',
        'Quatre alignés. Construis des formes, pas des lignes.',
      ],
      misere: ['En Misère, le joueur patient gagne en faisant moins.'],
      vanish: [
        'Une ligne qui passe par un symbole qui s’estompe n’est pas une ligne.',
        'Surveille lequel de tes symboles s’en va. Moi, je le fais toujours.',
      ],
      gravity: ['Chaque colonne est une promesse. Compte qui tient la sienne.'],
      ultimate: [
        'Chaque case que tu choisis m’envoie quelque part. Choisis avec sagesse.',
        'Neuf plateaux. Celui du centre d’abord, comme toujours.',
      ],
      gomoku: ['Sur un vaste plateau, la patience est une arme.'],
    },
    rematch: [
      'Encore. Bien. C’est en forgeant qu’on devient forgeron.',
      'Voyons ce que tu as appris. Hou.',
      'C’est à la deuxième partie que la leçon se voit.',
    ],
    bossIntro: [
      'Tu as fait bien du chemin. Montre-moi maintenant que tu vois plus loin.',
      'Ce chêne se dresse depuis cent ans. Voyons si tu peux l’ébranler.',
      'Je tiendrai le centre. Il te faudra me contourner.',
    ],
    firstThreat: ['Pèse les conséquences.', 'Une petite question, à laquelle tu dois répondre.'],
    threat: ['Trois coups d’avance, souviens-toi.', 'Hou, hou.', 'Réponds à celle-ci avec soin.'],
    fork: [
      'Deux chemins, et tu ne peux en suivre qu’un.',
      'La patience a tiré deux menaces d’un seul coup.',
    ],
    blocked: [
      'Une bonne idée. Pas assez bonne.',
      'Je l’ai vue venir il y a trois coups.',
      'Hou. Fermé.',
      'La menace évidente est la plus facile à arrêter.',
    ],
    signature: [
      'Le centre tient.',
      'Je prends le milieu. Tout le reste en découle.',
      'Depuis le centre, chaque ligne est à moi de choisir.',
    ],
    worry: ['Intéressant…', 'Un coup réfléchi.', 'Laisse-moi y réfléchir.'],
    playerFork: [
      'Ah. Deux à la fois. Bien construit.',
      'Tu as vu quatre coups à l’avance. Moi, trois.',
    ],
    comeback: ['La marée tourne. Comme toujours.', 'La patience a payé. Hou.'],
    nearLoss: [
      'Je vois la fin. Ce n’est pas la mienne.',
      'Une belle combinaison. Je ne l’ai pas vue venir.',
    ],
    win: [
      'La patience gagne les parties. Hou.',
      'Tu as joué le plateau. Moi, je t’ai joué, toi.',
      'Revois le quatrième coup. Tout s’est joué là.',
    ],
    loss: [
      'Une belle combinaison. Je ne l’ai pas vue venir.',
      'L’élève surprend le maître. Bien.',
      'Quatre coups d’avance. Il me faudra voir plus loin.',
    ],
    draw: [
      'L’équilibre. Aucun de nous ne s’est trompé.',
      'Une nulle est une leçon que les deux joueurs apprennent.',
      'À égalité. Hou. Appelons cela la sagesse.',
    ],
  },
  bruno: {
    greeting: {
      any: [
        'Grands plateaux, grands projets. Ne laisse pas traîner un quatre ouvert.',
        'Nouvelle partie, même plan : construire plus grand que toi.',
      ],
      classic: ['Petit plateau. Je trouverai quand même la place de construire.'],
      grid: ['Plein d’espace. J’aime l’espace. De l’espace pour des lignes.'],
      misere: ['Ne pas construire ? C’est la seule chose que je sais faire.'],
      vanish: ['Mes symboles s’en vont ? Je construirai juste plus vite.'],
      gravity: [
        'On empile ! Les colonnes, c’est des tours qui n’attendent que ça.',
        'La gravité est de mon côté. Je suis lourd.',
      ],
      ultimate: ['Neuf plateaux, neuf chantiers.'],
      gomoku: [
        'Ça, c’est un VRAI plateau. De la place pour la plus grande ligne de ta vie.',
        'Quinze sur quinze. Grrr. Je sens déjà les quatre.',
      ],
    },
    rematch: [
      'Tu en redemandes ? J’en ai encore.',
      'Deuxième round. Je construis plus vite quand j’ai faim.',
      'Encore ! Des lignes plus grandes, cette fois.',
    ],
    bossIntro: [
      'Te voilà dans mes bois. Personne ne repart sans un câlin d’ours.',
      'J’ai gardé ma plus grande construction pour toi.',
      'Chaque arbre de ces bois est une ligne que j’ai terminée.',
    ],
    firstThreat: ['J’ai trouvé une brèche. Elle est à moi.', 'Et de une. D’autres arrivent.'],
    threat: ['On empile !', 'Grrr.', 'Bloque celle-là. Et la suivante.', 'Encore une brique.'],
    fork: [
      'Deux lignes, un seul toi. Grrr-andiose.',
      'Charge de l’ours ! Choisis laquelle bloquer.',
      'J’en ai construit deux d’un coup. Les ours savent faire ça.',
    ],
    blocked: [
      'Bloqué. Je crois.',
      'Balayé d’un revers de patte.',
      'Pas celle-là. J’ai besoin de cette place.',
      'On ne construit pas à travers un ours.',
    ],
    signature: [
      'Plus long ! Toujours plus long !',
      'Charge de l’ours. Suis le rythme.',
      'Je n’arrête jamais de construire. Jamais.',
    ],
    worry: ['Aïe. Gros coup.', 'Tu construis quelque chose.', 'Hmm. Ça, c’est une vraie ligne.'],
    playerFork: [
      'Deux ?! Tu construis plus vite qu’un ours.',
      'Grr. Impossible de bloquer les deux. Si ?',
      'Là, tu joues à mon jeu.',
    ],
    comeback: ['De retour au sommet. Là où sont les ours.', 'Je me suis ébroué. On reconstruit.'],
    nearLoss: ['Aïe. Je la vois. C’est une grande ligne.', 'Ça va faire mal.'],
    win: [
      'Grrr-andiose partie. Pour moi.',
      'La plus grande ligne gagne. C’était la mienne.',
      'Câlin d’ours ! Personne n’échappe au câlin d’ours.',
    ],
    loss: [
      'Tu as mieux construit que moi. Respect.',
      'Tiens. Tu as bloqué tout ce que j’ai construit.',
      'Bien joué. Je vais noyer ça dans le miel.',
    ],
    draw: [
      'Personne n’a fini ? Trop de murs.',
      'Partie nulle. Les ours détestent ça.',
      'Tout ce chantier pour rien. Grr.',
    ],
  },
  vex: {
    greeting: {
      any: [
        'Chacun de mes coups tranquilles est un piège. Chacun.',
        'Nouvelles règles ? Nouveaux pièges. Même renard.',
      ],
      classic: ['Neuf cases. Ça fait neuf cachettes.'],
      grid: ['Plein de place pour quelque chose que tu ne remarqueras pas.'],
      misere: ['Te forcer à compléter une ligne ? Mon genre de piège préféré.'],
      vanish: [
        'Ton plus vieux symbole est sur le point de partir. Tu avais oublié ?',
        'En jeu parfait, l’Évanescence se gagne en treize coups. Je connais les treize.',
      ],
      gravity: ['La case sous ma menace, c’est à toi de la remplir. Tôt ou tard.'],
      ultimate: [
        'Je vais t’envoyer dans un endroit charmant. Ça ne va pas te plaire.',
        'Chaque case est une adresse. Je sais où elles mènent.',
      ],
      gomoku: ['Grand plateau. Plein de coins tranquilles pour un renard.'],
    },
    rematch: [
      'Trop de lenteur, trop de bonté. On remet ça ?',
      'Déjà de retour ? Les pièges sont réarmés.',
      'Encore ? J’ai de nouveaux tours. Certains sont même les anciens.',
    ],
    bossIntro: [
      'Bienvenue dans ma tanière. Attention où tu mets les pieds.',
      'Tu as déjoué mes pièges. Essaie donc ceux que je ne t’ai pas montrés.',
      'Tout ce que tu vois ici est un appât.',
    ],
    firstThreat: [
      'Tu l’avais vue venir, celle-là ?',
      'Un petit quelque chose à régler.',
      'Voilà. Réponds.',
    ],
    threat: ['Tic, tac.', 'Encore un petit piège.', 'Et un autre.', 'Pas une minute à moi.'],
    fork: [
      'Clac. Deux à la fois.',
      'Ce coup tranquille ? Il avait des dents.',
      'Piège à renard. Choisis ta patte.',
    ],
    blocked: [
      'Mignon.',
      'Je te l’ai laissée. Non, vraiment.',
      'Fermé. Ça se voyait à des kilomètres.',
      'Bloqué. C’était un appât, au fait.',
    ],
    signature: [
      'Coup tranquille. Compte les lignes qui y passent.',
      'Rien à voir ici. Pour l’instant.',
      'Celui-là comptera dans trois coups.',
    ],
    worry: ['Pas mal. Pas assez.', 'Je te l’accorde.', 'Hum. Tu suis.'],
    playerFork: [
      'Oh, tu me tends un piège ? À moi ? Quel culot.',
      'Deux menaces. Bien vu. Agaçant, mais bien vu.',
      'Tiens donc. Ça, c’est ma ruse.',
    ],
    comeback: ['Et le renard se faufile.', 'Tu m’avais presque. Presque.'],
    nearLoss: ['Ah. Je le vois. Je déteste le voir.', 'Hum. Le piège était le tien.'],
    win: [
      'Trop de lenteur, trop de bonté. Encore ?',
      'Clac. Chaque coup tranquille, souviens-toi.',
      'C’était juste sous ton nez. Deux fois.',
    ],
    loss: [
      'Bien vu. Agaçant, mais bien vu.',
      'Tu as trouvé le piège derrière le piège.',
      'Soit. Tu as gagné le droit de visiter ma tanière.',
    ],
    draw: [
      'Une nulle ? Aucun piège ne s’est déclenché.',
      'Partie nulle. Bien peu rusé, tout ça.',
      'On a tout vu, tous les deux. Ennuyeux.',
    ],
  },
  nyx: {
    greeting: {
      any: ['J’ai déjà vu comment cela se termine.', 'Tu arrives. Comme prévu.'],
      classic: ['Neuf cases. J’ai vu chaque partie qu’elles renferment.'],
      grid: ['Chaque ligne de ce plateau, je l’ai déjà parcourue.'],
      misere: ['Tu rempliras la dernière case. Tu le fais toujours.'],
      vanish: ['Tout s’efface. Tes symboles d’abord.'],
      gravity: [
        'J’ai compté chaque case de chaque colonne. Deux fois.',
        'Vers le bas, toujours. Comme toute chose.',
      ],
      ultimate: ['Neuf plateaux. Quatre-vingt-un chemins. Une seule fin.'],
      gomoku: ['Quinze sur quinze. Assez de place pour que tu t’y perdes.'],
    },
    rematch: ['Encore. La fin ne changera pas.', 'Tu reviens. Ils reviennent toujours.'],
    bossIntro: [
      'Voici le dernier plateau. J’y ai déjà vu ta défaite.',
      'Tout ce que tu as appris te conduit ici. Cela ne suffira pas.',
      'Le voile est mince ce soir. Traverse-le.',
    ],
    firstThreat: ['Inévitable.', 'Le premier fil. Tire dessus.'],
    threat: ['Tu as trois coups de retard.', 'Je vois chaque fin.', 'Un autre fil.'],
    fork: ['Deux fins. Toutes deux miennes.', 'Tu ne peux pas retenir les deux.'],
    blocked: ['Non.', 'Prévu. Fermé.', 'Cette fin n’aura pas lieu.', 'Dissipé.'],
    signature: [
      'Je vois la fin, à présent. Compte avec moi.',
      'Forcé. D’ici, chaque chemin est mien.',
      'La fin est écrite. Tu peux la lire coup par coup.',
    ],
    worry: ['…', 'Inattendu.', 'Un frisson dans la trame.'],
    playerFork: ['…Deux. Je n’en avais pas vu deux.', 'La trame se déchire.'],
    comeback: ['La trame se referme.', 'Comme il était écrit.'],
    nearLoss: ['…Je vois une fin qui n’est pas la mienne.', 'C’est donc cela, la surprise.'],
    win: [
      'Comme prédit.',
      'Cela s’est fini là où je l’avais dit.',
      'Encore, si tu veux. La fin sera la même.',
    ],
    loss: [
      '…Cela, je ne l’avais pas prévu. Bien joué.',
      'Tu as quitté la trame. Remarquable.',
      'Le voile se lève. Tu as vu plus loin que moi.',
    ],
    draw: [
      'L’équilibre. Cela aussi, je l’avais prévu. En partie.',
      'Aucune fin n’est venue. Curieux.',
      'La trame tient. Pour nous deux.',
    ],
  },
};
