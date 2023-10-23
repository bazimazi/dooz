import { useEffect, useState } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, generateRandomTurn } from "~/utils/players";
import { Board } from "./components/Board";
import { Footer } from "./components/Footer";
import { GamePageHeader } from "./components/Header";
import { ResultModal } from "./components/Modal/ResultModal";
import { GameMode } from "~/utils/game-mode";
import classes from "./PlayerVsPlayerPage.module.scss";
import { anyMovesLeft } from "~/utils/any-moves-left";
import { createBoard } from "~/utils/create-board";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { globals } from "~/utils/globals";

export function PlayerVsPlayerPage() {
  const { boardSize } = useSearch({ from: "" });
  const [boardData, setBoardData] = useState(createBoard(boardSize));
  const [currentPlayer, setCurrentPlayer] = useState(generateRandomTurn());
  const [winResult, setWinResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate({ from: "" });

  useEffect(() => {
    refreshBoard();
  }, [boardSize]);

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || winResult) return;
    boardData[i][j] = currentPlayer;
    setBoardData([...boardData]);

    if (checkWinner()) return;
    if (anyMovesLeft(boardData)) {
      setShowModal(true);
      return;
    }

    setCurrentPlayer(currentPlayer === P1 ? P2 : P1);
  };

  const checkWinner = () => {
    const result = checkBoard(boardData, currentPlayer);
    if (!result) return false;
    setWinResult(result);
    setShowModal(true);
    return true;
  };

  const refreshBoard = () => {
    setBoardData(createBoard(boardSize));
    setCurrentPlayer(generateRandomTurn());
    setWinResult(undefined);
    setShowModal(false);
  }

  function onSizeChange(size: number) {
    navigate({ to: globals.playerVsPlayer, search: { boardSize: size as never }, params: {} });
  }

  return (
    <div className={classes.page}>
      <GamePageHeader
        currentPlayer={currentPlayer}
        gameMode={GameMode.playerVsPlayerLocal}
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
        gameMode={GameMode.playerVsPlayerLocal}
      />}
      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
