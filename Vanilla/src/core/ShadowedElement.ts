import { ReplacedElement } from "./ReplacedElement";

export class ShadowedElement extends ReplacedElement {
  constructor(html?: string, css?: string) {
    super();

    this.attachShadow({ mode: "open" });

    this.render(html, css);
  }

  protected render(html?: string, css?: string) {
    css = css ? `
  * {
    box-sizing: border-box;
  }
  ${css}` : css;
    const template = this.template(html, css);
    if (!template) return;

    const templateEl = document.createElement("template");
    templateEl.innerHTML = template;
    this.shadowRoot!.appendChild(templateEl.content.cloneNode(true));
  }

}
