const { spawnSync } = require('child_process');
const { existsSync } = require('fs');
const { join, resolve } = require('path');

const env = { ...process.env };
delete env.PRISMA_CLIENT_ENGINE_TYPE;
delete env.PRISMA_GENERATE_NO_ENGINE;
delete env.PRISMA_ACCELERATE_URL;
delete env.PRISMA_DATA_PROXY_URL;

const backendRoot = process.cwd();
const workspaceRoot = resolve(backendRoot, '..');
const prismaCli = [join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js'), join(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js')].find((path) =>
  existsSync(path)
);

if (!prismaCli) {
  console.error('Unable to find the local Prisma CLI. Run npm install first.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [prismaCli, 'generate', '--schema', 'prisma/schema.prisma'], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
