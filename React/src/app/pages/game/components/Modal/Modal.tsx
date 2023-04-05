import classes from "./Modal.module.scss";
import { P1 } from "~/utils/players";
import { GamePageButtons } from "../GamePageButtons";

interface Props {
    winner: string;
    onRefresh: () => void;
    gameType: string;
}

export function Modal({ winner, onRefresh, gameType }: Props) {
    return (
        <div className={classes.backDrop}>
            <div className={classes.main} >
                <div className={classes.container}>
                    <div className={classes.imageContainer}>
                        <img src={gameType === "botGame" ? `static/images/${winner === P1 ? 'smile' : 'sad'}.svg` : `static/images/${winner === P1 ? 'Xmodal' : 'Omodal'}.svg`} alt="x" />
                    </div>
                    <div className={classes.winText}>{gameType === "botGame" ? winner === P1 ? "you Won" : "you Lost" : `Player ${winner === P1 ? 1 : 2} Won!`}</div>
                    <div className={classes.footer}>
                        <GamePageButtons winner={winner} onRefresh={onRefresh} />
                    </div>
                </div>
            </div>
        </div>
    )
}
