# Dooz player experience review

Reviewed on 3 October 2026. The game already offers substantial variety and a
coherent visual and audio identity. The highest-confidence opportunity is to
make existing play easier to learn, control, and recover from. This review
combines source inspection, browser measurements, automated play scenarios,
and published research. It does not claim to measure enjoyment or retention
among actual players.

## Evidence and scope

Inspected the home screen, onboarding, local and bot play, practice, puzzles,
journey progression, settings, profiles, results, shared board controls,
saved games, difficulty profiles, and existing accessibility tests. The
unchanged baseline passed 504 tests across 26 files. Browser measurements used
320 × 568 and 390 × 844 phone viewports and a 1280 × 800 desktop viewport.
Follow-up browser checks exercise both light and dark themes.

The multiplayer architecture and account code were reviewed, but this work
does not include human multiplayer sessions, native-device testing, or a
study with disabled players. Browser viewport simulation cannot establish
how comfortable a physical phone feels to use.

## Research that informed the decisions

Ryan, Rigby, and Przybylski's four studies associate perceived competence and
autonomy with enjoyment and preferences; their multiplayer study also links
relatedness with enjoyment and future play. This supports investigating
understandable controls and opportunities to learn. It does not establish
that any particular change below will increase Dooz retention.
[The Motivational Pull of Video Games](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf)

Xbox's difficulty guidance recommends accommodating differing skills and
explaining difficulty choices. Dooz already has six distinct bot levels, so
this implementation exposes practice and explains the ceiling of solved
Classic play. Difficulty balance remains a separate question for playtests.
[Xbox Accessibility Guideline 108](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/108)

Game Accessibility Guidelines recommends interactive tutorials, clear
language, reminders of objectives and controls, and practice without failure.
Dooz's existing interactive walkthrough and unlimited puzzle attempts are
good foundations; the walkthrough's acceptance rule needed to match its
instructions.
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/full-list/)

Xbox's cue guidance recommends representing critical colour information with
another signifier and providing narration or alternatives for visual cues.
The implemented hints therefore use shapes, words, and accessible cell
descriptions together.
[Xbox Accessibility Guideline 103](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/103)

W3C's target-size guidance uses 24 CSS pixels as the minimum size, subject to
defined exceptions. The measured mobile Gomoku cells were smaller than that.
An optional view now provides 36-pixel cells. This is an improvement in the
tested view, rather than a claim of complete WCAG conformance.
[Understanding Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)

Xbox's motion guidance recommends options to reduce visual distractions.
The app's comments described reduced-motion support, but inspection found no
corresponding CSS implementation. Device preferences and an in-game toggle
now suppress animation while retaining the final marks and winning line.
[Xbox Accessibility Guideline 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117)

Nielsen Norman Group recommends selective confirmation for consequential
actions and explicit action labels. In Dooz, restarting a played round is a
concrete loss of the current position. Confirmation is limited to active
rounds containing moves; empty and completed rounds can restart directly.
[Confirmation Dialogs Can Prevent User Errors](https://www.nngroup.com/articles/confirmation-dialog/)

## Observed friction and implemented changes

| Finding                                                                                                                                      | Player consequence inferred from the finding                                                     | Implemented response                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The first tutorial step said to tap any empty square but accepted only the centre.                                                           | A correct reading of the instruction received negative feedback.                                 | Accept any opening square, retain a specific win and block exercise, and stop input after a step is solved.                                                  |
| Gomoku 15 cells measured approximately 16.9 pixels at 320 pixels wide and 21.6 pixels at 390 pixels wide.                                    | Precise touch input is likely difficult.                                                         | Add an optional enlarged view with 36-pixel cells, internal scrolling, keyboard navigation, and automatic visibility of the last move.                       |
| Win and threat hints were both circular outlines distinguished by colour; their meanings were absent from cell descriptions.                 | Players could see help without understanding it, especially with colour vision differences.      | Use a solid circle for a win, a square with an exclamation mark for a block, and a dashed circle for a suggestion. Add a legend and accessible descriptions. |
| Practice was accessed through the learning screen and showed search depth and node counts.                                                   | Beginners could miss the learning tools or encounter information with little practical value.    | Add practice to home and bot results and replace diagnostics with a short explanation of take-backs and suggestions.                                         |
| Restart immediately replaced a played round, and difficulty changes switched positions immediately.                                          | Accidental input disrupted a player's active round.                                              | Confirm a restart or difficulty switch when the round has moves; pause the bot while the choice is open.                                                     |
| Result panels covered the board and had no review action.                                                                                    | Inspecting the final position and taking back a finished practice or local move were obstructed. | Allow local and bot results to uncover the board, reopen results, and use existing take-backs.                                                               |
| Classic is solved by Hard, Expert, and Master, but draws led to an easier-bot offer. Boundary levels also offered ineffective changes.       | A successful defensive result could look like failure.                                           | Explain perfect Classic play, acknowledge a draw against those levels, offer an easier level after losses, and hide offers beyond the available levels.      |
| Most unusual variant rules had no text reminder under the board.                                                                             | A rule learned earlier could be forgotten during play.                                           | Show concise Misère, Gravity, Ultimate, and Vanish reminders, retaining Vanish's draw countdown.                                                             |
| Motion support was described in comments but was absent from the stylesheet.                                                                 | Players asking their device to reduce motion still received animated effects.                    | Respect the device setting, persist an optional in-game setting, suppress decorative effects, and remove result animation waits.                             |
| Journey opacity reduced locked-stage and rival text contrast in both themes. The browser audit reported 88 contrast findings on that screen. | Future goals and unlock instructions became harder to read.                                      | Keep text at full opacity and retain lock icons and subdued avatar artwork.                                                                                  |
| Profile caches were copied to state after rendering.                                                                                         | Reopening a profile could briefly display empty activity.                                        | Derive fallback activity from the current account's cache during render; keep fetched data associated with its credentials.                                  |

The difficulty dialog also exposed a navigation timing issue during real
browser testing: removing its history entry before navigation committed
could undo the requested change. The prompt now remains until navigation
finishes. The browser scenario checks that the bot pauses, cancellation
resumes the same turn, and confirmation reaches the selected level.

Browser Back also needs time to consume a dialog's history entry before the
dialog unmounts. The new review and reset dialogs now use the app's existing
closing lifecycle; the browser audit checks that dismissing a reset with Back
keeps the player on the same game screen.

## Existing strengths to preserve

The shared deterministic rules, separate bot worker, legal-move checks, and
saved positions provide a solid basis for reliable play. Local series scores
and alternating openers give two people a reason to play another round.
Journey stages introduce multiple modes and publish their star targets.
Puzzles allow unlimited attempts and have proven solution lines. Optional
music, separate effects and vibration settings, and cosmetic rewards already
give players useful choices.

## Further investigation

These are hypotheses and follow-up proposals, not measured player needs.

1. **Test first-session comprehension.** Recruit several new players. Observe
   the walkthrough, finding practice, interpreting a block hint, and playing
   the first journey stage. Record wrong inputs, help requests, and what
   players think happened. Ask them to explain the rules in their own words.
2. **Test physical touch comfort.** Try both Gomoku views on actual phones,
   including a small device. Measure accidental placements and difficulty
   finding the latest move. Consider selectable cell size or tap-to-confirm
   only if players still report problems.
3. **Evaluate challenge by mode.** Record voluntary difficulty choices, losses,
   draws, retries, and completion of early journey stages in a consented
   study. Bot-versus-bot strength and proof of a winnable stage do not reveal
   how approachable a stage is for a new human player. Use the findings to
   tune defaults or stage order before changing the engine.
4. **Improve explanations in puzzles.** Currently an incorrect move says that
   the opponent can escape and then retracts it. A short defensive line
   could show why it fails, but needs validated engine analysis and tests
   beyond the stored winning line.
5. **Make saved rounds discoverable.** Positions already persist by mode and
   difficulty. Investigate whether players want a home-screen resume card;
   decide how to choose among several unfinished rounds before adding it.
6. **Test multiplayer with people.** Observe waiting, joining an invite,
   reconnecting, rematching, and clock pressure. Investigate queue abandonment
   and active player counts before adding more ranked pools or social systems.

Success should mean fewer mistaken inputs, better understanding, comfortable
play, and a difficulty players choose willingly. Session duration alone would
not show that the game became more pleasant.

## Verification

The full suite passed **516 tests across 29 files**, using
`npm test -- --maxWorkers=2` after unrestricted parallel checks exhausted the
machine's available memory. The web suite was checked again after the dialog
changes: **224 tests passed**. Typechecking, linting, and the production build
passed. Lint still reports warnings in existing account, history, audio, and
audit code; there are no lint errors. The production accessibility audit
reported **no accessibility problems** in its tested routes and themes.

Production offline checks passed for local identity edits, profile reloads,
bot workers and fallback play, restored local rounds and take-backs, solo
screens, and downloaded history, replay, and leaderboard data. A warning about
the approximately 596 kB main JavaScript chunk remains; measure initial load
on slower connections before deciding on further performance work.

Unit and interaction tests cover accepting tutorial openings, retaining the
win and block lessons, accessible hint meanings, enlarged-board input,
restart cancellation and focus restoration, finished-board review and
take-backs, and motion preference migration and application.

`npm run audit:experience --workspace @dooz/web` runs real-browser checks for
those flows, bot cancellation, 36-pixel enlarged cells, page overflow,
keyboard access, both themes, and visible win lines under reduced motion.
Screenshots are written to the ignored `src/apps/web/build/player-experience`
directory. The existing accessibility audit now waits for the rendered app
instead of network silence, so retries from an unavailable server cannot
prevent the audit from running.

Automated checks establish the tested behaviours. Human enjoyment, assistive
technology usability, native layouts, and multiplayer behaviour still require
the follow-up work above.
