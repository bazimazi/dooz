import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initMusic } from './lib/music';
import {
  applyGraphics,
  applyLanguage,
  applyStyle,
  applyTheme,
  loadPreferences,
} from './lib/preferences';
import { installUiSounds } from './lib/ui-sounds';
import { useAccountStore } from './features/account/store';
import { installCloudSync } from './features/cloud/sync';
import { installTelemetry } from './lib/telemetry';
import { installGameplayEvents } from './lib/telemetry-events';
import { installDeepLinks, warmHaptics } from './platform';
import { router } from './router';
import './styles/fonts.css';
import './styles/theme.css';

// Applied before the first paint rather than in an effect: a theme that lands
// one frame late is a white flash on a dark-themed device, which is the single
// most noticeable thing an app can get wrong on launch.
applyTheme(loadPreferences().theme);
applyGraphics(loadPreferences().graphics);
applyStyle(loadPreferences().style);
applyLanguage(loadPreferences().language);
window.addEventListener('online', () => void useAccountStore.getState().refresh());

// Nothing plays until the first gesture - browsers insist - but both need to
// be listening for it before it happens.
installUiSounds();
initMusic();

// Native builds open at whatever screen a `dooz://` or app link points to - the
// link that launched the app, and any that arrive while it runs - and get the
// phone's haptics driver loaded before the first move wants it.
void installDeepLinks((path) => router.history.push(path));
warmHaptics();

// Crash reports and anonymous usage events (off with Do Not Track or the
// Settings switch), and solo progress kept in step with the account's cloud
// save whenever there is an account to keep it in.
installTelemetry();
installGameplayEvents(router);
installCloudSync();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
