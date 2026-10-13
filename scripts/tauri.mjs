#!/usr/bin/env node
/**
 * `tauri`, with the parts of its configuration that depend on the deployment
 * filled in from the environment.
 *
 *   node scripts/tauri.mjs build            # = tauri build --config <generated>
 *   node scripts/tauri.mjs android build
 *   node scripts/tauri.mjs --print build    # show the generated overrides only
 *
 * `src-tauri/tauri.conf.json` is a static file, but three things in it can only
 * be known per deployment:
 *
 * - The content security policy has to name the multiplayer server, or the
 *   webview refuses to connect to it. It is built from `VITE_SERVER_URL` - the
 *   same variable the client reads - so the two can never disagree, and no
 *   wildcard is ever needed.
 * - The updater needs the release feed and the public half of the signing key
 *   (`TAURI_UPDATER_ENDPOINTS`, `TAURI_UPDATER_PUBKEY`). Without both it is
 *   left out entirely and the app simply never offers an update.
 * - Android App Links and iOS Universal Links need the domain that hosts the
 *   verification files (`TAURI_APP_LINK_HOST`). Without it only `dooz://` links
 *   open the app.
 *
 * Variables come from the environment or the same `.env` files Vite reads.
 * The result is written under `src-tauri/target` and passed with `--config`,
 * which Tauri merges over the static file (JSON Merge Patch: objects merge,
 * arrays and strings replace).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import cli from '@tauri-apps/cli';
import { loadEnv } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const baseConfig = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));

/**
 * The deployment-specific overrides for `baseConfig`, from `env`.
 *
 * Pure, so it can be checked by printing it (`--print`) before a release.
 */
export function tauriOverrides(env, base = baseConfig) {
  const overrides = {};
  const warnings = [];

  const server = env.VITE_SERVER_URL?.trim();
  if (server) {
    let url;
    try {
      url = new URL(server);
    } catch {
      throw new Error(`VITE_SERVER_URL is not a URL: ${server}`);
    }
    const socket = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const allowed = [url.origin, `${socket}//${url.host}`];
    const current = base.app?.security?.csp?.['connect-src'] ?? "'self'";
    const sources = current.split(/\s+/).filter(Boolean);
    for (const origin of allowed) if (!sources.includes(origin)) sources.push(origin);
    overrides.app = { security: { csp: { 'connect-src': sources.join(' ') } } };
  } else {
    warnings.push(
      'VITE_SERVER_URL is not set: the app will not be able to reach a multiplayer server.',
    );
  }

  const endpoints = (env.TAURI_UPDATER_ENDPOINTS ?? '').split(/[\s,]+/).filter(Boolean);
  const pubkey = env.TAURI_UPDATER_PUBKEY?.trim();
  if (endpoints.length > 0 && pubkey) {
    overrides.plugins = {
      ...overrides.plugins,
      // `passive` shows Windows' own progress bar but needs no clicks; the
      // player already agreed to the update in the game's prompt.
      updater: { endpoints, pubkey, windows: { installMode: 'passive' } },
    };
    // Signed `.sig` files are what the feed points at. The private key is a
    // CI secret, so a local build with the updater configured but no key still
    // produces installers, just none that can be served as an update.
    if (env.TAURI_SIGNING_PRIVATE_KEY) {
      overrides.bundle = { createUpdaterArtifacts: true };
    } else {
      warnings.push('TAURI_SIGNING_PRIVATE_KEY is not set: no update artifacts will be signed.');
    }
  } else if (endpoints.length > 0 || pubkey) {
    warnings.push(
      'The updater needs both TAURI_UPDATER_ENDPOINTS and TAURI_UPDATER_PUBKEY; it is off.',
    );
  }

  const appLinkHost = env.TAURI_APP_LINK_HOST?.trim();
  if (appLinkHost) {
    const mobile = base.plugins?.['deep-link']?.mobile ?? [];
    overrides.plugins = {
      ...overrides.plugins,
      'deep-link': {
        // Only the invite route: anything else on the site should keep
        // opening in the browser.
        mobile: [...mobile, { host: appLinkHost, pathPrefix: ['/play/online'], appLink: true }],
      },
    };
  }

  return { overrides, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const print = args.includes('--print');
  const tauriArgs = args.filter((arg) => arg !== '--print');
  const mode = tauriArgs.includes('build') ? 'production' : 'development';
  const env = { ...loadEnv(mode, root, ['VITE_', 'TAURI_']), ...process.env };

  const { overrides, warnings } = tauriOverrides(env);
  for (const warning of warnings) console.warn(`[tauri config] ${warning}`);

  if (print) {
    console.log(JSON.stringify(overrides, null, 2));
    return;
  }

  const file = join(root, 'src-tauri/target/dooz.tauri.conf.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(overrides, null, 2));

  // Anything after `--` belongs to cargo or the app, not to the Tauri CLI.
  const split = tauriArgs.indexOf('--');
  const head = split === -1 ? tauriArgs : tauriArgs.slice(0, split);
  const tail = split === -1 ? [] : tauriArgs.slice(split);
  cli.run([...head, '--config', file, ...tail], 'npm run tauri').catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

// Only when run, not when imported to check `tauriOverrides`.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
