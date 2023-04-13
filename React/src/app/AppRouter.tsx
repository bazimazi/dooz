import {
  Outlet,
  RouterProvider,
  ReactRouter,
  Route,
  RootRoute,
} from "@tanstack/react-router";
import { GamePage } from "./pages/game";
import { HomePage } from "./pages/home";
import {BotGamePage} from "./pages/game/BotGamePage"

const rootRoute = new RootRoute({
  component: () => <Outlet />,
});

const homeRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const gameRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/game",
  component: GamePage,
});

const botGameRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/botgame",
  component: BotGamePage,
});

const routeTree = rootRoute.addChildren([homeRoute, gameRoute, botGameRoute]);

const router = new ReactRouter({ routeTree });

export function AppRouter() {
  return <RouterProvider router={router} />;
}
