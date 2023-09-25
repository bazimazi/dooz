export function resetBoard(selectedSize: number) {
    return (Array(selectedSize)
        .fill(null)
        .map(() => Array(selectedSize).fill(null))
    )
}