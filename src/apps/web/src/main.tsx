import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initMusic } from './lib/music';
import { applyTheme, loadPreferences } from './lib/preferences';
import { installUiSounds } from './lib/ui-sounds';
import { router } from './router';
import './styles/fonts.css';
import './styles/theme.css';

// Applied before the first paint rather than in an effect: a theme that lands
// one frame late is a white flash on a dark-themed device, which is the single
// most noticeable thing an app can get wrong on launch.
applyTheme(loadPreferences().theme);

// Nothing plays until the first gesture - browsers insist - but both need to
// be listening for it before it happens.
installUiSounds();
initMusic();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
