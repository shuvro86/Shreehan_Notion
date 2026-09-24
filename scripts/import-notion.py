"""Reconcile exported originals against the Notion inventory; build local previews."""
import hashlib, json, re, shutil, subprocess, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORT = ROOT / 'tmp/import/exports'
for archive in (Path.home() / 'Downloads').glob('*ExportBlock*.zip'):
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            target = (EXPORT / entry.filename).resolve()
            if not target.is_relative_to(EXPORT.resolve()):
                raise ValueError('Unsafe archive path')
        z.extractall(EXPORT)
source = json.loads((ROOT / 'data/notion-source.json').read_text())
documents, missing, ocr = [], [], []
from urllib.parse import unquote
for row in source['rows']:
    if row['collection'] == 'Todo List':
        continue
    for ref in json.loads(row.get('Files & media', '[]')):
        parsed = json.loads(unquote(ref[7:]))
        _, attachment_id, filename = parsed['source'].split(':', 2)
        candidates = list(EXPORT.rglob(filename))
        if len(candidates) != 1:
            missing.append({'id': attachment_id, 'filename': filename, 'matches': len(candidates)})
            continue
        original = candidates[0]
        suffix = original.suffix.lower()
        dest = ROOT / 'public/documents' / (attachment_id + suffix)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, dest)
        preview_dir = ROOT / 'public/documents/previews' / attachment_id
        preview_dir.mkdir(parents=True, exist_ok=True)
        if suffix == '.pdf':
            extracted = subprocess.check_output(['pdftotext', '-layout', str(dest), '-']).decode('utf-8')
            texts = extracted.split('\f')
            if not texts[-1].strip(): texts.pop()
            if not list(preview_dir.glob('page-*.jpg')):
                subprocess.run(['pdftoppm', '-jpeg', '-r', '105', str(dest), str(preview_dir / 'page')], check=True, capture_output=True)
            images = sorted(preview_dir.glob('page-*.jpg'), key=lambda p:int(p.stem.split('-')[-1]))
        else:
            images = [dest]
            texts = ['']
        pages=[]
        for i, image in enumerate(images):
            text=texts[i] if i<len(texts) else ''
            needs_ocr=len(text.strip())<50 or any(marker in text for marker in ['g¨vcjwjd', 'cÖkœ', 'evsjv', '†kÖYx'])
            ocrfile=ROOT / 'tmp/import/ocr' / f'{attachment_id}-{i+1}.json'
            method='PDF text'
            confidence=None
            if ocrfile.exists():
                result=json.loads(ocrfile.read_text()); text=result['text']; confidence=result['confidence']; method='OCR'
            elif needs_ocr:
                ocr.append({'image':str(image),'output':str(ocrfile),'language':'ben+eng' if ('Bangla' in filename or ('syllabus' in filename and i==1)) else 'eng','id':attachment_id,'page':i+1})
                method='Awaiting OCR'
            pages.append({'number':i+1,'image':'/'+str(image.relative_to(ROOT/'public')),'text':text.strip(),'method':method,'confidence':confidence})
        title=filename.replace('_',' ').rsplit('.',1)[0]
        if filename=='1787467035.pdf':title='Geography — UK countries & capitals'
        if row['collection']=='Routine':title='Class II Rose — Weekly routine'
        if row['collection']=='Syllabus':title='First Monthly — Class II syllabus'
        if row['collection']=='Exam':title='First Monthly — Examination schedule'
        if row['collection']=='Unseen Paper':title=f'Air Around Us — page {original.stem}'
        documents.append({'id':attachment_id,'title':title,'filename':filename,'collection':row['collection'],'subject':row.get('Doc name','General').title(),'notionUrl':row['url'],'url':'/documents/'+dest.name,'kind':'PDF' if suffix=='.pdf' else 'Image','bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'pages':pages})
records=[]
for item in source['pages']:
    if item['result']['status']!='fulfilled':continue
    data=json.loads(item['result']['value']['content'][0]['text'])
    if data.get('title')=='New doc':continue
    content=re.search(r'<content>([\s\S]*?)</content>',data.get('text',''))
    body=content.group(1).strip() if content else ''
    template='Context, objectives, and scope of the document' in body
    row=next((r for r in source['rows'] if r['url'].split('/')[-1]==item['source']['id'].replace('-','')), {})
    records.append({'id':item['source']['id'],'title':data['title'],'collection':row.get('collection','Workspace'),'url':data['url'],'body':'' if template else re.sub(r'<[^>]+>','',body).strip(),'templateOnly':template,'topics':row.get('Topics',''),'date':row.get('date:CT Date:start',row.get('date:Deadline:start',''))})
out={'workspace':'Shreehan','teamspace':'Shreehan HQ','importedAt':'2026-09-18','expectedAttachments':30,'documents':documents,'records':records,'missing':missing,'ocrPending':len(ocr),'scope':'Seven active teamspace databases plus HW and README. Empty templates excluded; deleted Todo List excluded.'}
(ROOT/'data/library.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
(ROOT/'tmp/import/ocr-queue.json').write_text(json.dumps(ocr,indent=2))
print(json.dumps({'imported':len(documents),'pages':sum(len(d['pages']) for d in documents),'records':len(records),'missing':missing,'ocrPending':len(ocr)},indent=2))
