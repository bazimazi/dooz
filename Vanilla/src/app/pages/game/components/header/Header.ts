import { ShadowedElement } from "$/ShadowedElement";
import html from "./Header.html?raw";
import css from "./Header.css?raw";
import { P1 } from "$/players";

export class Header extends ShadowedElement {
    private _player1: HTMLElement;
    private _player2: HTMLElement;

    constructor() {
        super(html, css);

        this._player1 = this.shadowRoot!.querySelector('.player1')!;
        this._player2 = this.shadowRoot!.querySelector('.player2')!;
    }

    static get observedAttributes() { return ['current'] }

    get current() { return this.getAttribute('current')!; }
    set current(value: string) {
        this.setAttribute('current', value);
        if (value === P1) {
            this._player1.classList.add('current');
            this._player2.classList.remove('current');
        } else {
            this._player1.classList.remove('current');
            this._player2.classList.add('current');
        }
    }

}