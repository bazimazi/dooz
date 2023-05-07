import classes  from "./GamePageButtons.module.scss";

interface Props {
    onRefresh: () => void;
    modal: boolean;
}

export function GamePageButtons({ modal, onRefresh }: Props){
    return (
        <>
            <a className={`${classes.refresh} ${modal ? classes.modalColor : ""}`} onClick={() => onRefresh()}>
                <img src="static/images/refresh.svg" alt="refresh" />
            </a>

            <a className={`${classes.home} ${modal ? classes.modalColor : ""}`} href="/">
                <img src="static/images/home.svg" alt="home" />
            </a>
        </>
    );
}