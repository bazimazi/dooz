import { ShadowedElement } from "$/ShadowedElement";
import html from "./Footer.html?raw";
import css from "./Footer.css?raw";

export class Footer extends ShadowedElement {
    constructor() {
        super(html, css);
    }
}