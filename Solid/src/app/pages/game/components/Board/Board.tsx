import { Index } from "solid-js";
import styles from "./Board.module.scss";

interface Props {
  data: string[][];
  onClick: (i: number, j: number) => void;
}

export function Board(props: Props) {
  return (
    <div class={styles.main}>
      <div class={styles.container}>
        <Index each={props.data}>{
          (row, i) =>
            <div class={styles.row}>
              <Index each={row()}>{
                (col, j) =>
                  <div class={styles.cell} onClick={() => props.onClick(i, j)}>
                    {col() && <img src={`static/images/${col()}.svg`} alt={col()} />}
                  </div>
              }</Index>
            </div>
        }</Index>
      </div>
    </div>
  );
}
