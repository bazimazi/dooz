import classes from "./Footer.module.scss";

interface Props {
   onClick: () => void;
 }

export function Footer({onClick}:Props) {
  return (
    <>
      <a className={classes.refresh} onClick={() => onClick()}>
        <img src="static/images/refresh.svg" alt="refresh" />
      </a>

      <a className={classes.home} href="/">
        <img src="static/images/home.svg" alt="home" />
      </a>
    </>
  );
}
