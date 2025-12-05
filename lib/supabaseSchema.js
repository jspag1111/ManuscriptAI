import pg from 'pg';

const { Client } = pg;

const getPostgresConnectionString = () => (
  process.env.POSTGRES_URL_NON_POOLING
  || process.env.POSTGRES_PRISMA_URL
  || process.env.POSTGRES_URL
);

let ensureProjectsTablePromise = null;

const ensureProjectsTable = async () => {
  if (ensureProjectsTablePromise) return ensureProjectsTablePromise;

  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    console.warn('Skipping projects table check: POSTGRES_URL_NON_POOLING/POSTGRES_PRISMA_URL/POSTGRES_URL not set.');
    return false;
  }

  ensureProjectsTablePromise = (async () => {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();

      await client.query(`
        create table if not exists public.projects (
          id text primary key,
          title text not null,
          description text,
          created bigint not null,
          last_modified bigint not null,
          data jsonb not null
        );
      `);

      await client.query('alter table public.projects enable row level security;');

      await client.query(`
        do $$
        begin
          if not exists (
            select 1 from pg_policies where polname = 'public_read_projects'
          ) then
            create policy "public_read_projects"
            on public.projects
            for select
            to anon
            using (true);
          end if;
        end;
        $$;
      `);
    } finally {
      await client.end();
    }

    return true;
  })().catch((error) => {
    ensureProjectsTablePromise = null;
    console.warn('Failed to ensure projects table exists', error);
    throw error;
  });

  return ensureProjectsTablePromise;
};

export { ensureProjectsTable };
