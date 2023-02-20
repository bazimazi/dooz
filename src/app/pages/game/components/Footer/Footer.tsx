import classes from "./Footer.module.css";

export function Footer() {
  return (
    <>
      <a className={classes.refresh} onClick={() => window.location.reload()}>
        <img src="static/images/refresh.svg" alt="refresh" />
      </a>
      
      <a className={classes.home} href="/">
        <img src="static/images/home.svg" alt="home" />
      </a>
    </>
  );
}
