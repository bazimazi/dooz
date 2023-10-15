export const winLines: { [key: number]: number[][][] } = {
    3: [],
    6: [],
    9: []
}

export function createWinLines(boardSize: number) {

    const winLineSize: { [key: number]: number } = {
        3: 3,
        6: 4,
        9: 5
    }


    if (winLines[boardSize].length != 0) return;

    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j <= boardSize - winLineSize[boardSize]; j++) {
            let horizontal = [];
            for (let k = j; k < j + winLineSize[boardSize]; k++) {
                horizontal.push([i, k]);
            }
            winLines[boardSize].push(horizontal);
        }
    }

    for (let j = 0; j < boardSize; j++) {
        for (let i = 0; i <= boardSize - winLineSize[boardSize]; i++) {
            let vertical = [];
            for (let k = i; k < i + winLineSize[boardSize]; k++) {
                vertical.push([k, j]);
            }
            winLines[boardSize].push(vertical);
        }
    }

    for (let i = 0; i <= boardSize - winLineSize[boardSize]; i++) {
        for (let j = 0; j <= boardSize - winLineSize[boardSize]; j++) {
            let diagonalOne = [];
            let diagonalTwo = [];
            for (let k = 0; k < winLineSize[boardSize]; k++) {
                diagonalOne.push([i + k, j + k]);
                diagonalTwo.push([j + k, boardSize - k - i - 1]);
            }
            winLines[boardSize].push(diagonalOne);
            winLines[boardSize].push(diagonalTwo);

        }
    }
}

