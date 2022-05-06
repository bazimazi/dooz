import { useState } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2 } from "~/utils/players";
import { WinResult } from "~/utils/WinResult";
import { BoardContent } from "./BoardContent";

const INITIAL_BOARD = Array(3).fill(null).map(() => Array(3).fill(null));

export function Board() {
  const [boardData, setBoardData] = useState(INITIAL_BOARD);
  const [currentPlayer, setCurrentPlayer] = useState(Math.round(Math.random()) ? P1 : P2)
  const [result, setResult] = useState<WinResult>();

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || result) return;

    boardData[i][j] = currentPlayer;
    setBoardData([...boardData]);
    setCurrentPlayer(currentPlayer === P1 ? P2 : P1);

    checkWinner();
  }

  const checkWinner = () => {
    const winResult = checkBoard(boardData);
    if (!winResult) return;

    setResult(winResult);
    winResult.line.forEach(cell => {
      boardData[cell[0]][cell[1]] = '🤩';
    })
    setBoardData([...boardData]);
  }

  return <BoardContent boardData={boardData} onClick={handleClick} currentPlayer={currentPlayer} result={result} />

}
