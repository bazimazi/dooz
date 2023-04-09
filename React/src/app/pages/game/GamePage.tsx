import { useState } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, randomTurnGenerator } from "~/utils/players";
import { createWinLines } from "../../utils/create-win-lines"
import { Board } from "./components/Board";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Modal } from "./components/Modal";
import classes from "./GamePage.module.scss";

const winLines = createWinLines(3);
const INITIAL_BOARD = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));
export function GamePage() {
  const [boardData, setBoardData] = useState(structuredClone(INITIAL_BOARD));
  const [currentPlayer, setCurrentPlayer] = useState(
    randomTurnGenerator()
  );
  const [result, setResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || result) return;
    boardData[i][j] = currentPlayer;
    setBoardData([...boardData]);

    if (checkWinner()) return;

    setCurrentPlayer(currentPlayer === P1 ? P2 : P1);
  };

  const checkWinner = () => {
    const winResult = checkBoard(boardData, currentPlayer, winLines);
    if (!winResult) return false;
    setResult(winResult);
    setTimeout(() => {
      setShowModal(true);
    }, 500);
    return true;
  };

  const refreshBoard = () => {
    setBoardData(structuredClone(INITIAL_BOARD));
    setCurrentPlayer(randomTurnGenerator());
    setResult(undefined);
    setShowModal(false);
  }

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

      {showModal && <Modal
        winner={currentPlayer}
        onRefresh={refreshBoard}
      />}

      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
