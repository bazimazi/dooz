import classes from "./Board.module.css";

function Board() {
  return (
    <div className={classes.main}>
      <div className={classes.row}>
        <div className={classes.cell}>1</div>
        <div className={classes.cell}>2</div>
        <div className={classes.cell}>3</div>
      </div>
      <div className={classes.row}>
        <div className={classes.cell}>4</div>
        <div className={classes.cell}>5</div>
        <div className={classes.cell}>6</div>
      </div>
      <div className={classes.row}>
        <div className={classes.cell}>7</div>
        <div className={classes.cell}>8</div>
        <div className={classes.cell}>9</div>
      </div>
    </div>
  );
}

export default Board;
