import { createApp } from 'vue'
import App from './app/App.vue'
import { appRouter } from './app/AppRouter';
import './main.scss'

const app = createApp(App);
app.use(appRouter);
app.mount('#root');
