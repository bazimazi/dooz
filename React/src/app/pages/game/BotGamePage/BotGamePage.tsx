import { useState, useRef } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, generateRandomTurn } from "~/utils/players";
import { Board } from "../components/Board";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { gameMode } from "~/utils/game-mode";
import classes from "./BotGamePage.module.scss";

const INITIAL_BOARD = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));

export function BotGamePage() {
  const [boardData, setBoardData] = useState(structuredClone(INITIAL_BOARD));
  const [currentPlayer, setCurrentPlayer] = useState(
    generateRandomTurn()
  );
  const [result, setResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);
  const isFirstMove = useRef(true);

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || result) return;
    if (currentPlayer === P1) {
      boardData[i][j] = currentPlayer;
      setBoardData([...boardData]);
      if (checkWinner(P1)) return;
      setCurrentPlayer(P2);
      handleBot();
    }
  };

  const handleBot = () => {
    let row = Math.floor(Math.random() * 3);
    let col = Math.floor(Math.random() * 3);

    if (boardData[row][col]) {
      handleBot();
    } else {
      boardData[row][col] = P2;
      setBoardData([...boardData]);
      if (checkWinner(P2)) return;
      setCurrentPlayer(P1);
    }
  };

  const checkWinner = (currentPlayer: string) => {
    const winResult = checkBoard(boardData, currentPlayer);
    if (!winResult) return false;
    setResult(winResult);
    setTimeout(() => {
      setShowModal(true);
    }, 500);
    return true;
  };

  if (isFirstMove.current) {
    if (currentPlayer === P2) {
      setTimeout(() => {
        handleBot();
      }, 0);
    }
    isFirstMove.current = false;
  }

  const refreshBoard = () => {
    let newRandomTurnGenerator = generateRandomTurn();
    setBoardData(structuredClone(INITIAL_BOARD));
    setCurrentPlayer(newRandomTurnGenerator);
    if (newRandomTurnGenerator === P2) {
      isFirstMove.current = true;
    }
    setResult(undefined);
    setShowModal(false);
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <Header
          currentPlayer={currentPlayer}
          gameMode={gameMode.playerVsBot}
        />
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
        gameMode={gameMode.playerVsBot}
      />}

      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
