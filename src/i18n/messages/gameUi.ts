import { defineMessages } from '@/i18n';

/**
 * The game screens' shared furniture: the controls under the board, the
 * restart prompt, the hint legend, the mode picker, the seat cards, the star
 * row and the unlock toast.
 */
export const gameUiMessages = defineMessages({
  en: {
    takeBack: 'Take back the last move',
    playAgain: 'Play again',
    backHome: 'Back to home',

    resetTitle: 'Start a new round?',
    resetBody: 'This will replace the round you are playing.',
    resetAction: 'New round',
    keepPlaying: 'Keep playing',

    hintWin: 'Win here',
    hintThreat: 'Block here',
    hintBest: 'Suggested move',

    gameMode: 'Game mode',
    groupClassic: 'The classics',
    groupLarge: 'Bigger boards',
    groupVariant: 'Twists',
    ranked: 'Has a ranked ladder',

    you: 'you',
    stars: '{count} of {total} stars',

    level: 'Level {level}',
    skinHint: 'Choose them in Settings',
    cosmeticHint: 'Equip it in your Collection',
  },
  es: {
    takeBack: 'Deshacer la última jugada',
    playAgain: 'Jugar otra vez',
    backHome: 'Volver al inicio',

    resetTitle: '¿Empezar una nueva ronda?',
    resetBody: 'Esto reemplazará la ronda que estás jugando.',
    resetAction: 'Nueva ronda',
    keepPlaying: 'Seguir jugando',

    hintWin: 'Gana aquí',
    hintThreat: 'Bloquea aquí',
    hintBest: 'Jugada sugerida',

    gameMode: 'Modo de juego',
    groupClassic: 'Los clásicos',
    groupLarge: 'Tableros más grandes',
    groupVariant: 'Variantes',
    ranked: 'Tiene clasificación',

    you: 'tú',
    stars: '{count} de {total} estrellas',

    level: 'Nivel {level}',
    skinHint: 'Elígelas en Ajustes',
    cosmeticHint: 'Equípalo en tu Colección',
  },
  fr: {
    takeBack: 'Annuler le dernier coup',
    playAgain: 'Rejouer',
    backHome: 'Retour à l’accueil',

    resetTitle: 'Commencer une nouvelle manche ?',
    resetBody: 'Cela remplacera la manche en cours.',
    resetAction: 'Nouvelle manche',
    keepPlaying: 'Continuer à jouer',

    hintWin: 'Gagnez ici',
    hintThreat: 'Bloquez ici',
    hintBest: 'Coup suggéré',

    gameMode: 'Mode de jeu',
    groupClassic: 'Les classiques',
    groupLarge: 'Plus grands plateaux',
    groupVariant: 'Variantes',
    ranked: 'A un classement',

    you: 'vous',
    stars: { one: '{count} étoile sur {total}', other: '{count} étoiles sur {total}' },

    level: 'Niveau {level}',
    skinHint: 'Choisissez-les dans les Réglages',
    cosmeticHint: 'Équipez-le dans votre Collection',
  },
  de: {
    takeBack: 'Letzten Zug zurücknehmen',
    playAgain: 'Nochmal spielen',
    backHome: 'Zur Startseite',

    resetTitle: 'Neue Runde starten?',
    resetBody: 'Dadurch wird die laufende Runde ersetzt.',
    resetAction: 'Neue Runde',
    keepPlaying: 'Weiterspielen',

    hintWin: 'Hier gewinnen',
    hintThreat: 'Hier blocken',
    hintBest: 'Vorgeschlagener Zug',

    gameMode: 'Spielmodus',
    groupClassic: 'Die Klassiker',
    groupLarge: 'Größere Bretter',
    groupVariant: 'Varianten',
    ranked: 'Mit Rangliste',

    you: 'du',
    stars: '{count} von {total} Sternen',

    level: 'Level {level}',
    skinHint: 'Wähle sie in den Einstellungen',
    cosmeticHint: 'Rüste es in deiner Sammlung aus',
  },
  fa: {
    takeBack: 'پس گرفتن آخرین حرکت',
    playAgain: 'دوباره بازی کن',
    backHome: 'بازگشت به خانه',

    resetTitle: 'دست تازه‌ای شروع کنی؟',
    resetBody: 'دستی که در حال بازی‌اش هستی جایگزین می‌شود.',
    resetAction: 'دست تازه',
    keepPlaying: 'ادامهٔ بازی',

    hintWin: 'اینجا ببر',
    hintThreat: 'اینجا را ببند',
    hintBest: 'حرکت پیشنهادی',

    gameMode: 'حالت بازی',
    groupClassic: 'کلاسیک‌ها',
    groupLarge: 'صفحه‌های بزرگ‌تر',
    groupVariant: 'گونه‌ها',
    ranked: 'ردهٔ رقابتی دارد',

    you: 'تو',
    stars: '{count} از {total} ستاره',

    level: 'سطح {level}',
    skinHint: 'در تنظیمات انتخابشان کن',
    cosmeticHint: 'در مجموعه‌ات به کارش ببر',
  },
});
