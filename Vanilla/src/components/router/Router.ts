import { trim } from "$/trim";

export class Router {
    private _routeConfig: any;
    private _routes: any[];

    constructor(routeConfig: any) {
        this._routeConfig = routeConfig;
        this._routes = (this._routeConfig.routes || []).map((r: any) => ({ ...r, url: trim(r.url, '/') }));
    }

    public start(renderer: (c: string) => void) {
        window.addEventListener('popstate', e => {
            e.preventDefault();
            this.render(renderer);
        });

        document.addEventListener('router-navigate', (e: any) => {
            e.preventDefault();
            history.pushState(null, '', e.detail);
            this.render(renderer);
        });

        this.render(renderer);
    }

    private render(renderer: (c: string) => void) {
        let path = decodeURI(window.location.pathname);
        var url = trim(path, '/');
        for (const route of this._routes) {
            if (route.url === url) {
                console.log('found route:', route);
                renderer(route.content);
            }
        }
    }

}
