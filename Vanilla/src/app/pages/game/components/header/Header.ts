import { ShadowedElement } from "$/ShadowedElement";
import html from "./Header.html?raw";
import css from "./Header.css?raw";

export class Header extends ShadowedElement {
    constructor() {
        super(html, css);
    }
}