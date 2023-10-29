import { P1, P2 } from "./players";
import { checkBoard } from "./check-board";
import { anyMovesLeft } from "./any-moves-left";

export function findBestBotMove(board: any[][]) {
    const memo = new Map();
    let bestScore = -Infinity;
    let bestBotMove;
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] == null) {
                board[i][j] = P2;
                let score = minimax(board, 0, false, -Infinity, Infinity, memo);
                board[i][j] = null;
                if (score > bestScore) {
                    bestScore = score;
                    bestBotMove = { i, j };
                }
            }
        }
    }
    return bestBotMove;
}

function minimax(board: any[][], depth: number, isMaximizing: boolean, alpha: number, beta: number, memo: Map<any, any>) {
    let currentPlayer = isMaximizing ? P1 : P2;
    const key = board.toString();
    if (memo.has(key)) return memo.get(key);
    if (checkBoard(board, currentPlayer)) return isMaximizing ? -100 + depth : 100 - depth;
    if (anyMovesLeft(board) || depth >= board.length) return 0;
    let bestScore = isMaximizing ? -Infinity : Infinity;
    outerLoop:
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] === null) {
                board[i][j] = isMaximizing ? P2 : P1;
                let score = minimax(board, depth + 1, !isMaximizing, alpha, beta, memo);
                board[i][j] = null;
                bestScore = isMaximizing ? Math.max(bestScore, score) : Math.min(bestScore, score);
                if (isMaximizing) {
                    alpha = Math.max(alpha, score);
                    if (beta <= alpha) {
                        break outerLoop;
                    }
                } else {
                    beta = Math.min(beta, score);
                    if (beta <= alpha) {
                        break outerLoop;
                    }
                }
            }
        }
    }
    memo.set(key, bestScore);
    return bestScore;
}

