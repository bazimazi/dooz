import classes from "./ResultModal.module.scss";
import { P1 } from "~/utils/players";
import { GamePageButtons } from "../../GamePageButtons";
import { GameMode } from "~/utils/game-mode";

interface Props {
    winner: string | undefined;
    onRefresh: () => void;
    gameMode: GameMode;
}

export function ResultModal({ winner, onRefresh, gameMode }: Props) {
    let resultModalIconSrc = "";
    let resultModalText = "Draw";
    if (winner) {
        resultModalIconSrc = gameMode === GameMode.playerVsBot ? `static/images/${winner === P1 ? 'smile' : 'sad'}.svg` : `static/images/${winner === P1 ? 'Xmodal' : 'Omodal'}.svg`;
        resultModalText = gameMode === GameMode.playerVsBot ? winner === P1 ? "you Won" : "you Lost" : `Player ${winner === P1 ? 1 : 2} Won!`;
    }

    return (
        <div className={classes.backDrop}>
            <div className={classes.main} >
                <div className={classes.container}>
                    <div className={classes.imageContainer}>
                        <img src={resultModalIconSrc} />
                    </div>
                    <div className={winner ? classes.winText : classes.drawText}>{resultModalText}</div>
                    <div className={classes.footer}>
                        <GamePageButtons inResultModal onRefresh={onRefresh} />
                    </div>
                </div>
            </div>
        </div>
    )
}
