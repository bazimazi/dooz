import classes from "./App.module.css";
import { AppRouter } from "./AppRouter";

function App() {
  return (
    <div className={classes.main}>
      <AppRouter />
    </div>
  );
}

export default App;
