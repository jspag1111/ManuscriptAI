import { describe, expect, it, beforeEach } from 'vitest';
import { deleteProject, getProjects, saveProject, seedFromExampleData } from '../projectStore';
import { createNewProject } from '../../services/storageService';

class MockSupabaseClient {
  private rows: Map<string, any>;

  constructor(initialRows: any[] = []) {
    this.rows = new Map(initialRows.map((row) => [row.id, { ...row }]));
  }

  from(_table: string) {
    const self = this;
    return {
      select: (_columns?: string, opts: any = {}) => {
        const rows = Array.from(self.rows.values());
        if (opts.count === 'exact' && opts.head) {
          return { data: null, error: null, count: rows.length };
        }

        const baseResponse = {
          data: rows.map((row) => ({ data: row.data, last_modified: row.last_modified })),
          error: null,
          count: rows.length,
        };

        return {
          ...baseResponse,
          order: (_column: string, orderOpts: any = {}) => {
            const ordered = [...rows].sort((a, b) => (orderOpts?.ascending ? a.last_modified - b.last_modified : b.last_modified - a.last_modified));
            return {
              data: ordered.map((row) => ({ data: row.data, last_modified: row.last_modified })),
              error: null,
            };
          },
        };
      },
      upsert: (payload: any) => {
        const items = Array.isArray(payload) ? payload : [payload];
        items.forEach((row) => self.rows.set(row.id, { ...row }));
        const lastItem = items[items.length - 1];
        return {
          select: () => ({ single: () => ({ data: lastItem, error: null }) }),
        };
      },
      delete: () => ({
        eq: async (_column: string, id: string) => {
          self.rows.delete(id);
          return { data: null, error: null };
        },
      }),
      order: (_column: string, orderOpts: any = {}) => {
        const rows = [...self.rows.values()].sort((a, b) => (orderOpts?.ascending ? a.last_modified - b.last_modified : b.last_modified - a.last_modified));
        return {
          data: rows.map((row) => ({ data: row.data, last_modified: row.last_modified })),
          error: null,
        };
      },
    };
  }
}

describe('projectStore supabase adapter', () => {
  let client: MockSupabaseClient;

  beforeEach(() => {
    client = new MockSupabaseClient();
  });

  it('seeds Supabase from example data when empty', async () => {
    const seeded = await seedFromExampleData(client as any);
    expect(seeded).toBe(true);

    const projects = await getProjects(client as any);
    expect(projects.length).toBeGreaterThan(0);
  });

  it('saves, fetches, and deletes projects through Supabase', async () => {
    const project = createNewProject('Supabase Demo', 'Ensure persistence round-trip');
    const saved = await saveProject(project, client as any);

    expect(saved.id).toBe(project.id);

    const projects = await getProjects(client as any);
    const fetched = projects.find((p) => p.id === project.id);
    expect(fetched?.title).toBe('Supabase Demo');

    await deleteProject(project.id, client as any);
    const remaining = await getProjects(client as any);
    expect(remaining.some((p) => p.id === project.id)).toBe(false);
  });
});
