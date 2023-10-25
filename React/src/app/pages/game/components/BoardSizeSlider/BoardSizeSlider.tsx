import classes from "./BoardSizeSlider.module.scss";
import { globals } from "~/utils/globals";

interface Props {
    setBoardSize: React.Dispatch<React.SetStateAction<number>>;
    boardSize: number
}


export function BoardSizeSlider({ boardSize, setBoardSize }: Props) {

    function clickLeftVector() {
        boardSize != 3 && setBoardSize(boardSize - 3);
    }

    function clickRightVector() {
        boardSize != 9 && setBoardSize(boardSize + 3);
    }

    return (
        <>
            <div className={classes.vectorContainer}>
                <img className={classes.leftVector} src="static/images/vector-left.png" alt="leftVector" onClick={clickLeftVector} />
                <img className={classes.rightVector} src="static/images/vector-right.png" alt="rightVector" onClick={clickRightVector} />
            </div>
            <div className={classes.boardSizesContainerBackDrop}>
                <div className={classes.boardSizesContainer} style={{ transform: `translateX(${(6 - boardSize) * 70}px)`, transition: ".3s" }}>
                    {globals.boardSizes.map((board, i) => (
                        <img key={i} className={`${classes.boardSize}`} style={{ scale: `${(i + 1) * 3 == boardSize ? 1.3 : 1}`, transition: "0.3s" }} src={`static/images/board_size_${board}.svg`} />
                    ))}
                </div>
            </div>
        </>
    )
}