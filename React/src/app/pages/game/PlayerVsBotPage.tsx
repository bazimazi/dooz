import { useState, useRef, useEffect } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, generateRandomTurn } from "~/utils/players";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ResultModal } from "./components/Modal/ResultModal";
import { GameMode } from "~/utils/game-mode";
import classes from "./PlayerVsBotPage.module.scss";
import { isBoardFull } from "~/utils/isboardfull";
import { botMove } from "~/utils/bot-move-logic";
import { Board } from "./components/Board";
const INITIAL_BOARD = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));

export function PlayerVsBotPage() {
  const [boardData, setBoardData] = useState(structuredClone(INITIAL_BOARD));
  const [currentPlayer, setCurrentPlayer] = useState(generateRandomTurn());
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
      if (isBoardFull(boardData)) {
        setShowModal(true);
        return;
      }
      setCurrentPlayer(P2);
      handleBot();
    }
  };

  const handleBot = () => {

    let move = botMove(boardData)
    if (move) {
      boardData[move.i][move.j] = P2;
    }
    setBoardData([...boardData]);
    if (checkWinner(P2)) return;
    if (isBoardFull(boardData)) {
      setShowModal(true);
    }
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

      {showModal && <ResultModal
        winner={result && currentPlayer}
        onRefresh={refreshBoard}
        gameMode={GameMode.playerVsBot}
      />}

      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
