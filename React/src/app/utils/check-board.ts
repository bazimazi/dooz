
export function checkBoard(board: string[][], currentPlayer: string, winLines: number[][][]): number[][] | void {

    return winLines.find(line => line.every(cell => board[cell[0]][cell[1]] == currentPlayer))

}