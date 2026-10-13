import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '@/features/account/store';
import { useProgressStore } from '@/features/progress/store';
import { socialApi } from '@/lib/social-api';
import { cloudSyncStatus, syncNow } from './sync';

const CREDENTIALS = { accountId: '00000000-0000-4000-8000-000000000001', token: 'x'.repeat(43) };

beforeEach(() => {
  localStorage.clear();
  useProgressStore.getState().reset();
  useAccountStore.setState({ credentials: CREDENTIALS });
});

afterEach(() => vi.restoreAllMocks());

describe('cloud sync', () => {
  it('uploads local progress and takes what the cloud adds', async () => {
    useProgressStore.getState().recordStage('pip-1', 2);
    const put = vi
      .spyOn(socialApi, 'putCloudSave')
      .mockImplementation(async (_credentials, data) => {
        const progress = (data as { progress: Record<string, unknown> }).progress;
        // Another device already earned three stars here and solved a puzzle.
        return {
          revision: 4,
          updatedAt: 1,
          data: {
            v: 1,
            progress: {
              ...progress,
              journey: { ...(progress['journey'] as object), 'pip-1': 3 },
              puzzles: ['p-remote'],
            },
          },
        };
      });

    expect(await syncNow()).toBe(true);
    expect(put).toHaveBeenCalledOnce();
    const sent = put.mock.calls[0]![1] as {
      v: number;
      progress: { journey: Record<string, number> };
    };
    expect(sent.v).toBe(1);
    expect(sent.progress.journey['pip-1']).toBe(2);

    const progress = useProgressStore.getState();
    expect(progress.journey['pip-1']).toBe(3);
    expect(progress.puzzles).toContain('p-remote');
    expect(cloudSyncStatus()).toMatchObject({ dirty: false, accountId: CREDENTIALS.accountId });
  });

  it('never lowers anything this device earned', async () => {
    useProgressStore.getState().recordStage('pip-1', 3);
    vi.spyOn(socialApi, 'putCloudSave').mockResolvedValue({
      revision: 1,
      updatedAt: 1,
      data: { v: 1, progress: { journey: { 'pip-1': 1 } } },
    });
    await syncNow();
    expect(useProgressStore.getState().journey['pip-1']).toBe(3);
  });

  it('does nothing without an account, and stays dirty when the upload fails', async () => {
    const put = vi.spyOn(socialApi, 'putCloudSave');
    useAccountStore.setState({ credentials: null });
    expect(await syncNow()).toBe(false);
    expect(put).not.toHaveBeenCalled();

    useAccountStore.setState({ credentials: CREDENTIALS });
    put.mockRejectedValue(new Error('offline'));
    expect(await syncNow()).toBe(false);
    expect(cloudSyncStatus().dirty).toBe(true);
  });
});
