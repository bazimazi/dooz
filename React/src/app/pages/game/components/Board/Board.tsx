import { winLineStyleMaker } from "~/utils/winline-style-maker";
import classes from "./Board.module.scss";

interface Props {
  boardData: string[][];
  onClick: (i: number, j: number) => void;
  currentPlayer: string;
  result?: number[][];
}

export function Board({ boardData, onClick, currentPlayer, result }: Props) {
  const winLineStyle = winLineStyleMaker(currentPlayer, result);
  return (
    <div className={classes.main}>
      <div className={classes.container}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
    </div>
  );
}
