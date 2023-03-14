import { P1 } from "./players";


const boardWidth = 312;
const mainBorderSize = 1;
const boardSize = 3;
const winLineSize = 3;
const padding = 12;
const cellWidth = (boardWidth - 2 * (padding + mainBorderSize)) / boardSize;


export function winLineStyleMaker(currentPlayer: string, result?: number[][]) {

    if (!result) return;

    const winLineStyle = {
        top: "",
        left: "",
        transform: "",
        height: "",
        backgroundColor: (currentPlayer == P1) ? "#FF99F6" : "#FFD334"
    }


    let lineStartX = result[0][1];
    let lineStartY = result[0][0];
    let lineEndX = result[result.length - 1][1];
    let lineEndY = result[result.length - 1][0];


    let angelIndicater = (lineEndY - lineStartY) / (lineEndX - lineStartX);
    let lineLength = winLineSize * cellWidth;
    winLineStyle.height = `${lineLength}px`;

    if (lineStartY == lineEndY) {
        winLineStyle.left = `0px`;
        winLineStyle.top = `${cellWidth * (lineStartY + 0.5)}px`;
        winLineStyle.transform = "rotate(-90deg)";
    } else if (lineStartX == lineEndX) {
        winLineStyle.left = `${cellWidth * (lineStartX + 0.5)}px`;
        winLineStyle.top = `0px`;
        winLineStyle.transform = "rotate(0deg)";
    }
    else {
        lineLength = Math.sqrt(2) * cellWidth * winLineSize;
        winLineStyle.height = `${lineLength}px`
        winLineStyle.transform = `rotate(${angelIndicater > 0 ? -45 : 45}deg)`;
        winLineStyle.left = `${(lineStartX + (angelIndicater > 0 ? 0 : 1)) * cellWidth}px`;
        winLineStyle.top = `${lineStartY * cellWidth}px`;
    }
    return winLineStyle;
}