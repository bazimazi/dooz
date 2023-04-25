import { useState, useRef, useEffect } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, generateRandomTurn } from "~/utils/players";
import { Board } from "../components/Board";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { GameMode } from "~/utils/game-mode";
import { minimax } from "~/utils/minimax";
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

  useEffect(() => {
    if (isFirstMove.current && currentPlayer === P2) {
      handleBot();
    }
    isFirstMove.current = false;
  }, [isFirstMove.current])

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

    let bestScore = -Infinity;
    let move;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (boardData[i][j] == null) {
          boardData[i][j] = P2;
          let score = minimax(boardData, 0, false);
          boardData[i][j] = null;
          if (score > bestScore) {
            bestScore = score;
            move = { i, j };
          }
        }
      }
    }
    if (move) boardData[move.i][move.j] = P2;
    setBoardData([...boardData]);
    if (checkWinner(P2)) return;
    setCurrentPlayer(P1);
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
          gameMode={GameMode.playerVsBot}
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
        gameMode={GameMode.playerVsBot}
      />}

      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
