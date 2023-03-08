<script>
    import { Router, Route } from "svelte-routing";
    import HomePage from "./pages/home/HomePage.svelte";
    import GamePage from "./pages/game/GamePage.svelte";
</script>

<Router>
    <Route path="/"><HomePage /></Route>
    <Route path="/game"><GamePage /></Route>
</Router>