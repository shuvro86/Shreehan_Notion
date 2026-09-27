import {requireDependency} from '../server/dependencies.mjs';
requireDependency('@next/env').loadEnvConfig(process.cwd());
const {syncDrive, hasDriveCredentials} = await import('../server/drive-sync.mjs');
const {atomic, root} = await import('../server/notion-sync.mjs');
if (!hasDriveCredentials()) {
  await atomic(root + '/status.json', {state: 'unconfigured', source: 'Google Drive', message: 'Configure a Google Drive service account or OAuth refresh token on the server.'});
  process.exit(1);
}
if (process.env.VERCEL) {
  console.error('Automatic sync requires the scheduled worker and persistent storage.');
  process.exit(1);
}
const interval = Math.max(30, Number(process.env.GOOGLE_DRIVE_SYNC_INTERVAL_SECONDS) || 60) * 1000;
do {
  try {
    const library = await syncDrive();
    if (library) console.log(`Google Drive sync: ${library.documents.length} files, ${library.ocrPending} pending extraction.`);
  } catch (error) {
    console.error('Google Drive sync failed:', String(error.message).replaceAll(/https?:\/\/\S+/g, '[URL]'));
    if (process.argv.includes('--once')) process.exitCode = 1;
  }
  if (process.argv.includes('--once')) break;
  await new Promise(resolve => setTimeout(resolve, interval));
} while (true);
