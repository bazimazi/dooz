import { P1, P2 } from "~/utils/players";
import classes from "./Header.module.scss";

interface Props {
  currentPlayer: string;
}

export function Header({ currentPlayer }: Props) {
  let playerOneClasses: String[] = [];
  let playerTwoClasses: String[] = [];
  let showVectorPink;
  let showVectorYellow;

  if (currentPlayer === P1) {
    playerOneClasses = [classes.player1, classes.playerOneTurn];
    playerTwoClasses = [classes.player2];
    showVectorPink = classes.showVectorPink;
    showVectorYellow = '';
  } else {
    playerTwoClasses = [classes.player2, classes.playerTwoTurn];
    playerOneClasses = [classes.player1];
    showVectorYellow = classes.showVectorYellow;
    showVectorPink = '';
  }

  return (
    <>
      <div className={playerOneClasses.join(' ')}>
        <img src="static/images/Vector_pink.svg" alt="Player 1 Turn" className={showVectorPink} />
        <div className={classes.playerContainer}>
          <img src="static/images/player.svg" alt="Player 1" />
          <div className={classes.playerTitle}>Player 1</div>
          <img src="static/images/player1.svg" alt="X" />
        </div>
      </div>

      <div className={classes.vs}>VS</div>

      <div className={playerTwoClasses.join(' ')}>
        <img src="static/images/Vector_yellow.svg" alt="Player 2 Turn" className={showVectorYellow} />
        <div className={classes.playerContainer}>
          <img src="static/images/player.svg" alt="Player 2" />
          <div className={classes.playerTitle}>Player 2</div>
          <img src="static/images/player2.svg" alt="O" />
        </div>
      </div>
    </>
  );
}
