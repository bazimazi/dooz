import { GamePageButtons } from "../GamePageButtons";
import classes from "./Footer.module.scss";

interface Props {
  onRefresh: () => void;
}

export function Footer({ onRefresh }: Props) {
  return (
      <GamePageButtons
        winner={undefined}
        onRefresh={onRefresh}
      />
  );
}
