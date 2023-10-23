export function createBoard(boardSize: number) {
    return (Array(boardSize)
        .fill(null)
        .map(() => Array(boardSize).fill(null))
    )
}