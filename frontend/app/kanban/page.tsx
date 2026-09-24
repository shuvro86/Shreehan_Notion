'use client';

import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown, Columns3, GripVertical, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import './kanban.css';

type Card = { id: string; title: string; details: string };
type Column = { id: string; name: string; cards: Card[] };

const initialBoard: Column[] = [
  { id: 'ideas', name: 'Ideas', cards: [
    { id: 'idea-1', title: 'Build a better morning routine', details: 'Pick a calm start that leaves room for breakfast, a little reading, and getting ready without rushing.' },
    { id: 'idea-2', title: 'Make a mini weather journal', details: 'Notice the sky each day and draw one small picture of the weather.' },
  ] },
  { id: 'up-next', name: 'Up next', cards: [
    { id: 'next-1', title: 'Choose a book for this week', details: 'Find a story that sounds fun and read a few pages together.' },
    { id: 'next-2', title: 'Plan a paper airplane challenge', details: 'Fold three designs and see which one flies the farthest.' },
  ] },
  { id: 'in-progress', name: 'In progress', cards: [
    { id: 'progress-1', title: 'Create a neighbourhood map', details: 'Add the park, the library, and a path between a few favourite places.' },
    { id: 'progress-2', title: 'Practise multiplication facts', details: 'Try a short round of the 2, 5, and 10 times tables each afternoon.' },
  ] },
  { id: 'review', name: 'Review', cards: [
    { id: 'review-1', title: 'Finish the solar system poster', details: 'Check the planet order, add labels, and make sure every planet has a colour.' },
  ] },
  { id: 'done', name: 'Done', cards: [
    { id: 'done-1', title: 'Organise the art supplies', details: 'Put pencils, paper, and paints back in their home so the next idea is easy to start.' },
    { id: 'done-2', title: 'Read a story aloud', details: 'Take turns reading and share a favourite part at the end.' },
  ] },
];

const storageKey = 'shreehan-kanban-v1';

export default function KanbanPage() {
  const [columns, setColumns] = useState(initialBoard);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [columnDraft, setColumnDraft] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<string | null>(null);

  useEffect(() => { let active = true; (async () => {
    try {
      const response = await fetch('/api/board', { cache: 'no-store' });
      if (!response.ok) throw Error('Could not load your board.');
      const data: { columns: Column[] } = await response.json();
      let next = data.columns;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const legacy = JSON.parse(saved) as Column[];
          if (Array.isArray(legacy) && legacy.length === 5 && legacy.every(column => typeof column.name === 'string' && Array.isArray(column.cards))) {
            const migrated = next.map((column, index) => ({ ...column, name: legacy[index].name, cards: legacy[index].cards.filter(card => typeof card.id === 'string' && typeof card.title === 'string' && typeof card.details === 'string') }));
            const save = await fetch('/api/board', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ columns: migrated }) });
            if (save.ok) { next = (await save.json()).columns; localStorage.removeItem(storageKey); }
          }
        } catch { /* Keep server data if legacy storage is malformed. */ }
      }
      if (active) { setColumns(next); setReady(true); }
    } catch { if (active) setSaveError('Could not load your board. Refresh to try again.'); }
  })(); return () => { active = false; }; }, []);

  async function persist(next: Column[]) {
    if (!ready) return;
    setSaveError('');
    try {
      const response = await fetch('/api/board', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ columns: next }) });
      if (!response.ok) throw Error();
      setColumns((await response.json()).columns);
    } catch { setSaveError('Could not save that change. Please try again.'); }
  }

  function renameColumn(id: string) {
    const nextName = columnDraft.trim();
    if (nextName) void persist(columns.map(column => column.id === id ? { ...column, name: nextName } : column));
    setEditingColumn(null);
  }

  function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addingTo || !title.trim()) return;
    const card = { id: crypto.randomUUID(), title: title.trim(), details: details.trim() };
    void persist(columns.map(column => column.id === addingTo ? { ...column, cards: [...column.cards, card] } : column));
    setAddingTo(null); setTitle(''); setDetails('');
  }

  function deleteCard(id: string) {
    void persist(columns.map(column => ({ ...column, cards: column.cards.filter(card => card.id !== id) })));
  }

  function startDrag(event: DragEvent<HTMLElement>, cardId: string) {
    setDraggedCard(cardId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardId);
  }

  function dropOnColumn(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData('text/plain') || draggedCard;
    if (!cardId) return;
    const next = (() => {
      let moving: Card | undefined;
      const withoutCard = columns.map(column => ({ ...column, cards: column.cards.filter(card => { if (card.id === cardId) { moving = card; return false; } return true; }) }));
      if (!moving) return columns;
      return withoutCard.map(column => column.id === targetId ? { ...column, cards: [...column.cards, moving!] } : column);
    })();
    void persist(next);
    setDraggedCard(null); setDropColumn(null);
  }

  const cardCount = columns.reduce((count, column) => count + column.cards.length, 0);

  return <main className="kanban-page">
    <header className="kanban-topbar">
      <Link href="/" className="kanban-brand" aria-label="Back to Shreehan HQ"><span className="kanban-brand-mark">s<span>·</span></span><span>shreehan<span className="kanban-brand-dot">.</span></span></Link>
      <div className="kanban-topbar-right"><span className="workspace-pill"><span className="workspace-avatar">S</span> Shreehan HQ <ChevronDown size={14}/></span><span className="topbar-divider"/><Link href="/" className="back-link"><ArrowLeft size={15}/> Learning hub</Link></div>
    </header>

    <section className="kanban-content">
      <div className="kanban-heading-row">
        <div className="kanban-heading">
          <div className="kanban-breadcrumb"><span>WORKSPACE</span><span className="breadcrumb-slash">/</span><span>PROJECTS</span></div>
          <div className="kanban-title-line"><span className="board-icon"><Columns3 size={21}/></span><div><h1>My project board</h1><p>A little progress, one step at a time.</p></div></div>
        </div>
        <div className="board-meta"><div className="board-people"><span>S</span><span className="board-people-plus">+</span></div><span>Just you</span><i/><span><Sparkles size={14}/> {cardCount} little wins</span></div>
      </div>

      <div className="board-toolbar"><div className="board-view"><span className="board-view-icon"><Columns3 size={15}/></span> Board <ChevronDown size={14}/></div><span className="toolbar-separator"/><span className="board-hint"><GripVertical size={15}/> Drag a card to move it along</span></div>
      {saveError && <p role="alert" className="board-save-error">{saveError}</p>}

      <div className={`kanban-board ${ready ? '' : 'board-not-ready'}`} aria-label="Project board with five columns" aria-busy={!ready}>
        {columns.map((column, index) => <section key={column.id} className={`kanban-column ${dropColumn === column.id ? 'is-drop-target' : ''}`} onDragOver={event => { event.preventDefault(); setDropColumn(column.id); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropColumn(null); }} onDrop={event => dropOnColumn(event, column.id)}>
          <div className="column-header"><span className={`column-marker marker-${index + 1}`}/>{editingColumn === column.id ? <form className="rename-form" onSubmit={event => { event.preventDefault(); renameColumn(column.id); }}><input autoFocus value={columnDraft} onChange={event => setColumnDraft(event.target.value)} onBlur={() => renameColumn(column.id)} onKeyDown={event => { if (event.key === 'Escape') setEditingColumn(null); }} aria-label="Column name" maxLength={30}/><button type="submit" aria-label="Save column name"><Check size={14}/></button></form> : <><button className="column-name" onClick={() => { setEditingColumn(column.id); setColumnDraft(column.name); }} title="Rename column">{column.name}</button><button className="column-edit" aria-label={`Rename ${column.name}`} onClick={() => { setEditingColumn(column.id); setColumnDraft(column.name); }}><Pencil size={13}/></button></>}<span className="column-count">{column.cards.length}</span><button className="column-menu" aria-label={`Add a card to ${column.name}`} onClick={() => { setAddingTo(column.id); setTitle(''); setDetails(''); }}><MoreHorizontal size={18}/></button></div>
          <div className="column-cards">{column.cards.map(card => <article key={card.id} className={`kanban-card ${draggedCard === card.id ? 'is-dragging' : ''}`} draggable onDragStart={event => startDrag(event, card.id)} onDragEnd={() => { setDraggedCard(null); setDropColumn(null); }}>
            <div className="card-grip"><GripVertical size={15}/><button className="card-delete" aria-label={`Delete ${card.title}`} onClick={() => deleteCard(card.id)}><Trash2 size={14}/></button></div>
            <h3>{card.title}</h3>{card.details && <p>{card.details}</p>}
          </article>)}
          {column.cards.length === 0 && <div className="column-empty"><span>Drop a card here</span></div>}
          <button className="add-card-button" onClick={() => { setAddingTo(column.id); setTitle(''); setDetails(''); }}><Plus size={16}/> Add a card</button></div>
        </section>)}
      </div>
      <footer className="kanban-footer"><span><span className="footer-sparkle">✳</span> Make progress visible. Keep moving gently.</span><span>YOUR BOARD · YOUR PACE</span></footer>
    </section>

    {addingTo && <div className="modal-scrim" onMouseDown={event => { if (event.target === event.currentTarget) setAddingTo(null); }}><section className="card-modal" role="dialog" aria-modal="true" aria-labelledby="new-card-title"><div className="modal-topline"><span className="modal-icon"><Plus size={17}/></span><button className="modal-close" aria-label="Close" onClick={() => setAddingTo(null)}><X size={18}/></button></div><div className="modal-copy"><h2 id="new-card-title">Add a little goal</h2><p>Give your next idea a clear place to begin.</p></div><form onSubmit={addCard}><label htmlFor="card-title">Title</label><input id="card-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="What would you like to do?" maxLength={100} required/><label htmlFor="card-details">Details <span>OPTIONAL</span></label><textarea id="card-details" value={details} onChange={event => setDetails(event.target.value)} placeholder="Add a few helpful details…" maxLength={500} rows={4}/><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setAddingTo(null)}>Cancel</button><button type="submit" className="create-button"><Plus size={16}/> Add card</button></div></form></section></div>}
  </main>;
}
