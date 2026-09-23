import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadPreferences, applyTheme } from './lib/preferences';
import { router } from './router';
import './styles/fonts.css';
import './styles/theme.css';

// Applied before the first paint rather than in an effect: a theme that lands
// one frame late is a white flash on a dark-themed device, which is the single
// most noticeable thing an app can get wrong on launch.
applyTheme(loadPreferences().theme);

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
