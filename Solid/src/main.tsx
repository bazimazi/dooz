/* @refresh reload */
import { render } from 'solid-js/web';

import './main.css';
import App from './app/App';

const root = document.getElementById('root');
render(() => <App />, root!);
