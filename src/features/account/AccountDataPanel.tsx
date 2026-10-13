import { DISPLAY_NAME_MAX } from '@/protocol';
import { recoveryCodeSchema } from '@/protocol/social';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { useT } from '@/i18n';
import { accountMessages } from '@/i18n/messages/onlineAccount';
import { apiErrorMessage } from '@/i18n/messages/onlineApiErrors';
import { socialApi } from '@/lib/social-api';
import { useAccountStore } from './store';

/**
 * The account's safety net and the player's rights over their data:
 * recovery codes, a recovery-code sign-in, a download of everything the
 * server holds, and deleting the account.
 *
 * Each action that cannot be undone asks for something deliberate first -
 * deletion wants the name typed again - and nothing here is shown as done
 * until the server has said so.
 */
export function AccountDataPanel() {
  const credentials = useAccountStore((state) => state.credentials);
  const t = useT(accountMessages);
  return (
    <Card className="w-full" padding="tight">
      <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">{t('heading')}</h2>
      <div className="flex flex-col gap-4 px-2 pb-1">
        {credentials ? <RecoveryCodes /> : null}
        <RecoverWithCode />
        {credentials ? <ExportData /> : null}
        {credentials ? <DeleteAccount /> : null}
      </div>
    </Card>
  );
}

function RecoveryCodes() {
  const t = useT(accountMessages);
  const credentials = useAccountStore((state) => state.credentials);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!credentials) return;
    void socialApi
      .recoveryStatus(credentials)
      .then((status) => setRemaining(status.remaining))
      .catch(() => setRemaining(null));
  }, [credentials]);

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm">{t('recoveryCodes')}</p>
      <p className="text-xs text-ink-faint">
        {remaining === null
          ? t('recoveryIntro')
          : remaining === 0
            ? t('recoveryNone')
            : t('recoveryRemaining', { count: remaining })}
      </p>
      {codes ? (
        <div className="flex flex-col gap-2 rounded-tile border border-stroke p-3">
          <p className="text-xs text-ink-muted">{t('shownOnce')}</p>
          <ol className="tnum grid grid-cols-2 gap-1 font-mono text-sm">
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ol>
          <Button
            size="small"
            className="w-auto self-start px-3"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codes.join('\n'));
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? t('copied') : t('copyAll')}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <Button
        size="small"
        className="w-auto self-start px-3"
        onClick={async () => {
          if (!credentials) return;
          try {
            const issued = await socialApi.issueRecoveryCodes(credentials);
            setCodes(issued.codes);
            setRemaining(issued.codes.length);
            setCopied(false);
            setError(null);
          } catch (cause) {
            setError(apiErrorMessage(cause));
          }
        }}
      >
        {remaining ? t('makeNewSet') : t('makeCodes')}
      </Button>
    </section>
  );
}

function RecoverWithCode() {
  const t = useT(accountMessages);
  const adopt = useAccountStore((state) => state.adopt);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="min-h-11 self-start text-xs text-ink-muted underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        {t('lostAccess')}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = recoveryCodeSchema.safeParse(code);
        if (!parsed.success) {
          setError(t('codeFormat'));
          return;
        }
        try {
          const result = await socialApi.recover(name.trim(), parsed.data);
          if (await adopt({ accountId: result.accountId, token: result.token })) {
            setDone(t('recovered', { count: result.remaining }));
            setError(null);
            setCode('');
          } else {
            setError(t('profileFailed'));
          }
        } catch (cause) {
          setError(apiErrorMessage(cause));
        }
      }}
    >
      <Field
        label={t('accountName')}
        value={name}
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="username"
        onChange={(event) => setName(event.target.value)}
      />
      <Field
        label={t('recoveryCode')}
        value={code}
        maxLength={20}
        autoComplete="one-time-code"
        error={error}
        hint={done ?? t('recoverHint')}
        onChange={(event) => setCode(event.target.value)}
      />
      <Button type="submit" size="small" variant="primary" className="w-auto self-start px-4">
        {t('recover')}
      </Button>
    </form>
  );
}

function ExportData() {
  const t = useT(accountMessages);
  const credentials = useAccountStore((state) => state.credentials);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm">{t('yourData')}</p>
      <p className="text-xs text-ink-faint">{t('exportBody')}</p>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <Button
        size="small"
        className="w-auto self-start px-3"
        onClick={async () => {
          if (!credentials) return;
          try {
            const data = await socialApi.exportData(credentials);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'dooz-account.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1_000);
            setError(null);
          } catch (cause) {
            setError(apiErrorMessage(cause));
          }
        }}
      >
        {t('download')}
      </Button>
    </section>
  );
}

function DeleteAccount() {
  const t = useT(accountMessages);
  const credentials = useAccountStore((state) => state.credentials);
  const profile = useAccountStore((state) => state.profile);
  const signOut = useAccountStore((state) => state.signOut);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="self-start text-xs text-danger underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        {t('deleteLink')}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-tile border border-danger/40 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!credentials) return;
        try {
          await socialApi.deleteAccount(credentials, confirm.trim());
          signOut();
        } catch (cause) {
          setError(apiErrorMessage(cause));
        }
      }}
    >
      <p className="text-sm">{t('deleteTitle')}</p>
      <p className="text-xs text-ink-muted">{t('deleteBody')}</p>
      <Field
        label={t('typeToConfirm', { name: profile?.displayName ?? t('yourName') })}
        value={confirm}
        maxLength={DISPLAY_NAME_MAX}
        error={error}
        onChange={(event) => setConfirm(event.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="small"
          variant="ghost"
          className="w-auto px-3"
          onClick={() => setOpen(false)}
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          size="small"
          variant="danger"
          className="w-auto px-3"
          disabled={confirm.trim().toLowerCase() !== (profile?.displayName ?? '').toLowerCase()}
        >
          {t('deleteAccount')}
        </Button>
      </div>
    </form>
  );
}
