import express from 'express';
import cors from 'cors';
import { deleteProject, getProjects, saveProject, seedFromExampleData } from './projectStore.js';
import { hasSupabaseConfig } from '../lib/supabaseServerClient.js';

const PORT = process.env.PORT || 4000;

const start = async () => {
  try {
    if (!hasSupabaseConfig()) {
      console.warn('Supabase configuration is missing; set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    } else {
      await seedFromExampleData();
    }

    if (process.argv.includes('--seed-only')) {
      console.log('Database seed complete. Exiting without starting server.');
      process.exit(0);
    }
  } catch (error) {
    console.error('Startup seed failed', error);
    if (process.argv.includes('--seed-only')) {
      process.exit(1);
    }
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await getProjects();
      res.json(projects);
    } catch (error) {
      console.error('Failed to fetch projects', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const saved = await saveProject(req.body);
      res.json(saved);
    } catch (error) {
      console.error('Failed to save project', error);
      res.status(500).json({ error: 'Failed to save project' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      await deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete project', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Supabase API listening on http://localhost:${PORT}`);
  });
};

start();
