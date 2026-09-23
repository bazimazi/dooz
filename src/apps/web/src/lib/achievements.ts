/**
 * The achievement catalogue, as the client shows it.
 *
 * A copy of the server's list rather than a fetch, because the profile screen
 * has to render the *locked* ones too - and the server only sends the ones an
 * account has earned. The ids are the contract between the two; a name only
 * shown here is one the server never has to know about.
 */
export interface AchievementLabel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const ACHIEVEMENT_LABELS: readonly AchievementLabel[] = [
  { id: 'first-win', name: 'Off the mark', description: 'Win your first online match.' },
  { id: 'ten-wins', name: 'Regular', description: 'Win ten online matches.' },
  { id: 'fifty-wins', name: 'Veteran', description: 'Win fifty online matches.' },
  { id: 'streak-3', name: 'On a roll', description: 'Win three matches in a row.' },
  { id: 'streak-5', name: 'Unstoppable', description: 'Win five matches in a row.' },
  { id: 'streak-10', name: 'Untouchable', description: 'Win ten matches in a row.' },
  { id: 'century', name: 'Centurion', description: 'Play one hundred online matches.' },
  { id: 'polymath', name: 'All-rounder', description: 'Play a match in every ranked mode.' },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Win a match in the fewest moves the rules allow.',
  },
  { id: 'marathon', name: 'Marathon', description: 'Win a match that ran to sixty moves or more.' },
  { id: 'climber', name: 'Climber', description: 'Reach a rating of 1500 in any mode.' },
  { id: 'summit', name: 'Summit', description: 'Reach a rating of 1800 in any mode.' },
];
