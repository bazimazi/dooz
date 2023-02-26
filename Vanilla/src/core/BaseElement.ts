export class BaseElement extends HTMLElement {
  constructor(html: string, css: string) {
    super();

    this.attachShadow({ mode: "open" });

    const template = `
    <style>
      ${css}
    </style>

    ${html}
    `;

    const templateEl = document.createElement("template");
    templateEl.innerHTML = template;
    this.shadowRoot!.appendChild(templateEl.content.cloneNode(true));
  }
}
