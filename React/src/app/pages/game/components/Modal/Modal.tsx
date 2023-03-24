import classes from "./Modal.module.scss";
import { P1 } from "~/utils/players";
import { GamePageButtons } from "../GamePageButtons";

interface Props {
    winner: string;
    onRefresh: () => void;
}

export function Modal({ winner, onRefresh }: Props) {
    return (
        <div className={classes.backDrop}>
            <div className={classes.main} >
                <div className={classes.container}>
                    <div className={classes.imageContainer}>
                        <img src={`static/images/${winner === P1 ? 'Xmodal' : 'Omodal'}.svg`} alt="x" />
                    </div>
                    <div className={classes.winText}>Player {winner === P1 ? 1 : 2} Won!</div>
                    <div className={classes.footer}>
                        <GamePageButtons winner={winner} onRefresh={onRefresh} />
                    </div>
                </div>
            </div>
        </div>
    )
}
