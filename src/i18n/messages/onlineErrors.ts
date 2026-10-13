import { currentLocale, defineMessages, type Locale, translate, useLocale } from '@/i18n';

/**
 * What the server's refusals say, in the interface language.
 *
 * The server writes its messages in English and tags each with an error code.
 * A message this catalog knows word for word gets its own translation; any
 * other message is explained by its code; and only a code this client has
 * never heard of shows the server's English as it came. In English the
 * server's own words are shown, being the most specific there are.
 */
const english = {
  // By code, for a message the client does not know word for word.
  badMessage: 'Something went wrong talking to the server.',
  versionMismatch: 'Please reload to get the latest version.',
  unauthorized: 'Those credentials are not valid.',
  roomNotFound: 'No game with that code.',
  roomFull: 'That game already has two players.',
  notInRoom: 'You are not in a game.',
  notYourTurn: 'It is not your turn.',
  illegalMove: 'That move is not allowed here.',
  rateLimited: 'Slow down.',
  serverFull: 'The server is busy. Try again in a moment.',
  notRankable: 'Only the standard modes have a ladder.',
  alreadyPlaying: 'This account was opened somewhere else.',
  tournamentUnavailable: 'That tournament cannot be joined right now.',
  banned: 'This account is suspended.',
  forbidden: 'That is not allowed for this account.',
  // Raised by the client itself.
  resumeLost: 'The connection dropped and the game could not be resumed.',
  // Word for word, for the server messages that say more than their code.
  introduceFirst: 'Introduce yourself first.',
  challengesUnavailable: 'Challenges are not available here.',
  alreadyIntroduced: 'Already introduced.',
  unknownGame: 'That is not a game we know how to run.',
  hostAway: 'The host of that game is not here right now.',
  watchersFull: 'That game has as many watchers as it will take.',
  matchOver: 'This match is over.',
  tournamentsOff: 'Tournaments are not running on this server.',
  textFrame: 'Expected a text frame.',
  unrecognised: 'Unrecognised message.',
  serverError: 'Server error.',
  challengeMuted: 'Your account cannot send challenges right now.',
  hostOnly: 'Only the host can start this bracket.',
  bracketTooSmall: 'A bracket needs at least two players to start.',
} as const;

export const onlineErrorMessages = defineMessages({
  en: english,
  es: {
    badMessage: 'Algo salió mal al comunicarse con el servidor.',
    versionMismatch: 'Recarga para obtener la última versión.',
    unauthorized: 'Esas credenciales no son válidas.',
    roomNotFound: 'No hay ninguna partida con ese código.',
    roomFull: 'Esa partida ya tiene dos jugadores.',
    notInRoom: 'No estás en ninguna partida.',
    notYourTurn: 'No es tu turno.',
    illegalMove: 'Esa jugada no está permitida aquí.',
    rateLimited: 'Más despacio.',
    serverFull: 'El servidor está ocupado. Inténtalo de nuevo en un momento.',
    notRankable: 'Solo los modos estándar tienen clasificación.',
    alreadyPlaying: 'Esta cuenta se ha abierto en otro lugar.',
    tournamentUnavailable: 'No es posible unirse a ese torneo ahora mismo.',
    banned: 'Esta cuenta está suspendida.',
    forbidden: 'Esta cuenta no tiene permiso para hacer eso.',
    resumeLost: 'Se perdió la conexión y no se pudo reanudar la partida.',
    introduceFirst: 'Primero preséntate.',
    challengesUnavailable: 'Los desafíos no están disponibles aquí.',
    alreadyIntroduced: 'Ya te has presentado.',
    unknownGame: 'No sabemos cómo ejecutar ese juego.',
    hostAway: 'El anfitrión de esa partida no está aquí ahora mismo.',
    watchersFull: 'Esa partida ya tiene todos los espectadores que admite.',
    matchOver: 'Esta partida ha terminado.',
    tournamentsOff: 'Este servidor no tiene torneos activos.',
    textFrame: 'Se esperaba un mensaje de texto.',
    unrecognised: 'Mensaje no reconocido.',
    serverError: 'Error del servidor.',
    challengeMuted: 'Tu cuenta no puede enviar desafíos ahora mismo.',
    hostOnly: 'Solo el anfitrión puede iniciar este cuadro.',
    bracketTooSmall: 'Un cuadro necesita al menos dos jugadores para empezar.',
  },
  fr: {
    badMessage: 'Un problème est survenu en communiquant avec le serveur.',
    versionMismatch: 'Rechargez pour obtenir la dernière version.',
    unauthorized: 'Ces identifiants ne sont pas valides.',
    roomNotFound: 'Aucune partie avec ce code.',
    roomFull: 'Cette partie a déjà deux joueurs.',
    notInRoom: 'Vous n’êtes dans aucune partie.',
    notYourTurn: 'Ce n’est pas votre tour.',
    illegalMove: 'Ce coup n’est pas autorisé ici.',
    rateLimited: 'Doucement.',
    serverFull: 'Le serveur est occupé. Réessayez dans un instant.',
    notRankable: 'Seuls les modes standard ont un classement.',
    alreadyPlaying: 'Ce compte a été ouvert ailleurs.',
    tournamentUnavailable: 'Impossible de rejoindre ce tournoi pour le moment.',
    banned: 'Ce compte est suspendu.',
    forbidden: 'Ce n’est pas autorisé pour ce compte.',
    resumeLost: 'La connexion a été perdue et la partie n’a pas pu reprendre.',
    introduceFirst: 'Présentez-vous d’abord.',
    challengesUnavailable: 'Les défis ne sont pas disponibles ici.',
    alreadyIntroduced: 'Déjà présenté.',
    unknownGame: 'Nous ne savons pas faire tourner ce jeu.',
    hostAway: 'L’hôte de cette partie n’est pas là pour le moment.',
    watchersFull: 'Cette partie a atteint son nombre maximal de spectateurs.',
    matchOver: 'Ce match est terminé.',
    tournamentsOff: 'Ce serveur n’organise pas de tournois.',
    textFrame: 'Un message texte était attendu.',
    unrecognised: 'Message non reconnu.',
    serverError: 'Erreur du serveur.',
    challengeMuted: 'Votre compte ne peut pas envoyer de défis pour le moment.',
    hostOnly: 'Seul l’hôte peut lancer ce tableau.',
    bracketTooSmall: 'Un tableau a besoin d’au moins deux joueurs pour commencer.',
  },
  de: {
    badMessage: 'Bei der Verbindung zum Server ist etwas schiefgelaufen.',
    versionMismatch: 'Bitte neu laden, um die neueste Version zu erhalten.',
    unauthorized: 'Diese Zugangsdaten sind ungültig.',
    roomNotFound: 'Kein Spiel mit diesem Code.',
    roomFull: 'Dieses Spiel hat bereits zwei Spieler.',
    notInRoom: 'Du bist in keinem Spiel.',
    notYourTurn: 'Du bist nicht am Zug.',
    illegalMove: 'Dieser Zug ist hier nicht erlaubt.',
    rateLimited: 'Nicht so schnell.',
    serverFull: 'Der Server ist ausgelastet. Versuche es gleich noch einmal.',
    notRankable: 'Nur die Standardmodi haben eine Rangliste.',
    alreadyPlaying: 'Dieses Konto wurde an einem anderen Ort geöffnet.',
    tournamentUnavailable: 'Diesem Turnier kann gerade nicht beigetreten werden.',
    banned: 'Dieses Konto ist gesperrt.',
    forbidden: 'Das ist für dieses Konto nicht erlaubt.',
    resumeLost: 'Die Verbindung ist abgebrochen, und das Spiel konnte nicht fortgesetzt werden.',
    introduceFirst: 'Stell dich zuerst vor.',
    challengesUnavailable: 'Herausforderungen sind hier nicht verfügbar.',
    alreadyIntroduced: 'Bereits vorgestellt.',
    unknownGame: 'Dieses Spiel können wir nicht ausführen.',
    hostAway: 'Der Gastgeber dieses Spiels ist gerade nicht da.',
    watchersFull: 'Dieses Spiel hat bereits so viele Zuschauer, wie es zulässt.',
    matchOver: 'Dieses Match ist vorbei.',
    tournamentsOff: 'Auf diesem Server laufen keine Turniere.',
    textFrame: 'Textnachricht erwartet.',
    unrecognised: 'Unbekannte Nachricht.',
    serverError: 'Serverfehler.',
    challengeMuted: 'Dein Konto kann gerade keine Herausforderungen senden.',
    hostOnly: 'Nur der Gastgeber kann dieses Turnier starten.',
    bracketTooSmall: 'Ein Turnierbaum braucht mindestens zwei Spieler zum Start.',
  },
  fa: {
    badMessage: 'در ارتباط با سرور مشکلی پیش آمد.',
    versionMismatch: 'برای دریافت آخرین نسخه، صفحه را دوباره بارگذاری کن.',
    unauthorized: 'این اطلاعات ورود معتبر نیست.',
    roomNotFound: 'بازی‌ای با این کد وجود ندارد.',
    roomFull: 'این بازی از قبل دو بازیکن دارد.',
    notInRoom: 'در هیچ بازی‌ای نیستی.',
    notYourTurn: 'نوبت تو نیست.',
    illegalMove: 'این حرکت اینجا مجاز نیست.',
    rateLimited: 'کمی آهسته‌تر.',
    serverFull: 'سرور شلوغ است. کمی بعد دوباره امتحان کن.',
    notRankable: 'فقط حالت‌های استاندارد جدول رده‌بندی دارند.',
    alreadyPlaying: 'این حساب در جای دیگری باز شد.',
    tournamentUnavailable: 'الان نمی‌شود به این مسابقات پیوست.',
    banned: 'این حساب تعلیق شده است.',
    forbidden: 'این کار برای این حساب مجاز نیست.',
    resumeLost: 'اتصال قطع شد و بازی ادامه پیدا نکرد.',
    introduceFirst: 'اول خودت را معرفی کن.',
    challengesUnavailable: 'چالش اینجا در دسترس نیست.',
    alreadyIntroduced: 'قبلاً معرفی شده‌ای.',
    unknownGame: 'نمی‌دانیم این بازی را چطور اجرا کنیم.',
    hostAway: 'میزبان این بازی الان اینجا نیست.',
    watchersFull: 'ظرفیت تماشاگران این بازی پر است.',
    matchOver: 'این مسابقه تمام شده است.',
    tournamentsOff: 'روی این سرور مسابقاتی برگزار نمی‌شود.',
    textFrame: 'انتظار یک پیام متنی می‌رفت.',
    unrecognised: 'پیام ناشناخته.',
    serverError: 'خطای سرور.',
    challengeMuted: 'حساب تو الان نمی‌تواند چالش بفرستد.',
    hostOnly: 'فقط میزبان می‌تواند این جدول حذفی را شروع کند.',
    bracketTooSmall: 'جدول حذفی برای شروع دست‌کم دو بازیکن لازم دارد.',
  },
});

type ErrorKey = keyof typeof english;

const byEnglish = new Map<string, ErrorKey>(
  (Object.entries(english) as [ErrorKey, string][]).map(([key, text]) => [text, key]),
);

/**
 * The text to show for a server error. `code` is the server's error code (or
 * one the client raised itself, like `resumeLost`); `message` is the English
 * that came with it.
 */
export function onlineErrorText(
  code: string | null,
  message: string,
  locale: Locale = currentLocale(),
): string {
  const exact = byEnglish.get(message);
  if (exact) return translate(onlineErrorMessages, exact, undefined, locale);
  // English keeps the server's own words; other languages explain the code.
  if (locale !== 'en' && code && code in english) {
    return translate(onlineErrorMessages, code as ErrorKey, undefined, locale);
  }
  return message;
}

/** {@link onlineErrorText}, re-rendering when the language changes. */
export function useOnlineErrorText(): (code: string | null, message: string) => string {
  const locale = useLocale();
  return (code, message) => onlineErrorText(code, message, locale);
}
