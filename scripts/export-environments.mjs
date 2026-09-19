import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ENVIRONMENTS } from '../src/environments.ts';

const destination = resolve(process.argv[2] ?? 'output/environments');
await mkdir(destination, { recursive: true });
for (const environment of Object.values(ENVIRONMENTS)) {
  await writeFile(resolve(destination, `${environment.id}.json`), JSON.stringify(environment, null, 2) + '\n');
}
console.log(`Exported ${Object.keys(ENVIRONMENTS).length} environment descriptions to ${destination}`);
