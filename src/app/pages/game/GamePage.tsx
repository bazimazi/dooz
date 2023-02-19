import { useState } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2 } from "~/utils/players";
import { WinResult } from "~/utils/WinResult";
import { Board } from "./components/Board";
import classes from "./GamePage.module.css";

const INITIAL_BOARD = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));

export function GamePage() {
  const [boardData, setBoardData] = useState(INITIAL_BOARD);
  const [currentPlayer, setCurrentPlayer] = useState(
    Math.round(Math.random()) ? P1 : P2
  );
  const [result, setResult] = useState<WinResult>();

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || result) return;

    boardData[i][j] = currentPlayer;
    setBoardData([...boardData]);
    setCurrentPlayer(currentPlayer === P1 ? P2 : P1);

    checkWinner();
  };

  const checkWinner = () => {
    const winResult = checkBoard(boardData);
    if (!winResult) return;

    setResult(winResult);
    winResult.line.forEach((cell) => {
      boardData[cell[0]][cell[1]] = "🤩";
    });
    setBoardData([...boardData]);
  };

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <div className={classes.player1}>
          <div className={classes.playerContainer}>
            <img src="static/images/player.svg" alt="Player 1" />
            <div className={classes.playerTitle}>Player 1</div>
            <img src="static/images/X.svg" alt="X" />
          </div>
        </div>
        <div className={classes.vs}>VS</div>
        <div className={classes.player2}>
          <div className={classes.playerContainer}>
          <img src="static/images/player.svg" alt="Player 2" />
            <div className={classes.playerTitle}>Player 2</div>
            <img src="static/images/O.svg" alt="O" />
          </div>
        </div>
      </div>

      <div className={classes.body}>
        <Board
          boardData={boardData}
          onClick={handleClick}
          currentPlayer={currentPlayer}
          result={result}
        />
      </div>

      <div className={classes.footer}>
        <a className={classes.refresh} href="#">
          <img src="static/images/refresh.svg" alt="refresh" />
        </a>
        <a className={classes.home} href="/">
          <img src="static/images/home.svg" alt="home" />
        </a>
      </div>
    </div>
  );
}
