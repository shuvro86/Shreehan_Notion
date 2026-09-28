'use client';

import {useEffect, useState} from 'react';
import {Sparkles} from 'lucide-react';

type Progress = {state:string;phase:string;collection:string;message:string;records?:{added:number;changed:number;removed:number};documents?:{added:number;changed:number;removed:number}};
const idle = (collection:string):Progress => ({state:'idle',phase:'idle',collection,message:`Ready to sync ${collection}.`});

export default function CollectionSync({collection}:{collection:'Study Note'|'Exam'|'Assignment'}) {
 const [progress,setProgress]=useState<Progress>(()=>idle(collection));
 useEffect(()=>{
  let active=true;
  setProgress(idle(collection));
  fetch(`/api/collections/${encodeURIComponent(collection)}/sync`,{cache:'no-store'})
   .then(response=>response.ok?response.json():null)
   .then(value=>{if(active&&value)setProgress(value as Progress)})
   .catch(()=>{});
  return()=>{active=false};
 },[collection]);
 useEffect(()=>{
  if(progress.state!=='running')return;
  let active=true;
  const poll=async()=>{
   try{
    const response=await fetch(`/api/collections/${encodeURIComponent(collection)}/sync`,{cache:'no-store'});
    if(!response.ok)return;
    const next=await response.json() as Progress;
    if(active){
     setProgress(next);
     if(next.state==='complete')window.dispatchEvent(new CustomEvent('shreehan:library-refresh'));
    }
   }catch{/* Keep the last progress message during a temporary network error. */}
  };
  const timer=window.setInterval(poll,1200);
  return()=>{active=false;window.clearInterval(timer)};
 },[collection,progress.state]);
 async function start(){
  setProgress({state:'running',phase:'starting',collection,message:`Starting ${collection} sync…`});
  try{
   const response=await fetch(`/api/collections/${encodeURIComponent(collection)}/sync`,{method:'POST',cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.error==='string'?data.error:`Could not sync ${collection}.`);
   setProgress(data as Progress);
  }catch(error){setProgress({state:'error',phase:'error',collection,message:error instanceof Error?error.message:`Could not sync ${collection}.`})}
 }
 return <div className="collection-sync-control">
  <button type="button" className="collection-sync-button" onClick={start} disabled={progress.state==='running'}><Sparkles size={16}/>{progress.state==='running'?'Syncing…':'Sync Notion'}</button>
  {progress.state!=='idle'&&<div className={`collection-sync-message ${progress.state}`} role="status" aria-live="polite">
   {progress.state==='running'&&<progress aria-label={`${collection} Notion sync in progress`}/>}
   <span>{progress.message}</span>
  </div>}
 </div>;
}
