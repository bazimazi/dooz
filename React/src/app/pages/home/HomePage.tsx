import { Link } from "@tanstack/react-router";
import { useState } from "react";
import classes from "./HomePage.module.scss";
import { globals } from "~/utils/globals";

export function HomePage() {

  const [boardSize, setBoardSize] = useState(3);

  function clickLeftVector() {
    boardSize != 3 && setBoardSize(boardSize - 3);
  }

  function clickRightVector() {
    boardSize != 9 && setBoardSize(boardSize + 3);
  }

  return (
    <>
      <div className={classes.title}>
        <img
          src="static/images/title.svg"
          alt="title"
          className={classes.titleImg}
        />
        <img
          src="static/images/title_bg_1.svg"
          alt="title"
          className={classes.titleBg1}
        />
        <img
          src="static/images/title_bg_2.svg"
          alt="title"
          className={classes.titleBg2}
        />
      </div>
      <div className={classes.vectorContainer}>
        <img className={classes.leftVector} src="static/images/vector-left.png" alt="leftVector" onClick={clickLeftVector} />
        <img className={classes.rightVector} src="static/images/vector-right.png" alt="rightVector" onClick={clickRightVector} />
      </div>
      <div className={classes.boardSizesContainerBackDrop}>
        <div className={classes.boardSizesContainer} style={{ transform: `translateX(${(6 - boardSize) * 70}px)`, transition: ".3s" }}>
          {globals.boardSizes.map((board, i) => (
            <img key={i} className={`${classes.boardSize}`} style={{ scale: `${(i + 1) * 3 == boardSize ? 1.3 : 1}`, transition: "0.3s" }} src={`static/images/board_size_${board}.svg`} />
          ))}
        </div>
      </div>
      <div className={classes.body}>
        <Link className={classes.playNowButton} to="player-vs-player" search={{ boardSize: boardSize }} >
          Play Now!
        </Link>
        <Link className={classes.playBotButton} to="player-vs-bot" search={{ boardSize: boardSize }}>
          <img src="static/images/bot.svg" />
          Play with bot
        </Link>
        <button className={classes.playFriendsButton}>
          <img src="static/images/friends.svg" />
          Play with friends
        </button>
      </div>
    </>
  );
}
