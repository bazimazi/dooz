import { useState, useRef, useEffect, useContext } from "react";
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
import { boardSizeContext } from "~/App";
import { resetBoard } from "~/utils/reset-board";
import { createWinLines } from "~/utils/create-winlines";

export function PlayerVsBotPage() {
  const { selectedSize } = useContext(boardSizeContext);
  const [boardData, setBoardData] = useState(structuredClone(resetBoard(selectedSize)));
  const [currentPlayer, setCurrentPlayer] = useState(generateRandomTurn());
  const [winResult, setWinResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);
  const isFirstMove = useRef(true);
  const [winLines, setWinlines] = useState<number[][][]>()

  useEffect(() => {
    setWinlines(createWinLines(selectedSize));
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
    let movement = findBestBotMove(boardData, winLines!)
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
    const result = checkBoard(boardData, currentPlayer, winLines!);
    if (!result) return false;
    setWinResult(result);
    setShowModal(true);
    return true;
  };

  const refreshBoard = () => {
    let newRandomTurnGenerator = generateRandomTurn();
    setBoardData(structuredClone(resetBoard(selectedSize)));
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
