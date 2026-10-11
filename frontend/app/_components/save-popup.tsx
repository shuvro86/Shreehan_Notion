'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import './save-popup.css';

type SaveNotice = {message:string;refresh?:boolean};
const EVENT = 'shreehan:saved';

export function showSavePopup(message:string, refresh=false){
 window.dispatchEvent(new CustomEvent<SaveNotice>(EVENT,{detail:{message,refresh}}));
}

export default function SavePopup(){
 const [notice,setNotice]=useState<SaveNotice|null>(null);
 useEffect(()=>{const onSave=(event:Event)=>setNotice((event as CustomEvent<SaveNotice>).detail);window.addEventListener(EVENT,onSave);return()=>window.removeEventListener(EVENT,onSave);},[]);
 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>{if(notice.refresh)window.location.reload();else setNotice(null);},notice.refresh?2200:3500);return()=>window.clearTimeout(timer);},[notice]);
 if(!notice)return null;
 return <div className="save-popup" role="status" aria-live="polite"><span className="save-popup-icon"><Check size={21}/></span><div><strong>Saved successfully</strong><p>{notice.message}</p></div><button type="button" onClick={()=>{if(notice.refresh)window.location.reload();else setNotice(null);}}>{notice.refresh?'Refresh now':'Done'}</button></div>;
}
