import { App } from "~/App";
import { RouterLink } from "#/router/RouterLink";
import { HomePage } from "~/pages/home/HomePage";
import { GamePage } from "~/pages/game/GamePage";
import { Header } from "~/pages/game/components/header/Header";
import { Board } from "~/pages/game/components/board/Board";
import { Footer } from "~/pages/game/components/footer/Footer";


customElements.define("a-", RouterLink, { extends: 'a' });

customElements.define("app-", App);
customElements.define("home-", HomePage);
customElements.define("game-", GamePage);
customElements.define("header-", Header);
customElements.define("board-", Board);
customElements.define("footer-", Footer);