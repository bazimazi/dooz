import { P1, P2 } from "~/utils/players";
import styles from "./Header.module.scss";

interface Props {
  currentPlayer: string;
}

export function Header(props: Props) {

  return (
    <>
      <div class={`${styles.player1} ${props.currentPlayer === P1 ? styles.current : ''}`}>
        <img src="static/images/current_1.svg" alt="Player 1 Turn" class={styles.currentImg} />
        <div class={styles.playerContainer}>
          <img src="static/images/player.svg" alt="Player 1" />
          <div class={styles.playerTitle}>Player 1</div>
          <img src="static/images/player1.svg" alt="X" />
        </div>
      </div>

      <div class={styles.vs}>VS</div>

      <div class={`${styles.player2} ${props.currentPlayer === P2 ? styles.current : ''}`}>
        <img src="static/images/current_2.svg" alt="Player 2 Turn" class={styles.currentImg} />
        <div class={styles.playerContainer}>
          <img src="static/images/player.svg" alt="Player 2" />
          <div class={styles.playerTitle}>Player 2</div>
          <img src="static/images/player2.svg" alt="O" />
        </div>
      </div>
    </>
  );
}
