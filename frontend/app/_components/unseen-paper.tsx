'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, FileText, Sparkles } from 'lucide-react';
import type { SubjectPractice } from '../_lib/subject-practice';
import './unseen-paper.css';

type Document = { id: string; title: string; collection: string; subject: string; sha256?: string };
type SyncProgress = {state:string;phase:string;percent:number;message:string;subject?:string|null;questionsReady?:number;questionsTarget?:number;subjectsTotal?:number;subjectsCompleted?:number};

export default function UnseenPaper({ documents, bank, drivePending, studyNotes = false }: { documents: Document[]; bank: SubjectPractice; drivePending?: boolean; studyNotes?: boolean }) {
 const [selectedSubject, setSubject] = useState('');
 const [localBank, setLocalBank] = useState(bank);
 const [revealed, setRevealed] = useState<string[]>([]);
 const [answers, setAnswers] = useState<Record<string, string>>({});
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [syncProgress, setSyncProgress] = useState<SyncProgress>({state:'idle',phase:'idle',percent:0,message:'Ready to sync Subject Materials.'});
 useEffect(() => setLocalBank(bank), [bank]);
 useEffect(() => {
  if (studyNotes) return;
  let active = true;
  async function refreshProgress() {
   try {
    const response = await fetch('/api/subject-materials/sync', {cache:'no-store'});
    if (!response.ok) return;
    const progress = await response.json() as SyncProgress;
    if (active) {
     setSyncProgress(progress);
     if (progress.state !== 'running' && progress.state !== 'idle') window.dispatchEvent(new CustomEvent('shreehan:library-refresh'));
    }
   } catch { /* Keep the last visible sync state if the network blips. */ }
  }
  if (syncProgress.state === 'idle') void refreshProgress();
  if (syncProgress.state !== 'running') return () => {active=false};
  const timer = setInterval(refreshProgress, 1200);
  return () => {active=false;clearInterval(timer)};
 }, [syncProgress.state, studyNotes]);
 const subjects = localBank.subjects;
 const selected = subjects.find(item => item.name === selectedSubject) || subjects[0];
 const subject = selected?.name || '';
 const subjectDocuments = documents.filter(doc => selected?.documentIds.includes(doc.id));
 const questions = selected?.questions || [];
 const visible = questions.slice(0, selected?.target || 15);
 const reveal = (id: string) => setRevealed(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
 async function generateMore() {
  if (!selected || busy) return;
  setBusy(true); setError('');
  try {
   const response = await fetch(`/api/subject-practice/${encodeURIComponent(subject)}/generate-more`, {method: 'POST', cache: 'no-store'});
   const data = await response.json();
   if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'Could not generate questions. Please try again.');
   setLocalBank(data as SubjectPractice);
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not generate questions. Please try again.'); }
  finally { setBusy(false); }
 }
 async function syncNotion() {
  if (syncProgress.state === 'running') return;
  setError('');
  setSyncProgress({state:'running',phase:'starting',percent:1,message:'Starting Notion sync…'});
  try {
   const response = await fetch('/api/subject-materials/sync', {method:'POST',cache:'no-store'});
   const progress = await response.json();
   if (!response.ok) throw Error(progress.error || progress.detail || 'Could not start Notion sync.');
   setSyncProgress(progress as SyncProgress);
  } catch (cause) {
   setSyncProgress(current => ({...current,state:'error',phase:'error',message:cause instanceof Error ? cause.message : 'Could not start Notion sync.'}));
  }
 }
 return <section className="unseen-paper-module" aria-label={studyNotes ? "Study Notes questions" : "Analytical Material"}>
  <div className="unseen-paper-heading">
   <div><div className="eyebrow"><span/> {studyNotes ? "STUDY NOTES · CLASS 2" : "SUBJECT MATERIALS · CLASS 2"}</div><h2>{studyNotes ? "Study Notes questions & answers" : "Analytical Material"}</h2><p>Choose a subject from Notion. Each question and answer comes from its linked study material.</p></div>
   <div className="unseen-paper-count" aria-live="polite"><strong>{visible.length}</strong><span>of {selected?.target || 15} questions</span></div>
  </div>
  {studyNotes && <p className="unseen-paper-note">New and edited notes refresh automatically after sync. Production checks are scheduled every five minutes; processing can take longer. Unclear scans may need review.</p>}
  {!studyNotes && <div className="subject-sync-control">
   <button className="sync-notion-button" onClick={syncNotion} disabled={syncProgress.state==='running'}><Sparkles size={16}/>{syncProgress.state==='running'?'Syncing…':'Sync Notion'}</button>
   {syncProgress.state !== 'idle' && <div className="subject-sync-status" aria-live="polite">
    <div className="subject-sync-status-heading"><strong>{syncProgress.state==='running'?'Sync in progress':syncProgress.state==='complete'?'Sync complete':syncProgress.state==='partial'?'Sync partially complete':syncProgress.state==='error'?'Sync failed':'Ready to sync'}</strong><span>{syncProgress.percent}%</span></div>
    <progress value={syncProgress.percent} max={100} aria-label="Notion sync and analysis progress"/>
    <p>{syncProgress.message}{syncProgress.phase==='analysis'&&syncProgress.subjectsTotal?` · Subject ${Math.min((syncProgress.subjectsCompleted||0)+1,syncProgress.subjectsTotal)} of ${syncProgress.subjectsTotal}`:''}</p>
   </div>}
   {drivePending && <p className="subject-sync-limitation">New files inside linked Drive folders need a server-side Drive credential to be discovered.</p>}
  </div>
  }<div className="unseen-subjects" role="group" aria-label="Choose a subject">
   {subjects.map(item => <button key={item.name} aria-pressed={subject === item.name} onClick={() => {setSubject(item.name);setError('');}}>{item.name}<span>{item.questions.length} of {item.target} questions</span></button>)}
  </div>
  {!subjects.length && <p className="unseen-finished">{studyNotes ? "Add subject notes and readable PDFs to Study Notes in Notion. Questions appear after synchronization and analysis." : "Subject Materials will appear here when Notion finishes syncing."}</p>}
  {selected && <>
   <div className="unseen-paper-note"><Sparkles size={18}/><span>{subjectDocuments.length} linked {subjectDocuments.length === 1 ? 'file' : 'files'} for {subject}. {studyNotes ? "Questions refresh automatically when these files change." : "Generate More adds five questions."} Check the linked page if an answer seems unclear.</span></div>
   {selected.state !== 'ready' && <div className="unseen-pending" role="status"><strong>{selected.message}</strong></div>}
   <details className="unseen-source-list"><summary>View {subject} source material ({subjectDocuments.length} files)</summary>
    {selected.notionUrls.filter(Boolean).map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><FileText size={14}/>{studyNotes ? "Study Notes in Notion" : "Subject Materials in Notion"}</a>)}
    {subjectDocuments.map(doc => <a key={doc.id} href={`/library?doc=${encodeURIComponent(doc.id)}&page=1`} target="_blank" rel="noreferrer"><FileText size={14}/>{doc.title}</a>)}
   </details>
   {!questions.length && <p className="unseen-finished">Questions will appear when the linked material has been read and checked.</p>}
   <div className="unseen-question-grid">{visible.map((q, index) => {
    const shown = revealed.includes(q.id);
    return <article className="unseen-question-card" key={q.id} data-question-id={q.id}>
     <div className="unseen-question-meta"><span>{q.subject} · {q.topic}</span><span>{q.type}</span></div>
     <h3><b>{String(index + 1).padStart(2, '0')}</b>{q.question}</h3>
     {q.options.length ? <div className="unseen-options">{q.options.map(option => <button key={option} disabled={shown} aria-pressed={answers[q.id] === option} className={`${answers[q.id] === option ? 'selected' : ''} ${shown && option === q.answer ? 'correct' : ''}`} onClick={() => setAnswers(current => ({ ...current, [q.id]: option }))}>{option}{shown && option === q.answer && <Check size={14}/>}</button>)}</div> : <textarea aria-label={`Your answer: ${q.question}`} placeholder="Write your answer here…" value={answers[q.id] || ''} onChange={event => setAnswers(current => ({...current, [q.id]: event.target.value}))} disabled={shown}/>}
     <div className="unseen-question-actions"><button className="unseen-answer-button" aria-expanded={shown} aria-controls={`answer-${q.id}`} onClick={() => reveal(q.id)}>{shown ? 'Hide answer' : 'Show answer'}<ChevronRight size={15}/></button></div>
     <div id={`answer-${q.id}`} hidden={!shown} className="unseen-model-answer"><small>MODEL ANSWER · CLASS 2</small><p>{q.answer}</p></div>
     <div className="unseen-sources">{q.sources.map(source => <a key={`${source.documentId}-${source.page}`} href={`/library?doc=${encodeURIComponent(source.documentId)}&page=${source.page}`} target="_blank" rel="noreferrer"><FileText size={12}/>Read source · page {source.page}</a>)}</div>
    </article>;
   })}</div>
   {error && <p className="unseen-pending" role="alert">{error}</p>}
   {!studyNotes && <button className="unseen-more-button" disabled={busy || syncProgress.state==='running' || selected.state !== 'ready' || questions.length < selected.target} onClick={generateMore}><Sparkles size={17}/>{busy ? 'Generating five questions…' : 'Generate More'}<span>+5 questions</span></button>}
  </>}
 </section>;
}
