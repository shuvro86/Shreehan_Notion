'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLibrary } from './components/use-library';
import Homework from './components/homework';
import UnseenPaper from './components/unseen-paper';
import { ArrowRight, ArrowUpRight, BookOpen, Bot, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock3, CloudSun, Columns3, ExternalLink, FileText, FolderOpen, GraduationCap, Grid2X2, History, KeyRound, LayoutDashboard, ListTodo, LogOut, Menu, Plus, Search, Sparkles, Target, X } from 'lucide-react';

const collections = [
  { name: 'Homework List', description: 'Your homework, always connected to Notion.', icon: ListTodo, color: 'green', id: '3c89ecdd38af80349a22f4d5af9fde88', tag: 'KEEP MOVING FORWARD' },
  { name: 'Routine', description: 'A little structure. A lot of progress.', icon: CalendarDays, color: 'orange', id: '3c49ecdd38af80aa8205dbaad10da968', tag: 'PLAN YOUR DAY' },
  { name: 'Syllabus', description: 'The bigger picture, broken down.', icon: BookOpen, color: 'blue', id: '3c49ecdd38af804ebce9e86206305609', tag: 'KNOW THE PATH' },
  { name: 'Study Note', description: 'Ideas worth keeping close.', icon: FileText, color: 'purple', id: '3c49ecdd38af800fb72df5988abf3b43', tag: 'BUILD YOUR KNOWLEDGE' },
  { name: 'Assignment', description: 'Turn what you know into what you do.', icon: ClipboardList, color: 'green', id: '3c49ecdd38af805bb96afe5722a95f6c', tag: 'PUT IT INTO PRACTICE' },
  { name: 'Exam', description: 'Be ready for your next milestone.', icon: GraduationCap, color: 'pink', id: '3c49ecdd38af80f7afbec860cd6176b1', tag: 'MAKE IT COUNT' },
  { name: 'Unseen Paper', description: 'New challenges. Sharper thinking.', icon: FolderOpen, color: 'yellow', id: '3c49ecdd38af808c8ac4ef768f5d8a22', tag: 'GO A LITTLE FURTHER' },
  { name: 'CT', description: 'Small checkpoints, steady growth.', icon: Target, color: 'blue', id: '3cb9ecdd38af804c84e9ca5417b5e150', tag: 'CHECK YOUR PROGRESS' },
];
type Task = { id: string; title: string; subject: string; done: boolean; priority: string };
const initialTasks: Task[] = [ { id: '1', title: 'Revise fractions & decimals', subject: 'Mathematics', done: false, priority: 'High' }, { id: '2', title: 'Finish the science worksheet', subject: 'Science', done: false, priority: 'Medium' }, { id: '3', title: 'Read the next literature chapter', subject: 'English Literature', done: true, priority: 'Low' } ];
const subjects = ['Mathematics', 'Science', 'English Literature', 'Bangla', 'Bangladesh Studies', 'Geography', 'History', 'Moral Studies'];
const schedule = [ ['Mathematics', 'Fractions & decimals', '09:00', '09:45', 'orange'], ['Science', 'The world around us', '10:00', '10:45', 'green'], ['English Literature', 'Reading & reflection', '11:15', '12:00', 'purple'] ];
type HeroMessage = { title: string; text: string; source: string };
const heroMessages: HeroMessage[] = [
 { title: 'Curiosity is your superpower', text: 'Ask a question. Try a new idea. Celebrate every little win.', source: 'A note for Shreehan' },
 { title: 'Kindness makes you brighter', text: 'A thoughtful word can turn someone’s whole day around.', source: 'A note for Shreehan' },
 { title: 'Small steps become big adventures', text: 'Keep going gently. Every little effort counts.', source: 'A note for Shreehan' },
 { title: 'Brave minds keep learning', text: 'Mistakes are clues that help clever ideas grow.', source: 'A note for Shreehan' },
 { title: 'Your imagination can take you anywhere', text: 'Read, wonder, draw, and follow the questions in your mind.', source: 'A note for Shreehan' },
 { title: 'You can make today wonderful', text: 'Choose one good thing to learn, one kind thing to do, and have fun.', source: 'A note for Shreehan' },
 { title: 'Sharing makes learning sparkle', text: 'Explain an idea, listen closely, and grow together.', source: 'A note for Shreehan' },
 { title: 'Let your effort shine', text: 'A little practice today becomes a confident skill tomorrow.', source: 'A note for Shreehan' },
 { title: 'Dream boldly, begin simply', text: 'Pick one tiny action and let it open the door to a bigger dream.', source: 'A note for Shreehan' },
 { title: 'Your questions are welcome here', text: 'Wonder is the first step of every discovery.', source: 'A note for Shreehan' },
 { title: 'Progress loves patience', text: 'You do not need to be perfect to move forward.', source: 'A note for Shreehan' },
 { title: 'Make room for joy', text: 'Learning is brighter when you notice the fun along the way.', source: 'A note for Shreehan' },
 { title: 'You are growing every day', text: 'Even quiet effort leaves a beautiful mark.', source: 'A note for Shreehan' },
 { title: 'Be the explorer of your ideas', text: 'Read closely, test gently, and keep your mind open.', source: 'A note for Shreehan' },
 { title: '“You have a right to action, never to its fruits.”', text: 'Begin with care, do your best, and let the result unfold.', source: 'Bhagavad Gita 2.47' },
 { title: '“The mind is everything. What you think, you become.”', text: 'Fill your thoughts with courage, patience, and possibility.', source: 'Bhagavad Gita 6.5' },
 { title: '“Whenever there is a decline in righteousness…”', text: 'Choose truth and kindness today; small goodness still matters.', source: 'Bhagavad Gita 4.7' },
 { title: '“Yoga is the journey of the self, through the self, to the self.”', text: 'Learn who you are by giving your best attention to this moment.', source: 'Bhagavad Gita 6.20' },
 { title: '“A person can rise through the efforts of their own mind.”', text: 'Your steady choices can lift you toward your next bright idea.', source: 'Bhagavad Gita 6.5' },
 { title: '“Perform your duty with an even mind.”', text: 'Stay calm, keep practicing, and let every challenge teach you.', source: 'Bhagavad Gita 2.48' },
 { title: '“There is neither this world nor the world beyond for one who doubts.”', text: 'Trust your ability to learn, then take the next small step.', source: 'Bhagavad Gita 4.40' },
 { title: '“No effort is ever lost.”', text: 'Every page read, problem solved, and kind act is part of your journey.', source: 'Bhagavad Gita 2.40' },
];
type ExamItem = { id: string; date: string; subject: string; start: string; end: string; note?: string };
const examSchedule: ExamItem[] = [
 { id: 'english-language', date: '2026-09-12', subject: 'English Language', start: '09:00', end: '10:30' },
 { id: 'bangla-dictation', date: '2026-09-13', subject: 'Bangla Dictation & Spelling', start: '09:00', end: '10:00' },
 { id: 'poetry-reading-drawing', date: '2026-09-13', subject: 'Poetry, Reading & Drawing', start: '10:15', end: '11:45' },
 { id: 'geography', date: '2026-09-14', subject: 'Geography', start: '09:00', end: '10:30' },
 { id: 'bangla-paper-i', date: '2026-09-15', subject: 'Bangla Paper I', start: '09:00', end: '10:30' },
 { id: 'bangladesh-studies', date: '2026-09-16', subject: 'Bangladesh Studies', start: '09:00', end: '10:15' },
 { id: 'moral-studies', date: '2026-09-17', subject: 'Islamic Studies / Moral Studies', start: '09:00', end: '10:15' },
 { id: 'mathematics', date: '2026-09-19', subject: 'Mathematics', start: '09:00', end: '10:30', note: 'Saturday' },
 { id: 'bangla-paper-ii', date: '2026-09-20', subject: 'Bangla Paper II', start: '09:00', end: '10:30', note: 'Sunday' },
 { id: 'science', date: '2026-09-21', subject: 'Science', start: '09:00', end: '10:30', note: 'Monday' },
 { id: 'history', date: '2026-09-22', subject: 'History', start: '09:00', end: '10:30', note: 'Tuesday' },
 { id: 'english-literature', date: '2026-09-23', subject: 'English Literature', start: '09:00', end: '10:30', note: 'Wednesday' },
 { id: 'english-dictation', date: '2026-09-24', subject: 'English Dictation & Spelling', start: '09:00', end: '10:15', note: 'Thursday' },
];
type DayContext = { dateLabel?: string; historyUnavailable?: boolean; location: string; weather: { temperature: number | null; code: number | null }; events: Array<{ year?: number; text: string; region?: 'Bangladesh' | 'World'; sourceUrl?: string }> };
function weatherLabel(code: number | null) { if (code === null) return 'Weather loading'; if (code === 0) return 'Clear skies'; if ([1, 2].includes(code)) return 'A few clouds'; if (code === 3) return 'Cloudy'; if ([45, 48].includes(code)) return 'Misty'; if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'Rainy'; if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snowy'; if ([95, 96, 99].includes(code)) return 'Stormy'; return 'Today’s weather'; }

function ExamSchedule() {
 const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
 const [selected, setSelected] = useState<string | null>(null);
 const now = new Date();
 const endTime = (exam: ExamItem) => { const [hours, minutes] = exam.end.split(':').map(Number); const date = new Date(`${exam.date}T00:00:00`); date.setHours(hours, minutes, 0, 0); return date; };
 const isComplete = (exam: ExamItem) => now >= endTime(exam);
 const visible = examSchedule.filter(exam => filter === 'all' || (filter === 'completed' ? isComplete(exam) : !isComplete(exam)));
 const completed = examSchedule.filter(isComplete).length;
 return <section className="exam-module">
  <div className="exam-module-head"><div><div className="eyebrow"><span/> FIRST MONTHLY · CLASS 2</div><h2>Your exam runway.</h2><p>Know what is coming, and give each subject your best little step.</p></div><div className="exam-progress"><strong>{completed}/{examSchedule.length}</strong><span>completed</span></div></div>
  <div className="exam-toolbar"><div className="exam-filters">{([['all', 'All exams'], ['upcoming', 'Upcoming'], ['completed', 'Completed']] as const).map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}<span>{key === 'all' ? examSchedule.length : key === 'completed' ? completed : examSchedule.length - completed}</span></button>)}</div><span className="exam-updated"><Clock3 size={13}/> Live status · {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>
  <div className="exam-list">{visible.map(exam => { const done = isComplete(exam); const open = selected === exam.id; return <div className={`exam-row ${done ? 'completed' : ''} ${open ? 'expanded' : ''}`} key={exam.id}><button className="exam-row-main" onClick={() => setSelected(open ? null : exam.id)} aria-expanded={open}><span className="exam-date"><strong>{new Date(`${exam.date}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit' })}</strong><small>{new Date(`${exam.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}</small></span><span className="exam-subject"><strong>{exam.subject}</strong><small>{exam.note || new Date(`${exam.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' })}</small></span><span className="exam-time"><Clock3 size={14}/>{exam.start} – {exam.end}</span><span className={`exam-state ${done ? 'done' : ''}`}>{done ? <><Check size={13}/> Complete</> : 'Get ready'}</span><ChevronDown className="exam-chevron" size={16}/></button>{open && <div className="exam-details"><span>{done ? 'This exam has finished.' : 'This is your next chance to show what you know.'}</span><span>Be seated 15 minutes before the start time.</span></div>}</div> })}{!visible.length && <div className="exam-empty"><CheckCheck size={24}/><strong>Every exam is complete.</strong><p>Lovely work, Shreehan. Keep your learning rhythm going.</p></div>}</div>
  <div className="exam-footnote">Schedule from the First Monthly Examination 2026–2027 · Times follow your device clock.</div>
 </section>;
}

export default function Home() {
 const {library,practice,syncLabel,unseenPractice}=useLibrary();
 const [active, setActive] = useState('Overview');
 const [tasks, setTasks] = useState<Task[]>(initialTasks);
 const [taskError, setTaskError] = useState('');
 const [tasksReady, setTasksReady] = useState(false);
 const [account, setAccount] = useState('Shreehan');
 const [searchOpen, setSearchOpen] = useState(false);
 const [query, setQuery] = useState('');
 const [taskOpen, setTaskOpen] = useState(false);
 const [help, setHelp] = useState(false);
 const [mobile, setMobile] = useState(false);
 const [taskFilter, setTaskFilter] = useState('All tasks');
 const [week, setWeek] = useState(0);
 const [day, setDay] = useState(4);
 const [list, setList] = useState(false);
 const [dayContext, setDayContext] = useState<DayContext | null>(null);
 const [historyOpen, setHistoryOpen] = useState(false);
 const [passwordOpen, setPasswordOpen] = useState(false);
 const [passwordBusy, setPasswordBusy] = useState(false);
 const [passwordError, setPasswordError] = useState('');
 const [passwordSuccess, setPasswordSuccess] = useState(false);
 const [heroMessageIndex, setHeroMessageIndex] = useState(0);
 const searchRef = useRef<HTMLInputElement>(null);
 useEffect(() => { let active = true; (async () => { try {
   const [response, me] = await Promise.all([fetch('/api/tasks', { cache: 'no-store' }), fetch('/api/auth/me', { cache: 'no-store' })]);
   if (!response.ok) throw Error();
   let next: Task[] = (await response.json()).tasks;
   if (me.ok) setAccount((await me.json()).username);
   const saved = localStorage.getItem('shreehan-tasks-v1');
   if (saved) { try { const legacy = JSON.parse(saved); if (Array.isArray(legacy) && legacy.every(t => typeof t.id === 'string' && typeof t.title === 'string' && typeof t.done === 'boolean' && typeof t.subject === 'string' && typeof t.priority === 'string')) { const migration = await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: legacy }) }); if (migration.ok) { next = (await migration.json()).tasks; localStorage.removeItem('shreehan-tasks-v1'); } } } catch {} }
   if (active) { setTasks(next); setTasksReady(true); }
  } catch { if (active) setTaskError('Could not load your tasks. Refresh to try again.'); } })(); return () => { active = false; }; }, []);
 async function saveTasks(next: Task[]) { if (!tasksReady) return; setTaskError(''); try { const response = await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: next }) }); if (!response.ok) throw Error(); setTasks((await response.json()).tasks); } catch { setTaskError('Could not save your tasks. Please try again.'); } }
 async function signOut() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }
 async function changePassword(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setPasswordError(''); setPasswordBusy(true);
  const values = new FormData(event.currentTarget);
  const new_password = String(values.get('new_password') || '');
  const confirm_password = String(values.get('confirm_password') || '');
  if (new_password !== confirm_password) { setPasswordError('New passwords do not match.'); setPasswordBusy(false); return; }
  try {
   const response = await fetch('/api/auth/change-password', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({new_password,confirm_password}) });
   const result = await response.json().catch(() => ({}));
   if (!response.ok) throw new Error(result.error || 'Could not change your password.');
   setPasswordSuccess(true);
  } catch (error) { setPasswordError(error instanceof Error ? error.message : 'Could not change your password.'); }
  finally { setPasswordBusy(false); }
 }
 useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v); } if (e.key === 'Escape') { setSearchOpen(false); setTaskOpen(false); setHelp(false); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
 useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
 useEffect(() => { let active = true; fetch('/api/day-context', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(data => { if (active && data) setDayContext(data); }).catch(() => {}); return () => { active = false; }; }, []);
 useEffect(() => {
  const chooseNext = () => setHeroMessageIndex(current => {
   let previous = -1;
   try { previous = Number(localStorage.getItem('shreehan-last-hero-message')); } catch {}
   const options = heroMessages.map((_, index) => index).filter(index => index !== current && index !== previous);
   const next = options[Math.floor(Math.random() * options.length)];
   try { localStorage.setItem('shreehan-last-hero-message', String(next)); } catch {}
   return next;
  });
  chooseNext();
  const timer = window.setInterval(chooseNext, 5 * 60 * 1000);
  return () => window.clearInterval(timer);
 }, []);
 const completed = tasks.filter(t => t.done).length;
 const current = collections.find(c => c.name === active);
 function navigate(name: string) { setActive(name); setMobile(false); setSearchOpen(false); setQuery(''); }
 const visibleTasks = tasks.filter(t => taskFilter === 'All tasks' || (taskFilter === 'Completed' ? t.done : !t.done));
 const weekStart = new Date(2026, 8, 14 + week * 7);
 const dateLabel = new Date(2026, 8, 14 + week * 7 + day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
 const heroMessage = heroMessages[heroMessageIndex];
 return <div className="app-shell">
  {mobile && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobile(false)} />}
  <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
   <a className="brand" href="/" aria-label="Shreehan HQ home"><div className="brand-mark">s<span>·</span></div><span>shreehan<span className="brand-dot">.</span></span></a>
   <button className="workspace-switch" onClick={() => setHelp(true)}><span className="workspace-icon">S</span><span><strong>Shreehan HQ</strong><small>Personal workspace</small></span><ChevronDown size={15}/></button>
   <button className="sidebar-search" onClick={() => setSearchOpen(true)}><Search size={16}/><span>Quick search</span><kbd>⌘ K</kbd></button>
   <div className="nav-label">WORKSPACE</div>
   <nav aria-label="Main navigation"><button className={`nav-item ${active === 'Overview' ? 'selected' : ''}`} onClick={() => navigate('Overview')}><LayoutDashboard size={18}/>Overview<span className="active-dot"/></button><button className={`nav-item ${active === 'My tasks' ? 'selected' : ''}`} onClick={() => navigate('My tasks')}><CheckCheck size={18}/>My tasks<span className="nav-count">{tasks.filter(t => !t.done).length}</span></button></nav>
   <a className="nav-item" href="/library"><BookOpen size={18}/>Document library<span className="nav-count">{library.documents.length}</span></a><a className="nav-item" href="/assistant"><Bot size={18}/>Shreehan Digital Twin</a><a className="nav-item" href="/practice"><GraduationCap size={18}/>Class 2 practice</a><a className="nav-item" href="/kanban"><Columns3 size={18}/>Project board</a><div className="nav-label collection-label">COLLECTIONS <span>8</span></div>
   <nav aria-label="Collections">{collections.map(c => <button key={c.name} onClick={() => navigate(c.name)} className={`nav-item ${active === c.name ? 'selected' : ''}`}><c.icon size={17}/>{c.name}</button>)}</nav>
   <div className="sidebar-bottom"><button className="nav-item" onClick={() => { setPasswordError(''); setPasswordSuccess(false); setPasswordOpen(true); setMobile(false); }}><KeyRound size={17}/>Change password</button><div className="profile"><div className="avatar">{account.slice(0,2).toUpperCase()}</div><span><strong>{account}</strong><small>Workspace member</small></span><button aria-label="Sign out" onClick={signOut}><LogOut size={17}/></button></div></div>
  </aside>
  <div className="main-shell">
   <main>
    <div className="page-heading"><div><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={20}/></button><div className="eyebrow"><span/> CLASS 2 · SHREEHAN’S LEARNING HUB</div><h1>{active === 'Overview' ? 'Ready for your next discovery?' : active === 'My tasks' ? 'One small win at a time.' : current?.name}</h1><p>{active === 'Overview' ? 'Learn, play, and keep your curious mind shining.' : active === 'My tasks' ? 'Pick a little goal and make it yours.' : current?.description}</p></div>{active!=='Homework List'&&<button className="primary-button" onClick={() => setTaskOpen(true)}><Plus size={17}/>New task</button>}</div>
    {active === 'Overview' && <>
     <a href="/library" className="import-library-banner"><span className="icon-tile green"><BookOpen size={22}/></span><span><strong>All your study documents are here.</strong><small>{library.documents.length} imported files · {library.documents.reduce((n,d)=>n+d.pages.length,0)} pages · {practice.questions.length} Class 2 questions with source links</small></span><span className="import-library-cta">Explore library <ArrowUpRight size={18}/></span></a>
     <section className="hero"><div className="hero-content"><div className="hero-kicker"><span/> SHREEHAN HQ <span className="hero-slash">/</span> BIG IDEAS, LITTLE STEPS</div><h2 key={heroMessageIndex} className="hero-message-title">{heroMessage.title}<span>!</span></h2><p key={`hero-text-${heroMessageIndex}`} className="hero-message-text">{heroMessage.text}<br/>There is always something brilliant to discover.</p><small className="hero-inspiration-source">{heroMessage.source}</small><button className="hero-button" onClick={() => navigate('Routine')}>See today’s adventure <ArrowUpRight size={17}/></button><div className="hero-context"><div className="hero-weather"><CloudSun size={20}/><span><strong>{dayContext?.weather.temperature !== null && dayContext?.weather.temperature !== undefined ? `${Math.round(dayContext.weather.temperature)}°C` : '—'}</strong><small>{dayContext ? `${weatherLabel(dayContext.weather.code)} · ${dayContext.location}` : 'Checking the sky…'}</small></span></div><button className="hero-history" onClick={() => setHistoryOpen(true)}><History size={16}/><span><small>ON THIS DAY · {dayContext?.events[0]?.region === 'Bangladesh' ? 'BANGLADESH' : 'WORLD'}</small><strong>{dayContext?.events[0]?.text || (dayContext ? 'No verified events available for today.' : 'Loading today’s history…')}</strong></span><ArrowUpRight size={15}/></button></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="art-grid"/><div className="art-sun"/><div className="step step-one"/><div className="step step-two"/><div className="step step-three"/><div className="step step-four"/><div className="art-star">✦</div><span className="art-caption">KEEP WONDERING ↗</span></div><div className="hero-index">01 — THE JOY OF LEARNING</div></section>
     <section className="stats" aria-label="Workspace statistics"><Stat icon={FolderOpen} value="08" label="Workspace collections" detail="A place for everything" color="orange"/><Stat icon={BookOpen} value="08" label="Core subjects" detail="Keep your curiosity growing" color="purple"/><Stat icon={ListTodo} value={String(tasks.filter(t => !t.done).length).padStart(2, '0')} label="Tasks to focus on" detail="Your next small wins" color="blue"/><Stat icon={CheckCheck} value={String(completed).padStart(2, '0')} label="Tasks completed" detail="Progress you can feel" color="green"/></section>
     <section className="collections-section"><div className="section-heading"><div><h2>Your workspace <span className="count-badge">8</span></h2><p>Less searching. More learning.</p></div><div className="view-toggle"><button aria-label="Grid view" aria-pressed={!list} className={!list ? 'on' : ''} onClick={() => setList(false)}><Grid2X2 size={16}/></button><button aria-label="List view" aria-pressed={list} className={list ? 'on' : ''} onClick={() => setList(true)}><ClipboardList size={17}/></button></div></div><div className={`collection-grid ${list ? 'list-view' : ''}`}>{collections.map(c => <button key={c.name} className="collection-card" onClick={() => navigate(c.name)}><div className="card-top"><span className={`icon-tile ${c.color}`}><c.icon size={22} strokeWidth={1.7}/></span><ArrowUpRight className="card-arrow" size={17}/></div><h3>{c.name}</h3><p>{c.description}</p><div className="card-footer"><span>{c.tag}</span><ArrowRight size={14}/></div></button>)}</div></section>
    </>}
    {current && <section className="collection-detail"><span className={`icon-tile ${current.color}`}><current.icon size={28}/></span><div><span className="eyebrow">SHREEHAN HQ COLLECTION</span><h2>{current.tag.toLowerCase().replace(/^./, s => s.toUpperCase())}.</h2><p>{current.description} Open the original collection to view and manage your documents in Notion.</p></div><a className="primary-button" href={`https://app.notion.com/p/${current.id}`} target="_blank" rel="noreferrer">Open in Notion <ExternalLink size={16}/></a></section>}
    {current?.name === 'Exam' && <ExamSchedule/>}
    {current?.name === 'Unseen Paper' && <UnseenPaper documents={library.documents} bank={unseenPractice}/>}
    {active==='Homework List'&&<Homework data={library.homework} documents={library.documents} syncLabel={syncLabel}/>}
    {current && !['Exam','Homework List'].includes(current.name) && <section className="panel imported-collection"><div className="section-heading"><div><h2>Documents in {current.name}</h2><p>Originals imported from your Notion workspace.</p></div><a className="secondary-button" href={`/library?collection=${encodeURIComponent(current.name)}`}>Browse library <ArrowUpRight size={14}/></a></div>{library.documents.filter(d=>d.collection===current.name).map(d=><a className="imported-file-row" key={d.id} href={`/library?doc=${d.id}`}><FileText size={19}/><span><strong>{d.title}</strong><small>{d.kind} · {d.pages.length} pages · {d.subject}</small></span><ArrowUpRight size={16}/></a>)}{current.name==='CT' && library.records.filter(r=>r.collection==='CT').map(r=><div className="imported-file-row" key={r.id}><CalendarDays size={18}/><span><strong>{r.title}</strong><small>{r.date} · {r.topics||'No topic specified'}</small></span></div>)}</section>}
    {(active === 'Overview' || active === 'Routine' || active === 'My tasks' || active === 'Assignment') && <div className={`lower-grid ${active === 'My tasks' || active === 'Assignment' ? 'tasks-only' : ''}`}>
    {(active === 'Overview' || active === 'Routine') && <section className="panel routine-panel"><div className="section-heading"><div><h2>Your weekly rhythm</h2><p>A little focus goes a long way.</p></div><span className="demo-label">Sample schedule</span></div><div className="week-header"><strong><CalendarDays size={15}/>{weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><div><button className="icon-button" aria-label="Previous week" onClick={() => setWeek(week - 1)}><ChevronLeft size={16}/></button><button className="icon-button" aria-label="Next week" onClick={() => setWeek(week + 1)}><ChevronRight size={16}/></button></div></div><div className="week-days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <button aria-label={new Date(2026, 8, 14 + week * 7 + i).toDateString()} aria-pressed={day === i} className={day === i ? 'chosen' : ''} key={i} onClick={() => setDay(i)}><span>{d}</span><strong>{new Date(2026, 8, 14 + week * 7 + i).getDate()}</strong><i/></button>)}</div><div className="schedule-heading"><span>{dateLabel} · {day > 4 ? 'Recharge day' : 'Your focus sessions'}</span><span>{day > 4 ? '0' : '3'} sessions</span></div><div className="schedule-list">{day > 4 ? <div className="empty-state"><Sparkles size={26}/><strong>Room to recharge.</strong><p>A little rest is part of the routine.</p></div> : schedule.map(([name, desc, start, end, color]) => <div className="schedule-row" key={name}><div className="time"><strong>{start}</strong><span>{end}</span></div><span className={`schedule-line ${color}`}/><div><strong>{name}</strong><p>{desc}</p></div><ArrowUpRight size={15}/></div>)}</div></section>}
    <section className="panel task-panel"><div className="section-heading"><div><h2>A little progress, daily <span className="count-badge">{tasks.filter(t => !t.done).length}</span></h2><p>Your priorities, without the noise.</p></div><button className="icon-button border-button" aria-label="Add task" onClick={() => setTaskOpen(true)}><Plus size={17}/></button></div><div className="task-tabs">{['All tasks', 'To do', 'Completed'].map(f => <button key={f} className={taskFilter === f ? 'active' : ''} onClick={() => setTaskFilter(f)}>{f}</button>)}<span>Saved to your account</span></div>{taskError && <p role="alert">{taskError}</p>}<div className="task-list">{visibleTasks.length ? visibleTasks.map(t => <div className={`task-row ${t.done ? 'done' : ''}`} key={t.id}><button className="task-check" role="checkbox" aria-checked={t.done} aria-label={`Complete ${t.title}`} onClick={() => void saveTasks(tasks.map(x => x.id === t.id ? {...x, done: !x.done} : x))}>{t.done && <Check size={13}/>}</button><div><strong>{t.title}</strong><span>{t.subject}</span></div><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></div>) : <div className="empty-state"><CheckCheck size={26}/><strong>{taskFilter === 'Completed' ? 'Your next win is ahead.' : 'A clean slate.'}</strong><p>{taskFilter === 'Completed' ? 'Completed tasks will appear here.' : 'Add something you want to work on.'}</p></div>}</div><button className="add-task-inline" onClick={() => setTaskOpen(true)}><Plus size={15}/>Add a task</button><div className="task-progress"><div><span>Small wins add up.</span><strong>{completed} of {tasks.length} completed</strong></div><div className="progress-track"><span style={{width: `${tasks.length ? completed/tasks.length*100 : 0}%`}}/></div></div></section>
    </div>}
    {current && !['Routine', 'Homework List', 'Assignment', 'Exam'].includes(active) && <section className="panel subject-panel"><div className="section-heading"><div><h2>A world of things to learn.</h2><p>Subjects represented in your Shreehan workspace.</p></div><BookOpen size={22}/></div><div className="subject-grid">{subjects.map((s, i) => <div key={s}><span>{String(i + 1).padStart(2, '0')}</span><strong>{s}</strong></div>)}</div></section>}
    <footer><span><span className="footer-symbol">✳</span> Built for a brighter everyday.</span><span>Shreehan HQ <i/> {syncLabel} · Schedule below is a sample</span></footer>
   </main>
  </div>
  {searchOpen && <Modal title="Search your workspace" onClose={() => setSearchOpen(false)}><div className="search-input"><Search size={20}/><input ref={searchRef} placeholder="Find a collection or task…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="search-results">{collections.filter(c => `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase())).map(c => <button key={c.name} onClick={() => navigate(c.name)}><span className={`icon-tile ${c.color}`}><c.icon size={19}/></span><span><strong>{c.name}</strong><small>Collection · Shreehan HQ</small></span><ArrowUpRight size={16}/></button>)}{tasks.filter(t => query && t.title.toLowerCase().includes(query.toLowerCase())).map(t => <button key={t.id} onClick={() => navigate('My tasks')}><ListTodo size={20}/><span><strong>{t.title}</strong><small>Local task · {t.subject}</small></span><ArrowRight size={16}/></button>)}{!collections.some(c => `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase())) && !tasks.some(t => query && t.title.toLowerCase().includes(query.toLowerCase())) && <div className="empty-state">No results for “{query}”. Try another search.</div>}</div></Modal>}
  {taskOpen && <Modal title="Make room for a small win." onClose={() => setTaskOpen(false)}><p className="modal-description">Add a task to your personal learning plan. Saved to your account.</p><form className="task-form" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const title = String(data.get('title')).trim(); if (!title) return; void saveTasks([...tasks, { id: crypto.randomUUID(), title, subject: String(data.get('subject')), priority: String(data.get('priority')), done: false }]); setTaskOpen(false); }}><label>What would you like to work on?<input autoFocus name="title" required maxLength={160} placeholder="e.g. Review the science chapter"/></label><div className="form-columns"><label>Subject<select aria-label="Subject" name="subject">{subjects.map(s => <option key={s}>{s}</option>)}<option>General</option></select></label><label>Priority<select aria-label="Priority" name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option></select></label></div><div className="form-footer"><button className="secondary-button" type="button" onClick={() => setTaskOpen(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16}/>Create task</button></div></form></Modal>}
  {passwordOpen && <Modal title="Change password" onClose={() => setPasswordOpen(false)}>{passwordSuccess ? <div className="password-success" role="status"><Check size={22}/><p>Your password has been changed. Other signed-in sessions were closed.</p><button className="primary-button" onClick={() => setPasswordOpen(false)}>Done</button></div> : <form className="password-change-form" onSubmit={changePassword}><p className="modal-description">Type your new password twice to confirm it.</p><label>New password<input autoFocus type="password" name="new_password" autoComplete="new-password" minLength={6} maxLength={256} required/></label><label>Confirm new password<input type="password" name="confirm_password" autoComplete="new-password" minLength={6} maxLength={256} required/></label>{passwordError && <p role="alert" className="password-error">{passwordError}</p>}<div className="form-footer"><button className="secondary-button" type="button" onClick={() => setPasswordOpen(false)}>Cancel</button><button className="primary-button" disabled={passwordBusy} type="submit">{passwordBusy ? 'Saving…' : 'Save new password'}</button></div></form>}</Modal>}
  {historyOpen && <Modal title={`On this day · ${dayContext?.dateLabel || new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka', month: 'long', day: 'numeric' })}`} onClose={() => setHistoryOpen(false)}>
   <div className="history-modal"><p className="modal-description">Bangladesh comes first, followed by moments from around the world. Dates follow Bangladesh time.</p>
    <section aria-label="Bangladesh history"><h3 className="history-group-heading">Bangladesh</h3>
     {dayContext?.events.some(event => event.region === 'Bangladesh') ? dayContext.events.filter(event => event.region === 'Bangladesh').map((event, index) => <article className="history-event" key={index}><span>{event.year || 'Today'}</span><div><p>{event.text}</p>{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer">Read source ↗</a>}</div></article>) : <p className="modal-description">{dayContext?.historyUnavailable ? 'Bangladesh’s daily history feed is temporarily unavailable.' : dayContext ? 'No verified Bangladesh event was found for this date.' : 'Loading today’s history…'}</p>}
    </section>
    {!!dayContext?.events.some(event => event.region !== 'Bangladesh') && <section aria-label="World history"><h3 className="history-group-heading">Around the world</h3>{dayContext.events.filter(event => event.region !== 'Bangladesh').map((event, index) => <article className="history-event" key={index}><span>{event.year || 'Past'}</span><div><p>{event.text}</p>{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer">Read source ↗</a>}</div></article>)}</section>}
   </div>
  </Modal>}
  {help && <Modal title="Welcome to Shreehan HQ." onClose={() => setHelp(false)}><div className="info-content"><span className="icon-tile orange"><GraduationCap size={25}/></span><p>Your personal home for learning, built around the eight collections in your <strong>Shreehan</strong> Notion workspace.</p><p>The document library contains the attachments shared with the Notion integration, with original page previews and Class 2 practice. The dashboard schedule is a sample; your tasks are saved to your account.</p><div className="info-shortcut"><span>Find anything quickly</span><kbd>⌘ / Ctrl + K</kbd></div><p className="muted">Notion content reflects the latest available sync. New top-level pages must be connected to the integration. {syncLabel}.</p></div></Modal>}
 </div>;
}

function Stat({icon: Icon, value, label, detail, color}: { icon: typeof FolderOpen; value: string; label: string; detail: string; color: string }) { return <div className="stat"><div className="stat-top"><span>{label}</span><Icon size={17} className={`text-${color}`}/></div><strong>{value}<span className={`stat-spark ${color}`}><ArrowUpRight size={15}/></span></strong><small>{detail}</small></div>; }
function Modal({title, children, onClose}: {title: string; children: React.ReactNode; onClose: () => void}) { const ref = useRef<HTMLDivElement>(null); useEffect(() => { const prior = document.activeElement as HTMLElement; const bodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; const elements = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, input, select, a[href], [tabindex="0"]') || []); if (!ref.current?.contains(document.activeElement)) elements()[0]?.focus(); const trap = (e: KeyboardEvent) => { if (e.key !== 'Tab') return; const all = elements(); const first = all[0], last = all[all.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }; document.addEventListener('keydown', trap); return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', trap); prior?.focus(); }; }, []); return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</div></div>; }
