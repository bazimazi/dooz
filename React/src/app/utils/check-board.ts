import { createWinLines } from "./create-winlines";
const boardSize = 3;
const winLines = createWinLines(boardSize);

export function checkBoard(board: string[][], currentPlayer: string): number[][] | void {

    return winLines.find(line => line.every(cell => board[cell[0]][cell[1]] == currentPlayer))

}