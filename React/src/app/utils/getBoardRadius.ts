interface BoardStyles {
    mainRadius: string;
    templateRadius: string;
}

export function getBoardRadius(selectedSize: number) {
    const boardStyles: BoardStyles = { mainRadius: "64px", templateRadius: "56px" };
    switch (selectedSize) {
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