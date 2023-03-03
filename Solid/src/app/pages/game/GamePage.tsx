import { createSignal } from "solid-js";
import { checkBoard } from "~/utils/check-board";
import { P1, P2 } from "~/utils/players";
import { Board } from "./components/Board";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import styles from "./GamePage.module.scss";

const INITIAL_BOARD = Array(3).fill(null).map(() => Array(3).fill(null));

export default function GamePage() {
  const [boardData, setBoardData] = createSignal(INITIAL_BOARD);
  const [currentPlayer, setCurrentPlayer] = createSignal(Math.round(Math.random()) ? P1 : P2);
  const [result, setResult] = createSignal<number[][]>();

  const handleClick = (i: number, j: number) => {
    const data = boardData();
    const current = currentPlayer();
    if (data[i][j] || result()) return;

    data[i] = [...data[i]];
    data[i][j] = current;
    setBoardData([...data]);
    if (checkWinner()) return;
    
    setCurrentPlayer(c => c === P1 ? P2 : P1);
  };

  const checkWinner = () => {
    const data = boardData();
    const winResult = checkBoard(data, currentPlayer());
    if (!winResult) return false;

    setResult(winResult);
    winResult.forEach((cell) => {
      data[cell[0]][cell[1]] = "🤩";
    });
    setBoardData(data);
    return true;
  };

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <Header currentPlayer={currentPlayer()} />
      </div>

      <div class={styles.body}>
        <Board data={boardData()} onClick={handleClick} />
      </div>

      <div class={styles.footer}>
        <Footer />
      </div>
    </div>
  );
}
