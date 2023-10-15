import { getWinLines } from "./get-winLines"

export function checkBoard(board: string[][], currentPlayer: string): number[][] | void {
    const winLines = getWinLines(board.length);
    if (winLines) return winLines.find(line => line.every(cell => board[cell[0]][cell[1]] == currentPlayer))

}