import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbClient, normalizeProject, DATA_DIR, DB_PATH } from './dbClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;

const seedFromExampleData = async () => {
  const rowCount = await dbClient.countProjects();
  if (rowCount > 0) {
    return;
  }

  const examplePath = path.resolve(__dirname, '../example_data.json');
  if (!fs.existsSync(examplePath)) {
    console.warn('example_data.json not found. Skipping seed.');
    return;
  }

  try {
    const raw = fs.readFileSync(examplePath, 'utf-8');
    const projects = JSON.parse(raw);
    await dbClient.insertMany(projects.map((project) => normalizeProject(project)));
    console.log(`Seeded ${projects.length} project(s) from example_data.json`);
  } catch (error) {
    console.error('Failed to seed database from example_data.json', error);
  }
};

const startServer = async () => {
  await dbClient.ensureSchema();
  await seedFromExampleData();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await dbClient.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error('Failed to fetch projects', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const toPersist = await dbClient.upsertProject(req.body);
      res.json(toPersist);
    } catch (error) {
      console.error('Failed to save project', error);
      res.status(500).json({ error: 'Failed to save project' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await dbClient.deleteProject(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete project', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  if (process.argv.includes('--seed-only')) {
    console.log('Database seed complete. Exiting without starting server.');
    process.exit(0);
  }

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    if (dbClient.type === 'sqlite') {
      console.log(`Local database file: ${DB_PATH}`);
      console.log(`Data directory: ${DATA_DIR}`);
    } else {
      console.log(`Turso database: ${process.env.TURSO_DATABASE_URL}`);
    }
  });
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
