'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import './classroom-notifications.css';
import {formatDateTime} from '../_lib/date-format';

type Event = {id:string;text:string;at:string};

export default function ClassroomNotifications(){
 const [open,setOpen]=useState(false),[items,setItems]=useState<Event[]>([]),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const response=await fetch('/api/coursework/notifications',{cache:'no-store'});if(!response.ok)throw new Error('Notifications are unavailable.');setItems((await response.json()).items);setError('');}catch(caught){setError((caught as Error).message);}},[]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(timer);},[load]);
 return <div className="classroom-notifications"><button type="button" aria-expanded={open} aria-label="Notifications" onClick={()=>{setOpen(!open);if(!open)void load();}}><BellRing size={17}/> Notifications{items.length>0&&<span>{items.length}</span>}</button>{open&&<section aria-label="Recent notifications" className="classroom-notification-panel"><div><strong>Recent notifications</strong><button type="button" onClick={()=>void load()}>Refresh</button></div>{error?<p role="alert">{error}</p>:items.length?<ul>{items.map(item=><li key={item.id}><span>{item.text}</span><time dateTime={item.at}>{formatDateTime(item.at)}</time></li>)}</ul>:<p>No notifications yet.</p>}</section>}</div>;
}
