import { useEffect, useState } from 'react';
import { Toggle } from '@/components/ui/Field';
import { useT } from '@/i18n';
import { socialMessages } from '@/i18n/messages/onlineSocial';
import { disablePush, enablePush, type PushState, pushState } from '@/lib/push';
import { browserOptedOut, setTelemetryChoice, telemetryChoice } from '@/lib/telemetry';

/**
 * The settings for things that leave the device: notifications from the
 * server, and anonymous usage and crash reports.
 *
 * Notifications are opt-in and only offered where they can work (the
 * installed web app, with a server that has push configured). Usage reports
 * are on by default but say exactly what they are, and a browser's Do Not
 * Track overrides the switch rather than being overridden by it.
 */
export function NotificationSettings() {
  const t = useT(socialMessages);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const value = await pushState();
      if (live) setState(value);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state === null || state === 'unsupported') return null;

  const description =
    state === 'denied'
      ? t('notificationsDenied')
      : state === 'unavailable'
        ? t('notificationsUnavailable')
        : t('notificationsDescription');

  return (
    <Toggle
      label={t('notifications')}
      description={busy ? t('working') : description}
      checked={state === 'on'}
      onChange={async (on) => {
        if (busy || state === 'denied' || state === 'unavailable') return;
        setBusy(true);
        try {
          setState(await (on ? enablePush() : disablePush()));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

export function TelemetrySettings() {
  const t = useT(socialMessages);
  const [choice, setChoice] = useState(telemetryChoice);
  const blocked = browserOptedOut();
  return (
    <Toggle
      label={t('telemetry')}
      description={blocked ? t('telemetryBlocked') : t('telemetryDescription')}
      checked={choice && !blocked}
      onChange={(on) => {
        if (blocked) return;
        setTelemetryChoice(on);
        setChoice(on);
      }}
    />
  );
}
