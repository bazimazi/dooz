export function createBoard(selectedSize: number) {
    return (Array(selectedSize)
        .fill(null)
        .map(() => Array(selectedSize).fill(null))
    )
}