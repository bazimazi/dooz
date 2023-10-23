import React from "react";
import { globals } from "./globals";
import { P1 } from "./players";

const allSizeCellWidth: { [key: number]: number } = {
    3: 0,
    6: 0,
    9: 0
}

globals.boardSizes.map(size => {
    allSizeCellWidth[size] = (globals.boardWidth - 2 * (globals.padding + globals.boardBorderWidth)) / size;
})

export function winLineStyleMaker(currentPlayer: string, boardSize: number, result?: number[][]) {

    if (!result) return;

    const cellWidth = allSizeCellWidth[boardSize];
    const winLineStyle = {
        visibility: "visible",
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
    let lineLength = result.length * cellWidth;
    winLineStyle.height = `${lineLength}px`;

    if (lineStartY == lineEndY) {
        winLineStyle.left = `${cellWidth * (lineStartX) - 2}px`; //minus 2 is half of winLine width
        winLineStyle.top = `${cellWidth * (lineStartY + 0.5)}px`;
        winLineStyle.transform = "rotate(-90deg)";
    } else if (lineStartX == lineEndX) {
        winLineStyle.left = `${cellWidth * (lineStartX + 0.5) - 2}px`; //minus 2 is half of winLine width
        winLineStyle.top = `${cellWidth * (lineStartY)}px`;
        winLineStyle.transform = "rotate(0deg)";
    }
    else {
        lineLength = Math.sqrt(2) * cellWidth * result.length;
        winLineStyle.height = `${lineLength}px`
        winLineStyle.transform = `rotate(${angelIndicater > 0 ? -45 : 45}deg)`;
        winLineStyle.left = `${(lineStartX + (angelIndicater > 0 ? 0 : 1)) * cellWidth}px`;
        winLineStyle.top = `${lineStartY * cellWidth}px`;
    }
    return winLineStyle as React.CSSProperties;
}