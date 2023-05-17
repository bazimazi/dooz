import classes  from "./GamePageButtons.module.scss";

interface Props {
    onRefresh: () => void;
    inResultModal?: boolean;
}

export function GamePageButtons({ inResultModal, onRefresh }: Props){
    return (
        <>
            <a className={`${classes.refresh} ${inResultModal ? classes.modalColor : ""}`} onClick={() => onRefresh()}>
                <img src="static/images/refresh.svg" alt="refresh" />
            </a>

            <a className={`${classes.home} ${inResultModal ? classes.modalColor : ""}`} href="/">
                <img src="static/images/home.svg" alt="home" />
            </a>
        </>
    );
}