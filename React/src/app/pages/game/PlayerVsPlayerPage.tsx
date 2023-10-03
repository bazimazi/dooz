import { useContext, useEffect, useState } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, generateRandomTurn } from "~/utils/players";
import { Board } from "./components/Board";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { ResultModal } from "./components/Modal/ResultModal";
import { GameMode } from "~/utils/game-mode";
import classes from "./PlayerVsPlayerPage.module.scss";
import { anyMovesLeft } from "~/utils/any-moves-left";
import { boardSizeContext } from "~/App";
import { resetBoard } from "~/utils/reset-board";
import { createWinLines } from "~/utils/create-winlines";

export function PlayerVsPlayerPage() {
  const { selectedSize } = useContext(boardSizeContext);
  const [boardData, setBoardData] = useState(structuredClone(resetBoard(selectedSize)));
  const [currentPlayer, setCurrentPlayer] = useState(generateRandomTurn());
  const [winResult, setWinResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);
  const [winLines, setWinlines] = useState<number[][][]>();

  useEffect(() => {
    setWinlines(createWinLines(selectedSize));
  }, []);

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
    const result = checkBoard(boardData, currentPlayer,winLines!);
    if (!result) return false;
    setWinResult(result);
    setShowModal(true);
    return true;
  };

  const refreshBoard = () => {
    setBoardData(structuredClone(resetBoard(selectedSize)));
    setCurrentPlayer(generateRandomTurn());
    setWinResult(undefined);
    setShowModal(false);
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <Header
          currentPlayer={currentPlayer}
          gameMode={GameMode.playerVsPlayerLocal}
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
        gameMode={GameMode.playerVsPlayerLocal}
      />}

      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
