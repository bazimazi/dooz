import type { DialogueTable } from '@/features/journey/dialogue';
import type { Locale } from '@/i18n';
import { journeyDialogueDe } from './journeyDialogue.de';
import { journeyDialogueEs } from './journeyDialogue.es';
import { journeyDialogueFa } from './journeyDialogue.fa';
import { journeyDialogueFr } from './journeyDialogue.fr';

/**
 * What the journey rivals say, in English - the source every other language
 * translates line for line.
 *
 * A line is addressed by rival, event (and, for greetings, mode family) and
 * its place in the pool, so each translation is a table of exactly this
 * shape: the same pools, each the same length, in the same order. That is
 * what lets the session's deck deal a pool's positions rather than its words,
 * and keep dealing without repeats when the player changes language halfway.
 * `journey.test.ts` holds every language to it.
 */
export const journeyDialogueEn: DialogueTable = {
  pip: {
    greeting: {
      any: [
        'Ribbit! New board, new rules. I love new rules!',
        'I read the rules twice. Well, once. Mostly.',
      ],
      classic: [
        'Three in a row! I can count to three. Watch!',
        'Nine squares, like nine lily pads. Hop, hop!',
      ],
      grid: ['Four in a row on a big pond? That’s so many pads.'],
      misere: ['Wait, three in a row is BAD here? Ribbit… noted.'],
      vanish: ['My marks disappear? Like bubbles! Pop!'],
      gravity: ['Things fall down here. Even frogs, sometimes.'],
      ultimate: ['Boards inside boards? My head is spinning. Ribbit!'],
      gomoku: ['Five in a row on a giant pond! I’ll get lost.'],
    },
    rematch: [
      'Again? Yay! I’ve been practising. For about a minute.',
      'Rematch! This time I’ll remember which mark is mine.',
      'Let’s go again! I promise to blink less.',
    ],
    bossIntro: [
      'I’ve been watching you. Now I’m going to copy you. Ha!',
      'Big frog energy today. Ribbit!',
      'Everything you do, I do. That’s the plan. The whole plan.',
    ],
    firstThreat: [
      'Ooh, is this a line?',
      'Two in a row! Did I do that?',
      'Look, look! A line! Almost!',
    ],
    threat: ['Ribbit? Ribbit!', 'Did I do that on purpose?', 'Another one! I think.'],
    fork: ['Two lines?! Ribbit ribbit ribbit!', 'Wait, can you block both? Can you?'],
    blocked: [
      'Boop. Blocked! I saw that one.',
      'Not on my lily pad!',
      'Ha! Splash-blocked.',
      'I hopped in the way. On purpose. Mostly.',
    ],
    signature: [
      'Copycat! Whatever you do, I do.',
      'Ribbit — I’ll have the one opposite yours.',
      'Mirror, mirror, on the pond!',
    ],
    worry: ['Uh-oh.', 'Wait, wait, wait—', 'Is that allowed?', 'That looks like a line. Eep.'],
    playerFork: [
      'Two lines?! That’s not fair. Is it fair?',
      'I only have one hop!',
      'Which one do I block? Both? Help!',
    ],
    comeback: ['I’m back! I think! Ribbit!', 'Phew. Still in this!'],
    nearLoss: ['I can see it coming. Gulp.', 'Is this… the end of the pond?', 'Ribbit… oh no.'],
    win: [
      'Wait… I won? Beginner’s luck!',
      'I WON! I have to tell every frog I know.',
      'Ribbit! That was a real line and everything!',
    ],
    loss: [
      'Hop to it — you’re a natural.',
      'Ribbit. You’re really good at this.',
      'Teach me that trick sometime?',
    ],
    draw: [
      'Nobody won? So we both won! Right?',
      'A tie! Like a lily pad with two frogs on it.',
      'Full pond, no lines. Ribbit.',
    ],
  },

  mo: {
    greeting: {
      any: ['I always block. What I don’t see is what comes after.', 'Fine. One game. Then nap.'],
      classic: [
        'Nine squares. I’ll sit on whichever one you want.',
        'Classic. Like a sunbeam on a windowsill.',
      ],
      grid: ['A bigger board just means more places to block you.'],
      misere: [
        'Don’t make three in a row. I never make anything. Easy.',
        'Misère. My favourite. Doing nothing is a skill.',
      ],
      vanish: ['Your marks vanish too. Then I don’t even have to block them.'],
      gravity: [
        'Things fall. I always land on my feet.',
        'Stacking columns. Like knocking cups off a table, backwards.',
      ],
      ultimate: ['Nine boards to block you on. Purr.'],
      gomoku: ['Five in a row on a board this big? I’ll be everywhere.'],
    },
    rematch: [
      'Again? I wasn’t done napping.',
      'Back for more blocking? Fine.',
      'Rematch. I’ll block the same things, faster.',
    ],
    bossIntro: [
      'This is my roof. Nobody gets a line on my roof.',
      'Nine lives. You’ll need to beat me at least once.',
      'I’ve blocked everything you’ve tried. Try harder.',
    ],
    firstThreat: ['Your move. Choose wisely.', 'Oh, did I make a line? Accident.'],
    threat: ['Paws off that square.', 'Mrrow.', 'That one’s mine. Unless you block it.'],
    fork: [
      'Two? Hm. I don’t usually attack. Don’t get used to it.',
      'Look at that. Even I can make two.',
    ],
    blocked: [
      'Blocked. Obviously.',
      'Pounced.',
      'I sat on it. It’s my square now.',
      'You were going there? I was already there.',
    ],
    signature: [
      'Pounce. Your little line is gone.',
      'I smother lines before they purr.',
      'That was going to be a threat. Was.',
    ],
    worry: ['I saw that. Probably.', 'Hiss.', 'Hmph. Blocking in a moment.'],
    playerFork: [
      'Two threats at once is cheating. (It isn’t.)',
      'I can only sit on one square. Rude.',
      'Hiss! Where did the second one come from?',
    ],
    comeback: ['See? Blocked everything. Now it’s my turn.', 'Purr. Back in control.'],
    nearLoss: ['I don’t like where this is going.', 'Tail’s twitching. Bad sign.'],
    win: ['Purrfect. Try again?', 'You walked into my nap. Don’t.', 'Mine. As usual.'],
    loss: [
      'Hmph. Two threats at once is cheating. (It isn’t.)',
      'Fine. You found the square I wasn’t sitting on.',
      'I’ll be on the windowsill. Sulking.',
    ],
    draw: [
      'Nobody gets through. Exactly how I like it.',
      'A draw. I blocked everything. As promised.',
      'Stalemate. Purr.',
    ],
  },

  sage: {
    greeting: {
      any: [
        'I look three moves ahead. Set your traps further out than that.',
        'New rules are old patterns in new feathers.',
      ],
      classic: ['Even nine squares hold a lifetime of lessons.'],
      grid: [
        'The centre of a board is worth more than its edges. Remember that.',
        'Four in a row. Build shapes, not lines.',
      ],
      misere: ['In misère, the patient player wins by doing less.'],
      vanish: [
        'A line through a fading mark is no line at all.',
        'Watch which of your marks is leaving. I always do.',
      ],
      gravity: ['Every column is a promise. Count who keeps theirs.'],
      ultimate: [
        'Every square you choose sends me somewhere. Choose wisely.',
        'Nine boards. The centre one first, as always.',
      ],
      gomoku: ['On a wide board, patience is a weapon.'],
    },
    rematch: [
      'Again. Good. Repetition is the mother of skill.',
      'Let us see what you learned. Hoo.',
      'The second game is where the lesson shows.',
    ],
    bossIntro: [
      'You have come far. Now show me you can see further.',
      'The oak has stood a hundred years. Let us see if you can move it.',
      'I will hold the centre. You will have to go around me.',
    ],
    firstThreat: ['Consider the consequences.', 'A small question for you to answer.'],
    threat: ['Three moves ahead, remember.', 'Hoo, hoo.', 'Answer this one carefully.'],
    fork: [
      'Two roads, and you can only walk one.',
      'Patience has made two threats out of one move.',
    ],
    blocked: [
      'A good idea. Not good enough.',
      'I saw it coming three moves ago.',
      'Hoo. Closed.',
      'The obvious threat is the easiest to stop.',
    ],
    signature: [
      'The centre holds.',
      'I take the middle. Everything else follows.',
      'From the centre, every line is mine to choose.',
    ],
    worry: ['Interesting…', 'A thoughtful move.', 'Let me think on that.'],
    playerFork: [
      'Ah. Two at once. Well constructed.',
      'You looked four moves ahead. I looked three.',
    ],
    comeback: ['The tide turns. As it always does.', 'Patience has paid. Hoo.'],
    nearLoss: ['I see the end. It is not mine.', 'A fine combination. I did not see it coming.'],
    win: [
      'Patience wins games. Hoo.',
      'You played the board. I played you.',
      'Look again at move four. That was the game.',
    ],
    loss: [
      'A fine combination. I did not see it coming.',
      'The student surprises the teacher. Good.',
      'Four moves ahead. I shall have to look further.',
    ],
    draw: [
      'Balance. Neither of us erred.',
      'A draw is a lesson both players learn.',
      'Even. Hoo. Let us call it wisdom.',
    ],
  },

  bruno: {
    greeting: {
      any: [
        'Big boards, big plans. Don’t leave an open four lying around.',
        'New game, same plan: build bigger than you.',
      ],
      classic: ['Small board. I’ll still find room to build.'],
      grid: ['Plenty of space. I like space. Space for lines.'],
      misere: ['Don’t build? That’s the only thing I know how to do.'],
      vanish: ['My marks fall off? I’ll just build faster.'],
      gravity: [
        'Stack ’em up. Columns are just towers waiting to happen.',
        'Gravity’s on my side. I’m heavy.',
      ],
      ultimate: ['Nine boards, nine building sites.'],
      gomoku: [
        'Now THIS is a board. Room for the biggest line you ever saw.',
        'Fifteen by fifteen. Grrr. I can smell the fours already.',
      ],
    },
    rematch: [
      'Back for more? I’ve got more.',
      'Round two. I build faster when I’m hungry.',
      'Again! Bigger lines this time.',
    ],
    bossIntro: [
      'You made it to my woods. Nobody leaves without a bear hug.',
      'I’ve been saving my biggest build for you.',
      'Every tree in these woods is a line I finished.',
    ],
    firstThreat: ['Found a gap. Mine now.', 'There’s the first one. More coming.'],
    threat: ['Stack ’em up.', 'Grrr.', 'Block that. And the next one.', 'Another brick.'],
    fork: [
      'Two lines, one of you. Grrr-eat.',
      'Bear rush! Pick one to block.',
      'I built two at once. Bears can do that.',
    ],
    blocked: [
      'Blocked it. I think.',
      'Swatted.',
      'Not that one. I need that space.',
      'You can’t build through a bear.',
    ],
    signature: ['Longer! Always longer!', 'Bear rush. Keep up.', 'I don’t stop building. Ever.'],
    worry: ['Oof. Big move.', 'You’re building something.', 'Hmm. That’s a real line.'],
    playerFork: [
      'Two?! You out-built a bear.',
      'Grr. Can’t block both. Can I?',
      'Now you’re playing my game.',
    ],
    comeback: ['Back on top. Where bears belong.', 'Shook it off. Building again.'],
    nearLoss: ['Oof. I see it. That’s a big line.', 'This is going to hurt.'],
    win: [
      'Grrr-eat game. For me.',
      'Biggest line wins. It was mine.',
      'Bear hug! Nobody escapes the bear hug.',
    ],
    loss: [
      'You out-built me. Respect.',
      'Huh. You blocked everything I built.',
      'Good game. I’m going to eat some honey about it.',
    ],
    draw: [
      'Nobody finished? Too many walls.',
      'A stalemate. Bears hate those.',
      'All that building and nothing to show. Grr.',
    ],
  },

  vex: {
    greeting: {
      any: ['Every quiet move of mine is a trap. Every one.', 'New rules? New traps. Same fox.'],
      classic: ['Nine squares. That’s nine places to hide something.'],
      grid: ['Plenty of room for something you won’t notice.'],
      misere: ['Make you complete a line? That’s my favourite kind of trap.'],
      vanish: [
        'Your oldest mark is about to leave. Did you forget?',
        'Perfect play wins vanish in thirteen. I know which thirteen.',
      ],
      gravity: ['The square under my threat is yours to fill. Eventually.'],
      ultimate: [
        'I’ll send you somewhere lovely. You won’t like it.',
        'Every square is an address. I know where they lead.',
      ],
      gomoku: ['Big board. Lots of quiet corners for a fox.'],
    },
    rematch: [
      'Too slow, too kind. Again?',
      'Back already? The traps are reset.',
      'Again? I have new tricks. Some are even the old ones.',
    ],
    bossIntro: [
      'Welcome to the den. Mind the floor.',
      'You beat my traps. Now try the ones I didn’t show you.',
      'Everything you see here is bait.',
    ],
    firstThreat: [
      'Did you see that one coming?',
      'Something for you to deal with.',
      'There. Answer it.',
    ],
    threat: ['Tick, tock.', 'Another little trap.', 'And another.', 'Busy, busy.'],
    fork: ['Snap. Two at once.', 'That quiet move? It had teeth.', 'Fox trap. Pick your leg.'],
    blocked: [
      'Cute.',
      'I let you have that one. No, really.',
      'Closed. You were telegraphing.',
      'Blocked. Bait, by the way.',
    ],
    signature: [
      'Quiet move. Count the lines through it.',
      'Nothing to see here. Yet.',
      'That one will matter in three moves.',
    ],
    worry: ['Not bad. Not enough.', 'I’ll allow it.', 'Hm. You’re paying attention.'],
    playerFork: [
      'Oh, you set a trap? For me? Rude.',
      'Two threats. Clever. Annoyingly clever.',
      'Well. That’s my trick.',
    ],
    comeback: ['And the fox slips out.', 'You almost had me. Almost.'],
    nearLoss: ['Ah. I see it. I hate that I see it.', 'Hm. The trap was yours.'],
    win: [
      'Too slow, too kind. Again?',
      'Snap. Every quiet move, remember?',
      'You walked right past it. Twice.',
    ],
    loss: [
      'Clever. Annoyingly clever.',
      'You found the trap behind the trap.',
      'Fine. You’ve earned a look at my den.',
    ],
    draw: [
      'A draw? Neither trap went off.',
      'Stalemate. How unfoxlike.',
      'We both saw everything. Boring.',
    ],
  },

  nyx: {
    greeting: {
      any: ['I have already seen how this ends.', 'You arrive. As foreseen.'],
      classic: ['Nine squares. I have seen every game they hold.'],
      grid: ['Every line on this board, I have walked already.'],
      misere: ['You will fill the last square. You always do.'],
      vanish: ['Everything fades. Your marks first.'],
      gravity: [
        'I have counted every square in every column. Twice.',
        'Down, always down. Like everything.',
      ],
      ultimate: ['Nine boards. Eighty-one paths. One ending.'],
      gomoku: ['Fifteen by fifteen. Enough room for you to get lost.'],
    },
    rematch: ['Again. The ending will not change.', 'You return. They always return.'],
    bossIntro: [
      'This is the last board. I have seen you lose on it already.',
      'Everything you learned brought you here. It will not be enough.',
      'The veil is thin tonight. Step through.',
    ],
    firstThreat: ['Inevitable.', 'The first thread. Pull it.'],
    threat: ['You are three moves too late.', 'I see every ending.', 'Another thread.'],
    fork: ['Two endings. Both mine.', 'You cannot hold back both.'],
    blocked: ['No.', 'Foreseen. Closed.', 'That ending does not happen.', 'Dissolved.'],
    signature: [
      'I see the end now. Count with me.',
      'Forced. From here, every road is mine.',
      'The ending is written. You may read it move by move.',
    ],
    worry: ['…', 'Unexpected.', 'A ripple in the pattern.'],
    playerFork: ['…Two. I did not see two.', 'The pattern breaks.'],
    comeback: ['The pattern restores itself.', 'As it was always going to.'],
    nearLoss: ['…I see an ending that is not mine.', 'So this is what surprise feels like.'],
    win: [
      'As foreseen.',
      'It ended where I said it would.',
      'Again, if you like. It ends the same.',
    ],
    loss: [
      '…I did not foresee that. Well played.',
      'You stepped outside the pattern. Remarkable.',
      'The veil lifts. You have seen further than I.',
    ],
    draw: [
      'Balance. I foresaw that too. Mostly.',
      'Neither ending came. Curious.',
      'The pattern holds. For both of us.',
    ],
  },
};

/** Every language's table. */
export const JOURNEY_DIALOGUE: Readonly<Record<Locale, DialogueTable>> = {
  en: journeyDialogueEn,
  es: journeyDialogueEs,
  fr: journeyDialogueFr,
  de: journeyDialogueDe,
  fa: journeyDialogueFa,
};
