import { useEffect, useState, useRef } from "react";
import { checkBoard } from "~/utils/check-board";
import { P1, P2, randomTurnGenerator } from "~/utils/players";
import { Board } from "../components/Board";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import classes from "./BotGamePage.module.scss";

const INITIAL_BOARD = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));

export function BotGamePage() {
  const [boardData, setBoardData] = useState(structuredClone(INITIAL_BOARD));
  const [currentPlayer, setCurrentPlayer] = useState(
    randomTurnGenerator()
  );
  const [result, setResult] = useState<number[][]>();
  const [showModal, setShowModal] = useState(false);
  const stopStrictModeOnMount = useRef(true);

  useEffect(() => {
    if (stopStrictModeOnMount.current) {
      if (currentPlayer === P2) {
        setTimeout(() => {
          botTurnHandler();
        }, 1000);
      }
    }
    stopStrictModeOnMount.current = false;
  }, [stopStrictModeOnMount.current])

  const handleClick = (i: number, j: number) => {
    if (boardData[i][j] || result) return;
    if (currentPlayer === P1) {
      boardData[i][j] = currentPlayer;
      setBoardData([...boardData]);

      if (checkWinner(P1)) return;

      setCurrentPlayer(P2);


      setTimeout(() => {
        botTurnHandler();
      }, 1000);

    }
  };

  const botTurnHandler = () => {
    let row = Math.floor(Math.random() * 3);
    let col = Math.floor(Math.random() * 3);

    if (boardData[row][col]) {
      botTurnHandler();
    } else {
      boardData[row][col] = P2;
      setBoardData([...boardData]);
      if (checkWinner(P2)) return;
      setCurrentPlayer(P1);
    }

  };

  const checkWinner = (currentPlayer: string) => {
    const winResult = checkBoard(boardData, currentPlayer);
    if (!winResult) return false;
    setResult(winResult);
    setTimeout(() => {
      setShowModal(true);
    }, 500);
    return true;
  };

  const refreshBoard = () => {
    let newRandomTurnGenerator = randomTurnGenerator();
    setBoardData(structuredClone(INITIAL_BOARD));
    setCurrentPlayer(newRandomTurnGenerator);
    if (newRandomTurnGenerator === P2) {
      stopStrictModeOnMount.current = true;
    }
    setResult(undefined);
    setShowModal(false);
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <Header
          currentPlayer={currentPlayer}
          gameType="botGame"
        />
      </div>

      <div className={classes.body}>
        <Board
          boardData={boardData}
          onClick={handleClick}
          currentPlayer={currentPlayer}
          result={result}
        />
      </div>

      {showModal && <Modal
        winner={currentPlayer}
        onRefresh={refreshBoard}
        gameType="botGame"
      />}

      <div className={classes.footer}>
        <Footer onRefresh={refreshBoard} />
      </div>
    </div>
  );
}
