import { P1, P2 } from "./players";
import { checkBoard } from "./check-board";

function isAvailableCell(board: string[][]) {
    return board.some(row => row.some(cell => cell == null));
}

export function minimax(board: any, depth: number, isMaximizing: boolean) {
    let current = isMaximizing ? P2 : P1;
    let winResult = checkBoard(board, current);
    if (winResult) {
        if (isMaximizing) return 1;
        if (!isMaximizing) return -1;
    } else {
        if (!isAvailableCell(board)) return 0
    }
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[i][j] == null) {
                    board[i][j] = P2;
                    let score = minimax(board, depth + 1, false);
                    board[i][j] = null;
                    if (score > bestScore) bestScore = score;
                }
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[i][j] == null) {
                    board[i][j] = P1;
                    let score = minimax(board, depth + 1, true);
                    board[i][j] = null;
                    if (score < bestScore) bestScore = score;
                }
            }
        }
        return bestScore;
    }
}
