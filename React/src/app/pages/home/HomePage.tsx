import { Link } from "@tanstack/react-router";
import classes from "./HomePage.module.scss";

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
        <Link className={classes.palyNowButton} to="game">
          Play Now!
        </Link>
        <Link className={classes.palyBotButton} to="botgame">
          <img src="static/images/bot.svg" />
          Play with bot
        </Link>
        <button className={classes.palyFriendsButton}>
          <img src="static/images/friends.svg" />
          Play with friends
        </button>
      </div>
    </>
  );
}
