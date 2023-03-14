import classes from "./Modal.module.scss";
import { Footer } from "../Footer";
import { P1 } from "~/utils/players";

interface Props{
    result : number[][] | undefined;
    winner : string
}

export function Modal({result , winner} : Props) {
    return (
        <div className={classes.backDrop}>
            <div className={classes.main}>
                <div className={classes.container}>
                    <div className={classes.imageContainer}>
                        <img src={`static/images/${winner === P1 ? 'Xmodal' : 'Omodal'}.svg`} alt="x" />
                    </div>
                    <div className={classes.winText}>Player {winner === P1 ? 1 : 2} Won!</div>
                    <div className={classes.footer}>
                        <Footer result={result} />
                    </div>
                </div>
            </div>
        </div>
    )
}
