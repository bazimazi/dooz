import { P1, P2 } from "./players";
import { WinResult } from "./WinResult";

const WIN_LINES = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],

    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],

    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]],
];

export function checkBoard(board: string[][], currentPlayer: string): WinResult | void {

    let line: number[][] = [];
    let Win = WIN_LINES.some(WIN_LINE => {
        line = WIN_LINE;
        return WIN_LINE.every(e => {
            return board[e[0]][e[1]] == currentPlayer;
        })
    })

    if (Win) return { player: currentPlayer, line }
}