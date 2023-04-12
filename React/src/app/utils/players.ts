export const P1 = 'X';
export const P2 = 'O';

export function generateRandomTurn() {
  return Math.round(Math.random()) ? P1 : P2;
}