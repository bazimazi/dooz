import { P1, P2 } from "~/utils/players";
import classes from "./Board.module.scss";

interface Props {
  boardData: string[][];
  onClick: (i: number, j: number) => void;
  currentPlayer: string;
  result?: number[][];
}

export function Board({ boardData, onClick, currentPlayer, result }: Props) {

  const winningStyle = {
    bottom: "",
    left: "",
    transform: "",
    height: "",
    backgroundColor: (currentPlayer == P1) ? "#FF99F6" : "#FFD334"
  }

  switch (JSON.stringify(result)) {
    case JSON.stringify([[0, 0], [0, 1], [0, 2]]):

      winningStyle.bottom = "250px";
      winningStyle.left = "14px";
      winningStyle.transform = "rotate(90deg)";
      winningStyle.height = "279px"
      break;

    case JSON.stringify([[1, 0], [1, 1], [1, 2]]):

      winningStyle.bottom = "154px";
      winningStyle.left = "14px";
      winningStyle.transform = "rotate(90deg)";
      winningStyle.height = "279px"
      break;

    case JSON.stringify([[2, 0], [2, 1], [2, 2]]):

      winningStyle.bottom = "58px";
      winningStyle.left = "14px";
      winningStyle.transform = "rotate(90deg)";
      winningStyle.height = "279px"
      break;

    case JSON.stringify([[0, 0], [1, 0], [2, 0]]):

      winningStyle.bottom = "294px";
      winningStyle.left = "58px";
      winningStyle.transform = "rotate(180deg)";
      winningStyle.height = "279px"
      break;

    case JSON.stringify([[0, 1], [1, 1], [2, 1]]):

      winningStyle.bottom = "294px";
      winningStyle.left = "152px";
      winningStyle.transform = "rotate(180deg)";
      winningStyle.height = "279px"
      break;

    case JSON.stringify([[0, 2], [1, 2], [2, 2]]):

      winningStyle.bottom = "294px";
      winningStyle.left = "248px";
      winningStyle.transform = "rotate(180deg)";
      winningStyle.height = "279px"
      break;

    case JSON.stringify([[0, 0], [1, 1], [2, 2]]):

      winningStyle.bottom = "280px";
      winningStyle.left = "27px";
      winningStyle.transform = "rotate(135deg)";
      winningStyle.height = "354px"
      break;

    case JSON.stringify( [[0, 2], [1, 1], [2, 0]]):

      winningStyle.bottom = "280px";
      winningStyle.left = "280px";
      winningStyle.transform = "rotate(225deg)";
      winningStyle.height = "354px"
      break;

    default:
      break;
  }

  return (
    <div className={classes.main}>
      <div className={classes.container}>
        {/* {result ? (
          <div>
            winner: <b>{result.player}</b>
          </div>
        ) : (
          <div>
            current player: <b>{currentPlayer}</b>
          </div>
        )} */}
        {boardData.map((row, i) => (
          <div key={`row-${i}`} className={classes.row}>
            {row.map((col, j) => (
              <div
                key={`col-${j}`}
                className={classes.cell}
                onClick={() => onClick(i, j)}
              >
                {col && <img src={`static/images/${col}.svg`} alt={col} />}
              </div>
            ))}
          </div>
        ))}

      </div>
      <div className={classes.winnerLine} style={winningStyle}>

      </div>
    </div>
  );
}
