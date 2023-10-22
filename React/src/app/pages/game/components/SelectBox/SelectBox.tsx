import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import classes from "./SelectBox.module.scss";
import { globals } from "~/utils/globals";

export function SelectBox() {
  const [isSelectBoxOpen, setIsSelectBoxOpen] = useState(false);
  const { boardSize } = useSearch({ from: "" });

  return (
    <div className={classes.modeContainer}>
      <div className={`${classes.selectBox} ${isSelectBoxOpen && classes.selectBoxShowed}`}>
        <div className={classes.selectedSize} onClick={() => setIsSelectBoxOpen(!isSelectBoxOpen)}>
          {boardSize} x {boardSize}
          <img src={`${isSelectBoxOpen ? "static/images/arrow-up.png" : "static/images/arrow-down.png"}`} alt="arrow" />
        </div>
        {
          globals.boardSizes.map((size, i) =>
            <Link key={i} search={{ boardSize: size }}><div onClick={() => setIsSelectBoxOpen(false)}>{size} x {size}</div></Link>
          )
        }
      </div>
    </div>
  )

}