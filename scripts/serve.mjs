import {spawn} from 'node:child_process';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const children=[];
const args=process.argv.slice(2);
const next=spawn(process.execPath,['node_modules/next/dist/bin/next',...args],{stdio:'inherit'});children.push(next);
let stopping=false;
function worker(){if(stopping)return;const child=spawn(process.execPath,['scripts/sync-notion.mjs'],{stdio:'inherit'});children.push(child);child.on('exit',()=>{if(!stopping)setTimeout(worker,30000)})}
worker();
function stop(signal='SIGTERM'){stopping=true;for(const child of children)child.kill(signal)}
process.on('SIGINT',()=>stop('SIGINT'));process.on('SIGTERM',()=>stop());next.on('exit',code=>{stop();process.exitCode=code||0});
