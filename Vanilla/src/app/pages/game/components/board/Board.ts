import Handlebars from "handlebars";
import { ShadowedElement } from "$/ShadowedElement";
import html from "./Board.html?raw";
import css from "./Board.css?raw";

const INITIAL_BOARD = Array(3).fill(null).map(() => Array(3).fill(null));

export class Board extends ShadowedElement {
    private _data: any = {};

    constructor() {
        const template = Handlebars.compile(html);
        super(template({ boardData: INITIAL_BOARD }), css);

        this.shadowRoot?.querySelectorAll('.cell').forEach(div => {
            div.addEventListener('click', e => {
                if (!(e.target instanceof HTMLDivElement)) return;
                const el = e.target as HTMLDivElement;
                this.dispatchEvent(new CustomEvent('cell-click', {
                    detail: { i: el.getAttribute('data-i'), j: el.getAttribute('data-j') }
                }));
            })
        });
    }

    static get observedAttributes() { return ['data'] }

    get data() { return this._data; }
    set data(value: any) {
        this._data = value;
        const cell = this.shadowRoot!.querySelector(`#cell-${value.i}-${value.j}`);
        if (!cell) return;
        cell.innerHTML = `<img src="images/${value.player}.svg" alt="${value.player}" />`
    }
}