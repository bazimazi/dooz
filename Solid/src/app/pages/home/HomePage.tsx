import { A } from "@solidjs/router";
import styles from "./HomePage.module.scss";

export default function HomePage() {
  return (
    <>
      <div class={styles.title}>
        <img
          src="static/images/title.svg"
          alt="title"
          class={styles.titleImg}
        />
        <img
          src="static/images/title_bg_1.svg"
          alt="title"
          class={styles.titleBg1}
        />
        <img
          src="static/images/title_bg_2.svg"
          alt="title"
          class={styles.titleBg2}
        />
      </div>
      <div class={styles.body}>
        <a class={styles.palyNowButton} href="game">
          Play Now!
        </a>
        <button class={styles.palyBotButton}>
          <img src="static/images/bot.svg" />
          Play with bot
        </button>
        <button class={styles.palyFriendsButton}>
          <img src="static/images/friends.svg" />
          Play with friends
        </button>
      </div>
    </>
  );
}
