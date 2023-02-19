import {
  Outlet,
  RouterProvider,
  ReactRouter,
  Route,
  RootRoute,
} from "@tanstack/react-router";
import { GamePage } from "./pages/game";
import { HomePage } from "./pages/home";

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

const routeTree = rootRoute.addChildren([homeRoute, gameRoute]);

const router = new ReactRouter({ routeTree });

export function AppRouter() {
  return <RouterProvider router={router} />;
}
