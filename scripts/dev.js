// npm run dev — starts the API (port 4000) and the Vite dev server (port 5173) together.
import { spawn } from 'node:child_process';

const children = ['server', 'client'].map((workspace) =>
  spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit', shell: true }),
);

const stop = () => {
  for (const child of children) child.kill();
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && stop());
