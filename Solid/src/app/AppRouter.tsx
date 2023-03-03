import { lazy } from "solid-js";
import { Router, Routes, Route } from "@solidjs/router";
const HomePage = lazy(() => import("./pages/home/HomePage"));
const GamePage = lazy(() => import("./pages/game/GamePage"));

export function AppRouter() {
    return (
        <Router>
            <Routes>
                <Route path="/" component={HomePage} />
                <Route path="/game" component={GamePage} />
            </Routes>
        </Router>
    );
};