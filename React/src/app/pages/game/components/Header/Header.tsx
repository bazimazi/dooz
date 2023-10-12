import { P1, P2 } from "~/utils/players";
import classes from "./Header.module.scss";
import { GameMode } from "~/utils/game-mode";
import { boardSizeContext } from "~/App";
import { useContext, useState } from "react";

interface Props {
  currentPlayer: string;
  gameMode: GameMode;
  refreshBoard: () => void;
}

export function Header({ currentPlayer, gameMode, refreshBoard }: Props) {
  const { selectedSize, setSelectedSize } = useContext(boardSizeContext);
  const [isSelectBoxOpen, setIsSelectBoxOpen] = useState(false);

  function changeBoardSize(size: number) {
    if (selectedSize === size) return;
    setSelectedSize(size);
    setIsSelectBoxOpen(false);
    refreshBoard();
  }

  return (
    <div className={classes.main}>
      <div className={`${classes.player1} ${currentPlayer === P1 ? classes.current : ''}`}>
        <img src="static/images/current_1.svg" alt="Player 1 Turn" className={classes.currentImg} />
        <div className={classes.playerContainer}>
          <img src="static/images/player.svg" alt="Player 1" />
          <div className={classes.playerTitle}>{gameMode === GameMode.playerVsBot ? "You" : "player 1"}</div>
          <img src="static/images/player1.svg" alt="X" />
        </div>
      </div>
      <div className={classes.modeContainer}>
        <div className={`${classes.selectBox} ${isSelectBoxOpen && classes.selectBoxShowed}`}>
          <div className={classes.selectedSize} onClick={() => setIsSelectBoxOpen(!isSelectBoxOpen)}>
            {selectedSize} x {selectedSize}
            <img src={`${isSelectBoxOpen ? "static/images/arrow-up.png" : "static/images/arrow-down.png"}`} alt="arrow-down" />
          </div>
          <div onClick={() => changeBoardSize(3)}>3 x 3</div>
          <div onClick={() => changeBoardSize(6)}>6 x 6</div>
          <div onClick={() => changeBoardSize(9)}>9 x 9</div>
        </div>
      </div>
      <div className={`${classes.player2} ${currentPlayer === P2 ? classes.current : ''}`}>
        <img src="static/images/current_2.svg" alt="Player 2 Turn" className={classes.currentImg} />
        <div className={classes.playerContainer}>
          <img src={`static/images/${gameMode === GameMode.playerVsBot ? "botheader" : "player"}.svg`} alt="Player 2" />
          <div className={classes.playerTitle}>{gameMode === GameMode.playerVsBot ? "Bot" : "player 2"}</div>
          <img src="static/images/player2.svg" alt="O" />
        </div>
      </div>
    </div>
  );
}
