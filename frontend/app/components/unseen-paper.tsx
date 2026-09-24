'use client';

import { useState } from 'react';
import { Check, ChevronRight, FileText, Sparkles } from 'lucide-react';
import type { UnseenPractice } from '../lib/unseen-practice';
import './unseen-paper.css';

type Document = { id: string; title: string; collection: string; subject: string; sha256?: string };

export default function UnseenPaper({ documents, bank }: { documents: Document[]; bank: UnseenPractice }) {
 const [selectedSubject, setSubject] = useState('Science');
 const [counts, setCounts] = useState<Record<string, number>>({});
 const [revealed, setRevealed] = useState<string[]>([]);
 const [answers, setAnswers] = useState<Record<string, string>>({});
 const unseenDocuments = documents.filter(d => d.collection === 'Unseen Paper');
 // A reviewed answer is valid only for the exact source version that was read.
 const reviewed = bank.sources.filter(source => unseenDocuments.some(d => d.id === source.documentId && d.sha256 === source.sha256 && d.subject === source.subject));
 const readyIds = new Set(reviewed.map(source => source.documentId));
 const questions = bank.questions.filter(q => q.sources.every(source => readyIds.has(source.documentId)));
 const subjects = [...new Set(unseenDocuments.map(d => d.subject || 'Other'))].sort();
 const subject = subjects.includes(selectedSubject) ? selectedSubject : subjects[0];
 const subjectDocuments = unseenDocuments.filter(d => (d.subject || 'Other') === subject);
 const subjectQuestions = questions.filter(q => q.subject === subject);
 const pending = subjectDocuments.filter(d => !readyIds.has(d.id));
 const count = counts[subject] ?? 20;
 const visible = subjectQuestions.slice(0, count);
 const reveal = (id: string) => setRevealed(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
 return <section className="unseen-paper-module" aria-label="Unseen Paper practice">
  <div className="unseen-paper-heading">
   <div><div className="eyebrow"><span/> SUBJECT PRACTICE · CLASS 2</div><h2>Unseen Paper challenge.</h2><p>Choose a subject. Try each question, then reveal its answer. Every small step helps you learn, Shreehan!</p></div>
   <div className="unseen-paper-count" aria-live="polite"><strong>{visible.length}</strong><span>of {subjectQuestions.length} questions</span></div>
  </div>
  <div className="unseen-subjects" role="group" aria-label="Choose a subject">
   {subjects.map(name => <button key={name} aria-pressed={subject === name} onClick={() => setSubject(name)}>{name}<span>{questions.filter(q => q.subject === name).length} questions</span></button>)}
  </div>
  <div className="unseen-paper-note"><Sparkles size={18}/><span>{subjectQuestions[0]?.topic ? <strong>{subjectQuestions[0].topic} · </strong> : null}{subjectDocuments.length - pending.length} of {subjectDocuments.length} synced files have questions for {subject || 'this collection'}. Start with up to 20 questions and add five at a time. New files are prepared automatically. AI-prepared answers are learning aids; check the linked source if anything seems unclear.</span></div>
  {!!pending.length && <div className="unseen-pending" role="status"><strong>{pending.length} new or changed {pending.length === 1 ? 'file is' : 'files are'} awaiting automatic questions.</strong>{pending.map(doc => <p key={doc.id}>{doc.title}: {bank.jobs?.find(job => job.documentId === doc.id)?.message || 'Waiting for automatic question preparation.'}</p>)}</div>}
  <details className="unseen-source-list"><summary>View {subject || 'collection'} source pages ({subjectDocuments.length})</summary>
   {subjectDocuments.map(doc => { const source = reviewed.find(s => s.documentId === doc.id); return <a key={doc.id} href={`/library?doc=${doc.id}&page=1`} target="_blank" rel="noreferrer"><FileText size={14}/>{doc.title}{source ? ` · ${source.origin === 'ai' ? 'AI questions ready' : 'reviewed questions ready'}` : ' · preparing questions'}</a>; })}
  </details>
  {!subjectQuestions.length && <p className="unseen-finished">Questions will appear here automatically when preparation finishes. You can read the source pages above.</p>}
  <div className="unseen-question-grid">{visible.map((q, index) => {
   const shown = revealed.includes(q.id);
   return <article className="unseen-question-card" key={q.id} data-question-id={q.id}>
    <div className="unseen-question-meta"><span>{q.subject} · {q.topic}</span><span>{q.type}</span></div>
    <h3><b>{String(index + 1).padStart(2, '0')}</b>{q.question}</h3>
    {q.options.length ? <div className="unseen-options">{q.options.map(option => <button key={option} disabled={shown} aria-pressed={answers[q.id] === option} className={`${answers[q.id] === option ? 'selected' : ''} ${shown && option === q.answer ? 'correct' : ''}`} onClick={() => setAnswers(current => ({ ...current, [q.id]: option }))}>{option}{shown && option === q.answer && <Check size={14}/>}</button>)}</div> : <textarea aria-label={`Your answer: ${q.question}`} placeholder="Write your answer here…" value={answers[q.id] || ''} onChange={e => setAnswers(current => ({ ...current, [q.id]: e.target.value }))} disabled={shown}/>}
    <div className="unseen-question-actions"><button className="unseen-answer-button" aria-expanded={shown} aria-controls={`answer-${q.id}`} onClick={() => reveal(q.id)}>{shown ? 'Hide answer' : 'Show answer'}<ChevronRight size={15}/></button></div>
    <div id={`answer-${q.id}`} hidden={!shown} className="unseen-model-answer"><small>MODEL ANSWER · CLASS 2</small><p>{q.answer}</p></div>
    <div className="unseen-sources">{q.sources.map(source => {
     const reviewedSource = reviewed.find(s => s.documentId === source.documentId);
     return <a key={`${source.documentId}-${source.page}`} href={`/library?doc=${source.documentId}&page=${source.page}`} target="_blank" rel="noreferrer"><FileText size={12}/>Read source · {reviewedSource?.printedPage ? `book page ${reviewedSource.printedPage}` : `page ${source.page}`}</a>;
    })}</div>
   </article>;
  })}</div>
  {count < subjectQuestions.length ? <button className="unseen-more-button" onClick={() => setCounts(current => ({ ...current, [subject]: Math.min(count + 5, subjectQuestions.length) }))}><Sparkles size={17}/>Show {Math.min(5, subjectQuestions.length - count)} more different questions</button> : !!subjectQuestions.length && <div className="unseen-finished">All {subjectQuestions.length} {subject} questions are now shown. Wonderful work, Shreehan! Try another subject or practise these again.</div>}
 </section>;
}
