import { P1 } from "./players";


export function winLineMaker(currentPlayer: string, result?: number[][]) {

    if (!result) return;

    const winLineStyle = {
        top: "",
        left: "",
        transform: "",
        height: "",
        backgroundColor: (currentPlayer == P1) ? "#FF99F6" : "#FFD334"
    }

    let lineStartY = result[0][0];
    let lineEndY = result[2][0];
    let lineStartX = result[0][1];
    let lineEndX = result[2][1];

    let angelIndicater = (lineEndY - lineStartY) / (lineEndX - lineStartX);
    let lineLength = Math.sqrt((lineEndY - lineStartY) ** 2 + (lineEndX - lineStartX) ** 2) * 139;

    winLineStyle.height = `${lineLength}px`;

    if (lineStartY == lineEndY) {
        winLineStyle.left = "14px";
        winLineStyle.top = `${lineStartY * 95 + 58}px`;
        winLineStyle.transform = "rotate(-90deg)";
    }
    else if (lineStartX == lineEndX) {
        winLineStyle.left = `${lineStartX * 95 + 58}px`;
        winLineStyle.top = "16px";
        winLineStyle.transform = "rotate(0deg)";
    }
    else {
        winLineStyle.height = `${lineLength - 37}px`
        winLineStyle.transform = `rotate(${angelIndicater > 0 ? -45 : 45}deg)`;
        winLineStyle.left = `${lineStartX * 125 + 28}px`;
        winLineStyle.top = `${lineStartY * 125 + 28}px`;
    }
    return winLineStyle;
}