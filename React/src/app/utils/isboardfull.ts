export function isBoardFull(board: string[][]) {
    return !board.some(row => row.some(cell => cell == null));
}