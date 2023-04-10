export function createWinLines(boardSize: number) {
    let winLines = [];
    let diagonal1 = [];
    let diagonal2 = [];
    for (let row = 0; row < boardSize; row++) {
        let horizontal = [];
        for (let col = 0; col < boardSize; col++) {
            horizontal.push([row, col]);
        }
        winLines.push(horizontal)
    }
    for (let col = 0; col < boardSize; col++) {
        let vertical = [];
        for (let row = 0; row < boardSize; row++) {
            vertical.push([row, col]);
        }
        winLines.push(vertical)
    }

    for (let i = 0; i < boardSize; i++) {
        diagonal1.push([i, i]);
        diagonal2.push([i, boardSize - i - 1]);
    }
    winLines.push(diagonal1);
    winLines.push(diagonal2);

    return winLines
}