import { Router } from "#/router/Router";
import { ReplacedElement } from "$/ReplacedElement";
import html from "./App.html?raw";
import css from "./App.css?raw";

export class App extends ReplacedElement {
  constructor() {
    super(html, css);
  }

  connectedCallback() {
    var router = new Router({
      routes: [{
        url: '/',
        content: '<home- class="page" />'
      }, {
        url: '/game',
        content: '<game- class="page" />'
      }, {
        url: '/haha',
        content: '<h1>haha</h1>'
      }]
    });
    let main = document.querySelector('div.main')!;
    router.start((content: string) => main.innerHTML = content);
  }
}
