import { P1, P2 } from "~/utils/players";
import classes from "./GamePageHeader.module.scss";
import { GameMode } from "~/utils/game-mode";
import { useState } from "react";
import { globals } from "~/utils/globals";


interface Props {
  currentPlayer: string;
  gameMode: GameMode;
  boardSize: number;
  onSizeChange: (size: number) => void;
}

export function GamePageHeader({ currentPlayer, gameMode, boardSize, onSizeChange }: Props) {

  const [isOpen, setIsOpen] = useState(false);

  function changeSize(size: number) {
    setIsOpen(false);
    onSizeChange(size);
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
        <div className={`${classes.selectBox} ${isOpen && classes.selectBoxShowed}`}>
          <div className={classes.selectedSize} onClick={() => setIsOpen(!isOpen)}>
            {boardSize} x {boardSize}
            <img src={`${isOpen ? "static/images/arrow-up.png" : "static/images/arrow-down.png"}`} alt="arrow" />
          </div>
          {
            globals.boardSizes.map((size, i) =>
              <div key={i} onClick={() => changeSize(size)}>{size} x {size}</div>
            )
          }
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
