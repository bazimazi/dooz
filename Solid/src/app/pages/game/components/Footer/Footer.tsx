import styles from "./Footer.module.scss";

export function Footer() {
  return (
    <>
      <a class={styles.refresh} onClick={() => window.location.reload()}>
        <img src="static/images/refresh.svg" alt="refresh" />
      </a>

      <a class={styles.home} href="/">
        <img src="static/images/home.svg" alt="home" />
      </a>
    </>
  );
}
