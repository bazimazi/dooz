import { BaseElement } from "../core/BaseElement";
import html from "./App.html?raw";
import css from "./App.css?raw";

console.log('App...')

class App extends BaseElement {
  constructor() {
    super(html, css);
  }
}

customElements.define("app-x", App);
// if (!customElements.get("app-comp")) {
// }
