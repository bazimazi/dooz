import { useState } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2 } from "~/utils/players";
import { Board } from "./components/Board";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import classes from "./GamePage.module.scss";

const INITIAL_BOARD = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));

export function GamePage() {
  const [boardData, setBoardData] = useState(INITIAL_BOARD);
  const [currentPlayer, setCurrentPlayer] = useState(
    Math.round(Math.random()) ? P1 : P2
  );
  const [result, setResult] = useState<number[][]>();

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || result) return;

    boardData[i][j] = currentPlayer;
    setBoardData([...boardData]);

    if (checkWinner()) return;

    setCurrentPlayer(currentPlayer === P1 ? P2 : P1);
  };

  const checkWinner = () => {
    const winResult = checkBoard(boardData, currentPlayer);
    if (!winResult) return false;
    setResult(winResult);
    return true;
  };

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <Header currentPlayer={currentPlayer} />
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
        <Footer />
      </div>
    </div>
  );
}
