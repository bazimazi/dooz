export class ReplacedElement extends HTMLElement {
  protected html?: string = '';
  protected css?: string = '';

  constructor(html?: string, css?: string) {
    super();

    this.html = html;
    this.css = css;

    const outerHtml = this.template(html, css);

    if (!outerHtml) return;

    this.outerHTML = outerHtml;
  }

  protected template(html?: string, css?: string) {
    if (!html && !css) return;

    if (html) {
      return !css ? `${html}` : `
<style>
${css}
</style>

${html}
`;
    }

    return `
<style>
${css}
</style>`;
  }
}
