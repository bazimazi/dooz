/**
 * The lessons in French. Keys, and the English they fall back to, are
 * explained in `lessonsContent.ts`.
 */
export const lessonsContentFr: Readonly<Record<string, string>> = {
  // Classic
  'classic-three-in-a-row.title': 'Gagner et bloquer',
  'classic-three-in-a-row.intro':
    'Chaque partie de morpion se joue sur deux questions, à se poser à chaque coup : puis-je gagner tout de suite ? Et mon adversaire ? Cherchez deux symboles alignés dont la troisième case est vide — les vôtres, complétez-les ; les siens, bloquez-les.',
  'classic-three-in-a-row.1.prompt': 'Vous avez deux symboles alignés. Complétez la ligne.',
  'classic-three-in-a-row.1.hint':
    'Votre diagonale va d’un coin à l’autre en passant par le centre.',
  'classic-three-in-a-row.1.success':
    'Trois alignés. Cherchez toujours votre propre victoire en premier.',
  'classic-three-in-a-row.1.wrong':
    'Ce n’est pas un alignement de trois — regardez le long de la diagonale.',
  'classic-three-in-a-row.2.prompt': 'L’adversaire a deux symboles alignés. Arrêtez-le.',
  'classic-three-in-a-row.2.hint': 'Ses deux symboles descendent la diagonale. Prenez-en le bout.',
  'classic-three-in-a-row.2.success': 'Bloqué. Sa diagonale est morte.',
  'classic-three-in-a-row.2.wrong': 'Il lui reste une case qui complète sa diagonale.',
  'classic-three-in-a-row.3.prompt':
    'Vous avez chacun deux symboles alignés. Qu’est-ce qui passe en premier ?',
  'classic-three-in-a-row.3.hint': 'Une victoire termine la partie avant que sa menace ne compte.',
  'classic-three-in-a-row.3.success':
    'Gagner passe avant bloquer — l’adversaire n’aura pas de coup suivant.',
  'classic-three-in-a-row.3.wrong':
    'Vous pouvez gagner ce coup-ci. Prenez la victoire avant de vous soucier de sa menace.',
  'classic-forks.title': 'Les fourchettes',
  'classic-forks.intro':
    'Une fourchette est un coup qui crée deux menaces à la fois. Votre adversaire ne peut en bloquer qu’une, alors l’autre gagne. Presque toutes les parties de morpion qui ne finissent pas nulles se décident ainsi.',
  'classic-forks.1.prompt': 'Créez deux menaces en un seul coup.',
  'classic-forks.1.hint':
    'Cherchez une case alignée avec deux de vos symboles, sur deux lignes différentes.',
  'classic-forks.1.success': 'Deux menaces. Quelle que soit celle qu’il bloque, l’autre gagne.',
  'classic-forks.1.wrong':
    'Cela crée une menace au plus — l’adversaire la bloque et il ne vous reste rien.',
  'classic-forks.2.prompt':
    'L’adversaire occupe deux coins opposés. Empêchez la fourchette avant qu’elle n’arrive.',
  'classic-forks.2.hint':
    'Un coin semble naturel, et c’est le piège. Créez votre propre menace depuis un bord.',
  'classic-forks.2.success':
    'Un bord l’oblige à vous répondre, et il n’a jamais le coup libre dont une fourchette a besoin.',
  'classic-forks.2.wrong':
    'Un coin ici lui permet de prendre l’autre coin avec deux menaces à la fois.',
  'classic-first-reply.title': 'La première réponse',
  'classic-first-reply.intro':
    'Avec un bon jeu des deux côtés, le Classique se termine en partie nulle, mais une seule réponse à chaque ouverture permet d’y parvenir. Le premier symbole décide où vous devez répondre : un coin appelle le centre, le centre appelle un coin.',
  'classic-first-reply.1.prompt':
    'L’adversaire a ouvert dans un coin. Trouvez la seule réponse qui tient.',
  'classic-first-reply.1.hint':
    'Toute autre case lui laisse un moyen de vous faire une fourchette plus tard.',
  'classic-first-reply.1.success':
    'Le centre. Face à un coin, c’est la seule réponse qui mène à la nulle.',
  'classic-first-reply.1.wrong':
    'Cela perd face à un jeu parfait : une ouverture dans un coin exige le centre.',
  'classic-first-reply.2.prompt': 'L’adversaire a ouvert au centre. Répondez.',
  'classic-first-reply.2.hint': 'Les bords perdent face au centre. Les coins tiennent.',
  'classic-first-reply.2.success': 'Un coin. De là, chaque fourchette qu’il tente peut être parée.',
  'classic-first-reply.2.wrong': 'Un bord face au centre perd à coup sûr. Prenez un coin.',
  'classic-first-reply.3.prompt':
    'L’adversaire a ouvert sur un bord. Plusieurs réponses tiennent — trouvez-en une.',
  'classic-first-reply.3.hint': 'Le centre, le bord opposé, ou un coin à côté de son symbole.',
  'classic-first-reply.3.success':
    'Cela tient. Une ouverture sur un bord vous laisse le plus de choix.',
  'classic-first-reply.3.wrong': 'Celle-ci perd : elle lui laisse une fourchette dans deux coups.',

  // Grid 6
  'grid-6-open-three.title': 'Trois ouverts et trois fermés',
  'grid-6-open-three.intro':
    'En Grille 6, il faut en aligner quatre. Un trois dont les deux bouts sont libres est ouvert : il peut devenir un quatre par l’un ou l’autre bout, c’est donc déjà deux menaces. Un trois bloqué à un bout est fermé — une seule menace, facile à arrêter.',
  'grid-6-open-three.1.prompt': 'Transformez vos deux symboles en trois ouvert.',
  'grid-6-open-three.1.hint':
    'Prolongez votre rangée juste à côté, en gardant les deux bouts libres.',
  'grid-6-open-three.1.success':
    'Un trois ouvert : le quatre attend aux deux bouts, et l’adversaire ne peut en couvrir qu’un.',
  'grid-6-open-three.1.wrong':
    'Laissez un trou et le trois n’a plus qu’une façon de devenir un quatre.',
  'grid-6-open-three.2.prompt': 'Le trois adverse est fermé à un bout. Arrêtez-le.',
  'grid-6-open-three.2.hint': 'Votre symbole ferme déjà un bout. Fermez l’autre.',
  'grid-6-open-three.2.success':
    'Un trois fermé n’a qu’une façon de grandir, et vous venez de la prendre.',
  'grid-6-open-three.2.wrong': 'Sa rangée a encore une case qui donne un quatre.',
  'grid-6-open-three.3.prompt':
    'L’adversaire a un deux ouvert. Bouchez-le avant qu’il ne devienne un trois ouvert.',
  'grid-6-open-three.3.hint': 'Jouez tout contre un bout de sa paire.',
  'grid-6-open-three.3.success': 'Bouché. Quoi qu’il ajoute maintenant, le trois sera fermé.',
  'grid-6-open-three.3.wrong':
    'D’ici, il peut encore faire un trois ouvert — et cela fait deux menaces.',
  'grid-6-crossing-lines.title': 'Là où les lignes se croisent',
  'grid-6-crossing-lines.intro':
    'Deux lignes à moitié construites qui passent par la même case vide, c’est une fourchette en puissance. Jouez le point de croisement et les deux lignes deviennent des menaces à la fois. Apprenez à les repérer chez vous — et chez l’adversaire.',
  'grid-6-crossing-lines.1.prompt':
    'Votre rangée et votre colonne se rejoignent sur une case. Trouvez-la.',
  'grid-6-crossing-lines.1.hint':
    'Suivez votre rangée vers la droite et votre colonne vers le bas jusqu’à ce qu’elles se croisent.',
  'grid-6-crossing-lines.1.success':
    'Les deux lignes sont maintenant des trois avec de la place pour grandir. Deux menaces, un seul blocage.',
  'grid-6-crossing-lines.1.wrong':
    'Cela n’aide qu’une ligne. La case qui sert les deux, c’est la fourchette.',
  'grid-6-crossing-lines.2.prompt': 'Cette fois, une diagonale et une colonne. Créez deux menaces.',
  'grid-6-crossing-lines.2.hint':
    'Le trou de votre diagonale se trouve juste au-dessus de votre colonne.',
  'grid-6-crossing-lines.2.success':
    'La diagonale et la colonne menacent toutes deux de faire quatre. L’adversaire ne peut pas couvrir les deux.',
  'grid-6-crossing-lines.2.wrong':
    'Une seule menace se bloque facilement. Trouvez la case qui en crée deux.',

  // Grid 9
  'grid-9-both-ends.title': 'Surveillez les deux bouts',
  'grid-9-both-ends.intro':
    'Cinq alignés sur un plateau 9×9, cela veut dire de longues lignes avec de la place aux deux bouts — et des trous. Un quatre troué reste un quatre. Un trois ouvert laissé tranquille devient un quatre ouvert, et rien ne l’arrête.',
  'grid-9-both-ends.1.prompt': 'L’adversaire a quatre alignés. Bloquez-le.',
  'grid-9-both-ends.1.hint': 'L’un des bouts est déjà à vous.',
  'grid-9-both-ends.1.success': 'Bloqué. Un quatre exige une réponse immédiate — toujours.',
  'grid-9-both-ends.1.wrong':
    'Il fait cinq au prochain coup. Son bout ouvert est la seule case qui compte.',
  'grid-9-both-ends.2.prompt': 'Ce quatre a un trou. Trouvez la case qui compte.',
  'grid-9-both-ends.2.hint': 'Bouchez le trou.',
  'grid-9-both-ends.2.success': 'Un quatre troué reste un quatre. Les trous comptent.',
  'grid-9-both-ends.2.wrong': 'Il fait cinq par le trou au prochain coup.',
  'grid-9-both-ends.3.prompt':
    'Un trois ouvert. Bloquez-le avant qu’il ne devienne un quatre ouvert.',
  'grid-9-both-ends.3.hint': 'Bloquez tout contre le trois, pas une case plus loin.',
  'grid-9-both-ends.3.success': 'Désormais, son quatre, s’il le fait, n’aura qu’un bout ouvert.',
  'grid-9-both-ends.3.wrong': 'Trop loin : il peut encore faire un quatre ouvert aux deux bouts.',

  // Gomoku
  'gomoku-13-open-threes.title': 'Le trois ouvert',
  'gomoku-13-open-threes.intro':
    'Au gomoku, un trois ouvert — trois alignés avec de la place aux deux bouts — est la menace qui compte. Ignorez-le et il devient un quatre ouvert, qui gagne. Un trois fermé peut attendre : il ne donne jamais qu’un quatre que vous pouvez bloquer.',
  'gomoku-13-open-threes.1.prompt': 'Vous avez un trois ouvert. Faites-en un quatre ouvert.',
  'gomoku-13-open-threes.1.hint': 'Ajoutez à l’un ou l’autre bout, juste à côté du trois.',
  'gomoku-13-open-threes.1.success': 'Un quatre ouvert : le cinq attend aux deux bouts.',
  'gomoku-13-open-threes.1.wrong': 'Ce quatre n’a qu’un bout ouvert — l’adversaire le bloque.',
  'gomoku-13-open-threes.2.prompt': 'L’adversaire a deux trois. Bloquez celui qui compte.',
  'gomoku-13-open-threes.2.hint':
    'Votre symbole ferme déjà la colonne. La rangée est ouverte aux deux bouts.',
  'gomoku-13-open-threes.2.success':
    'Exact. Le trois fermé ne peut donner qu’un quatre que vous bloquerez à temps.',
  'gomoku-13-open-threes.2.wrong':
    'Cela laisse son trois ouvert libre de devenir un quatre ouvert.',
  'gomoku-15-four-three.title': 'Le quatre-trois',
  'gomoku-15-four-three.intro':
    'Un quatre doit être paré immédiatement. Un quatre-trois est un coup qui crée à la fois un quatre et un trois ouvert : l’adversaire est forcé de bloquer le quatre, et pendant ce temps le trois devient un quatre ouvert. C’est la forme gagnante classique du gomoku.',
  'gomoku-15-four-three.1.prompt': 'Créez un quatre et un trois ouvert en un seul coup.',
  'gomoku-15-four-three.1.hint': 'Votre rangée et votre colonne se rejoignent sur une case.',
  'gomoku-15-four-three.1.success':
    'Quatre à l’horizontale, trois ouvert à la verticale. L’adversaire doit bloquer le quatre — puis le trois gagne.',
  'gomoku-15-four-three.1.wrong':
    'Cela lui laisse du temps. Trouvez le coup qui crée le quatre et le trois à la fois.',
  'gomoku-15-four-three.2.prompt': 'Un autre quatre-trois, sur la diagonale.',
  'gomoku-15-four-three.2.hint':
    'Prolongez la diagonale pour qu’elle complète aussi un trois dans la rangée du dessous.',
  'gomoku-15-four-three.2.success':
    'Quatre sur la diagonale, trois ouvert dans la rangée. Le blocage arrive trop tard.',
  'gomoku-15-four-three.2.wrong':
    'Pas celui-ci — regardez où la diagonale et votre rangée partagent une case.',
  'gomoku-15-double-four.title': 'Les quatre d’abord',
  'gomoku-15-double-four.intro':
    'Deux quatre à la fois ne peuvent pas être bloqués tous les deux. Et quand votre adversaire a un quatre, rien de ce que vous construisez ne compte tant qu’il n’est pas arrêté — pas même un trois ouvert à vous.',
  'gomoku-15-double-four.1.prompt': 'Créez deux quatre en un seul coup.',
  'gomoku-15-double-four.1.hint': 'Le trou de votre rangée est aussi le bout de votre colonne.',
  'gomoku-15-double-four.1.success':
    'Un double quatre. Un seul blocage ne peut pas empêcher deux cinq.',
  'gomoku-15-double-four.1.wrong':
    'Cela crée un quatre au plus. Trouvez la case que les deux lignes partagent.',
  'gomoku-15-double-four.2.prompt': 'Vous avez un trois ouvert, mais l’adversaire a un quatre.',
  'gomoku-15-double-four.2.hint': 'Votre trois peut attendre un coup. Son quatre, non.',
  'gomoku-15-double-four.2.success':
    'Bloqué. Maintenant, c’est votre trois ouvert qui menace sur le plateau.',
  'gomoku-15-double-four.2.wrong': 'Il fait cinq avant que votre trois n’ait sa chance.',

  // Misère
  'misere-dont-finish.title': 'Ne terminez pas la ligne',
  'misere-dont-finish.intro':
    'En Misère, aligner trois symboles fait perdre. En fin de partie, les cases se font rares, et la question devient : quelle case pouvez-vous jouer sans compléter une ligne à vous ? Comptez-les avant de jouer.',
  'misere-dont-finish.1.prompt':
    'Deux des cases vides complètent une de vos lignes. Trouvez celle qui ne le fait pas.',
  'misere-dont-finish.1.hint':
    'Vérifiez votre rangée du haut et votre colonne de gauche avant de jouer.',
  'misere-dont-finish.1.success':
    'Sans danger — et maintenant, chaque case restante complète une ligne de l’adversaire.',
  'misere-dont-finish.1.wrong': 'Cela aligne trois de vos symboles. En Misère, c’est perdu.',
  'misere-dont-finish.2.prompt': 'Même idée, autre plateau. Quelle case est sans danger ?',
  'misere-dont-finish.2.hint':
    'Il ne manque qu’une case à votre rangée du haut comme à votre colonne de droite.',
  'misere-dont-finish.2.success':
    'La seule case sans danger — et elle n’en laisse aucune à l’adversaire.',
  'misere-dont-finish.2.wrong': 'Cette case complète votre propre ligne.',
  'misere-centre-mirror.title': 'Centre et miroir',
  'misere-centre-mirror.intro':
    'Le premier joueur ne peut jamais perdre en Misère. Prenez le centre, puis répondez à chaque coup par son reflet à travers le centre. Vos symboles ne s’alignent jamais entre eux, vous ne pouvez donc jamais être celui qui en aligne trois.',
  'misere-centre-mirror.1.prompt': 'Vous jouez en premier. Où ?',
  'misere-centre-mirror.1.hint':
    'La seule case par rapport à laquelle chaque autre case a son reflet.',
  'misere-centre-mirror.1.success': 'Le centre. Toute autre ouverture perd face à un jeu parfait.',
  'misere-centre-mirror.1.wrong': 'Cela perd face à un jeu parfait. Commencez au centre.',
  'misere-centre-mirror.2.prompt': 'L’adversaire a pris un coin. Jouez son reflet.',
  'misere-centre-mirror.2.hint': 'Tout droit à travers le centre, de l’autre côté.',
  'misere-centre-mirror.2.success':
    'Le coin opposé. Continuez à jouer en miroir et vous ne pouvez pas perdre.',
  'misere-centre-mirror.2.wrong': 'Seule la case miroir tient. Traversez le centre tout droit.',
  'misere-centre-mirror.3.prompt':
    'Cette fois, l’adversaire a pris un bord. Jouez encore son reflet.',
  'misere-centre-mirror.3.hint': 'Le bord juste en face du sien.',
  'misere-centre-mirror.3.success':
    'Reflété. Vos symboles et le centre restent hors des lignes les uns des autres.',
  'misere-centre-mirror.3.wrong': 'Cela perd face à un jeu parfait. Répondez par le bord opposé.',

  // Vanish
  'vanish-fading-marks.title': 'Le symbole qui s’estompe',
  'vanish-fading-marks.intro':
    'En Évanescence, vous ne gardez que trois symboles. Le plus ancien s’affiche en train de s’estomper : il quitte le plateau quand vous placez le suivant, il ne peut donc jamais faire partie de la ligne que ce coup forme. Les lignes qui passent par un symbole qui s’estompe n’ont que l’apparence d’une menace.',
  'vanish-fading-marks.1.prompt': 'Trois lignes semblent à une case du but. Une seule est réelle.',
  'vanish-fading-marks.1.hint': 'Ignorez toute ligne qui passe par votre coin qui s’estompe.',
  'vanish-fading-marks.1.success':
    'La seule ligne sans votre symbole qui s’estompe. Trois alignés.',
  'vanish-fading-marks.1.wrong':
    'Votre symbole qui s’estompe disparaît quand vous jouez : cette ligne n’est jamais complète.',
  'vanish-fading-marks.2.prompt': 'L’adversaire semble avoir deux menaces. Bloquez la vraie.',
  'vanish-fading-marks.2.hint': 'L’une de ses lignes passe par son propre symbole qui s’estompe.',
  'vanish-fading-marks.2.success':
    'Bloqué. Son autre ligne avait besoin d’un symbole sur le point de disparaître.',
  'vanish-fading-marks.2.wrong':
    'Cela laisse sa vraie ligne ouverte. L’autre n’a jamais été une menace.',
  'vanish-tempo.title': 'Laissez son symbole partir',
  'vanish-tempo.intro':
    'Le symbole qui s’estompe chez l’adversaire va lui aussi disparaître, et la case qu’il libère est à vous. Alignez deux de vos symboles derrière lui : quand il disparaît pendant son coup, votre ligne s’ouvre et l’adversaire ne peut pas la fermer à temps.',
  'vanish-tempo.1.prompt':
    'Le symbole adverse qui s’estompe bloque une ligne. Placez-vous derrière.',
  'vanish-tempo.1.hint':
    'Son symbole le plus ancien est en haut d’une colonne. Faites de cette colonne la vôtre.',
  'vanish-tempo.1.success': 'Quand il joue, son symbole part et la colonne n’attend plus que vous.',
  'vanish-tempo.1.wrong':
    'Cela le laisse s’en tirer. Alignez vos symboles derrière celui qui va disparaître.',
  'vanish-tempo.2.prompt': 'Même astuce, de l’autre côté du plateau.',
  'vanish-tempo.2.hint': 'Lequel de ses symboles part ensuite, et que laisse-t-il ouvert ?',
  'vanish-tempo.2.success':
    'Son symbole qui s’estompe est la seule chose sur votre chemin — et il s’en va.',
  'vanish-tempo.2.wrong': 'Celui-ci lui laisse le temps de préparer sa propre ligne.',

  // Gravity
  'gravity-floors-and-stacks.title': 'Le sol et les piles',
  'gravity-floors-and-stacks.intro':
    'En Gravité, vous choisissez une colonne et votre symbole tombe tout en bas. Une case n’est jouable que lorsque celle du dessous est prise. Les rangées au sol et les piles dans une colonne sont les premières menaces à chercher.',
  'gravity-floors-and-stacks.1.prompt': 'Trois au sol. Complétez la ligne.',
  'gravity-floors-and-stacks.1.hint':
    'Les deux bouts de votre rangée sont au sol, donc tous deux jouables.',
  'gravity-floors-and-stacks.1.success': 'Quatre au sol.',
  'gravity-floors-and-stacks.1.wrong': 'Cette case ne complète pas votre rangée.',
  'gravity-floors-and-stacks.2.prompt': 'L’adversaire a empilé trois symboles. Bouchez la colonne.',
  'gravity-floors-and-stacks.2.hint': 'Jouez dans sa colonne.',
  'gravity-floors-and-stacks.2.success': 'Bouché. Une pile ne peut grandir que vers le haut.',
  'gravity-floors-and-stacks.2.wrong': 'Il en pose un quatrième dessus au prochain coup.',
  'gravity-dont-fill-under.title': 'Ne remplissez pas dessous',
  'gravity-dont-fill-under.intro':
    'Une menace peut se trouver au-dessus d’une case vide. Personne ne peut la jouer tant que rien ne tombe dessous — alors celui qui remplit cette case offre la menace à l’autre joueur. Souvent, le meilleur coup consiste simplement à éviter cette colonne.',
  'gravity-dont-fill-under.1.prompt':
    'La rangée adverse a besoin d’une case pas encore jouable. Qu’elle le reste.',
  'gravity-dont-fill-under.1.hint': 'N’importe quelle colonne sauf celle sous sa menace.',
  'gravity-dont-fill-under.1.success':
    'Sa menace reste hors de portée jusqu’à ce que quelqu’un remplisse la case du dessous.',
  'gravity-dont-fill-under.1.wrong':
    'Cela remplit la case du dessous, et l’adversaire tombe pile sur son quatre.',
  'gravity-dont-fill-under.2.prompt':
    'Cette fois, la menace au-dessus de la case vide est la vôtre. Gardez-la.',
  'gravity-dont-fill-under.2.hint': 'Ne jouez pas dans la colonne sous votre propre menace.',
  'gravity-dont-fill-under.2.success':
    'Votre menace attend. Chaque coup de l’adversaire dans cette colonne vous offre la victoire.',
  'gravity-dont-fill-under.2.wrong':
    'Vous avez rempli votre propre case : l’adversaire joue par-dessus et votre menace disparaît.',
  'gravity-stacked-threats.title': 'Menaces superposées',
  'gravity-stacked-threats.intro':
    'Deux menaces dans la même colonne, l’une juste au-dessus de l’autre, ne peuvent pas être arrêtées toutes les deux : bloquer celle du bas rend celle du haut jouable. Au sol, un trois ouvert fonctionne comme sur un plateau à plat.',
  'gravity-stacked-threats.1.prompt': 'Créez deux menaces, l’une au-dessus de l’autre.',
  'gravity-stacked-threats.1.hint':
    'Un seul coup peut prolonger votre rangée et compléter un trois sur votre diagonale.',
  'gravity-stacked-threats.1.success':
    'L’adversaire doit bloquer la case du bas, et cela met votre seconde menace à portée.',
  'gravity-stacked-threats.1.wrong': 'Cela crée une seule menace, qu’il lui suffit de bloquer.',
  'gravity-stacked-threats.2.prompt': 'Créez un trois ouvert au sol.',
  'gravity-stacked-threats.2.hint':
    'Prolongez votre paire au sol, en gardant les deux bouts libres.',
  'gravity-stacked-threats.2.success': 'Deux bouts jouables, un seul blocage. Le sol est à vous.',
  'gravity-stacked-threats.2.wrong': 'Cela lui laisse une case à bloquer, et rien de plus.',

  // Ultimate
  'ultimate-small-boards.title': 'Gagner les petits plateaux',
  'ultimate-small-boards.intro':
    'En Ultimate, vous gagnez des petits plateaux pour gagner le grand. La case que vous choisissez dans un petit plateau décide sur quel plateau votre adversaire doit jouer ensuite — et quand il vous envoie là où vous avez déjà deux symboles alignés, prenez le plateau.',
  'ultimate-small-boards.1.prompt':
    'Vous êtes envoyé sur un plateau où vous avez deux symboles alignés. Prenez-le.',
  'ultimate-small-boards.1.hint': 'Complétez la rangée du bas du plateau en haut à gauche.',
  'ultimate-small-boards.1.success': 'Le plateau en haut à gauche est à vous.',
  'ultimate-small-boards.1.wrong': 'Cela ne complète pas votre rangée sur ce plateau.',
  'ultimate-small-boards.2.prompt': 'Envoyé sur le plateau central. Prenez-le aussi.',
  'ultimate-small-boards.2.hint': 'Même forme que tout à l’heure : la rangée du bas.',
  'ultimate-small-boards.2.success': 'Deux plateaux sur la diagonale.',
  'ultimate-small-boards.2.wrong': 'Cela ne complète pas votre rangée sur le plateau central.',
  'ultimate-small-boards.3.prompt': 'Un plateau de plus sur la diagonale et la partie est gagnée.',
  'ultimate-small-boards.3.hint': 'Il manque une case à votre colonne de gauche sur ce plateau.',
  'ultimate-small-boards.3.success': 'Trois plateaux alignés — la partie est à vous.',
  'ultimate-small-boards.3.wrong': 'Cela ne prend pas ce plateau, et ce plateau, c’est la partie.',
  'ultimate-where-you-send.title': 'Où vous l’envoyez',
  'ultimate-where-you-send.intro':
    'Chaque case que vous jouez envoie votre adversaire sur le petit plateau correspondant. Ne l’envoyez jamais sur un plateau qu’il peut gagner. Et ne l’envoyez jamais sur un plateau terminé : cela lui donne un coup libre n’importe où, y compris sur le plateau dont vous l’aviez soigneusement tenu à l’écart.',
  'ultimate-where-you-send.1.prompt':
    'Ici, deux cases envoient l’adversaire sur un plateau qu’il peut prendre. Évitez-les toutes les deux.',
  'ultimate-where-you-send.1.hint':
    'Repérez les plateaux où il a déjà deux symboles alignés, et évitez les cases qui y mènent.',
  'ultimate-where-you-send.1.success': 'Il arrive sur un plateau où il n’a rien à compléter.',
  'ultimate-where-you-send.1.wrong':
    'Cela l’envoie sur un plateau où il a deux symboles alignés. Il le prend.',
  'ultimate-where-you-send.2.prompt':
    'Le plateau en bas à droite est terminé. Attention au coup libre.',
  'ultimate-where-you-send.2.hint':
    'Évitez les plateaux où il a deux symboles alignés — et la case qui mène au plateau terminé.',
  'ultimate-where-you-send.2.success':
    'Aucun plateau à prendre pour lui, et aucun coup libre pour aller en chercher un.',
  'ultimate-where-you-send.2.wrong':
    'De là, il peut gagner un petit plateau — directement, ou grâce à un coup libre.',
};
