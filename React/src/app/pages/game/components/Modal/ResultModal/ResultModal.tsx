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

    let resultModalIcon = <></>;
    let resultModalText = <div className={classes.drawText}>It's Draw</div>;
    if (winner) {
        resultModalIcon = <img src={gameMode === GameMode.playerVsBot ? `static/images/${winner === P1 ? 'smile' : 'sad'}.svg` : `static/images/${winner === P1 ? 'Xmodal' : 'Omodal'}.svg`} alt="x" />;
        resultModalText = <div className={classes.winText}>{gameMode === GameMode.playerVsBot ? winner === P1 ? "you Won" : "you Lost" : `Player ${winner === P1 ? 1 : 2} Won!`}</div>;
    }

    return (
        <div className={classes.backDrop}>
            <div className={classes.main} >
                <div className={classes.container}>
                    <div className={classes.imageContainer}>
                        {resultModalIcon}
                    </div>
                    {resultModalText}
                    <div className={classes.footer}>
                        <GamePageButtons modal={true} onRefresh={onRefresh} />
                    </div>
                </div>
            </div>
        </div>
    )
}
