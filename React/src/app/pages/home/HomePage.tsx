import { Link } from "@tanstack/react-router";
import { useState } from "react";
import classes from "./HomePage.module.scss";
import { BoardSizeSlider } from "../game/components/BoardSizeSlider";

export function HomePage() {

  const [boardSize, setBoardSize] = useState(3);


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
      <BoardSizeSlider setBoardSize={setBoardSize} boardSize={boardSize} />
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
