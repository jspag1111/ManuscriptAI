import express from 'express';
import cors from 'cors';
import { deleteProject, getProjects, saveProject, seedFromExampleData, DB_PATH } from './projectStore.js';

const PORT = process.env.PORT || 4000;

seedFromExampleData();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/projects', (_req, res) => {
  try {
    const projects = getProjects();
    res.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const saved = saveProject(req.body);
    res.json(saved);
  } catch (error) {
    console.error('Failed to save project', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    deleteProject(req.params.id);
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
  console.log(`SQLite API listening on http://localhost:${PORT}`);
  console.log(`Database file: ${DB_PATH}`);
});
