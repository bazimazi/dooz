/* @refresh reload */
import { render } from 'solid-js/web';
import { App } from './app/App';
import './main.scss';

const root = document.getElementById('root');
render(() => <App />, root!);
