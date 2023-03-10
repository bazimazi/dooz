import { createRouter, createWebHistory } from 'vue-router'
import HomePage from './pages/home/HomePage.vue';
import GamePage from './pages/game/GamePage.vue';

const routes = [
    { path: '/', component: HomePage },
    { path: '/game', component: GamePage },
]

export const appRouter = createRouter({
    history: createWebHistory(),
    routes, 
});