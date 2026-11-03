'use client';

import {useEffect, useState} from 'react';
import {CalendarDays, ChevronDown, Clock3, ExternalLink, Search} from 'lucide-react';
import './exam-routine.css';

const sourceUrl = 'https://drive.google.com/file/d/1H_ntNNaI9A7OMEMlkYUMyJBPlf2HRrE_/view';
type Paper = {id:string; date:string; day:string; start:string; end:string; subject:string};

// Transcribed from the single scanned page of Routine.pdf (Classes II–III, July session).
const papers:Paper[] = [
 {id:'english-language',date:'2026-11-28',day:'Saturday',start:'09:00',end:'11:00',subject:'English Language'},
 {id:'bangla-dictation',date:'2026-11-29',day:'Sunday',start:'09:00',end:'10:00',subject:'Bangla Dictation & Spelling'},
 {id:'poetry-reading-drawing',date:'2026-11-29',day:'Sunday',start:'10:15',end:'11:45',subject:'Poetry, Reading & Drawing'},
 {id:'english-dictation',date:'2026-11-30',day:'Monday',start:'09:00',end:'10:30',subject:'English Dictation & Spelling'},
 {id:'science',date:'2026-12-01',day:'Tuesday',start:'09:00',end:'11:00',subject:'Science'},
 {id:'bangla-paper-i',date:'2026-12-02',day:'Wednesday',start:'09:00',end:'11:00',subject:'Bangla Paper I'},
 {id:'islamic-moral-studies',date:'2026-12-03',day:'Thursday',start:'09:00',end:'10:30',subject:'Islamic Studies / Moral Studies'},
 {id:'mathematics',date:'2026-12-05',day:'Saturday',start:'09:00',end:'11:00',subject:'Mathematics'},
 {id:'history',date:'2026-12-06',day:'Sunday',start:'09:00',end:'11:00',subject:'History'},
 {id:'english-literature',date:'2026-12-07',day:'Monday',start:'09:00',end:'11:00',subject:'English Literature'},
 {id:'bangla-paper-ii',date:'2026-12-08',day:'Tuesday',start:'09:00',end:'11:00',subject:'Bangla Paper II'},
 {id:'geography',date:'2026-12-09',day:'Wednesday',start:'09:00',end:'11:00',subject:'Geography'},
 {id:'bangladesh-studies',date:'2026-12-10',day:'Thursday',start:'09:00',end:'10:30',subject:'Bangladesh Studies'},
];

type Filter = 'all'|'upcoming'|'past';
const dhakaTime = (date:string,time:string) => new Date(`${date}T${time}:00+06:00`).getTime();
const dateLabel = (date:string) => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date(`${date}T12:00:00+06:00`));
const timeLabel = (time:string) => new Intl.DateTimeFormat('en-GB',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Dhaka'}).format(new Date(`2026-12-01T${time}:00+06:00`));
const seatedBy = (time:string) => {const [hour,minute]=time.split(':').map(Number);const total=hour*60+minute-15;return timeLabel(`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`)};

export default function ExamRoutine(){
 const [filter,setFilter]=useState<Filter>('all');
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState<string|null>(null);
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{const update=()=>setNow(Date.now());update();const timer=window.setInterval(update,60_000);return()=>window.clearInterval(timer)},[]);
 const getStatus=(paper:Paper)=>now===null||now<dhakaTime(paper.date,paper.start)?'upcoming':now<dhakaTime(paper.date,paper.end)?'in progress':'past';
 const upcoming=papers.filter(paper=>getStatus(paper)!=='past');
 const past=papers.length-upcoming.length;
 const search=query.trim().toLocaleLowerCase();
 const visible=papers.filter(paper=>(filter==='all'||(filter==='upcoming'?getStatus(paper)!=='past':getStatus(paper)==='past'))&&(!search||`${paper.subject} ${paper.day} ${dateLabel(paper.date)}`.toLocaleLowerCase().includes(search)));
 const next=upcoming[0];
 return <section className="exam-routine" aria-labelledby="exam-routine-title">
  <header className="exam-routine-head"><div><span className="exam-routine-kicker">MAPLE LEAF INTERNATIONAL SCHOOL · CLASSES II–III · JULY SESSION</span><h2 id="exam-routine-title">Half-yearly exam routine</h2><p>Every paper, date and time from the school’s 2026–2027 routine.</p></div><a href={sourceUrl} target="_blank" rel="noreferrer">Open original PDF <ExternalLink size={15}/></a></header>
  <div className="exam-routine-facts"><div><CalendarDays size={20}/><span><strong>28 Nov – 10 Dec 2026</strong><small>{papers.length} papers across 12 exam days</small></span></div><div><Clock3 size={20}/><span><strong>{next?`${next.subject} ${getStatus(next)==='in progress'?'now':'next'}`:'All scheduled times passed'}</strong><small>{next?`${next.day}, ${dateLabel(next.date)} · ${timeLabel(next.start)}`:'See the original routine for any changes'}</small></span></div></div>
  <div className="exam-routine-controls"><div className="exam-routine-filters" role="group" aria-label="Filter exams by time"><button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All <span>{papers.length}</span></button><button type="button" aria-pressed={filter==='upcoming'} onClick={()=>setFilter('upcoming')}>Upcoming <span>{upcoming.length}</span></button><button type="button" aria-pressed={filter==='past'} onClick={()=>setFilter('past')}>Past <span>{past}</span></button></div><label className="exam-routine-search"><Search size={16}/><span className="exam-routine-visually-hidden">Search by subject or date</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search subject or date"/></label></div>
  <p className="exam-routine-count" role="status">Showing {visible.length} of {papers.length} papers · Times in Dhaka (UTC+6)</p>
  <div className="exam-routine-list">{visible.map(paper=>{const status=getStatus(paper);const expanded=open===paper.id;return <article className={`exam-routine-row ${status==='past'?'is-past':''}`} key={paper.id}><button type="button" aria-expanded={expanded} onClick={()=>setOpen(expanded?null:paper.id)}><span className="exam-routine-date"><strong>{new Date(`${paper.date}T12:00:00+06:00`).getUTCDate()}</strong><small>{new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'Asia/Dhaka'}).format(new Date(`${paper.date}T12:00:00+06:00`))}</small></span><span className="exam-routine-subject"><strong>{paper.subject}</strong><small>{paper.day}, {dateLabel(paper.date)}</small></span><span className="exam-routine-time"><Clock3 size={14}/>{timeLabel(paper.start)} – {timeLabel(paper.end)}</span><span className={`exam-routine-status ${status.replace(' ','-')}`}>{status==='in progress'?'In progress':status==='past'?'Past':'Upcoming'}</span><ChevronDown className={expanded?'is-open':''} size={17}/></button>{expanded&&<div className="exam-routine-details"><p>Be seated in the examination hall by <strong>{seatedBy(paper.start)}</strong>, 15 minutes before this paper starts.</p><p>Regular classes will not be held during the examination period.</p><a href={sourceUrl} target="_blank" rel="noreferrer">Check this entry in the original routine <ExternalLink size={13}/></a></div>}</article>})}</div>
  {!visible.length&&<div className="exam-routine-empty">No papers match this view. Try another filter or search.</div>}
  <footer className="exam-routine-footnote">The school notes that an exam may be held on a Friday if unavoidable circumstances require it. Check the original routine for changes.</footer>
 </section>;
}
