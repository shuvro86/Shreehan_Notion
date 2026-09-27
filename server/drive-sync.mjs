import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {acquireLock} from './sync-lock.mjs';
import {atomic, read, extract, download as publicDownload, root as defaultStore} from './notion-sync.mjs';

export const sourceFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1pg3lbrlzwxJClmKCMQEpZg-9aMIrHnwr';
const folderMime = 'application/vnd.google-apps.folder';
const nativePdf = new Set(['application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet', 'application/vnd.google-apps.presentation', 'application/vnd.google-apps.drawing']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const base64url = value => Buffer.from(value).toString('base64url');

export function hasDriveCredentials(env = process.env) {
  return Boolean(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || (env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN));
}

export function hasDriveApiKey(env = process.env) {
  return Boolean(env.G_DRIVE_KEY);
}

export async function accessToken(env = process.env, request = fetch) {
  let form;
  if (env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
    const account = JSON.parse(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
    if (!account.client_email || !account.private_key) throw Error('Invalid Google Drive service account');
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
    const claim = base64url(JSON.stringify({iss: account.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600}));
    const unsigned = `${header}.${claim}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
    form = new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}`});
  } else if (env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    form = new URLSearchParams({grant_type: 'refresh_token', client_id: env.GOOGLE_DRIVE_CLIENT_ID, client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET, refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN});
  } else throw Error('Google Drive credentials are missing');
  const response = await request('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: form, signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`Google Drive token request failed (${response.status})`);
  const body = await response.json();
  if (!body.access_token) throw Error('Google Drive token response has no access token');
  return body.access_token;
}

export function driveClient(token, request = fetch, apiKey = process.env.G_DRIVE_KEY) {
  async function call(url, binary = false) {
    const target = new URL(url);
    if (!token && apiKey) target.searchParams.set('key', apiKey);
    const headers = token ? {Authorization: `Bearer ${token}`} : {};
    const response = await request(target, {headers, signal: AbortSignal.timeout(120000)});
    if (!response.ok) throw Error(`Google Drive request failed (${response.status})`);
    if (binary) {
      const size = Number(response.headers.get('content-length') || 0);
      if (size > 100 * 1024 * 1024) throw Error('Drive file exceeds 100 MB');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 100 * 1024 * 1024) throw Error('Drive file exceeds 100 MB');
      return bytes;
    }
    return response.json();
  }
  return {
    file: id => call(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`),
    async children(id) {
      const files = [];
      let pageToken;
      do {
        const params = new URLSearchParams({q: `'${id.replaceAll("'", "\\'")}' in parents and trashed = false`, fields: 'nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime,size,md5Checksum,webViewLink,capabilities(canDownload))', pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true'});
        if (pageToken) params.set('pageToken', pageToken);
        const page = await call(`https://www.googleapis.com/drive/v3/files?${params}`);
        if (page.incompleteSearch) throw Error('Google Drive returned an incomplete folder listing');
        files.push(...(page.files || []));
        pageToken = page.nextPageToken;
      } while (pageToken);
      return files;
    },
    download: (id, mimeType) => nativePdf.has(mimeType)
      ? call(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=application%2Fpdf`, true)
      : call(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, true),
  };
}

export function studyMetadata(file, names) {
  const filename = file.name || 'Untitled';
  const inScience = names.includes('Science');
  const inGeography = names.includes('Geograpgy') || names.includes('Geography');
  const isSyllabus = names.includes('Syllabus');
  const sourcePage = inScience && /^\d+\.png$/i.test(filename) ? Number(filename.split('.')[0]) : null;
  const chapter = sourcePage && sourcePage <= 66 ? 'Food for Health' : sourcePage ? 'Rocks and Minerals' : null;
  return {
    collection: isSyllabus ? 'Syllabus' : 'Half Yearly',
    subject: isSyllabus ? 'Syllabus' : inScience ? 'Science' : inGeography ? 'Geography' : names.at(-1) || 'General',
    title: chapter ? `${chapter} · textbook page ${sourcePage}` : filename.replace(/\.[^.]+$/, ''),
    sourcePage,
  };
}

export async function publicSubjectClient(records, indexFile = new URL('../data/subject-materials-index.json', import.meta.url)) {
  const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));
  const folders = index.folders.filter(folder => records.some(record => record.collection === 'Subject Materials' && record.subject === folder.subject && record.driveLinks?.some(link => link.includes(`/folders/${folder.id}`))));
  const files = new Map(folders.flatMap(folder => folder.files.map(([id, name]) => [id, {id, name, mimeType: name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png', webViewLink: `https://drive.google.com/file/d/${id}/view` }])));
  return {
    file: async id => ({id, name: 'Half Yearly', mimeType: folderMime, trashed: false}),
    children: async id => id === sourceFolderId ? folders.map(folder => ({id: folder.id, name: folder.subject, mimeType: folderMime})) : (folders.find(folder => folder.id === id)?.files || []).map(([fileId]) => files.get(fileId)),
    download: async id => publicDownload(files.get(id).webViewLink),
    knownFiles: files.size,
  };
}

export async function syncDrive({client, processFile = extract, store = defaultStore, folderId = sourceFolderId, publish = true, previousLibrary, onProgress, forceRefresh = false} = {}) {
  const release = publish ? await acquireLock(store) : () => {};
  if (!release) return;
  const prior = previousLibrary ?? await read(path.join(store, 'library.json'), null);
  const previous = prior?.sourceFolderId === folderId ? prior : {documents: []};
  const startedAt = new Date().toISOString();
  const progress = async stage => { if (onProgress) await onProgress(stage); else if (publish) await atomic(path.join(store, 'status.json'), {state: 'syncing', source: 'Google Drive', startedAt, updatedAt: new Date().toISOString(), lastSuccess: previous.syncedAt || null, stage}); };
  try {
    if (!client) client = hasDriveCredentials() ? driveClient(await accessToken()) : hasDriveApiKey() ? driveClient(null) : driveClient(await accessToken());
    await progress('Checking source folder');
    const folder = await client.file(folderId);
    if (folder.mimeType !== folderMime || folder.trashed) throw Error('Configured Google Drive source is not an active folder');
    const queue = [{id: folderId, names: []}];
    const seenFolders = new Set();
    const found = [];
    while (queue.length) {
      const item = queue.shift();
      if (seenFolders.has(item.id)) continue;
      seenFolders.add(item.id);
      await progress(`Listing ${item.names.join(' / ') || folder.name}`);
      for (const child of await client.children(item.id)) {
        if (child.mimeType === folderMime) queue.push({id: child.id, names: [...item.names, child.name]});
        else found.push({file: child, names: item.names});
      }
    }
    const documents = [];
    for (const {file, names} of found) {
      if (file.capabilities?.canDownload === false) throw Error(`Cannot download Drive file ${file.id}`);
      await progress(`Importing ${file.name}`);
      const metadata = studyMetadata(file, names);
      const old = previous.documents.find(doc => doc.id === file.id);
      let doc;
      const driveVersion = `${file.modifiedTime || ''}|${file.md5Checksum || ''}|${file.mimeType || ''}`;
      if (!forceRefresh && old && old.driveVersion === driveVersion && !old.processingError && await fs.stat(path.join(store, 'assets', old.assetFolder || '', path.basename(old.url || ''))).then(() => true, () => false)) {
        doc = old;
      } else {
        const bytes = await client.download(file.id, file.mimeType);
        const checksum = sha(bytes);
        if (old && old.sha256 === checksum && !old.processingError) doc = old;
        else {
          const extension = nativePdf.has(file.mimeType) ? '.pdf' : path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
          const kind = file.mimeType === 'application/pdf' || nativePdf.has(file.mimeType) ? 'PDF' : file.mimeType?.startsWith('image/') ? 'Image' : 'File';
          const assetFolder = `drive-${file.id}-${checksum.slice(0, 16)}`;
          const dir = path.join(store, 'assets', assetFolder);
          await fs.mkdir(dir, {recursive: true});
          const local = path.join(dir, `original${extension}`);
          const url = `/api/documents/${assetFolder}`;
          await fs.writeFile(local, bytes);
          let pages, processingError;
          try { pages = await processFile(local, dir, url, kind, metadata.subject); }
          catch { processingError = 'Text extraction pending; original file is available. Retrying next sync.'; pages = [{number: 1, image: kind === 'Image' ? `${url}/original${extension}` : '', text: processingError, method: 'Pending', confidence: null}]; }
          doc = {id: file.id, assetFolder, url: `${url}/original${extension}`, kind, bytes: bytes.length, sha256: checksum, pages, ...(processingError ? {processingError} : {})};
        }
      }
      documents.push({...doc, ...metadata, sourceType: 'google_drive', filename: file.name, sourcePath: names.join('/'), driveVersion, driveUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, notionUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`});
    }
    const now = new Date().toISOString();
    const snapshot = {sourceType: 'google_drive', sourceFolderId: folderId, importedAt: now, syncedAt: now, expectedAttachments: found.length, documents, records: [], homework: {sources: [], items: []}, missing: [], ocrPending: documents.filter(doc => doc.processingError).length, scope: `Google Drive folder ${folderId} and all descendant folders.`};
    if (publish) {
      await atomic(path.join(store, 'library.json'), snapshot);
      await atomic(path.join(store, 'status.json'), {state: snapshot.ocrPending ? 'partial' : 'ok', source: 'Google Drive', updatedAt: now, lastSuccess: now, documents: documents.length, ocrPending: snapshot.ocrPending});
    }
    return snapshot;
  } catch (error) {
    if (publish) await atomic(path.join(store, 'status.json'), {state: 'error', source: 'Google Drive', updatedAt: new Date().toISOString(), lastSuccess: previous.syncedAt || null, message: 'Drive sync failed. The last complete Drive library is still available.'});
    throw error;
  } finally { await release(); }
}
