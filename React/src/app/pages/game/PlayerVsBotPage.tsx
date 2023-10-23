import { useState, useRef, useEffect } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, generateRandomTurn } from "~/utils/players";
import { Footer } from "./components/Footer";
import { GamePageHeader } from "./components/Header";
import { ResultModal } from "./components/Modal/ResultModal";
import { GameMode } from "~/utils/game-mode";
import classes from "./PlayerVsBotPage.module.scss";
import { anyMovesLeft } from "~/utils/any-moves-left";
import { findBestBotMove } from "~/utils/find-best-bot-move";
import { Board } from "./components/Board";
import { createBoard } from "~/utils/create-board";
import { useNavigate, useSearch } from "@tanstack/react-router";

export function PlayerVsBotPage() {
  const { boardSize } = useSearch({ from: "" });
  const [boardData, setBoardData] = useState(createBoard(boardSize));
  const [currentPlayer, setCurrentPlayer] = useState(generateRandomTurn());
  const [winResult, setWinResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);
  const isFirstMove = useRef(true);
  const navigate = useNavigate({ from: "" });

  useEffect(() => {
    if (!isFirstMove.current) {
      refreshBoard();
    }
  }, [boardSize])

  useEffect(() => {
    if (currentPlayer === P2 && !winResult) {
      handleBot();
    }
    isFirstMove.current = false;
  }, [currentPlayer]);



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
    }
  };

  const handleBot = async () => {
    setTimeout(() => {
      let bestBotMove = findBestBotMove(boardData);
      if (bestBotMove) {
        boardData[bestBotMove.i][bestBotMove.j] = P2;
      }
      setBoardData([...boardData]);
      if (checkWinner(P2)) return;
      if (anyMovesLeft(boardData)) {
        setShowModal(true);
      }
      setCurrentPlayer(P1);
    }, 500);
  };

  const checkWinner = (currentPlayer: string) => {
    const result = checkBoard(boardData, currentPlayer);
    if (!result) return false;
    setWinResult(result);
    setShowModal(true);
    return true;
  };

  const refreshBoard = () => {
    setBoardData(createBoard(boardSize));
    let cp = generateRandomTurn();
    setCurrentPlayer(cp);
    isFirstMove.current = true;
    setWinResult(undefined);
    setShowModal(false);
  }

  function onSizeChange(size: number) {
    navigate({ to: "/player-vs-bot", search: { boardSize: size } });
  }

  return (
    <div className={classes.page}>
      <GamePageHeader
        currentPlayer={currentPlayer}
        gameMode={GameMode.playerVsBot}
        onSizeChange={onSizeChange}
        boardSize={boardSize}
      />
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
