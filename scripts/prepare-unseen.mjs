import {requireDependency} from '../server/dependencies.mjs';
requireDependency('@next/env').loadEnvConfig(process.cwd());
const {read,root}=await import('../server/notion-sync.mjs');
const {prepareUnseen}=await import('../server/unseen-practice.mjs');
const library=await read(root+'/library.json',null);
if(library)await prepareUnseen(library);
