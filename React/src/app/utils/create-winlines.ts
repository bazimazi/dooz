export function createWinLines(boardSize: number) {

    let winLineSize = 3;

    switch (boardSize) {
        case 3:
            winLineSize = 3
            break;
        case 6:
            winLineSize = 4
            break;
        case 9:
            winLineSize = 5
            break;
    }

    let winLines = [];

    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j <= boardSize - winLineSize; j++) {
            let horizontal = [];
            for (let k = j; k < j + winLineSize; k++) {
                horizontal.push([i, k]);
            }
            winLines.push(horizontal);
        }
    }

    for (let j = 0; j < boardSize; j++) {
        for (let i = 0; i <= boardSize - winLineSize; i++) {
            let vertical = [];
            for (let k = i; k < i + winLineSize; k++) {
                vertical.push([k, j]);
            }
            winLines.push(vertical);
        }
    }

    for (let i = 0; i <= boardSize - winLineSize; i++) {
        for (let j = 0; j <= boardSize - winLineSize; j++) {
            let diagonalOne = [];
            let diagonalTwo = [];
            for (let k = 0; k < winLineSize; k++) {
                diagonalOne.push([i + k, j + k]);
                diagonalTwo.push([j + k, boardSize - k - i]);
            }
            winLines.push(diagonalOne);
            winLines.push(diagonalTwo);

        }
    }
    return winLines;
}

