import { winLineMaker } from "~/utils/winline-maker"
import classes from "./Board.module.scss";

interface Props {
  boardData: string[][];
  onClick: (i: number, j: number) => void;
  currentPlayer: string;
  result?: number[][];
}

export function Board({ boardData, onClick, currentPlayer, result }: Props) {

  const winLineStyle = winLineMaker(currentPlayer, result);
  return (
    <div className={classes.main}>
      <div className={classes.container}>
        {boardData.map((row, i) => (
          <div key={`row-${i}`} className={classes.row}>
            {row.map((col, j) => (
              <div key={`col-${j}`} className={classes.cell} onClick={() => onClick(i, j)}>
                {col && <img src={`static/images/${col}.svg`} alt={col} />}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={classes.winLine} style={winLineStyle} />
    </div>
  );
}
