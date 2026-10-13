import { describe, expect, it } from 'vitest';
import { type DialogueTable, LineDeck, rivalLine } from '@/features/journey/dialogue';
import { resultLine } from '@/features/journey/remarks';
import { RIVALS } from '@/features/journey/rivals';
import { STAGES } from '@/features/journey/stages';
import { seeded } from '@/game/engine/testing';
import { LOCALES, type Message } from '@/i18n';
import {
  journeyContentMessages,
  journeyMessages,
  objectiveText,
  rivalText,
  stageText,
} from './journey';
import { JOURNEY_DIALOGUE, journeyDialogueEn } from './journeyDialogue';

/**
 * The journey's catalogs are partly built from data and partly plain records,
 * so the compiler cannot hold the translations to English. This does: every
 * language covers every message, rival and stage with the same placeholders,
 * and speaks every rival's dialogue line for line - the same pools, each as
 * long as the English one - since lines are dealt by their place in a pool.
 */

const TRANSLATED = LOCALES.filter((locale) => locale !== 'en');

function placeholders(message: Message | undefined): string[] {
  if (message === undefined) return [];
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  return [...new Set(texts.flatMap((text) => text?.match(/\{\w+\}/g) ?? []))].toSorted();
}

/** Every pool of a table, by a `rival.event` or `rival.greeting.family` path. */
function pools(table: DialogueTable): Map<string, readonly string[]> {
  const found = new Map<string, readonly string[]>();
  for (const [rival, lines] of Object.entries(table)) {
    const { greeting, ...events } = lines;
    for (const [family, pool] of Object.entries(greeting)) {
      found.set(`${rival}.greeting.${family}`, pool ?? []);
    }
    for (const [event, pool] of Object.entries(events)) found.set(`${rival}.${event}`, pool);
  }
  return found;
}

describe('the journey interface catalog', () => {
  it.each(TRANSLATED)('is fully translated into %s, placeholders and all', (locale) => {
    const translated = journeyMessages[locale] ?? {};
    expect(Object.keys(translated).toSorted()).toEqual(Object.keys(journeyMessages.en).toSorted());
    for (const [key, english] of Object.entries(journeyMessages.en)) {
      const message = translated[key as keyof typeof journeyMessages.en];
      expect(message, `${locale}: ${key}`).toBeDefined();
      expect(placeholders(message), `${locale}: ${key}`).toEqual(placeholders(english));
    }
  });

  it('lists objectives as the stage sheet always has', () => {
    const stage = (objective: string) => STAGES.find((entry) => entry.objective === objective)!;
    expect(objectiveText(stage('par'), 'en')).toBe(`Win in ${stage('par').par[1]} moves or fewer`);
    expect(objectiveText(stage('no-hints'), 'en')).toBe(
      `Win in ${stage('no-hints').par[0]} or fewer without a hint`,
    );
    expect(objectiveText(stage('fork'), 'en')).toBe(
      `Win in ${stage('fork').par[0]} or fewer with a double threat`,
    );
    expect(objectiveText(stage('flawless'), 'en')).toBe(
      `Win in ${stage('flawless').par[0]} or fewer without facing a threat`,
    );
  });
});

describe('the journey rivals and stages', () => {
  const englishKeys = Object.keys(journeyContentMessages.en).toSorted();

  it('reads English word for word from the data', () => {
    for (const rival of RIVALS) {
      expect(rivalText(rival, 'en')).toEqual({
        greeting: rival.greeting,
        gloat: rival.gloat,
        concede: rival.concede,
        signature: rival.signature,
        chapter: rival.chapter,
      });
    }
    for (const stage of STAGES) {
      expect(stageText(stage, 'en')).toEqual({
        tip: stage.tip,
        ...(stage.intro ? { intro: stage.intro } : {}),
        ...(stage.twist ? { twist: stage.twist } : {}),
      });
    }
  });

  it.each(TRANSLATED)('translates every key in %s, and only those', (locale) => {
    const translated = journeyContentMessages[locale] ?? {};
    expect(Object.keys(translated).toSorted()).toEqual(englishKeys);
    for (const [key, message] of Object.entries(translated)) {
      expect(typeof message === 'string' && message.trim().length > 0, key).toBe(true);
      expect(placeholders(message), key).toEqual(placeholders(journeyContentMessages.en[key]));
    }
  });

  it.each(TRANSLATED)('reads rivals and stages in %s rather than English', (locale) => {
    const rival = RIVALS[0]!;
    expect(rivalText(rival, locale).greeting).not.toBe(rival.greeting);
    expect(stageText(STAGES[0]!, locale).tip).not.toBe(STAGES[0]!.tip);
  });
});

describe('the journey dialogue', () => {
  const english = pools(journeyDialogueEn);

  it.each(TRANSLATED)('speaks %s line for line with English', (locale) => {
    const translated = pools(JOURNEY_DIALOGUE[locale]);
    expect([...translated.keys()].toSorted()).toEqual([...english.keys()].toSorted());
    for (const [path, pool] of english) {
      const local = translated.get(path)!;
      expect(local, `${locale}: ${path}`).toHaveLength(pool.length);
      // A line said twice in one pool would be heard twice in a row.
      expect(new Set(local).size, `${locale}: ${path}`).toBe(local.length);
      local.forEach((line, index) => {
        expect(line.trim().length, `${locale}: ${path}.${index}`).toBeGreaterThan(0);
        expect(placeholders(line), `${locale}: ${path}.${index}`).toEqual(
          placeholders(pool[index]),
        );
      });
    }
  });

  it('keeps dealing a pool without repeats when the language changes', () => {
    const deck = new LineDeck(seeded(3));
    const pool = journeyDialogueEn.pip.blocked;
    const heard = new Set<number>();
    pool.forEach((_, turn) => {
      const locale = LOCALES[turn % LOCALES.length]!;
      const line = rivalLine('pip', 'blocked', undefined, deck, undefined, locale)!;
      const index = JOURNEY_DIALOGUE[locale].pip.blocked.indexOf(line);
      expect(index).toBeGreaterThanOrEqual(0);
      heard.add(index);
    });
    expect(heard.size).toBe(pool.length);
  });

  it.each(TRANSLATED)('ends a game in %s', (locale) => {
    const line = resultLine(RIVALS[0]!, 'win', locale);
    expect(JOURNEY_DIALOGUE[locale].pip.loss).toContain(line);
  });
});
