import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../supabaseServerClient.js', () => ({
  hasSupabaseConfig: vi.fn(),
  getSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock('../supabaseSchema.js', () => ({
  ensureProjectsTable: vi.fn(),
}));

vi.mock('../../server/projectStore.js', () => ({
  TABLE_NAME: 'projects',
}));

import { verifySupabaseConnection } from '../supabaseHealth.js';
import * as mockedConfig from '../supabaseServerClient.js';
import * as mockedSchema from '../supabaseSchema.js';

describe('verifySupabaseConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns missing-config when env vars are absent', async () => {
    mockedConfig.hasSupabaseConfig.mockReturnValue(false);

    const result = await verifySupabaseConnection();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing-config');
    expect(mockedSchema.ensureProjectsTable).not.toHaveBeenCalled();
  });

  it('verifies row count when Supabase query succeeds', async () => {
    mockedConfig.hasSupabaseConfig.mockReturnValue(true);
    mockedSchema.ensureProjectsTable.mockResolvedValue(true);
    mockedConfig.getSupabaseServiceRoleClient.mockReturnValue({
      from: () => ({
        select: (_columns: string, _opts: any) => ({ error: null, count: 3 }),
      }),
    });

    const result = await verifySupabaseConnection();

    expect(result.ok).toBe(true);
    expect(result.rowCount).toBe(3);
  });

  it('surfaces query errors from Supabase', async () => {
    mockedConfig.hasSupabaseConfig.mockReturnValue(true);
    mockedSchema.ensureProjectsTable.mockResolvedValue(true);
    mockedConfig.getSupabaseServiceRoleClient.mockReturnValue({
      from: () => ({
        select: () => ({ error: { message: 'permission denied' }, count: null }),
      }),
    });

    const result = await verifySupabaseConnection();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('query-error');
    expect(result.message).toContain('permission denied');
  });

  it('handles unexpected Supabase exceptions', async () => {
    mockedConfig.hasSupabaseConfig.mockReturnValue(true);
    mockedSchema.ensureProjectsTable.mockResolvedValue(true);
    mockedConfig.getSupabaseServiceRoleClient.mockReturnValue({
      from: () => ({
        select: () => { throw new Error('network down'); },
      }),
    });

    const result = await verifySupabaseConnection();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unhandled-error');
    expect(result.message).toContain('network down');
  });

  it('reports ensureProjectsTable failures before querying', async () => {
    mockedConfig.hasSupabaseConfig.mockReturnValue(true);
    mockedSchema.ensureProjectsTable.mockRejectedValue(new Error('connection refused'));

    const result = await verifySupabaseConnection();

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ensure-failed');
    expect(result.message).toContain('Failed to ensure projects table exists.');
  });
});
