import { useState } from "react";
import classes from "./App.module.css";
import { Board } from "./components/Board/Board";
import { Header } from "./components/Header/Header";

function App() {
  return (
    <div className={classes.main}>
      <Header></Header>
      <Board></Board>
    </div>
  );
}

export default App;
