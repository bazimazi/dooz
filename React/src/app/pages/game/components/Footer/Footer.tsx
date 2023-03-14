import classes from "./Footer.module.scss";

interface Props{
  result : number[][] | undefined;
}

export function Footer({result}:Props) {
  return (
    <>
      <a className={`${classes.refresh} ${result ? classes.modalColor : ""}` } onClick={() => window.location.reload()}>
        <img src="static/images/refresh.svg" alt="refresh" />
      </a>

      <a className={`${classes.home} ${result ? classes.modalColor : ""}`} href="/">
        <img src="static/images/home.svg" alt="home" />
      </a>
    </>
  );
}
