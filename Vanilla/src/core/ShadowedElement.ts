export class ShadowedElement extends HTMLElement {
  constructor(html: string, css?: string) {
    super();

    this.attachShadow({ mode: "open" });

    const template = !css ? `${html}` : `
<style>
* {
    box-sizing: border-box;
}
${css}
</style>

${html}
`;

    const templateEl = document.createElement("template");
    templateEl.innerHTML = template;
    this.shadowRoot!.appendChild(templateEl.content.cloneNode(true));
  }
}
