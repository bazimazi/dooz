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

export function checkBoard(board: string[][]): WinResult | void {
    const p1s: number[][] = [];
    const p2s: number[][] = [];

    board.forEach((row, i) => {
        row.forEach((col, j) => {
            if (col === P1) {
                p1s.push([i, j]);
            } else if (col === P2) {
                p2s.push([i, j]);
            }
        });
    });

    for (let index = 0; index < WIN_LINES.length; index++) {
        const line = WIN_LINES[index];

        const p1Wins = line.every(lineCell => {
            for (let k = 0; k < p1s.length; k++) {
                const p1Cell = p1s[k];
                if (p1Cell[0] === lineCell[0] && p1Cell[1] === lineCell[1]) {
                    return true;
                }
            }
            return false;
        })
        if (p1Wins) return { player: P1, line };


        const p2Wins = line.every(lineCell => {
            for (let k = 0; k < p2s.length; k++) {
                const p2Cell = p2s[k];
                if (p2Cell[0] === lineCell[0] && p2Cell[1] === lineCell[1]) {
                    return true;
                }
            }
            return false;
        })
        if (p2Wins) return { player: P2, line };
    }
}