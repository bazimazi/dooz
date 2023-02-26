export class RouterLink extends HTMLAnchorElement {
    constructor() {
        super();

        this.addEventListener('click', e => {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent("router-navigate", {
                bubbles: true,
                composed: true,
                cancelable: false,
                detail: this.href,
            }));
        }, false);
    }
}
