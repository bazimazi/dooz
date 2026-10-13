import type { Notice } from '@/protocol';
import {
  currentLocale,
  defineMessages,
  type Locale,
  type MessageValues,
  translate,
  useLocale,
} from '@/i18n';
import { describeConfigText } from './modes';

/**
 * Words around friends and notices that are not on one screen: the notice
 * toasts, the notification and usage-report settings, and the HTTP refusals
 * the social, correspondence and account routes answer with.
 */
export const socialMessages = defineMessages({
  en: {
    notNow: 'Not now',
    join: 'Join',
    open: 'Open',
    dismiss: 'Dismiss',
    connectFirst: 'Connect to the internet first',

    notifications: 'Notifications',
    notificationsDenied:
      'Blocked in your browser settings. Allow notifications for this site to turn them on.',
    notificationsUnavailable: 'This server does not send notifications.',
    notificationsDescription:
      'Your turn in a game by mail, a friend’s challenge, a tournament starting.',
    working: 'Working…',
    telemetry: 'Usage and crash reports',
    telemetryBlocked: 'Off: your browser asks sites not to track you, and we respect that.',
    telemetryDescription:
      'Anonymous: which modes are played and what crashed. No name, account or device id.',
  },
  es: {
    notNow: 'Ahora no',
    join: 'Unirme',
    open: 'Abrir',
    dismiss: 'Descartar',
    connectFirst: 'Primero conéctate a internet',
    notifications: 'Notificaciones',
    notificationsDenied:
      'Bloqueadas en los ajustes del navegador. Permite las notificaciones de este sitio para activarlas.',
    notificationsUnavailable: 'Este servidor no envía notificaciones.',
    notificationsDescription:
      'Tu turno en una partida por correo, el desafío de un amigo, el inicio de un torneo.',
    working: 'Un momento…',
    telemetry: 'Informes de uso y de errores',
    telemetryBlocked:
      'Desactivado: tu navegador pide a los sitios que no te rastreen, y lo respetamos.',
    telemetryDescription:
      'Anónimos: qué modos se juegan y qué falló. Sin nombre, cuenta ni identificador del dispositivo.',
  },
  fr: {
    notNow: 'Pas maintenant',
    join: 'Rejoindre',
    open: 'Ouvrir',
    dismiss: 'Fermer',
    connectFirst: 'Connectez-vous d’abord à internet',
    notifications: 'Notifications',
    notificationsDenied:
      'Bloquées dans les réglages du navigateur. Autorisez les notifications pour ce site pour les activer.',
    notificationsUnavailable: 'Ce serveur n’envoie pas de notifications.',
    notificationsDescription:
      'Votre tour dans une partie par correspondance, le défi d’un ami, le début d’un tournoi.',
    working: 'Un instant…',
    telemetry: 'Rapports d’utilisation et de plantage',
    telemetryBlocked:
      'Désactivé : votre navigateur demande aux sites de ne pas vous suivre, et nous le respectons.',
    telemetryDescription:
      'Anonymes : quels modes sont joués et ce qui a planté. Ni nom, ni compte, ni identifiant d’appareil.',
  },
  de: {
    notNow: 'Nicht jetzt',
    join: 'Beitreten',
    open: 'Öffnen',
    dismiss: 'Schließen',
    connectFirst: 'Verbinde dich zuerst mit dem Internet',
    notifications: 'Mitteilungen',
    notificationsDenied:
      'In den Browsereinstellungen blockiert. Erlaube Mitteilungen für diese Seite, um sie einzuschalten.',
    notificationsUnavailable: 'Dieser Server sendet keine Mitteilungen.',
    notificationsDescription:
      'Dein Zug in einem Fernspiel, die Herausforderung eines Freundes, ein Turnier beginnt.',
    working: 'Einen Moment…',
    telemetry: 'Nutzungs- und Absturzberichte',
    telemetryBlocked:
      'Aus: Dein Browser bittet Seiten, dich nicht zu verfolgen, und daran halten wir uns.',
    telemetryDescription:
      'Anonym: welche Modi gespielt werden und was abgestürzt ist. Kein Name, kein Konto, keine Geräte-ID.',
  },
  fa: {
    notNow: 'الان نه',
    join: 'بپیوند',
    open: 'باز کن',
    dismiss: 'بستن',
    connectFirst: 'اول به اینترنت وصل شو',
    notifications: 'اعلان‌ها',
    notificationsDenied:
      'در تنظیمات مرورگرت مسدود شده است. برای روشن کردنش، اعلان‌های این سایت را مجاز کن.',
    notificationsUnavailable: 'این سرور اعلان نمی‌فرستد.',
    notificationsDescription: 'نوبتت در بازی مکاتبه‌ای، چالش یک دوست، شروع یک مسابقه.',
    working: 'صبر کن…',
    telemetry: 'گزارش استفاده و خرابی',
    telemetryBlocked:
      'خاموش: مرورگرت از سایت‌ها خواسته ردیابی‌ات نکنند و ما هم به آن احترام می‌گذاریم.',
    telemetryDescription:
      'ناشناس: کدام حالت‌ها بازی می‌شوند و چه چیزی خراب شد. بدون نام، حساب یا شناسهٔ دستگاه.',
  },
});

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

/**
 * Notices are written by the server in English. Each shape the server sends
 * is recognised here and rewritten in the interface language; a notice in a
 * shape this client does not know is shown as it came.
 */
export const noticeMessages = defineMessages({
  en: {
    challengeTitle: '{name} challenges you',
    challengeBody: '{mode} - join before they give up waiting.',
    customGame: 'A custom game',
    aFriend: 'A friend',
    friendRequestTitle: 'Friend request',
    friendRequestBody: '{name} wants to be friends.',
    newFriendTitle: 'New friend',
    requestAcceptedTitle: 'Friend request accepted',
    nowFriendsBody: 'You and {name} are now friends.',
    challengeDeclinedTitle: 'Challenge declined',
    challengeDeclinedBody: '{name} cannot play right now.',
    inviteTitle: 'Correspondence invitation',
    inviteBody: {
      one: '{name} invited you to a game at {count} day a move.',
      other: '{name} invited you to a game at {count} days a move.',
    },
    turnTitle: 'Your move',
    dueSoonTitle: 'Your move is nearly due',
    gameStartedBody: 'Your game against {name} has started. You open.',
    movedBody: '{name} has moved.',
    dueSoonBody: {
      one: 'Less than {count} hour left to move against {name}.',
      other: 'Less than {count} hours left to move against {name}.',
    },
    wonTitle: 'You won a correspondence game',
    lostTitle: 'Correspondence game lost',
    drawnTitle: 'Correspondence game drawn',
    resultBody: 'Against {name}: {reason}.',
    reasonLine: 'a line was completed',
    reasonDraw: 'the board filled up',
    reasonResign: 'by resignation',
    reasonTimeout: 'on time',
    reasonAbandoned: 'by abandonment',
    reasonAgreed: 'by agreement',
    reasonOther: 'game over',
    tournamentStartedTitle: '{name} has started',
    arenaStartedBody: 'Pairings are live. Jump in.',
    bracketStartedBody: 'Your first match is ready.',
  },
  es: {
    challengeTitle: '{name} te desafía',
    challengeBody: '{mode}: únete antes de que se canse de esperar.',
    customGame: 'Una partida personalizada',
    aFriend: 'Un amigo',
    friendRequestTitle: 'Solicitud de amistad',
    friendRequestBody: '{name} quiere ser tu amigo.',
    newFriendTitle: 'Nuevo amigo',
    requestAcceptedTitle: 'Solicitud de amistad aceptada',
    nowFriendsBody: '{name} y tú ya sois amigos.',
    challengeDeclinedTitle: 'Desafío rechazado',
    challengeDeclinedBody: '{name} no puede jugar ahora mismo.',
    inviteTitle: 'Invitación por correo',
    inviteBody: {
      one: '{name} te ha invitado a una partida con {count} día por jugada.',
      other: '{name} te ha invitado a una partida con {count} días por jugada.',
    },
    turnTitle: 'Te toca',
    dueSoonTitle: 'Tu plazo para jugar está a punto de vencer',
    gameStartedBody: 'Tu partida contra {name} ha empezado. Abres tú.',
    movedBody: '{name} ha jugado.',
    dueSoonBody: {
      one: 'Te queda menos de {count} hora para jugar contra {name}.',
      other: 'Te quedan menos de {count} horas para jugar contra {name}.',
    },
    wonTitle: 'Has ganado una partida por correo',
    lostTitle: 'Partida por correo perdida',
    drawnTitle: 'Partida por correo en tablas',
    resultBody: 'Contra {name}: {reason}.',
    reasonLine: 'se completó una línea',
    reasonDraw: 'el tablero se llenó',
    reasonResign: 'por abandono',
    reasonTimeout: 'por tiempo',
    reasonAbandoned: 'por desconexión',
    reasonAgreed: 'de mutuo acuerdo',
    reasonOther: 'fin de la partida',
    tournamentStartedTitle: '{name} ha empezado',
    arenaStartedBody: 'Los emparejamientos están en marcha. ¡Entra ya!',
    bracketStartedBody: 'Tu primera partida está lista.',
  },
  fr: {
    challengeTitle: '{name} vous défie',
    challengeBody: '{mode} - rejoignez avant que l’attente ne lasse votre adversaire.',
    customGame: 'Une partie personnalisée',
    aFriend: 'Un ami',
    friendRequestTitle: 'Demande d’ami',
    friendRequestBody: '{name} veut devenir votre ami.',
    newFriendTitle: 'Nouvel ami',
    requestAcceptedTitle: 'Demande d’ami acceptée',
    nowFriendsBody: '{name} et vous êtes maintenant amis.',
    challengeDeclinedTitle: 'Défi refusé',
    challengeDeclinedBody: '{name} ne peut pas jouer pour le moment.',
    inviteTitle: 'Invitation par correspondance',
    inviteBody: {
      one: '{name} vous invite à une partie à {count} jour par coup.',
      other: '{name} vous invite à une partie à {count} jours par coup.',
    },
    turnTitle: 'À vous de jouer',
    dueSoonTitle: 'Votre coup est bientôt attendu',
    gameStartedBody: 'Votre partie contre {name} a commencé. Vous ouvrez.',
    movedBody: '{name} a joué.',
    dueSoonBody: {
      one: 'Moins de {count} heure pour jouer contre {name}.',
      other: 'Moins de {count} heures pour jouer contre {name}.',
    },
    wonTitle: 'Partie par correspondance gagnée',
    lostTitle: 'Partie par correspondance perdue',
    drawnTitle: 'Partie par correspondance nulle',
    resultBody: 'Contre {name} : {reason}.',
    reasonLine: 'une ligne a été complétée',
    reasonDraw: 'le plateau s’est rempli',
    reasonResign: 'par abandon',
    reasonTimeout: 'au temps',
    reasonAbandoned: 'par départ',
    reasonAgreed: 'd’un commun accord',
    reasonOther: 'partie terminée',
    tournamentStartedTitle: '{name} a commencé',
    arenaStartedBody: 'Les appariements sont lancés. À vous de jouer.',
    bracketStartedBody: 'Votre premier match est prêt.',
  },
  de: {
    challengeTitle: '{name} fordert dich heraus',
    challengeBody: '{mode} - tritt bei, bevor das Warten zu lang wird.',
    customGame: 'Ein eigenes Spiel',
    aFriend: 'Ein Freund',
    friendRequestTitle: 'Freundschaftsanfrage',
    friendRequestBody: '{name} möchte mit dir befreundet sein.',
    newFriendTitle: 'Neuer Freund',
    requestAcceptedTitle: 'Freundschaftsanfrage angenommen',
    nowFriendsBody: 'Du und {name} seid jetzt befreundet.',
    challengeDeclinedTitle: 'Herausforderung abgelehnt',
    challengeDeclinedBody: '{name} kann gerade nicht spielen.',
    inviteTitle: 'Einladung zum Fernspiel',
    inviteBody: {
      one: '{name} hat dich zu einem Spiel mit {count} Tag pro Zug eingeladen.',
      other: '{name} hat dich zu einem Spiel mit {count} Tagen pro Zug eingeladen.',
    },
    turnTitle: 'Du bist am Zug',
    dueSoonTitle: 'Dein Zug ist bald fällig',
    gameStartedBody: 'Dein Spiel gegen {name} hat begonnen. Du eröffnest.',
    movedBody: '{name} hat gezogen.',
    dueSoonBody: {
      one: 'Weniger als {count} Stunde für deinen Zug gegen {name}.',
      other: 'Weniger als {count} Stunden für deinen Zug gegen {name}.',
    },
    wonTitle: 'Fernspiel gewonnen',
    lostTitle: 'Fernspiel verloren',
    drawnTitle: 'Fernspiel unentschieden',
    resultBody: 'Gegen {name}: {reason}.',
    reasonLine: 'eine Reihe wurde vollendet',
    reasonDraw: 'das Brett war voll',
    reasonResign: 'durch Aufgabe',
    reasonTimeout: 'auf Zeit',
    reasonAbandoned: 'durch Verlassen',
    reasonAgreed: 'durch Einigung',
    reasonOther: 'Spiel vorbei',
    tournamentStartedTitle: '{name} hat begonnen',
    arenaStartedBody: 'Die Paarungen laufen. Spring rein.',
    bracketStartedBody: 'Dein erstes Match ist bereit.',
  },
  fa: {
    challengeTitle: '{name} تو را به چالش کشیده',
    challengeBody: '{mode} - تا حوصله‌اش سر نرفته، بپیوند.',
    customGame: 'یک بازی سفارشی',
    aFriend: 'یک دوست',
    friendRequestTitle: 'درخواست دوستی',
    friendRequestBody: '{name} می‌خواهد با تو دوست شود.',
    newFriendTitle: 'دوست تازه',
    requestAcceptedTitle: 'درخواست دوستی پذیرفته شد',
    nowFriendsBody: 'تو و {name} حالا با هم دوستید.',
    challengeDeclinedTitle: 'چالش رد شد',
    challengeDeclinedBody: '{name} الان نمی‌تواند بازی کند.',
    inviteTitle: 'دعوت به بازی مکاتبه‌ای',
    inviteBody: {
      other: '{name} تو را به بازی‌ای با {count} روز برای هر حرکت دعوت کرده.',
    },
    turnTitle: 'نوبت توست',
    dueSoonTitle: 'مهلت حرکتت رو به پایان است',
    gameStartedBody: 'بازی‌ات با {name} شروع شد. تو شروع می‌کنی.',
    movedBody: '{name} حرکتش را انجام داد.',
    dueSoonBody: {
      other: 'کمتر از {count} ساعت برای حرکت در برابر {name} وقت داری.',
    },
    wonTitle: 'یک بازی مکاتبه‌ای را بردی',
    lostTitle: 'بازی مکاتبه‌ای را باختی',
    drawnTitle: 'بازی مکاتبه‌ای مساوی شد',
    resultBody: 'در برابر {name}: {reason}.',
    reasonLine: 'یک ردیف کامل شد',
    reasonDraw: 'صفحه پر شد',
    reasonResign: 'با کناره‌گیری',
    reasonTimeout: 'با تمام شدن وقت',
    reasonAbandoned: 'با ترک بازی',
    reasonAgreed: 'با توافق',
    reasonOther: 'بازی تمام شد',
    tournamentStartedTitle: '{name} شروع شد',
    arenaStartedBody: 'جفت‌ها مشخص شده‌اند. بپر وسط!',
    bracketStartedBody: 'اولین مسابقه‌ات آماده است.',
  },
});

type NoticeKey = keyof (typeof noticeMessages)['en'];

/** One English shape the server writes, and how to say it in a catalog. */
interface Shape {
  readonly match: RegExp;
  readonly key: NoticeKey;
  readonly values?: (groups: readonly string[], notice: Notice, locale: Locale) => MessageValues;
}

const REASONS: Record<string, NoticeKey> = {
  'a line was completed': 'reasonLine',
  'the board filled up': 'reasonDraw',
  'by resignation': 'reasonResign',
  'on time': 'reasonTimeout',
  'by abandonment': 'reasonAbandoned',
  'by agreement': 'reasonAgreed',
  'game over': 'reasonOther',
};

const named = (groups: readonly string[]) => ({ name: groups[0] ?? '' });

const TITLES: readonly Shape[] = [
  { match: /^Friend request$/, key: 'friendRequestTitle' },
  { match: /^New friend$/, key: 'newFriendTitle' },
  { match: /^Friend request accepted$/, key: 'requestAcceptedTitle' },
  { match: /^Challenge declined$/, key: 'challengeDeclinedTitle' },
  { match: /^Correspondence invitation$/, key: 'inviteTitle' },
  { match: /^Your move$/, key: 'turnTitle' },
  { match: /^Your move is nearly due$/, key: 'dueSoonTitle' },
  { match: /^You won a correspondence game$/, key: 'wonTitle' },
  { match: /^Correspondence game lost$/, key: 'lostTitle' },
  { match: /^Correspondence game drawn$/, key: 'drawnTitle' },
  { match: /^(.+) challenges you$/, key: 'challengeTitle', values: named },
  { match: /^(.+) has started$/, key: 'tournamentStartedTitle', values: named },
];

const BODIES: readonly Shape[] = [
  { match: /^Pairings are live\. Jump in\.$/, key: 'arenaStartedBody' },
  { match: /^Your first match is ready\.$/, key: 'bracketStartedBody' },
  {
    match: /^(.+) - join before they give up waiting\.$/,
    key: 'challengeBody',
    values: ([mode = ''], notice, locale) => ({
      mode: notice.config
        ? describeConfigText(notice.config, locale)
        : mode === 'A custom game'
          ? translate(noticeMessages, 'customGame', undefined, locale)
          : mode,
    }),
  },
  { match: /^(.+) wants to be friends\.$/, key: 'friendRequestBody', values: named },
  { match: /^You and (.+) are now friends\.$/, key: 'nowFriendsBody', values: named },
  { match: /^(.+) cannot play right now\.$/, key: 'challengeDeclinedBody', values: named },
  {
    match: /^(.+) invited you to a game at (\d+) days? a move\.$/,
    key: 'inviteBody',
    values: ([name = '', days = '0'], _notice, locale) => ({
      name: name === 'A friend' ? translate(noticeMessages, 'aFriend', undefined, locale) : name,
      count: Number(days),
    }),
  },
  {
    match: /^Your game against (.+) has started\. You open\.$/,
    key: 'gameStartedBody',
    values: named,
  },
  {
    match: /^Less than (\d+) hours? left to move against (.+)\.$/,
    key: 'dueSoonBody',
    values: ([hours = '0', name = '']) => ({ name, count: Number(hours) }),
  },
  { match: /^(.+) has moved\.$/, key: 'movedBody', values: named },
  {
    match: /^Against (.+): ([a-z ]+)\.$/,
    key: 'resultBody',
    values: ([name = '', reason = ''], _notice, locale) => {
      const key = REASONS[reason];
      return { name, reason: key ? translate(noticeMessages, key, undefined, locale) : reason };
    },
  },
];

function rewrite(text: string, shapes: readonly Shape[], notice: Notice, locale: Locale): string {
  for (const shape of shapes) {
    const found = shape.match.exec(text);
    if (!found) continue;
    const values = shape.values?.(found.slice(1), notice, locale);
    return translate(noticeMessages, shape.key, values, locale);
  }
  return text;
}

/** A notice's title and body in the interface language. */
export function noticeText(
  notice: Notice,
  locale: Locale = currentLocale(),
): { title: string; body: string } {
  if (locale === 'en') return { title: notice.title, body: notice.body };
  return {
    title: rewrite(notice.title, TITLES, notice, locale),
    body: rewrite(notice.body, BODIES, notice, locale),
  };
}

/** {@link noticeText}, re-rendering when the language changes. */
export function useNoticeText(): (notice: Notice) => { title: string; body: string } {
  const locale = useLocale();
  return (notice) => noticeText(notice, locale);
}
