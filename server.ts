import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiApp } from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Mount API
app.use(apiApp);

// In production, serve static build files
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Production Server] Server running on http://0.0.0.0:${PORT}`);
});
