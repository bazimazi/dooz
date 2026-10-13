import { currentLocale, defineMessages, type Locale, translate } from '@/i18n';
import { ApiError } from '@/lib/api';

/**
 * What a failed HTTP call says, in the interface language.
 *
 * The client's own messages and the server's `error` texts are English. One
 * this catalog knows word for word gets its translation; any other is
 * explained by its HTTP status; and in English the text is shown as it came.
 */
const english = {
  // Raised by the client (src/lib/api.ts and the stores).
  offline: 'Connect to the internet to download this data',
  unreachable: 'Could not reach the server',
  incomplete: 'Could not finish downloading this data',
  somethingWrong: 'Something went wrong',
  unexpected: 'The server sent something unexpected',

  // Sent by the server.
  backupFailed: 'Backup failed - see the server log',
  backupsOff: 'Backups are off',
  cannotBlock: 'Cannot block',
  invalidBatch: 'Invalid batch',
  invalidRequest: 'Invalid request',
  invalidSave: 'Invalid save',
  invalidSubscriptionKeys: 'Invalid subscription keys',
  invalidSubscription: 'Invalid subscription',
  noSuchRequest: 'No such request, or a friends list is full',
  noSuchSeason: 'No such season',
  notFound: 'Not found',
  notificationsOff: 'Notifications are not set up on this server',
  passwordTooShort: 'Password must be at least 8 characters',
  saveTooLarge: 'Save too large',
  slowDown: 'Slow down',
  nameCodeMismatch: 'That name and code did not match',
  nameTakenAlready: 'That name is already taken',
  nameNotAllowed: 'That name is not allowed. Please choose another.',
  nameTaken: 'That name is taken',
  detailsMismatch: 'Those details did not match an account',
  tooManyAccounts: 'Too many accounts from here',
  tooManyAttemptsName: 'Too many attempts for that name. Try again later.',
  tooManyAttemptsHere: 'Too many attempts from here',
  tooManyAttempts: 'Too many attempts',
  tooManyExports: 'Too many exports - try again later',
  tooManyRequests: 'Too many requests',
  typeNameToConfirm: 'Type your display name to confirm',
  unauthorized: 'Unauthorized',
  unsupportedPush: 'Unsupported push service',
  notInMatch: 'You were not in that match',
  friendRequestsMuted: 'Your account cannot send friend requests right now',
  invitationsMuted: 'Your account cannot send invitations right now',
  ownCode: 'That is your own code',
  noPlayerWithCode: 'No player with that code',
  youBlocked: 'You have blocked this player',
  alreadyFriends: 'You are already friends',
  requestPending: 'Request already sent',
  friendLimit: 'Too many friends or pending requests',
  onlyFriends: 'You can only invite friends',
  tooManyGames: 'Too many games in progress',
  unknownGame: 'That is not a game we know how to run',
  notYourTurn: 'It is not your turn',
  illegalMove: 'That move is not allowed here',
  stale: 'The game has moved on - refresh and try again',
  gameOver: 'This game is over',
  notAllowed: 'Not allowed',
  suspended: 'This account has been suspended.',
  suspendedShort: 'Suspended',
  /** "until 2026-05-01 18:00 UTC", the date kept as the server wrote it. */
  suspendedUntil: 'This account is suspended until {until} UTC.',

  // By HTTP status, for a message not listed above.
  status400: 'The server could not accept that request.',
  status401: 'Your sign-in has expired. Please sign in again.',
  status403: 'That is not allowed for this account.',
  status404: 'That could not be found.',
  status409: 'That clashes with something that changed. Refresh and try again.',
  status413: 'That is too large to send.',
  status429: 'Too many attempts. Try again later.',
  status5xx: 'The server ran into a problem. Try again in a moment.',
} as const;

export const apiErrorMessages = defineMessages({
  en: english,
  es: {
    offline: 'Conéctate a internet para descargar estos datos',
    unreachable: 'No se pudo conectar con el servidor',
    incomplete: 'No se pudieron terminar de descargar estos datos',
    somethingWrong: 'Algo salió mal',
    unexpected: 'El servidor envió algo inesperado',
    backupFailed: 'La copia de seguridad falló; consulta el registro del servidor',
    backupsOff: 'Las copias de seguridad están desactivadas',
    cannotBlock: 'No se puede bloquear',
    invalidBatch: 'Lote no válido',
    invalidRequest: 'Solicitud no válida',
    invalidSave: 'Partida guardada no válida',
    invalidSubscriptionKeys: 'Claves de suscripción no válidas',
    invalidSubscription: 'Suscripción no válida',
    noSuchRequest: 'No existe esa solicitud, o una lista de amigos está llena',
    noSuchSeason: 'No existe esa temporada',
    notFound: 'No encontrado',
    notificationsOff: 'Las notificaciones no están configuradas en este servidor',
    passwordTooShort: 'La contraseña debe tener al menos 8 caracteres',
    saveTooLarge: 'La partida guardada es demasiado grande',
    slowDown: 'Más despacio',
    nameCodeMismatch: 'Ese nombre y ese código no coinciden',
    nameTakenAlready: 'Ese nombre ya está en uso',
    nameNotAllowed: 'Ese nombre no está permitido. Elige otro.',
    nameTaken: 'Ese nombre está ocupado',
    detailsMismatch: 'Esos datos no coinciden con ninguna cuenta',
    tooManyAccounts: 'Demasiadas cuentas desde aquí',
    tooManyAttemptsName: 'Demasiados intentos con ese nombre. Inténtalo más tarde.',
    tooManyAttemptsHere: 'Demasiados intentos desde aquí',
    tooManyAttempts: 'Demasiados intentos',
    tooManyExports: 'Demasiadas exportaciones; inténtalo más tarde',
    tooManyRequests: 'Demasiadas solicitudes',
    typeNameToConfirm: 'Escribe tu nombre visible para confirmar',
    unauthorized: 'No autorizado',
    unsupportedPush: 'Servicio de notificaciones no compatible',
    notInMatch: 'No participaste en esa partida',
    friendRequestsMuted: 'Tu cuenta no puede enviar solicitudes de amistad ahora mismo',
    invitationsMuted: 'Tu cuenta no puede enviar invitaciones ahora mismo',
    ownCode: 'Ese es tu propio código',
    noPlayerWithCode: 'No hay ningún jugador con ese código',
    youBlocked: 'Has bloqueado a este jugador',
    alreadyFriends: 'Ya sois amigos',
    requestPending: 'Solicitud ya enviada',
    friendLimit: 'Demasiados amigos o solicitudes pendientes',
    onlyFriends: 'Solo puedes invitar a amigos',
    tooManyGames: 'Demasiadas partidas en curso',
    unknownGame: 'No sabemos cómo ejecutar ese juego',
    notYourTurn: 'No es tu turno',
    illegalMove: 'Esa jugada no está permitida aquí',
    stale: 'La partida ha avanzado; actualiza e inténtalo de nuevo',
    gameOver: 'Esta partida ha terminado',
    notAllowed: 'No permitido',
    suspended: 'Esta cuenta ha sido suspendida.',
    suspendedShort: 'Suspendida',
    suspendedUntil: 'Esta cuenta está suspendida hasta el {until} UTC.',
    status400: 'El servidor no pudo aceptar esa solicitud.',
    status401: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    status403: 'Esta cuenta no tiene permiso para hacer eso.',
    status404: 'No se encontró.',
    status409: 'Algo ha cambiado mientras tanto. Actualiza e inténtalo de nuevo.',
    status413: 'Es demasiado grande para enviarlo.',
    status429: 'Demasiados intentos. Inténtalo más tarde.',
    status5xx: 'El servidor tuvo un problema. Inténtalo de nuevo en un momento.',
  },
  fr: {
    offline: 'Connectez-vous à Internet pour télécharger ces données',
    unreachable: 'Impossible de joindre le serveur',
    incomplete: 'Impossible de terminer le téléchargement de ces données',
    somethingWrong: 'Un problème est survenu',
    unexpected: 'Le serveur a envoyé une réponse inattendue',
    backupFailed: 'La sauvegarde a échoué — consultez le journal du serveur',
    backupsOff: 'Les sauvegardes sont désactivées',
    cannotBlock: 'Blocage impossible',
    invalidBatch: 'Lot invalide',
    invalidRequest: 'Requête invalide',
    invalidSave: 'Sauvegarde invalide',
    invalidSubscriptionKeys: 'Clés d’abonnement invalides',
    invalidSubscription: 'Abonnement invalide',
    noSuchRequest: 'Demande introuvable, ou une liste d’amis est pleine',
    noSuchSeason: 'Saison introuvable',
    notFound: 'Introuvable',
    notificationsOff: 'Les notifications ne sont pas configurées sur ce serveur',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères',
    saveTooLarge: 'Sauvegarde trop volumineuse',
    slowDown: 'Doucement',
    nameCodeMismatch: 'Ce nom et ce code ne correspondent pas',
    nameTakenAlready: 'Ce nom est déjà pris',
    nameNotAllowed: 'Ce nom n’est pas autorisé. Choisissez-en un autre.',
    nameTaken: 'Ce nom est pris',
    detailsMismatch: 'Ces informations ne correspondent à aucun compte',
    tooManyAccounts: 'Trop de comptes depuis cet endroit',
    tooManyAttemptsName: 'Trop de tentatives pour ce nom. Réessayez plus tard.',
    tooManyAttemptsHere: 'Trop de tentatives depuis cet endroit',
    tooManyAttempts: 'Trop de tentatives',
    tooManyExports: 'Trop d’exportations — réessayez plus tard',
    tooManyRequests: 'Trop de requêtes',
    typeNameToConfirm: 'Saisissez votre nom d’affichage pour confirmer',
    unauthorized: 'Non autorisé',
    unsupportedPush: 'Service de notifications non pris en charge',
    notInMatch: 'Vous n’avez pas participé à ce match',
    friendRequestsMuted: 'Votre compte ne peut pas envoyer de demandes d’ami pour le moment',
    invitationsMuted: 'Votre compte ne peut pas envoyer d’invitations pour le moment',
    ownCode: 'C’est votre propre code',
    noPlayerWithCode: 'Aucun joueur avec ce code',
    youBlocked: 'Vous avez bloqué ce joueur',
    alreadyFriends: 'Vous êtes déjà amis',
    requestPending: 'Demande déjà envoyée',
    friendLimit: 'Trop d’amis ou de demandes en attente',
    onlyFriends: 'Vous ne pouvez inviter que des amis',
    tooManyGames: 'Trop de parties en cours',
    unknownGame: 'Nous ne savons pas faire tourner ce jeu',
    notYourTurn: 'Ce n’est pas votre tour',
    illegalMove: 'Ce coup n’est pas autorisé ici',
    stale: 'La partie a avancé — actualisez et réessayez',
    gameOver: 'Cette partie est terminée',
    notAllowed: 'Non autorisé',
    suspended: 'Ce compte a été suspendu.',
    suspendedShort: 'Suspendu',
    suspendedUntil: 'Ce compte est suspendu jusqu’au {until} UTC.',
    status400: 'Le serveur n’a pas pu accepter cette requête.',
    status401: 'Votre session a expiré. Reconnectez-vous.',
    status403: 'Ce n’est pas autorisé pour ce compte.',
    status404: 'Introuvable.',
    status409: 'Quelque chose a changé entre-temps. Actualisez et réessayez.',
    status413: 'C’est trop volumineux pour être envoyé.',
    status429: 'Trop de tentatives. Réessayez plus tard.',
    status5xx: 'Le serveur a rencontré un problème. Réessayez dans un instant.',
  },
  de: {
    offline: 'Verbinde dich mit dem Internet, um diese Daten herunterzuladen',
    unreachable: 'Server nicht erreichbar',
    incomplete: 'Diese Daten konnten nicht vollständig heruntergeladen werden',
    somethingWrong: 'Etwas ist schiefgelaufen',
    unexpected: 'Der Server hat etwas Unerwartetes gesendet',
    backupFailed: 'Sicherung fehlgeschlagen – siehe Serverprotokoll',
    backupsOff: 'Sicherungen sind ausgeschaltet',
    cannotBlock: 'Blockieren nicht möglich',
    invalidBatch: 'Ungültiger Stapel',
    invalidRequest: 'Ungültige Anfrage',
    invalidSave: 'Ungültiger Spielstand',
    invalidSubscriptionKeys: 'Ungültige Abo-Schlüssel',
    invalidSubscription: 'Ungültiges Abo',
    noSuchRequest: 'Diese Anfrage gibt es nicht, oder eine Freundesliste ist voll',
    noSuchSeason: 'Diese Saison gibt es nicht',
    notFound: 'Nicht gefunden',
    notificationsOff: 'Benachrichtigungen sind auf diesem Server nicht eingerichtet',
    passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen lang sein',
    saveTooLarge: 'Spielstand zu groß',
    slowDown: 'Nicht so schnell',
    nameCodeMismatch: 'Name und Code passen nicht zusammen',
    nameTakenAlready: 'Dieser Name ist bereits vergeben',
    nameNotAllowed: 'Dieser Name ist nicht erlaubt. Bitte wähle einen anderen.',
    nameTaken: 'Dieser Name ist vergeben',
    detailsMismatch: 'Diese Angaben passen zu keinem Konto',
    tooManyAccounts: 'Zu viele Konten von hier',
    tooManyAttemptsName: 'Zu viele Versuche für diesen Namen. Versuche es später erneut.',
    tooManyAttemptsHere: 'Zu viele Versuche von hier',
    tooManyAttempts: 'Zu viele Versuche',
    tooManyExports: 'Zu viele Exporte – versuche es später erneut',
    tooManyRequests: 'Zu viele Anfragen',
    typeNameToConfirm: 'Gib zur Bestätigung deinen Anzeigenamen ein',
    unauthorized: 'Nicht berechtigt',
    unsupportedPush: 'Nicht unterstützter Push-Dienst',
    notInMatch: 'Du warst nicht in diesem Match',
    friendRequestsMuted: 'Dein Konto kann gerade keine Freundschaftsanfragen senden',
    invitationsMuted: 'Dein Konto kann gerade keine Einladungen senden',
    ownCode: 'Das ist dein eigener Code',
    noPlayerWithCode: 'Kein Spieler mit diesem Code',
    youBlocked: 'Du hast diesen Spieler blockiert',
    alreadyFriends: 'Ihr seid bereits befreundet',
    requestPending: 'Anfrage bereits gesendet',
    friendLimit: 'Zu viele Freunde oder offene Anfragen',
    onlyFriends: 'Du kannst nur Freunde einladen',
    tooManyGames: 'Zu viele laufende Spiele',
    unknownGame: 'Dieses Spiel können wir nicht ausführen',
    notYourTurn: 'Du bist nicht am Zug',
    illegalMove: 'Dieser Zug ist hier nicht erlaubt',
    stale: 'Das Spiel ist weitergegangen – aktualisiere und versuche es erneut',
    gameOver: 'Dieses Spiel ist vorbei',
    notAllowed: 'Nicht erlaubt',
    suspended: 'Dieses Konto wurde gesperrt.',
    suspendedShort: 'Gesperrt',
    suspendedUntil: 'Dieses Konto ist bis {until} UTC gesperrt.',
    status400: 'Der Server konnte diese Anfrage nicht annehmen.',
    status401: 'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.',
    status403: 'Das ist für dieses Konto nicht erlaubt.',
    status404: 'Das wurde nicht gefunden.',
    status409: 'Inzwischen hat sich etwas geändert. Aktualisiere und versuche es erneut.',
    status413: 'Das ist zu groß zum Senden.',
    status429: 'Zu viele Versuche. Versuche es später erneut.',
    status5xx: 'Auf dem Server ist ein Problem aufgetreten. Versuche es gleich noch einmal.',
  },
  fa: {
    offline: 'برای دریافت این داده‌ها به اینترنت وصل شو',
    unreachable: 'دسترسی به سرور ممکن نشد',
    incomplete: 'دریافت این داده‌ها کامل نشد',
    somethingWrong: 'مشکلی پیش آمد',
    unexpected: 'سرور پاسخ غیرمنتظره‌ای فرستاد',
    backupFailed: 'پشتیبان‌گیری ناموفق بود؛ گزارش سرور را ببین',
    backupsOff: 'پشتیبان‌گیری خاموش است',
    cannotBlock: 'مسدود کردن ممکن نیست',
    invalidBatch: 'دستهٔ نامعتبر',
    invalidRequest: 'درخواست نامعتبر',
    invalidSave: 'ذخیرهٔ نامعتبر',
    invalidSubscriptionKeys: 'کلیدهای اشتراک نامعتبر است',
    invalidSubscription: 'اشتراک نامعتبر',
    noSuchRequest: 'چنین درخواستی وجود ندارد، یا فهرست دوستان پر است',
    noSuchSeason: 'چنین فصلی وجود ندارد',
    notFound: 'پیدا نشد',
    notificationsOff: 'اعلان‌ها روی این سرور راه‌اندازی نشده‌اند',
    passwordTooShort: 'گذرواژه باید دست‌کم ۸ نویسه باشد',
    saveTooLarge: 'ذخیره بیش از حد بزرگ است',
    slowDown: 'کمی آهسته‌تر',
    nameCodeMismatch: 'این نام و کد با هم جور نیستند',
    nameTakenAlready: 'این نام قبلاً گرفته شده است',
    nameNotAllowed: 'این نام مجاز نیست. لطفاً نام دیگری انتخاب کن.',
    nameTaken: 'این نام گرفته شده است',
    detailsMismatch: 'این اطلاعات با هیچ حسابی جور نیست',
    tooManyAccounts: 'حساب‌های زیادی از اینجا ساخته شده است',
    tooManyAttemptsName: 'تلاش‌های زیادی برای این نام انجام شده. بعداً دوباره امتحان کن.',
    tooManyAttemptsHere: 'تلاش‌های زیادی از اینجا انجام شده است',
    tooManyAttempts: 'تلاش‌های بیش از حد',
    tooManyExports: 'خروجی‌گیری بیش از حد؛ بعداً دوباره امتحان کن',
    tooManyRequests: 'درخواست‌های بیش از حد',
    typeNameToConfirm: 'برای تأیید، نام نمایشی‌ات را بنویس',
    unauthorized: 'غیرمجاز',
    unsupportedPush: 'سرویس اعلان پشتیبانی نمی‌شود',
    notInMatch: 'تو در آن مسابقه نبودی',
    friendRequestsMuted: 'حساب تو الان نمی‌تواند درخواست دوستی بفرستد',
    invitationsMuted: 'حساب تو الان نمی‌تواند دعوت بفرستد',
    ownCode: 'این کد خودت است',
    noPlayerWithCode: 'بازیکنی با این کد وجود ندارد',
    youBlocked: 'این بازیکن را مسدود کرده‌ای',
    alreadyFriends: 'از قبل با هم دوست هستید',
    requestPending: 'درخواست قبلاً فرستاده شده است',
    friendLimit: 'تعداد دوستان یا درخواست‌های در انتظار بیش از حد است',
    onlyFriends: 'فقط می‌توانی دوستانت را دعوت کنی',
    tooManyGames: 'بازی‌های در جریان بیش از حد است',
    unknownGame: 'نمی‌دانیم این بازی را چطور اجرا کنیم',
    notYourTurn: 'نوبت تو نیست',
    illegalMove: 'این حرکت اینجا مجاز نیست',
    stale: 'بازی جلو رفته است؛ صفحه را تازه کن و دوباره امتحان کن',
    gameOver: 'این بازی تمام شده است',
    notAllowed: 'مجاز نیست',
    suspended: 'این حساب تعلیق شده است.',
    suspendedShort: 'تعلیق‌شده',
    suspendedUntil: 'این حساب تا {until} (UTC) تعلیق است.',
    status400: 'سرور نتوانست این درخواست را بپذیرد.',
    status401: 'ورودت منقضی شده است. لطفاً دوباره وارد شو.',
    status403: 'این کار برای این حساب مجاز نیست.',
    status404: 'پیدا نشد.',
    status409: 'در این فاصله چیزی تغییر کرده است. صفحه را تازه کن و دوباره امتحان کن.',
    status413: 'برای فرستادن بیش از حد بزرگ است.',
    status429: 'تلاش‌های بیش از حد. بعداً دوباره امتحان کن.',
    status5xx: 'سرور به مشکل خورد. کمی بعد دوباره امتحان کن.',
  },
});

type ApiErrorKey = keyof typeof english;

const byEnglish = new Map<string, ApiErrorKey>(
  (Object.entries(english) as [ApiErrorKey, string][]).map(([key, text]) => [text, key]),
);

const SUSPENDED_UNTIL = /^This account is suspended until (.+) UTC\.$/;

function statusKey(status: number): ApiErrorKey | null {
  if (status >= 500) return 'status5xx';
  switch (status) {
    case 0:
      return 'unreachable';
    case 400:
      return 'status400';
    case 401:
      return 'status401';
    case 403:
      return 'status403';
    case 404:
      return 'status404';
    case 409:
      return 'status409';
    case 413:
      return 'status413';
    case 429:
      return 'status429';
    default:
      return null;
  }
}

/**
 * An API error's English message, in the interface language. `status` is the
 * HTTP status, when there was one, to explain a message this catalog does not
 * know; without it an unknown message is shown as it came.
 */
export function apiErrorText(
  message: string,
  status?: number,
  locale: Locale = currentLocale(),
): string {
  if (locale === 'en') return message;
  const exact = byEnglish.get(message);
  if (exact) return translate(apiErrorMessages, exact, undefined, locale);
  const until = SUSPENDED_UNTIL.exec(message)?.[1];
  if (until) return translate(apiErrorMessages, 'suspendedUntil', { until }, locale);
  const byStatus = status === undefined ? null : statusKey(status);
  return byStatus ? translate(apiErrorMessages, byStatus, undefined, locale) : message;
}

/**
 * What to tell the player about a thrown error: an `ApiError` translated as
 * {@link apiErrorText} does, anything else as "Could not reach the server".
 */
export function apiErrorMessage(error: unknown, locale: Locale = currentLocale()): string {
  return error instanceof ApiError
    ? apiErrorText(error.message, error.status, locale)
    : translate(apiErrorMessages, 'unreachable', undefined, locale);
}
