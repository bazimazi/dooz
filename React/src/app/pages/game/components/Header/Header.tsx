import classes from "./Header.module.scss";

export function Header() {
  return (
    <>
      <div className={classes.player1}>
        <div className={classes.playerContainer}>
          <img src="static/images/player.svg" alt="Player 1" />
          <div className={classes.playerTitle}>Player 1</div>
          <img src="static/images/player1.svg" alt="X" />
        </div>
      </div>

      <div className={classes.vs}>VS</div>

      <div className={classes.player2}>
        <div className={classes.playerContainer}>
          <img src="static/images/player.svg" alt="Player 2" />
          <div className={classes.playerTitle}>Player 2</div>
          <img src="static/images/player2.svg" alt="O" />
        </div>
      </div>
    </>
  );
}
