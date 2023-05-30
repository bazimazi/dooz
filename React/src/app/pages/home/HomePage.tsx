import { Link } from "@tanstack/react-router";
import { useState } from "react";
import classes from "./HomePage.module.scss";

const boardSizes = [3, 6, 9];
export function HomePage() {

const [selectedSize,setSelectedSize] = useState(boardSizes[1]);

  function clickLeftVector() {
    selectedSize != 3 && setSelectedSize(selectedSize - 3);

  }

  function clickRightVector() {
    selectedSize != 9 && setSelectedSize(selectedSize + 3);
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
      <div className={classes.boardSizesContainer}>
        {boardSizes.map((board, i) => (
          <img key={i} className={`${classes.boardSize}`} style={{ transform: `translate(${(6 - selectedSize) * 55}px)`,transition: ".3s" , scale:`${(i+1)*3 == selectedSize ? 1.3 : 1}`}} src={`static/images/board_size_${board}.svg`} />
        ))}
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
