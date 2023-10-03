import { P1, P2 } from "./players";
import { checkBoard } from "./check-board";
import { anyMovesLeft } from "./any-moves-left";

let winLinesArray: number[][][];

export function findBestBotMove(board: any[][], winLines: number[][][]) {
    winLinesArray = winLines;
    let bestScore = -Infinity;
    let movement;
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] == null) {
                board[i][j] = P2;
                let score = minimax(board, 0, false);
                board[i][j] = null;
                if (score > bestScore) {
                    bestScore = score;
                    movement = { i, j };
                }
            }
        }
    }
    return movement;
}

function minimax(board: any[][], depth: number, isMaximizing: boolean) {

    let current = isMaximizing ? P2 : P1;
    let winResult = winLinesArray && checkBoard(board, current, winLinesArray);

    if (winResult) return isMaximizing ? 1 : -1;
    if (anyMovesLeft(board)) return 0;

    if (isMaximizing) return findMaxMove(board, depth);
    return findMinMove(board, depth)

}

function findMaxMove(board: any[][], depth: number) {

    let bestScore = -Infinity;
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] == null) {
                board[i][j] = P2;
                let score = minimax(board, depth + 1, false);
                board[i][j] = null;
                bestScore = Math.max(bestScore, score);
            }
        }
    }
    return bestScore;
}

function findMinMove(board: any[][], depth: number) {
    let bestScore = Infinity;
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] == null) {
                board[i][j] = P1;
                let score = minimax(board, depth + 1, true);
                board[i][j] = null;
                bestScore = Math.min(bestScore, score);
            }
        }
    }
    return bestScore;
}

