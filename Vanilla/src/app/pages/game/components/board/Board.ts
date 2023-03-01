import Handlebars from "handlebars";
import { ShadowedElement } from "$/ShadowedElement";
import html from "./Board.html?raw";
import css from "./Board.css?raw";

export class Board extends ShadowedElement {
    private _data: any = {};

    connectedCallback() {
        const template = Handlebars.compile(html);
        const s = +this.size;
        this.render(template({ data: Array(s).fill(null), size: 288/s }), css);

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

    static get observedAttributes() { return ['data', 'size'] }

    get data() { return this._data; }
    set data(value: any) {
        this._data = value;
        const cell = this.shadowRoot!.querySelector(`#cell-${value.i}-${value.j}`);
        if (!cell) return;
        cell.innerHTML = `<img src="images/${value.player}.svg" alt="${value.player}" />`
    }

    get size() { return this.getAttribute('size')!; }
    set size(value: string) { this.setAttribute('size', value); }
}