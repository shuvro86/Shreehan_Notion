'use client';

import {useState} from 'react';
import {BookOpen, CalendarDays, ChevronDown, ExternalLink, Search} from 'lucide-react';
import './exam-syllabus.css';

const syllabusUrl = 'https://drive.google.com/file/d/1wjYczLYdFtruV5ETLMPUKpIXGuq2qVr0/view';
type Group = 'Language' | 'Math & science' | 'People & places' | 'Creative & values';
type Subject = {name:string; group:Group; page:number; summary:string; topics:string[]; note?:string};

// Transcribed from the three-page Class II (July Session) half-yearly syllabus.
const subjects:Subject[] = [
 {name:'English Language',group:'Language',page:1,summary:'Grammar, comprehension and writing',topics:['Brighter Grammar: lessons 4–6','Nelson International Comprehension: units 7–10','Junior English: pp. 19, 21, 24, 29, 31, 32, 34–36 and 38–42','Creative writing: paragraphs, sentences and unseen descriptions or notes to friends']},
 {name:'English Literature',group:'Language',page:1,summary:'Bingo and the Bully; The Ice King',topics:['Seen: A Magic Place Book 2 — Bingo and the Bully; word meanings and exercises A–D','Unseen: The Ice King; word meanings, short answers, true/false, fill in the blanks and MCQ']},
 {name:'Mathematics',group:'Math & science',page:1,summary:'Joy of Mathematics, mental maths and geometry',topics:['Joy of Mathematics Book 3: p. 44 exercises 1–5; pp. 46, 48, 53; p. 97 exercises b–c; p. 98 exercises 1–5','Mental Mathematics: exercises 18, 21 and 25','Geometry: circle, semicircle and square; diagrams and definitions'],note:'Numerical values will change in the examination.'},
 {name:'Science',group:'Math & science',page:1,summary:'Food for Health; Rocks and Minerals',topics:['Seen: Food for Health — understand, recall, observe, apply, analyse and evaluate','Unseen: Rocks and Minerals — short answers, true/false and fill in the blanks','Diagrams from every chapter']},
 {name:'History',group:'People & places',page:1,summary:'Alexander the Great; Rabindranath Tagore',topics:['Seen: The Conqueror Who Stands Out in History: Alexander the Great — Word Trove and exercises B–C','Unseen: Standing the Test of Time: Rabindranath Tagore — short answers, true/false, fill in the blanks and MCQ']},
 {name:'Geography',group:'People & places',page:1,summary:'Land, volcanoes, wonders, weather and maps',topics:['Seen: p. 14 The Shape of the Land; p. 16 Volcanoes; p. 18 World Wonders; p. 20 Experiencing the Weather','Unseen: p. 22 Different Types of Weather; p. 24 Extreme Weather','Map pp. 60–61: world continents and oceans','Questions, fill in the blanks, true/false and diagrams from every chapter']},
 {name:'English Dictation & Spelling',group:'Language',page:1,summary:'Harrap sets and Bingo and the Bully',topics:['Harrap Spellings: sets 25, 27 and 28','Dictation: A Magic Place Book 2 — Bingo and the Bully']},
 {name:'Bangladesh Studies',group:'People & places',page:1,summary:'Rabindranath Tagore and postcards',topics:['Discovering Bangladesh: Nobel Laureate Rabindranath Tagore','Postcards of Bangladesh','Questions, true/false and fill in the blanks']},
 {name:'Poetry',group:'Creative & values',page:1,summary:'My Garden',topics:['A Magic Place Book 2, p. 43: My Garden (13 lines)']},
 {name:'Reading',group:'Creative & values',page:1,summary:'A Magic Place Book 2',topics:['Any chapter of A Magic Place Book 2']},
 {name:'Drawing',group:'Creative & values',page:1,summary:'A Flying Kite; Smriti Shoudho',topics:['Class work: A Flying Kite','Class work: Smriti Shoudho']},
 {name:'Bangla Paper I',group:'Language',page:2,summary:'গদ্য, পদ্য, বানান ও শ্রুতিলিপি',topics:['গদ্য: সবাই মিলে কাজ করি — প্রশ্ন/উত্তর','পদ্য: আমাদের ছোট নদী; মুক্তি সেনা — প্রশ্ন/উত্তর ও ৮ লাইন মুখস্থ','শব্দার্থ, বাক্য গঠন, শূন্যস্থান পূরণ ও নির্বাচিত যুক্তবর্ণ','বানান ও শ্রুতিলিপি: সবাই মিলে কাজ করি']},
 {name:'Bangla Paper II',group:'Language',page:2,summary:'ব্যাকরণ, অনুচ্ছেদ ও অনুবাদ',topics:['বর্ণ ও বর্ণমালা: অনুশীলনী ১–২; বচন, লিঙ্গ ও বিপরীতার্থক শব্দ','পূর্ণ মাত্রার বর্ণ: পৃষ্ঠা ১২','৮০ শব্দের অনুচ্ছেদ: আমাদের বিদ্যালয় অথবা বিড়াল','ইংরেজি থেকে বাংলা অনুবাদ (unseen)']},
 {name:'Islamic Studies',group:'Creative & values',page:3,summary:'Half-yearly 2026 · 60 marks',topics:['Meaning of Surah Al-Fatihah; given Al-Asma’ul Husna','Akhlaq, Bismillah and Islamic manners; pp. 10–11','Hazrat Adam and Hawa (A.S.); Tawhid and Risalat, pp. 3–6','Glossary: Surah, Hafiz, Taharat, Fajr, Al-Amin','Qa‘idah 1, Harkat and pronunciations; class discussions and tasks'],note:'The source specifies 60 marks for this subject.'},
 {name:'Moral Studies',group:'Creative & values',page:3,summary:'Lessons for Life Book 2 · chapters 3–5',topics:['Half-yearly examination: chapters 3, 4 and 5'],note:'The same table also lists other examinations; only the half-yearly row is shown here.'},
];
const groups = ['All subjects','Language','Math & science','People & places','Creative & values'] as const;

export default function ExamSyllabus(){
 const [group,setGroup]=useState<(typeof groups)[number]>('All subjects');
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState<string|null>(null);
 const normalized=query.trim().toLocaleLowerCase();
 const visible=subjects.filter(subject=>(group==='All subjects'||subject.group===group)&&(!normalized||[subject.name,subject.summary,...subject.topics].join(' ').toLocaleLowerCase().includes(normalized)));
 return <section className="exam-syllabus" aria-labelledby="exam-syllabus-title">
  <header className="exam-syllabus-head">
   <div><span className="exam-syllabus-kicker">MAPLE LEAF INTERNATIONAL SCHOOL · CLASS II · JULY SESSION</span><h2 id="exam-syllabus-title">Half-yearly exam guide</h2><p>Explore what to prepare for each subject in the 2026–2027 syllabus.</p></div>
   <a href={syllabusUrl} target="_blank" rel="noreferrer">Open original PDF <ExternalLink size={15}/></a>
  </header>
  <div className="exam-syllabus-facts"><div><CalendarDays size={20}/><span><strong>2026–2027 session</strong><small>Half-yearly examination</small></span></div><div><BookOpen size={20}/><span><strong>{subjects.length} subject areas</strong><small>Across all 3 syllabus pages</small></span></div></div>
  <p className="exam-syllabus-date-note"><strong>Exam dates and times:</strong> This syllabus does not list a day or time for each paper. Check the school’s exam routine for the schedule.</p>
  <div className="exam-syllabus-controls"><div className="exam-syllabus-groups" role="group" aria-label="Filter subjects by area">{groups.map(item=><button type="button" key={item} aria-pressed={group===item} onClick={()=>setGroup(item)}>{item}</button>)}</div><label className="exam-syllabus-search"><Search size={16}/><span className="exam-syllabus-visually-hidden">Search syllabus topics</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search subjects or topics" type="search"/></label></div>
  <p className="exam-syllabus-count" role="status">Showing {visible.length} of {subjects.length} subject areas</p>
  <div className="exam-syllabus-list">{visible.map(subject=><article className="exam-syllabus-card" key={subject.name}><button type="button" aria-expanded={open===subject.name} onClick={()=>setOpen(open===subject.name?null:subject.name)}><span className="exam-syllabus-page">P{subject.page}</span><span className="exam-syllabus-card-title"><strong>{subject.name}</strong><small>{subject.summary}</small></span><span className="exam-syllabus-group">{subject.group}</span><ChevronDown className={open===subject.name?'is-open':''} size={18}/></button>{open===subject.name&&<div className="exam-syllabus-details"><ul>{subject.topics.map(topic=><li key={topic}>{topic}</li>)}</ul>{subject.note&&<p>{subject.note}</p>}<a href={`${syllabusUrl}#page=${subject.page}`} target="_blank" rel="noreferrer">Check source page {subject.page} <ExternalLink size={13}/></a></div>}</article>)}</div>
  {!visible.length&&<div className="exam-syllabus-empty">No subjects match that search. Try another topic or choose “All subjects.”</div>}
  <footer className="exam-syllabus-footnote">The school says the syllabus may change without prior notice. Check the original PDF for the latest wording.</footer>
 </section>;
}
