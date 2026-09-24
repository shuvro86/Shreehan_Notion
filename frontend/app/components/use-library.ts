'use client';
import {useEffect,useMemo,useState} from 'react';
import seed from '../../../data/library.json';
import prepared from '../../../data/practice.json';
import unseen from '../../../data/unseen-practice.json';
import type {HomeworkData} from './homework';
import type { UnseenPractice } from '../lib/unseen-practice';
export function useLibrary(){
 const [library,setLibrary]=useState<typeof seed & {homework?:HomeworkData}>({...seed,documents:[] as typeof seed.documents,records:[] as typeof seed.records});
 const [unseenPractice,setUnseenPractice]=useState<UnseenPractice>(unseen);
 const [sync,setSync]=useState<{state:string;lastSuccess?:string|null;message?:string}>({state:'starting'});
 useEffect(()=>{let active=true;const controller=new AbortController();async function refresh(){try{const response=await fetch('/api/library',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(active){setLibrary(data.library);setSync(data.sync);setUnseenPractice(data.unseenPractice || unseen)}}catch{if(active)setSync(s=>({...s,state:'offline'}))}}void refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh)}},[]);
 const practice=useMemo(()=>{
  const unchanged=new Set(library.documents.filter(d=>seed.documents.some(s=>s.id===d.id&&s.sha256===d.sha256)).map(d=>d.id));
  const reviewed=new Set(library.documents.filter(d=>d.collection==='Unseen Paper'&&unseenPractice.sources.some(s=>s.documentId===d.id&&s.sha256===d.sha256&&s.subject===d.subject)).map(d=>d.id));
  const unseenQuestions=unseenPractice.questions.filter(q=>q.sources.every(s=>reviewed.has(s.documentId))).map(q=>({...q,explanation:''}));
  return {...prepared,questions:[...prepared.questions.filter(q=>q.sources.every(s=>unchanged.has(s.documentId))),...unseenQuestions],analysis:prepared.analysis.filter(a=>unchanged.has(a.documentId))};
 },[library,unseenPractice]);
 const syncLabel=sync.state==='ok'?`Synced ${sync.lastSuccess?new Date(sync.lastSuccess).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}`:sync.state==='syncing'?'Syncing with Notion…':sync.state==='partial'?'Synced · text extraction pending':sync.state==='error'?'Sync failed · saved copy':sync.state==='stale'?'Notion updates delayed · saved copy':sync.state==='offline'?'Offline · saved copy':sync.state==='unconfigured'?'Notion sync needs configuration':'Connecting to Notion…';
 return {library,practice,sync,syncLabel,unseenPractice};
}
