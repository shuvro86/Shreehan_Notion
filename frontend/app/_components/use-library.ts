'use client';
import {useEffect,useMemo,useState} from 'react';
import seed from '../../../data/library.json';
import prepared from '../../../data/practice.json';
import unseen from '../../../data/unseen-practice.json';
import type {HomeworkData} from './homework';
import type { UnseenPractice } from '../_lib/unseen-practice';
import type { SubjectPractice } from '../_lib/subject-practice';
export function useLibrary(){
 const [library,setLibrary]=useState<typeof seed & {homework?:HomeworkData}>({...seed,documents:[] as typeof seed.documents,records:[] as typeof seed.records});
 const [unseenPractice,setUnseenPractice]=useState<UnseenPractice>(unseen);
 const [studyNotePractice,setStudyNotePractice]=useState<SubjectPractice>({subjects:[]});
 const [subjectPractice,setSubjectPractice]=useState<SubjectPractice>({subjects:[]});
 const [sync,setSync]=useState<{state:string;lastSuccess?:string|null;message?:string;drivePending?:boolean}>({state:'starting'});
 useEffect(()=>{let active=true;const controller=new AbortController();async function refresh(){try{const response=await fetch('/api/library',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(active){setLibrary(data.library);setSync(data.sync);setUnseenPractice(data.unseenPractice || unseen);setSubjectPractice(data.subjectPractice || {subjects:[]});setStudyNotePractice(data.studyNotePractice || {subjects:[]})}}catch{if(active)setSync(s=>({...s,state:'offline'}))}}void refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('shreehan:library-refresh',refresh);return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('shreehan:library-refresh',refresh)}},[]);
 const practice=useMemo(()=>{
  const unchanged=new Set(library.documents.filter(d=>seed.documents.some(s=>s.id===d.id&&s.sha256===d.sha256)).map(d=>d.id));
  const reviewed=new Set(library.documents.filter(d=>(d.collection==='Unseen Paper'||((d as typeof d & {sourceType?:string}).sourceType==='google_drive'&&d.collection!=='Syllabus'))&&unseenPractice.sources.some(s=>s.documentId===d.id&&s.sha256===d.sha256&&s.subject===d.subject)).map(d=>d.id));
  const unseenQuestions=unseenPractice.questions.filter(q=>q.sources.every(s=>reviewed.has(s.documentId))).map(q=>({...q,explanation:''}));
  return {...prepared,questions:[...prepared.questions.filter(q=>q.sources.every(s=>unchanged.has(s.documentId))),...unseenQuestions],analysis:prepared.analysis.filter(a=>unchanged.has(a.documentId)),coverageNote:['google_drive','notion_drive'].includes((library as typeof library & {sourceType?:string}).sourceType||'')?'Questions are based on readable pages in the synced Class II half-yearly folder. Syllabus topics without uploaded lessons are not treated as answered content. Check the original scans for diagrams and unclear OCR.':prepared.coverageNote};
 },[library,unseenPractice]);
 const syncLabel=sync.drivePending&&['syncing','partial'].includes(sync.state)?'Notion synced · Drive folder access needed':sync.state==='ok'?`Synced ${sync.lastSuccess?new Date(sync.lastSuccess).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}`:sync.state==='syncing'?'Syncing study sources…':sync.state==='partial'?'Synced · text extraction pending':sync.state==='error'?'Sync failed · saved copy':sync.state==='stale'?'Source updates delayed · saved copy':sync.state==='offline'?'Offline · saved copy':sync.state==='unconfigured'?'Notion sync needs configuration':'Connecting to Notion…';
 return {library,practice,sync,syncLabel,unseenPractice,subjectPractice,studyNotePractice};
}
