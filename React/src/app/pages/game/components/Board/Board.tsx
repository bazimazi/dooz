import { winLineStyleMaker } from "~/utils/winline-style-maker";
import classes from "./Board.module.scss";
import { useEffect, useState } from "react";
import { getBoardRadius } from "~/utils/getBoardRadius";

interface Props {
  boardData: string[][];
  onClick: (i: number, j: number) => void;
  currentPlayer: string;
  result?: number[][];
}

export function Board({ boardData, onClick, currentPlayer, result }: Props) {

  const winLineStyle = winLineStyleMaker(currentPlayer, boardData.length, result);
  const [boardRadius, setBoardRadius] = useState(getBoardRadius(boardData.length));

  useEffect(() => {
    setBoardRadius(getBoardRadius(boardData.length));
  }, [boardData.length]);

  return (
    <div className={classes.main} style={{ borderRadius: boardRadius.mainRadius }}>
      <div className={classes.template} style={{ borderRadius: boardRadius.templateRadius }}>
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
    </div>
  );
}
