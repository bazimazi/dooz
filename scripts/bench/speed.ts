import { chooseMove } from '../../src/game/engine/bot/index.js';
import { applyMove, createGame } from '../../src/game/engine/game.js';
import { modeById } from '../../src/game/engine/modes.js';
import { BOT_DIFFICULTIES } from '../../src/game/engine/bot/difficulty.js';
import { X } from '../../src/game/engine/types.js';

for (const id of ['classic', 'grid-6', 'grid-9', 'gomoku-15', 'ultimate'] as const) {
  const mode = modeById(id);
  const centre = Math.floor(mode.config.size / 2);
  let game = createGame(mode.config, X);
  game = applyMove(game, centre * mode.config.size + centre)!;
  game = applyMove(game, centre * mode.config.size + centre + 1)!;
  for (const d of BOT_DIFFICULTIES) {
    const t = Date.now();
    const r = chooseMove(game, { difficulty: d })!;
    console.log(
      `${id.padEnd(10)} ${d.padEnd(9)} ${String(Date.now() - t).padStart(6)}ms nodes=${String(r.nodes).padStart(8)} depth=${r.depth} ${r.reason}`,
    );
  }
  console.log('');
}
