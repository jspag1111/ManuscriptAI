import { dbClient, normalizeProject } from '../server/dbClient.js';

// Ensure schema is created once per cold start
let readyPromise;
const ensureReady = async () => {
  if (!readyPromise) {
    readyPromise = dbClient.ensureSchema();
  }
  return readyPromise;
};

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (err) {
      throw new Error('Invalid JSON body');
    }
  }
  return req.body;
};

export default async function handler(req, res) {
  try {
    await ensureReady();
  } catch (error) {
    console.error('Failed to initialize database', error);
    res.status(500).json({ error: 'Failed to initialize database' });
    return;
  }

  const { method } = req;

  if (method === 'GET') {
    try {
      const projects = await dbClient.getAllProjects();
      res.status(200).json(projects);
    } catch (error) {
      console.error('Failed to fetch projects', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
    return;
  }

  if (method === 'POST') {
    try {
      const body = parseBody(req);
      const project = normalizeProject(body);
      const saved = await dbClient.upsertProject(project);
      res.status(200).json(saved);
    } catch (error) {
      console.error('Failed to save project', error);
      res.status(500).json({ error: 'Failed to save project' });
    }
    return;
  }

  if (method === 'DELETE') {
    try {
      const { id } = req.query || {};
      if (!id) {
        res.status(400).json({ error: 'Project id is required' });
        return;
      }
      await dbClient.deleteProject(id);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to delete project', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
    return;
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  res.status(405).end('Method Not Allowed');
}
