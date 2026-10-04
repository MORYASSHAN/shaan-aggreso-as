import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT_ENV = fileURLToPath(new URL('../../.env', import.meta.url));

/** Loads the repo-root .env if present. On Render, variables come from the dashboard instead. */
export function loadEnvFile() {
  if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);
}
