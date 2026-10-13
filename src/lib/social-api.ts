import type { GameConfig } from '@/game/engine';
import {
  cloudSaveSchema,
  correspondenceGameSchema,
  correspondenceListSchema,
  friendRequestResultSchema,
  friendSearchResponseSchema,
  friendsResponseSchema,
  pulseResponseSchema,
  pushKeyResponseSchema,
  recoverResponseSchema,
  recoveryCodesResponseSchema,
  recoveryStatusSchema,
} from '@/protocol/social';
import { z } from 'zod';
import { type Credentials, request } from './api';

/**
 * The client half of the social, account-data and push routes.
 *
 * Built on the same `request` as the core API, so every response is parsed
 * against its schema and failures arrive as `ApiError`s with a message fit to
 * show. Only the friends list is cached for offline viewing; everything else
 * here is either live (presence, the pulse) or a write.
 */

const ok = z.object({ ok: z.boolean() });
const gameResponse = z.object({ game: correspondenceGameSchema });

export const socialApi = {
  // Friends ------------------------------------------------------------------

  friends: (credentials: Credentials, signal?: AbortSignal) =>
    request('/api/friends', friendsResponseSchema, {
      credentials,
      ...(signal ? { signal } : {}),
    }),

  search: (credentials: Credentials, query: string, signal?: AbortSignal) =>
    request(`/api/friends/search?q=${encodeURIComponent(query)}`, friendSearchResponseSchema, {
      credentials,
      cache: false,
      ...(signal ? { signal } : {}),
    }),

  sendRequest: (credentials: Credentials, target: { code: string } | { accountId: string }) =>
    request('/api/friends/requests', friendRequestResultSchema, {
      method: 'POST',
      credentials,
      body: target,
    }),

  accept: (credentials: Credentials, accountId: string) =>
    request(`/api/friends/requests/${encodeURIComponent(accountId)}/accept`, ok, {
      method: 'POST',
      credentials,
    }),

  /** Decline an incoming request or withdraw an outgoing one. */
  dismiss: (credentials: Credentials, accountId: string) =>
    request(`/api/friends/requests/${encodeURIComponent(accountId)}`, ok, {
      method: 'DELETE',
      credentials,
    }),

  remove: (credentials: Credentials, accountId: string) =>
    request(`/api/friends/${encodeURIComponent(accountId)}`, ok, { method: 'DELETE', credentials }),

  block: (credentials: Credentials, accountId: string) =>
    request(`/api/friends/${encodeURIComponent(accountId)}/block`, ok, {
      method: 'POST',
      credentials,
    }),

  unblock: (credentials: Credentials, accountId: string) =>
    request(`/api/friends/${encodeURIComponent(accountId)}/block`, ok, {
      method: 'DELETE',
      credentials,
    }),

  declineChallenge: (credentials: Credentials, accountId: string) =>
    request(`/api/friends/${encodeURIComponent(accountId)}/decline-challenge`, ok, {
      method: 'POST',
      credentials,
    }),

  pulse: (credentials: Credentials) =>
    request('/api/social/pulse', pulseResponseSchema, { credentials, cache: false }),

  // Push ---------------------------------------------------------------------

  pushKey: () => request('/api/push/key', pushKeyResponseSchema, { cache: false }),

  subscribePush: (credentials: Credentials, subscription: PushSubscriptionJSON) =>
    request('/api/push/subscriptions', ok, {
      method: 'POST',
      credentials,
      body: { endpoint: subscription.endpoint, keys: subscription.keys },
    }),

  unsubscribePush: (credentials: Credentials, endpoint: string) =>
    request('/api/push/subscriptions', ok, { method: 'DELETE', credentials, body: { endpoint } }),

  // Correspondence -----------------------------------------------------------

  correspondence: (credentials: Credentials, signal?: AbortSignal) =>
    request('/api/correspondence', correspondenceListSchema, {
      credentials,
      cache: false,
      ...(signal ? { signal } : {}),
    }),

  correspondenceGame: (credentials: Credentials, id: string, signal?: AbortSignal) =>
    request(`/api/correspondence/${encodeURIComponent(id)}`, gameResponse, {
      credentials,
      ...(signal ? { signal } : {}),
    }),

  inviteCorrespondence: (
    credentials: Credentials,
    opponentId: string,
    config: GameConfig,
    daysPerMove: 1 | 2 | 3,
  ) =>
    request('/api/correspondence', gameResponse, {
      method: 'POST',
      credentials,
      body: { opponentId, config, daysPerMove },
    }),

  correspondenceAction: (
    credentials: Credentials,
    id: string,
    action: 'accept' | 'decline' | 'resign',
  ) =>
    request(`/api/correspondence/${encodeURIComponent(id)}/${action}`, gameResponse.partial(), {
      method: 'POST',
      credentials,
    }),

  correspondenceMove: (credentials: Credentials, id: string, index: number, ply: number) =>
    request(`/api/correspondence/${encodeURIComponent(id)}/move`, gameResponse, {
      method: 'POST',
      credentials,
      body: { index, ply },
    }),

  // Account data -------------------------------------------------------------

  recoveryStatus: (credentials: Credentials) =>
    request('/api/account/recovery-codes', recoveryStatusSchema, { credentials, cache: false }),

  issueRecoveryCodes: (credentials: Credentials) =>
    request('/api/account/recovery-codes', recoveryCodesResponseSchema, {
      method: 'POST',
      credentials,
    }),

  recover: (displayName: string, code: string) =>
    request('/api/account/recover', recoverResponseSchema, {
      method: 'POST',
      body: { displayName, code },
    }),

  exportData: (credentials: Credentials) =>
    request('/api/account/export', z.record(z.string(), z.unknown()), {
      credentials,
      cache: false,
    }),

  deleteAccount: (credentials: Credentials, confirm: string) =>
    request('/api/account', z.null(), { method: 'DELETE', credentials, body: { confirm } }),

  cloudSave: (credentials: Credentials) =>
    request('/api/cloud-save', cloudSaveSchema, { credentials, cache: false }),

  putCloudSave: (credentials: Credentials, data: Record<string, unknown>) =>
    request('/api/cloud-save', cloudSaveSchema, { method: 'PUT', credentials, body: { data } }),
};
