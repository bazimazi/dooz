import { defineMessages } from '@/i18n';

/** The app's frame: a link to nowhere, a screen that broke, and the logo's name. */
export const routeMessages = defineMessages({
  en: {
    notFoundTitle: 'Nothing here',
    notFoundText:
      'That link does not point at a screen in this app. It may have been a room that has since closed.',
    backHome: 'Back to home',
    errorTitle: 'Something broke',
    errorText: 'An unexpected error stopped this screen from loading.',
    reload: 'Reload',
    home: 'Home',
    logo: 'dooz - tic tac toe',
  },
  es: {
    notFoundTitle: 'Aquí no hay nada',
    notFoundText:
      'Ese enlace no lleva a ninguna pantalla de esta app. Puede que fuera una sala que ya se ha cerrado.',
    backHome: 'Volver al inicio',
    errorTitle: 'Algo se ha roto',
    errorText: 'Un error inesperado impidió que se cargara esta pantalla.',
    reload: 'Recargar',
    home: 'Inicio',
    logo: 'dooz - tres en raya',
  },
  fr: {
    notFoundTitle: 'Rien ici',
    notFoundText:
      'Ce lien ne mène à aucun écran de cette appli. C’était peut-être un salon fermé depuis.',
    backHome: 'Retour à l’accueil',
    errorTitle: 'Quelque chose s’est cassé',
    errorText: 'Une erreur inattendue a empêché cet écran de se charger.',
    reload: 'Recharger',
    home: 'Accueil',
    logo: 'dooz - morpion',
  },
  de: {
    notFoundTitle: 'Hier ist nichts',
    notFoundText:
      'Dieser Link führt zu keinem Bildschirm dieser App. Vielleicht war es ein Raum, der inzwischen geschlossen ist.',
    backHome: 'Zurück zum Start',
    errorTitle: 'Etwas ist kaputtgegangen',
    errorText: 'Ein unerwarteter Fehler hat das Laden dieses Bildschirms verhindert.',
    reload: 'Neu laden',
    home: 'Start',
    logo: 'dooz - Tic-Tac-Toe',
  },
  fa: {
    notFoundTitle: 'اینجا چیزی نیست',
    notFoundText:
      'این پیوند به هیچ صفحه‌ای در این برنامه نمی‌رسد. شاید اتاقی بوده که دیگر بسته شده است.',
    backHome: 'بازگشت به خانه',
    errorTitle: 'مشکلی پیش آمد',
    errorText: 'خطایی غیرمنتظره مانع بارگذاری این صفحه شد.',
    reload: 'بارگذاری دوباره',
    home: 'خانه',
    logo: 'dooz - دوز',
  },
});
