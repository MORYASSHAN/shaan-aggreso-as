// Runs the API (port 4000), waits until it is healthy, then starts Vite (port 5173), so the first page load
// never hits a proxy error while the API is still connecting to MongoDB.
import { spawn } from 'node:child_process';

const API_HEALTH = 'http://localhost:4000/api/health';
const children = [];

function start(workspace) {
  const child = spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit', shell: true });
  child.on('exit', (code) => code && stop());
  children.push(child);
}

function stop() {
  for (const child of children) child.kill();
  process.exit();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

async function waitForApi(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(API_HEALTH);
      if (res.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

start('server');
if (await waitForApi()) {
  start('client');
  console.log('\n  App ready: http://localhost:5173  (demo login: admin@example.com / 1234)\n');
} else {
  console.error('\n  The API did not become healthy within 90 s. Check the server output above.\n');
  stop();
}
