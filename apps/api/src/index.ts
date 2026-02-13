/**
 * FatedFortress API Server
 * Chapter 6: Technical Architecture
 * 
 * TODO: Implement Express server with routes
 */

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: Routes
// - POST /api/users (create user)
// - GET /api/users/:id (get user)
// - GET /api/users/:id/rep (get REP profile)
// - POST /api/contributions (submit contribution)
// - GET /api/squads (list squads)
// - POST /api/squads (create squad)

app.listen(PORT, () => {
  console.log(`🚀 FatedFortress API running on port ${PORT}`);
});

export default app;
