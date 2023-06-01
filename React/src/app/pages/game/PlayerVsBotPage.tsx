import { useState, useRef, useEffect } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, generateRandomTurn } from "~/utils/players";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ResultModal } from "./components/Modal/ResultModal";
import { GameMode } from "~/utils/game-mode";
import classes from "./PlayerVsBotPage.module.scss";
import { anyMovesLeft } from "~/utils/any-moves-left";
import { findBestBotMove } from "~/utils/find-best-bot-move";
import { Board } from "./components/Board";
const INITIAL_BOARD = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));

export function PlayerVsBotPage() {
  const [boardData, setBoardData] = useState(structuredClone(INITIAL_BOARD));
  const [currentPlayer, setCurrentPlayer] = useState(generateRandomTurn());
  const [winResult, setWinResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);
  const isFirstMove = useRef(true);

  useEffect(() => {
    if (isFirstMove.current && currentPlayer === P2) {
      handleBot();
    }
    isFirstMove.current = false;
  }, [isFirstMove.current])

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || winResult) return;
    if (currentPlayer === P1) {
      boardData[i][j] = currentPlayer;
      setBoardData([...boardData]);
      if (checkWinner(P1)) return;
      if (anyMovesLeft(boardData)) {
        setShowModal(true);
        return;
      }
      setCurrentPlayer(P2);
      handleBot();
    }
  };

  const handleBot = () => {

    let movement = findBestBotMove(boardData)
    if (movement) {
      boardData[movement.i][movement.j] = P2;
    }
    setBoardData([...boardData]);
    if (checkWinner(P2)) return;
    if (anyMovesLeft(boardData)) {
      setShowModal(true);
    }
    setCurrentPlayer(P1);
  };

  const checkWinner = (currentPlayer: string) => {
    const result = checkBoard(boardData, currentPlayer);
    if (!result) return false;
    setWinResult(result);
    setShowModal(true);
    return true;
  };

  const refreshBoard = () => {
    let newRandomTurnGenerator = generateRandomTurn();
    setBoardData(structuredClone(INITIAL_BOARD));
    setCurrentPlayer(newRandomTurnGenerator);
    if (newRandomTurnGenerator === P2) {
      isFirstMove.current = true;
    }
    setWinResult(undefined);
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
          result={winResult}
        />
      </div>

      {showModal && <ResultModal
        winner={winResult && currentPlayer}
        onRefresh={refreshBoard}
        gameMode={GameMode.playerVsBot}
      />}

      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
