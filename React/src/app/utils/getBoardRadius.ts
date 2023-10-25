interface BoardStyles {
    mainRadius: string;
    templateRadius: string;
}

export function getBoardRadius(boardSize: number) {
    const boardStyles: BoardStyles = { mainRadius: "64px", templateRadius: "56px" };
    switch (boardSize) {
        case 6:
            boardStyles.mainRadius = "42px";
            boardStyles.templateRadius = "30px";
            break;
        case 9:
            boardStyles.mainRadius = "36px";
            boardStyles.templateRadius = "20px";
            break;
    }
    return boardStyles;;
}