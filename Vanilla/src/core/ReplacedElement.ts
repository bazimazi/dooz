export class ReplacedElement extends HTMLElement {
  constructor(html: string, css?: string) {
    super();

    this.outerHTML = !css ? `${html}` : `
<style>
${css}
</style>

${html}
`;
  }
}
