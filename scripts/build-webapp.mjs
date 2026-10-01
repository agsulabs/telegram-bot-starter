import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist/webapp/public', { recursive: true });
await cp('webapp', 'dist/webapp/public', { recursive: true });
