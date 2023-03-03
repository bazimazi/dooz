import type { Component } from 'solid-js';
import { AppRouter } from './AppRouter';
import styles from './App.module.css';

export function App() {
  return (
    <div class={styles.main}>
      <AppRouter />
    </div>
  );
};