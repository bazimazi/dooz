import classes from "./Footer.module.scss";

interface Props {
  onRefresh: () => void;
 }

export function Footer({ onRefresh }:Props) {
  return (
    <>
      <a className={classes.refresh} onClick={() => onRefresh()}>
        <img src="static/images/refresh.svg" alt="refresh" />
      </a>

      <a className={classes.home} href="/">
        <img src="static/images/home.svg" alt="home" />
      </a>
    </>
  );
}
