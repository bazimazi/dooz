import type { DialogueTable } from '@/features/journey/dialogue';

/**
 * What the journey rivals say, in Spanish. Line for line with
 * `journeyDialogueEn` in `journeyDialogue.ts`: the same pools, each the same
 * length, in the same order.
 */
export const journeyDialogueEs: DialogueTable = {
  pip: {
    greeting: {
      any: [
        '¡Croac! Tablero nuevo, reglas nuevas. ¡Me encantan las reglas nuevas!',
        'Me he leído las reglas dos veces. Bueno, una. Casi entera.',
      ],
      classic: [
        '¡Tres en línea! Sé contar hasta tres. ¡Mira!',
        'Nueve casillas, como nueve nenúfares. ¡Hop, hop!',
      ],
      grid: ['¿Cuatro en línea en un estanque enorme? Eso son muchísimos nenúfares.'],
      misere: ['Espera, ¿aquí tres en línea es MALO? Croac… apuntado.'],
      vanish: ['¿Mis marcas desaparecen? ¡Como burbujas! ¡Pop!'],
      gravity: ['Aquí las cosas caen. Hasta las ranas, a veces.'],
      ultimate: ['¿Tableros dentro de tableros? Me da vueltas la cabeza. ¡Croac!'],
      gomoku: ['¡Cinco en línea en un estanque gigante! Me voy a perder.'],
    },
    rematch: [
      '¿Otra? ¡Bien! He estado practicando. Como un minuto.',
      '¡Revancha! Esta vez me acordaré de cuál es mi marca.',
      '¡Otra vez! Prometo parpadear menos.',
    ],
    bossIntro: [
      'Te he estado observando. Ahora voy a copiarte. ¡Ja!',
      'Hoy me siento una rana enorme. ¡Croac!',
      'Lo que tú hagas, lo hago yo. Ese es el plan. Todo el plan.',
    ],
    firstThreat: [
      '¡Uy! ¿Esto es una línea?',
      '¡Dos en línea! ¿Eso lo he hecho yo?',
      '¡Mira, mira! ¡Una línea! ¡Casi!',
    ],
    threat: ['¿Croac? ¡Croac!', '¿Lo he hecho a propósito?', '¡Otra! Creo.'],
    fork: ['¡¿Dos líneas?! ¡Croac croac croac!', 'Espera, ¿puedes bloquear las dos? ¿Puedes?'],
    blocked: [
      '¡Bup! ¡Bloqueado! Esa la he visto.',
      '¡En mi nenúfar no!',
      '¡Ja! Bloqueo con chapuzón.',
      'Me he puesto en medio de un salto. A propósito. Casi.',
    ],
    signature: [
      '¡Copión! Lo que tú hagas, lo hago yo.',
      'Croac — yo me quedo la de enfrente.',
      '¡Espejito, espejito del estanque!',
    ],
    worry: ['Oh, oh.', 'Espera, espera, espera…', '¿Eso se puede?', 'Eso parece una línea. ¡Ay!'],
    playerFork: [
      '¡¿Dos líneas?! Eso no es justo. ¿Es justo?',
      '¡Solo tengo un salto!',
      '¿Cuál bloqueo? ¿Las dos? ¡Socorro!',
    ],
    comeback: ['¡He vuelto! ¡Creo! ¡Croac!', 'Uf. ¡Sigo en la partida!'],
    nearLoss: ['Lo veo venir. Glups.', '¿Es este… el final del estanque?', 'Croac… oh, no.'],
    win: [
      'Espera… ¿he ganado? ¡Suerte del principiante!',
      '¡HE GANADO! Se lo tengo que contar a todas las ranas que conozco.',
      '¡Croac! ¡Ha sido una línea de verdad y todo!',
    ],
    loss: [
      '¡A saltar! Tienes un don natural.',
      'Croac. Se te da genial esto.',
      '¿Me enseñas ese truco algún día?',
    ],
    draw: [
      '¿Nadie ha ganado? ¡Pues hemos ganado los dos! ¿No?',
      '¡Empate! Como un nenúfar con dos ranas encima.',
      'Estanque lleno, ninguna línea. Croac.',
    ],
  },

  mo: {
    greeting: {
      any: [
        'Yo siempre bloqueo. Lo que no veo es lo que viene después.',
        'Vale. Una partida. Luego, siesta.',
      ],
      classic: [
        'Nueve casillas. Me sentaré en la que tú quieras.',
        'Clásico. Como un rayo de sol en el alféizar.',
      ],
      grid: ['Un tablero más grande solo significa más sitios donde bloquearte.'],
      misere: [
        'No hagas tres en línea. Yo nunca hago nada. Fácil.',
        'Misère. Mi favorito. No hacer nada es un arte.',
      ],
      vanish: ['Tus marcas también desaparecen. Así ni siquiera tengo que bloquearlas.'],
      gravity: [
        'Las cosas caen. Yo siempre caigo de pie.',
        'Apilar columnas. Como tirar tazas de la mesa, pero al revés.',
      ],
      ultimate: ['Nueve tableros donde bloquearte. Purr.'],
      gomoku: ['¿Cinco en línea en un tablero tan grande? Estaré en todas partes.'],
    },
    rematch: [
      '¿Otra? No había terminado la siesta.',
      '¿Vuelves a por más bloqueos? Vale.',
      'Revancha. Bloquearé lo mismo, pero más rápido.',
    ],
    bossIntro: [
      'Este es mi tejado. En mi tejado nadie hace línea.',
      'Siete vidas. Tendrás que ganarme al menos una vez.',
      'He bloqueado todo lo que has intentado. Esfuérzate más.',
    ],
    firstThreat: ['Te toca. Elige bien.', 'Uy, ¿he hecho una línea? Ha sido sin querer.'],
    threat: [
      'Quita las zarpas de esa casilla.',
      'Mrrrau.',
      'Esa es mía. A no ser que la bloquees.',
    ],
    fork: ['¿Dos? Mm. No suelo atacar. No te acostumbres.', 'Mira eso. Hasta yo sé hacer dos.'],
    blocked: [
      'Bloqueado. Obviamente.',
      'Zarpazo.',
      'Me he sentado encima. Ahora la casilla es mía.',
      '¿Ibas a ponerla ahí? Yo ya estaba.',
    ],
    signature: [
      'Zarpazo. Tu lineíta ha desaparecido.',
      'Ahogo las líneas antes de que ronroneen.',
      'Eso iba a ser una amenaza. Iba.',
    ],
    worry: ['Lo he visto. Probablemente.', 'Fff.', 'Hmpf. Ahora mismo lo bloqueo.'],
    playerFork: [
      'Dos amenazas a la vez es trampa. (No lo es.)',
      'Solo puedo sentarme en una casilla. Qué grosería.',
      '¡Fff! ¿De dónde ha salido la segunda?',
    ],
    comeback: [
      '¿Ves? Lo he bloqueado todo. Ahora me toca a mí.',
      'Purr. Vuelvo a tener el control.',
    ],
    nearLoss: ['No me gusta por dónde va esto.', 'Se me mueve la cola. Mala señal.'],
    win: [
      'Miaugnífico. ¿Lo intentas otra vez?',
      'Te has metido en mi siesta. No lo hagas.',
      'Mía. Como siempre.',
    ],
    loss: [
      'Hmpf. Dos amenazas a la vez es trampa. (No lo es.)',
      'Vale. Has encontrado la casilla en la que no estaba sentado.',
      'Estaré en el alféizar. Enfurruñado.',
    ],
    draw: [
      'Aquí no pasa nadie. Justo como me gusta.',
      'Empate. Lo he bloqueado todo. Como prometí.',
      'Tablas. Purr.',
    ],
  },

  sage: {
    greeting: {
      any: [
        'Veo tres jugadas por delante. Pon tus trampas más lejos.',
        'Las reglas nuevas son viejos patrones con plumas nuevas.',
      ],
      classic: ['Hasta nueve casillas guardan toda una vida de lecciones.'],
      grid: [
        'El centro de un tablero vale más que sus bordes. Recuérdalo.',
        'Cuatro en línea. Construye formas, no líneas.',
      ],
      misere: ['En misère, el jugador paciente gana haciendo menos.'],
      vanish: [
        'Una línea que pasa por una marca que se desvanece no es línea.',
        'Vigila cuál de tus marcas se marcha. Yo siempre lo hago.',
      ],
      gravity: ['Cada columna es una promesa. Cuenta quién cumple la suya.'],
      ultimate: [
        'Cada casilla que eliges me envía a algún sitio. Elige con sabiduría.',
        'Nueve tableros. Primero el central, como siempre.',
      ],
      gomoku: ['En un tablero amplio, la paciencia es un arma.'],
    },
    rematch: [
      'Otra vez. Bien. La repetición es la madre de la destreza.',
      'Veamos qué has aprendido. Uuh.',
      'En la segunda partida se nota la lección.',
    ],
    bossIntro: [
      'Has llegado lejos. Ahora demuéstrame que puedes ver más lejos.',
      'El roble lleva cien años en pie. Veamos si puedes moverlo.',
      'Yo defenderé el centro. Tendrás que rodearme.',
    ],
    firstThreat: ['Piensa en las consecuencias.', 'Una pequeña pregunta que debes responder.'],
    threat: ['Tres jugadas por delante, recuerda.', 'Uuh, uuh.', 'Responde a esta con cuidado.'],
    fork: [
      'Dos caminos, y solo puedes recorrer uno.',
      'La paciencia ha sacado dos amenazas de una sola jugada.',
    ],
    blocked: [
      'Buena idea. No lo bastante buena.',
      'Lo vi venir hace tres jugadas.',
      'Uuh. Cerrado.',
      'La amenaza obvia es la más fácil de parar.',
    ],
    signature: [
      'El centro resiste.',
      'Tomo el centro. Todo lo demás viene después.',
      'Desde el centro, todas las líneas son mías para elegir.',
    ],
    worry: ['Interesante…', 'Una jugada meditada.', 'Déjame pensarlo.'],
    playerFork: [
      'Ah. Dos a la vez. Bien construido.',
      'Tú has mirado cuatro jugadas por delante. Yo, tres.',
    ],
    comeback: ['La marea cambia. Como siempre.', 'La paciencia ha dado fruto. Uuh.'],
    nearLoss: ['Veo el final. No es el mío.', 'Una combinación excelente. No la vi venir.'],
    win: [
      'La paciencia gana partidas. Uuh.',
      'Tú jugabas contra el tablero. Yo jugaba contra ti.',
      'Mira otra vez la cuarta jugada. Ahí se decidió la partida.',
    ],
    loss: [
      'Una combinación excelente. No la vi venir.',
      'El alumno sorprende al maestro. Bien.',
      'Cuatro jugadas por delante. Tendré que mirar más lejos.',
    ],
    draw: [
      'Equilibrio. Ninguno de los dos ha errado.',
      'Un empate es una lección que aprenden los dos jugadores.',
      'Igualados. Uuh. Llamémoslo sabiduría.',
    ],
  },

  bruno: {
    greeting: {
      any: [
        'Tableros grandes, planes grandes. No dejes un cuatro abierto por ahí.',
        'Partida nueva, mismo plan: construir más que tú.',
      ],
      classic: ['Tablero pequeño. Aun así encontraré sitio para construir.'],
      grid: ['Mucho espacio. Me gusta el espacio. Espacio para líneas.'],
      misere: ['¿No construir? Es lo único que sé hacer.'],
      vanish: ['¿Mis marcas se caen? Pues construiré más rápido.'],
      gravity: [
        '¡A apilar! Las columnas son torres a punto de nacer.',
        'La gravedad está de mi parte. Peso mucho.',
      ],
      ultimate: ['Nueve tableros, nueve obras.'],
      gomoku: [
        'Esto SÍ es un tablero. Hay sitio para la línea más grande que hayas visto.',
        'Quince por quince. Grrr. Ya huelo los cuatros.',
      ],
    },
    rematch: [
      '¿Vuelves a por más? Tengo más.',
      'Segundo asalto. Construyo más rápido cuando tengo hambre.',
      '¡Otra! Líneas más grandes esta vez.',
    ],
    bossIntro: [
      'Has llegado a mi bosque. Nadie se va sin un abrazo de oso.',
      'He guardado mi mejor construcción para ti.',
      'Cada árbol de este bosque es una línea que terminé.',
    ],
    firstThreat: ['He encontrado un hueco. Ahora es mío.', 'Ahí va la primera. Vienen más.'],
    threat: ['¡A apilar!', 'Grrr.', 'Bloquea esa. Y la siguiente.', 'Otro ladrillo.'],
    fork: [
      'Dos líneas y solo uno de ti. Grrrandioso.',
      '¡Embestida de oso! Elige cuál bloqueas.',
      'He construido dos a la vez. Los osos sabemos hacer eso.',
    ],
    blocked: [
      'Bloqueado. Creo.',
      '¡Manotazo!',
      'Esa no. Necesito ese espacio.',
      'No puedes construir a través de un oso.',
    ],
    signature: [
      '¡Más larga! ¡Siempre más larga!',
      'Embestida de oso. Sígueme el ritmo.',
      'Nunca dejo de construir. Nunca.',
    ],
    worry: ['Uf. Gran jugada.', 'Estás construyendo algo.', 'Mmm. Esa sí es una línea de verdad.'],
    playerFork: [
      '¡¿Dos?! Has construido más que un oso.',
      'Grr. No puedo bloquear las dos. ¿O sí?',
      'Ahora juegas a mi juego.',
    ],
    comeback: [
      'De vuelta arriba. Donde deben estar los osos.',
      'Me lo he sacudido. A construir otra vez.',
    ],
    nearLoss: ['Uf. Lo veo. Es una línea enorme.', 'Esto va a doler.'],
    win: [
      'Grrrandiosa partida. Para mí.',
      'Gana la línea más grande. Y era la mía.',
      '¡Abrazo de oso! Nadie escapa del abrazo de oso.',
    ],
    loss: [
      'Has construido más que yo. Respeto.',
      'Vaya. Has bloqueado todo lo que he construido.',
      'Buena partida. Voy a comer un poco de miel para superarlo.',
    ],
    draw: [
      '¿Nadie ha terminado? Demasiados muros.',
      'Tablas. Los osos las odiamos.',
      'Tanto construir y nada que enseñar. Grr.',
    ],
  },

  vex: {
    greeting: {
      any: [
        'Cada jugada tranquila mía es una trampa. Todas.',
        '¿Reglas nuevas? Trampas nuevas. El mismo zorro.',
      ],
      classic: ['Nueve casillas. Nueve sitios donde esconder algo.'],
      grid: ['Mucho sitio para algo que no vas a notar.'],
      misere: ['¿Obligarte a completar una línea? Es mi clase de trampa favorita.'],
      vanish: [
        'Tu marca más antigua está a punto de irse. ¿Se te había olvidado?',
        'Con juego perfecto, Desvanecer se gana en trece jugadas. Sé cuáles.',
      ],
      gravity: ['La casilla bajo mi amenaza te toca llenarla a ti. Tarde o temprano.'],
      ultimate: [
        'Te mandaré a un sitio precioso. No te va a gustar.',
        'Cada casilla es una dirección. Sé adónde lleva cada una.',
      ],
      gomoku: ['Tablero grande. Muchos rincones tranquilos para un zorro.'],
    },
    rematch: [
      'Demasiado lento, demasiado amable. ¿Otra?',
      '¿Ya de vuelta? Las trampas están listas otra vez.',
      '¿Otra? Tengo trucos nuevos. Algunos son los de siempre.',
    ],
    bossIntro: [
      'Te doy la bienvenida a la madriguera. Mira dónde pisas.',
      'Has superado mis trampas. Ahora prueba las que no te enseñé.',
      'Todo lo que ves aquí es cebo.',
    ],
    firstThreat: ['¿Esa la viste venir?', 'Algo con lo que entretenerte.', 'Ahí. Responde.'],
    threat: ['Tic, tac.', 'Otra trampita.', 'Y otra.', 'Qué ajetreo.'],
    fork: [
      'Zas. Dos a la vez.',
      '¿Esa jugada tranquila? Tenía dientes.',
      'Trampa de zorro. Elige qué pata.',
    ],
    blocked: [
      'Qué mono.',
      'Te he dejado esa. No, en serio.',
      'Cerrado. Se te veía venir.',
      'Bloqueado. Era cebo, por cierto.',
    ],
    signature: [
      'Jugada tranquila. Cuenta las líneas que pasan por ella.',
      'Aquí no hay nada que ver. Todavía.',
      'Esa importará dentro de tres jugadas.',
    ],
    worry: ['No está mal. No basta.', 'Te lo permito.', 'Mm. Estás prestando atención.'],
    playerFork: [
      'Ay, ¿me has puesto una trampa? ¿A mí? Qué descaro.',
      'Dos amenazas. Qué astucia. Qué irritante astucia.',
      'Vaya. Ese truco es mío.',
    ],
    comeback: ['Y el zorro se escabulle.', 'Casi me tenías. Casi.'],
    nearLoss: ['Ah. Lo veo. Odio verlo.', 'Mm. La trampa era tuya.'],
    win: [
      'Demasiado lento, demasiado amable. ¿Otra?',
      'Zas. Cada jugada tranquila, ¿recuerdas?',
      'Lo tenías delante de las narices. Dos veces.',
    ],
    loss: [
      'Qué astucia. Qué irritante astucia.',
      'Has encontrado la trampa detrás de la trampa.',
      'Vale. Te has ganado una visita a mi madriguera.',
    ],
    draw: [
      '¿Un empate? No ha saltado ninguna trampa.',
      'Tablas. Qué poco zorruno.',
      'Los dos lo hemos visto todo. Qué aburrido.',
    ],
  },

  nyx: {
    greeting: {
      any: ['Ya he visto cómo termina esto.', 'Llegas. Tal como lo previ.'],
      classic: ['Nueve casillas. He visto todas las partidas que caben en ellas.'],
      grid: ['Cada línea de este tablero ya la he recorrido.'],
      misere: ['Llenarás la última casilla. Siempre lo haces.'],
      vanish: ['Todo se desvanece. Tus marcas, primero.'],
      gravity: [
        'He contado cada casilla de cada columna. Dos veces.',
        'Abajo, siempre abajo. Como todo.',
      ],
      ultimate: ['Nueve tableros. Ochenta y un caminos. Un solo final.'],
      gomoku: ['Quince por quince. Sitio de sobra para que te pierdas.'],
    },
    rematch: ['Otra vez. El final no cambiará.', 'Vuelves. Siempre vuelven.'],
    bossIntro: [
      'Este es el último tablero. Ya he visto tu derrota en él.',
      'Todo lo que has aprendido te ha traído hasta aquí. No bastará.',
      'Esta noche el velo es fino. Crúzalo.',
    ],
    firstThreat: ['Inevitable.', 'El primer hilo. Tira de él.'],
    threat: ['Llegas tres jugadas tarde.', 'Veo todos los finales.', 'Otro hilo.'],
    fork: ['Dos finales. Ambos míos.', 'No puedes contener los dos.'],
    blocked: ['No.', 'Previsto. Cerrado.', 'Ese final no ocurre.', 'Disuelto.'],
    signature: [
      'Ya veo el final. Cuenta las jugadas conmigo.',
      'Forzado. Desde aquí, todos los caminos son míos.',
      'El final está escrito. Puedes leerlo jugada a jugada.',
    ],
    worry: ['…', 'Inesperado.', 'Una onda en el patrón.'],
    playerFork: ['…Dos. No vi dos.', 'El patrón se rompe.'],
    comeback: ['El patrón se recompone.', 'Como siempre iba a ocurrir.'],
    nearLoss: ['…Veo un final que no es mío.', 'Conque esto es sorprenderse.'],
    win: [
      'Tal como lo previ.',
      'Ha terminado donde dije que terminaría.',
      'Otra vez, si quieres. Terminará igual.',
    ],
    loss: [
      '…Eso no lo previ. Bien jugado.',
      'Te has salido del patrón. Notable.',
      'El velo se alza. Has visto más lejos que yo.',
    ],
    draw: [
      'Equilibrio. También lo previ. Casi.',
      'No llegó ningún final. Curioso.',
      'El patrón se mantiene. Para los dos.',
    ],
  },
};
