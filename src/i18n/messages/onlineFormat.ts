import { defineMessages } from '@/i18n';

/**
 * The few words inside formatted numbers: match lengths and leaderboard
 * positions. Ordinals are keyed by the locale's *ordinal* plural category
 * (`one`, `two`, `few`, `other`), which is not the category `count` picks.
 */
export const formatMessages = defineMessages({
  en: {
    durationSeconds: '{seconds}s',
    durationMinutes: '{minutes}m {seconds}s',
    ordinal_one: '{n}st',
    ordinal_two: '{n}nd',
    ordinal_few: '{n}rd',
    ordinal_other: '{n}th',
  },
  es: {
    durationSeconds: '{seconds} s',
    durationMinutes: '{minutes} min {seconds} s',
    ordinal_one: '{n}.º',
    ordinal_two: '{n}.º',
    ordinal_few: '{n}.º',
    ordinal_other: '{n}.º',
  },
  fr: {
    durationSeconds: '{seconds} s',
    durationMinutes: '{minutes} min {seconds} s',
    ordinal_one: '{n}er',
    ordinal_two: '{n}e',
    ordinal_few: '{n}e',
    ordinal_other: '{n}e',
  },
  de: {
    durationSeconds: '{seconds} s',
    durationMinutes: '{minutes} min {seconds} s',
    ordinal_one: '{n}.',
    ordinal_two: '{n}.',
    ordinal_few: '{n}.',
    ordinal_other: '{n}.',
  },
  fa: {
    durationSeconds: '{seconds} ثانیه',
    durationMinutes: '{minutes} دقیقه و {seconds} ثانیه',
    ordinal_one: '{n}م',
    ordinal_two: '{n}م',
    ordinal_few: '{n}م',
    ordinal_other: '{n}م',
  },
});
