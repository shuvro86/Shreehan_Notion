import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import path from 'node:path';
// Local installs live in frontend; the runtime image installs at the app root.
export const requireDependency=createRequire(path.resolve(existsSync('frontend/package.json')?'frontend/package.json':'package.json'));
