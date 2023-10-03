import { createContext, useState } from "react";
import classes from "./App.module.scss";
import { AppRouter } from "./AppRouter";

interface IContextValue {
  selectedSize: number;
  setSelectedSize: React.Dispatch<React.SetStateAction<number>>
}

export const boardSizeContext = createContext<IContextValue>({ selectedSize: 3, setSelectedSize: () => { } });

function App() {
  const [selectedSize, setSelectedSize] = useState(3);
  const contextValue = {
    selectedSize,
    setSelectedSize
  }
  return (
    <boardSizeContext.Provider value={contextValue}>
      <div className={classes.main}>
        <AppRouter />
      </div>
    </boardSizeContext.Provider>
  );
}

export default App;
