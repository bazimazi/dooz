import { ShadowedElement } from "$/ShadowedElement";
import html from "./HomePage.html?raw";
import css from "./HomePage.css?raw";

export class HomePage extends ShadowedElement {
    constructor() {
        super(html, css);
    }
}