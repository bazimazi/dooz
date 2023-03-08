import { P1 } from "./players";


const boardSize = 312;
const mainBorderSize = 1;
const cellsNumberinBoardSide = 3;
const cellsNumberinWinLine = 3;
const paddingSize = 12;
const cellSize = (boardSize - 2 * (paddingSize + mainBorderSize)) / cellsNumberinBoardSide;
const pinkLineHex = "#FF99F6";
const yellowLineHex = "#FFD334";

export function winLineMaker(currentPlayer: string, result?: number[][]) {

    if (!result) return;

    const winLineStyle = {
        top: "",
        left: "",
        transform: "",
        height: "",
        backgroundColor: (currentPlayer == P1) ? pinkLineHex : yellowLineHex
    }

    let lineStartY = result[0][0];
    let lineStartX = result[0][1];
    let lineEndY = result[result.length - 1][0];
    let lineEndX = result[result.length - 1][1];

    let angelIndicater = (lineEndY - lineStartY) / (lineEndX - lineStartX);
    let lineLength = cellsNumberinWinLine * cellSize;
    winLineStyle.height = `${lineLength}px`;

    if (lineStartY == lineEndY) {
        winLineStyle.left = `0px`;
        winLineStyle.top = `${cellSize * (lineStartY + 0.5)}px`;
        winLineStyle.transform = "rotate(-90deg)";
    } else if (lineStartX == lineEndX) {
        winLineStyle.left = `${cellSize * (lineStartX + 0.5)}px`;
        winLineStyle.top = `0px`;
        winLineStyle.transform = "rotate(0deg)";
    }
    else {
        lineLength = Math.sqrt(2) * cellSize * cellsNumberinWinLine ;
        winLineStyle.height = `${lineLength}px`
        winLineStyle.transform = `rotate(${angelIndicater > 0 ? -45 : 45}deg)`;
        winLineStyle.left = `${(lineStartX + (angelIndicater > 0 ? 0 : 1) ) * cellSize}px`;
        winLineStyle.top = `${lineStartY * cellSize}px`;
    }
    return winLineStyle;
}