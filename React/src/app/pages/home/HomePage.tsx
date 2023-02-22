import { Link } from "@tanstack/react-router";
import classes from "./HomePage.module.css";

export function HomePage() {
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
      <div className={classes.body}>
        <a className={classes.palyNowButton} href="game">
          Play Now!
        </a>
        <button className={classes.palyBotButton}>
          <img src="static/images/bot.svg" />
          Play with bot
        </button>
        <button className={classes.palyFriendsButton}>
          <img src="static/images/friends.svg" />
          Play with friends
        </button>
      </div>
    </>
  );
}
