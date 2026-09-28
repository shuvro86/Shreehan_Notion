'use client';
import {useState} from 'react';
import {BookOpen,Check,ExternalLink,FileText,Search} from 'lucide-react';
import './homework.css';
export type HomeworkData={sources:{id:string;title:string;url:string}[];items:{id:string;title:string;kind:string;checked:boolean|null;date?:string;sourceTitle:string;notionUrl:string;level:number}[]};
type Document={id:string;title:string;collection:string;filename:string};
export default function Homework({data,documents,syncLabel}:{data?:HomeworkData;documents:Document[];syncLabel:string}){
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('All');
 const items=data?.items||[];
 const visible=items.filter(i=>`${i.title} ${i.sourceTitle}`.toLowerCase().includes(query.toLowerCase())&&(filter==='All'||(filter==='Completed'?i.checked===true:i.checked===false)));
 const files=documents.filter(d=>d.collection==='Homework');
 return <section className="panel homework-panel" aria-label="Homework from Notion">
  <div className="section-heading"><div><h2>Homework List <span className="count-badge">{items.length}</span></h2><p>Instructions and checklists from your Notion Homework section.</p></div><span className="homework-sync" role="status">{syncLabel}</span></div>
  <div className="homework-toolbar"><label><Search size={17}/><input aria-label="Search homework" placeholder="Find a homework instruction…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Homework status" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Pending checklists</option><option>Completed</option></select></div>
  <div className="homework-items">{visible.map((item,index)=><article className={`homework-item ${item.checked===true?'completed':''}`} key={item.id} style={{marginLeft:Math.min(item.level,3)*12}}><span className="homework-number" aria-label={item.checked===true?'Completed in Notion':item.checked===false?'Pending in Notion':undefined}>{item.checked===true?<Check size={17}/>:String(index+1).padStart(2,'0')}</span><div><p>{item.title}</p><small>{item.sourceTitle}{item.date?` · ${item.date}`:''}{item.checked!==null?` · ${item.checked?'Completed':'Pending'} in Notion`:''}</small></div><a href={item.notionUrl} target="_blank" rel="noreferrer" aria-label={`Open homework in Notion: ${item.title}`}><ExternalLink size={16}/></a></article>)}</div>
  {!visible.length&&<div className="empty-state"><BookOpen size={25}/><strong>{items.length?'No matching homework.':data?.sources.length?'No homework instructions yet.':'Waiting for Homework from Notion.'}</strong><p>{items.length?'Try a different search or status.':'Add instructions or checklist items in Notion; they appear here after synchronization.'}</p></div>}
  {files.length>0&&<div className="homework-files"><h3>Homework documents</h3>{files.map(d=><a className="imported-file-row" key={d.id} href={`/library?doc=${d.id}`}><FileText size={18}/><span>{d.title}<small>{d.filename}</small></span></a>)}</div>}
  <div className="homework-footer"><span>Edit instructions and completion in Notion. Changes sync here automatically.</span>{data?.sources.slice(0,1).map(s=><a key={s.id} href={s.url} target="_blank" rel="noreferrer">Open Homework <ExternalLink size={13}/></a>)}</div>
 </section>;
}
