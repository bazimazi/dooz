/**
 * Display-name filter.
 *
 * A name is the one string a player can put in front of a stranger, so it is
 * checked on the way in rather than only after somebody has reported it. The
 * list is deliberately short and blunt: it exists to stop the obvious slur or
 * obscenity, not to adjudicate taste, and a human with the admin API handles
 * everything subtler.
 *
 * Two lists, because substring matching on short words is how a filter ends up
 * refusing "Scunthorpe", "Hancock" or "Dickens":
 *
 * - `ANYWHERE` words are long or distinctive enough that they are offensive
 *   wherever they appear in the squashed name.
 * - `WHOLE` words only count as a separate word of the name, or as the whole
 *   squashed name.
 *
 * Before matching, the name is normalised the way people dodge filters:
 * diacritics stripped, leetspeak digits and symbols mapped back to letters,
 * separators removed and repeated letters collapsed ("fuuuck", "f.u.c.k",
 * "fü¢k" and "f4gg0t" all reduce to the same thing).
 */

const ANYWHERE = [
  'fuck',
  'fuk',
  'fck',
  'shit',
  'cunt',
  'bitch',
  'whore',
  'slut',
  'niger',
  'niga',
  'nigr',
  'fagot',
  'retard',
  'rapist',
  'nazi',
  'hitler',
  'kike',
  'wanker',
  'twat',
  'pusy',
  'penis',
  'vagina',
  'porn',
  'dildo',
  'asshole',
  'bastard',
  'motherf',
  'cocksuck',
  'jizz',
  'tranny',
  'killyourself',
  'pedo',
  'paedo',
] as const;

const WHOLE = [
  'ass',
  'fag',
  'cum',
  'tit',
  'tits',
  'dick',
  'cock',
  'rape',
  'spic',
  'chink',
  'gook',
  'coon',
  'homo',
  'sex',
  'anal',
  'piss',
  'hoe',
  'cuck',
  'wank',
  'kys',
] as const;

/**
 * Innocent words that contain an `ANYWHERE` entry, removed before matching so
 * the filter does not refuse a town, a country or a profession.
 */
const EXCEPTIONS = [
  'scunthorpe',
  'nigeria',
  'nigerian',
  'shitake',
  'therapist',
  'pedometer',
  'torpedo',
  'speedo',
] as const;

/**
 * Names that would let a player pass as staff or as the system. These are
 * refused on their own and as the leading word ("Admin Bob", "Moderator_1").
 */
const RESERVED = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'staff',
  'support',
  'system',
  'dooz',
  'official',
] as const;

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'l',
  '+': 't',
  '¢': 'c',
  '€': 'e',
  '£': 'l',
};

/** Lower-case, strip accents, undo leetspeak. Keeps word separators as spaces. */
function letters(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split('')
    .map((character) => LEET[character] ?? character)
    .join('')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** Collapse runs of the same letter: "fuuuck" and "fuck" match the same entry. */
function squeeze(text: string): string {
  return text.replace(/(.)\1+/g, '$1');
}

/**
 * The normalised forms a name is checked in, exposed for tests and for the
 * admin view, which shows moderators why a name was refused.
 */
export function normaliseName(name: string): { words: string[]; squashed: string } {
  const spaced = letters(name);
  const words = spaced.split(' ').filter(Boolean).map(squeeze);
  return { words, squashed: squeeze(spaced.replace(/ /g, '')) };
}

const ANYWHERE_SQUEEZED = ANYWHERE.map(squeeze);
const WHOLE_SQUEEZED = new Set(WHOLE.map(squeeze));
const EXCEPTIONS_SQUEEZED = EXCEPTIONS.map(squeeze);
const RESERVED_SET = new Set<string>(RESERVED.map(squeeze));

/** Why a name is refused, or `null` when it is fine. */
export function nameProblem(name: string): 'offensive' | 'reserved' | null {
  const { words, squashed } = normaliseName(name);
  if (squashed.length === 0) return null;

  const cleared = EXCEPTIONS_SQUEEZED.reduce((text, word) => text.replaceAll(word, ' '), squashed);
  if (ANYWHERE_SQUEEZED.some((word) => cleared.includes(word))) return 'offensive';
  if (words.some((word) => WHOLE_SQUEEZED.has(word)) || WHOLE_SQUEEZED.has(squashed)) {
    return 'offensive';
  }

  // Reserved words are checked as whole words, so "Mod" is caught but
  // "Modern" and "Moody" are not.
  const leading = words[0] ?? '';
  if (RESERVED_SET.has(squashed) || RESERVED_SET.has(leading)) return 'reserved';
  return null;
}

export function isNameAllowed(name: string): boolean {
  return nameProblem(name) === null;
}
