import classes  from "./GamePageButtons.module.scss";

interface Props {
    onRefresh: () => void;
    winner: string | undefined;
}

export function GamePageButtons({ winner, onRefresh }: Props){
    return (
        <>
            <a className={`${classes.refresh} ${winner ? classes.modalColor : ""}`} onClick={() => onRefresh()}>
                <img src="static/images/refresh.svg" alt="refresh" />
            </a>

            <a className={`${classes.home} ${winner ? classes.modalColor : ""}`} href="/">
                <img src="static/images/home.svg" alt="home" />
            </a>
        </>
    );
}