'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bot, BookOpen, Check, LoaderCircle, MessageCircle, Send, Sparkles, UserRound } from 'lucide-react';
import './assistant.css';

type Source = { id: string; documentId: string; title: string; page: number; documentUrl: string };
type Message = { role: 'user' | 'assistant'; content: string; sources?: Source[]; qa?: { items?: Array<{ question: string; answer: string; difficulty: string; sources: string[] }> } };

function Sources({ sources = [] }: { sources?: Source[] }) { return sources.length ? <div className="assistant-sources"><span>Sources</span>{sources.map(source => <a key={`${source.id}-${source.page}`} href={`/library?doc=${encodeURIComponent(source.documentId)}`} title={source.title}><BookOpen size={12} />{source.id} · {source.title} · p.{source.page}<ArrowUpRight size={11} /></a>)}</div> : null; }

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'chat' | 'qa'>('chat');

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput(''); setError(''); setBusy(true);
    const next = [...messages, { role: 'user' as const, content: message }]; setMessages(next);
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, mode, history: messages.map(item => ({ role: item.role, content: item.content })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The assistant could not answer.');
      setMessages([...next, { role: 'assistant', content: data.answer || '', sources: data.sources, qa: data.qa }]);
    } catch (e) { setError(e instanceof Error ? e.message : 'The assistant could not answer.'); }
    finally { setBusy(false); }
  }

  return <div className="assistant-page">
    <a className="assistant-back" href="/"><ArrowLeft size={15}/> Back to learning hub</a>
    <div className="assistant-heading"><div><div className="assistant-eyebrow"><Sparkles size={13} /> SHREEHAN DIGITAL TWIN</div><h1>A thoughtful study partner.</h1><p>Ask about your synced Notion documents, or turn them into practice questions with source links.</p></div><div className="assistant-status"><i /> Synced library</div></div>
    <section className="assistant-shell">
      <div className="assistant-chat" aria-live="polite">
        {!messages.length && <div className="assistant-welcome"><div className="assistant-robot-art" role="img" aria-label="Friendly Shreehan Digital Twin robot"><span className="robot-spark spark-one">✦</span><span className="robot-spark spark-two">✧</span><div className="robot-antenna"><i /></div><div className="robot-head"><div className="robot-face"><i /><i /></div><span className="robot-smile" /></div><div className="robot-neck" /><div className="robot-body"><span className="robot-badge">S</span><div className="robot-panel"><i /><i /><i /></div></div><div className="robot-arm arm-left" /><div className="robot-arm arm-right" /><div className="robot-shadow" /></div><h2>What would you like to understand?</h2><p>I’ll look through Shreehan’s synced study material and explain it clearly.</p><div className="assistant-prompts"><button onClick={() => { setInput('Summarize the latest study material'); setMode('chat'); }}>Summarize my study material</button><button onClick={() => { setInput('Create 5 questions about the most important topics'); setMode('qa'); }}>Create practice questions</button></div></div>}
        {messages.map((item, index) => <div className={`assistant-message ${item.role}`} key={`${item.role}-${index}`}><div className="message-icon">{item.role === 'assistant' ? <Bot size={15} /> : <UserRound size={15} />}</div><div className="message-body">{item.role === 'assistant' && item.qa?.items?.length ? <div className="qa-list">{item.qa.items.map((qa, i) => <article className="qa-card" key={i}><span>{qa.difficulty}</span><h3>{qa.question}</h3><p>{qa.answer}</p><small>{qa.sources?.join(' · ')}</small></article>)}</div> : <p>{item.content}</p>} {item.role === 'assistant' && <Sources sources={item.sources} />}</div></div>)}
        {busy && <div className="assistant-message assistant"><div className="message-icon"><Bot size={15} /></div><div className="message-body typing"><LoaderCircle size={16} /> Thinking through the library…</div></div>}
        {error && <div className="assistant-error"><strong>Something went wrong.</strong> {error}</div>}
      </div>
      <form className="assistant-composer" onSubmit={submit}><div className="mode-toggle"><button type="button" className={mode === 'chat' ? 'active' : ''} onClick={() => setMode('chat')}><MessageCircle size={13} /> Chat</button><button type="button" className={mode === 'qa' ? 'active' : ''} onClick={() => setMode('qa')}><Check size={13} /> Generate Q&amp;A</button></div><div className="composer-row"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }} placeholder={mode === 'qa' ? 'What should I make questions about?' : 'Ask Shreehan Digital Twin anything…'} rows={2} maxLength={4000} /><button aria-label="Send message" disabled={!input.trim() || busy}><Send size={17} /></button></div><small>Answers are grounded in synced Notion documents. Press Enter to send.</small></form>
    </section>
  </div>;
}
