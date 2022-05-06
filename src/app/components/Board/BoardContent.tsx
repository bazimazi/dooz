import { WinResult } from "~/utils/WinResult";
import classes from "./Board.module.css";

interface Props {
  boardData: string[][],
  onClick: (i: number, j: number) => void,
  currentPlayer: string,
  result?: WinResult
}

export function BoardContent({ boardData, onClick, currentPlayer, result }: Props) {
  return (
    <div className={classes.main}>
      {result ? (
        <div>winner: <b>{result.player}</b></div>
      ) : (
        <div>current player: <b>{currentPlayer}</b></div>
      )
      }
      {boardData.map((row, i) => (
        <div key={`row-${i}`} className={classes.row}>
          {row.map((col, j) => (
            <div
              key={`col-${j}`}
              className={classes.cell}
              onClick={() => onClick(i, j)}>{col}</div>
          ))}
        </div>
      ))}

    </div >
  );
}
