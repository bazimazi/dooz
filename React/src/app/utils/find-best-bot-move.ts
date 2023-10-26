import { P1, P2 } from "./players";
import { checkBoard } from "./check-board";
import { getWinLines } from "./get-winLines";
import { anyMovesLeft } from "./any-moves-left";

let winLinesArray: number[][][];
let test = 0;
export function findBestBotMove(board: any[][]) {
    winLinesArray = getWinLines(board.length);
    const memo = new Map();
    let bestScore = -Infinity;
    let bestBotMove;
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] == null) {
                board[i][j] = P2;
                let score = minimax(board, 0, false, -Infinity, Infinity, memo);
                board[i][j] = null;
                console.log("score", score, "bestscore", bestScore);
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
    let currentPlayer = isMaximizing ? P2 : P1;
    const key = board.toString();
    let winResult = checkBoard(board, currentPlayer);
    if (winResult) return isMaximizing ? 100 - depth : -100 + depth;
    if (anyMovesLeft(board)) return 0;
    if (memo.has(key)) return memo.get(key);
    if (isMaximizing) return findMaxMove(board, depth, alpha, beta, memo, key);
    return findMinMove(board, depth, alpha, beta, memo, key);
}

function findMaxMove(board: any[][], depth: number, alpha: number, beta: number, memo: Map<any, any>, key: string) {
    let bestScore = -Infinity;
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] === null) {
                board[i][j] = P2;
                let score = minimax(board, depth + 1, false, alpha, beta, memo);
                board[i][j] = null;
                bestScore = Math.max(bestScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) {
                    break;
                }
            }
        }
    }
    memo.set(key, bestScore);
    return bestScore;
}

function findMinMove(board: any[][], depth: number, alpha: number, beta: number, memo: Map<any, any>, key: string) {
    let bestScore = Infinity;
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board.length; j++) {
            if (board[i][j] === null) {
                board[i][j] = P1;
                let score = minimax(board, depth + 1, true, alpha, beta, memo);
                board[i][j] = null;
                bestScore = Math.min(bestScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) {
                    break;
                }
            }
        }
    }
    memo.set(key, bestScore);
    return bestScore;
}

