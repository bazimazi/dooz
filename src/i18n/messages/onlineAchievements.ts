import { defineMessages, type Locale, translate, useLocale } from '@/i18n';
import type { AchievementLabel } from '@/lib/achievements';

/**
 * Online achievement names and descriptions, keyed by the server's ids. The
 * English here matches `ACHIEVEMENT_LABELS`, which stays the list of ids.
 */
export const achievementMessages = defineMessages({
  en: {
    'first-win': 'Off the mark',
    'first-win.description': 'Win your first online match.',
    'ten-wins': 'Regular',
    'ten-wins.description': 'Win ten online matches.',
    'fifty-wins': 'Veteran',
    'fifty-wins.description': 'Win fifty online matches.',
    'streak-3': 'On a roll',
    'streak-3.description': 'Win three matches in a row.',
    'streak-5': 'Unstoppable',
    'streak-5.description': 'Win five matches in a row.',
    'streak-10': 'Untouchable',
    'streak-10.description': 'Win ten matches in a row.',
    century: 'Centurion',
    'century.description': 'Play one hundred online matches.',
    polymath: 'All-rounder',
    'polymath.description': 'Play a match in every ranked mode.',
    sharpshooter: 'Sharpshooter',
    'sharpshooter.description': 'Win a match in the fewest moves the rules allow.',
    marathon: 'Marathon',
    'marathon.description': 'Win a match that ran to sixty moves or more.',
    climber: 'Climber',
    'climber.description': 'Reach a rating of 1500 in any mode.',
    summit: 'Summit',
    'summit.description': 'Reach a rating of 1800 in any mode.',
  },
  es: {
    'first-win': 'Estreno',
    'first-win.description': 'Gana tu primera partida en línea.',
    'ten-wins': 'Habitual',
    'ten-wins.description': 'Gana diez partidas en línea.',
    'fifty-wins': 'Veterano',
    'fifty-wins.description': 'Gana cincuenta partidas en línea.',
    'streak-3': 'En racha',
    'streak-3.description': 'Gana tres partidas seguidas.',
    'streak-5': 'Imparable',
    'streak-5.description': 'Gana cinco partidas seguidas.',
    'streak-10': 'Intocable',
    'streak-10.description': 'Gana diez partidas seguidas.',
    century: 'Centurión',
    'century.description': 'Juega cien partidas en línea.',
    polymath: 'Todoterreno',
    'polymath.description': 'Juega una partida en cada modo clasificatorio.',
    sharpshooter: 'Francotirador',
    'sharpshooter.description':
      'Gana una partida con el mínimo de jugadas que permiten las reglas.',
    marathon: 'Maratón',
    'marathon.description': 'Gana una partida que haya durado sesenta jugadas o más.',
    climber: 'Escalador',
    'climber.description': 'Alcanza una puntuación de 1500 en cualquier modo.',
    summit: 'Cumbre',
    'summit.description': 'Alcanza una puntuación de 1800 en cualquier modo.',
  },
  fr: {
    'first-win': 'Premier pas',
    'first-win.description': 'Gagnez votre premier match en ligne.',
    'ten-wins': 'Habitué',
    'ten-wins.description': 'Gagnez dix matchs en ligne.',
    'fifty-wins': 'Vétéran',
    'fifty-wins.description': 'Gagnez cinquante matchs en ligne.',
    'streak-3': 'Sur sa lancée',
    'streak-3.description': 'Gagnez trois matchs d’affilée.',
    'streak-5': 'Inarrêtable',
    'streak-5.description': 'Gagnez cinq matchs d’affilée.',
    'streak-10': 'Intouchable',
    'streak-10.description': 'Gagnez dix matchs d’affilée.',
    century: 'Centurion',
    'century.description': 'Jouez cent matchs en ligne.',
    polymath: 'Touche-à-tout',
    'polymath.description': 'Jouez un match dans chaque mode classé.',
    sharpshooter: 'Tireur d’élite',
    'sharpshooter.description': 'Gagnez un match avec le moins de coups que permettent les règles.',
    marathon: 'Marathon',
    'marathon.description': 'Gagnez un match qui a duré soixante coups ou plus.',
    climber: 'Grimpeur',
    'climber.description': 'Atteignez un classement de 1500 dans n’importe quel mode.',
    summit: 'Sommet',
    'summit.description': 'Atteignez un classement de 1800 dans n’importe quel mode.',
  },
  de: {
    'first-win': 'Der erste Streich',
    'first-win.description': 'Gewinne dein erstes Online-Match.',
    'ten-wins': 'Stammgast',
    'ten-wins.description': 'Gewinne zehn Online-Matches.',
    'fifty-wins': 'Veteran',
    'fifty-wins.description': 'Gewinne fünfzig Online-Matches.',
    'streak-3': 'Im Lauf',
    'streak-3.description': 'Gewinne drei Matches in Folge.',
    'streak-5': 'Unaufhaltsam',
    'streak-5.description': 'Gewinne fünf Matches in Folge.',
    'streak-10': 'Unantastbar',
    'streak-10.description': 'Gewinne zehn Matches in Folge.',
    century: 'Zenturio',
    'century.description': 'Spiele hundert Online-Matches.',
    polymath: 'Allrounder',
    'polymath.description': 'Spiele ein Match in jedem Ranglistenmodus.',
    sharpshooter: 'Scharfschütze',
    'sharpshooter.description': 'Gewinne ein Match mit so wenigen Zügen, wie die Regeln erlauben.',
    marathon: 'Marathon',
    'marathon.description': 'Gewinne ein Match, das sechzig Züge oder mehr gedauert hat.',
    climber: 'Aufsteiger',
    'climber.description': 'Erreiche in einem beliebigen Modus eine Wertung von 1500.',
    summit: 'Gipfel',
    'summit.description': 'Erreiche in einem beliebigen Modus eine Wertung von 1800.',
  },
  fa: {
    'first-win': 'شروع خوب',
    'first-win.description': 'نخستین مسابقهٔ آنلاینت را ببر.',
    'ten-wins': 'همیشگی',
    'ten-wins.description': 'ده مسابقهٔ آنلاین را ببر.',
    'fifty-wins': 'کهنه‌کار',
    'fifty-wins.description': 'پنجاه مسابقهٔ آنلاین را ببر.',
    'streak-3': 'در اوج',
    'streak-3.description': 'سه مسابقه پشت سر هم ببر.',
    'streak-5': 'توقف‌ناپذیر',
    'streak-5.description': 'پنج مسابقه پشت سر هم ببر.',
    'streak-10': 'شکست‌ناپذیر',
    'streak-10.description': 'ده مسابقه پشت سر هم ببر.',
    century: 'صدتایی',
    'century.description': 'صد مسابقهٔ آنلاین بازی کن.',
    polymath: 'همه‌فن‌حریف',
    'polymath.description': 'در هر حالت رتبه‌بندی‌شده یک مسابقه بازی کن.',
    sharpshooter: 'تک‌تیرانداز',
    'sharpshooter.description': 'مسابقه‌ای را با کمترین حرکتی که قوانین اجازه می‌دهد ببر.',
    marathon: 'ماراتن',
    'marathon.description': 'مسابقه‌ای را ببر که شصت حرکت یا بیشتر طول کشیده باشد.',
    climber: 'کوهنورد',
    'climber.description': 'در هر حالتی به امتیاز ۱۵۰۰ برس.',
    summit: 'قله',
    'summit.description': 'در هر حالتی به امتیاز ۱۸۰۰ برس.',
  },
});

type AchievementKey = keyof (typeof achievementMessages)['en'];

/** An online achievement's name and description in the interface language. */
export function achievementText(
  achievement: AchievementLabel,
  locale?: Locale,
): { name: string; description: string } {
  const key = achievement.id as AchievementKey;
  if (!(key in achievementMessages.en)) return achievement;
  return {
    name: translate(achievementMessages, key, undefined, locale),
    description: translate(
      achievementMessages,
      `${key}.description` as AchievementKey,
      undefined,
      locale,
    ),
  };
}

/** {@link achievementText}, re-rendering when the language changes. */
export function useAchievementText(): (achievement: AchievementLabel) => {
  name: string;
  description: string;
} {
  const locale = useLocale();
  return (achievement) => achievementText(achievement, locale);
}
