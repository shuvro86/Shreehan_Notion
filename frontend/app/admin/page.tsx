'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BellRing, KeyRound, LogOut, Pencil, Plus, Settings2, ShieldCheck, Trash2, Users } from 'lucide-react';
import {useMenuAccess} from '../_components/auth-gate';
import './admin.css';

type Role = 'student' | 'teacher' | 'admin';
type Account = { id: string; username: string; email: string; active: number; role: Role };
type MenuItem = {key:string;label:string;path:string;enabled:boolean;locked:boolean};
type TeacherUpdate = {id:string;day:string;body:string;teacher_name:string;created_at:string;updated_at:string;read_at:string|null};
type Draft = { username: string; email: string; password: string; role: Role };
const emptyDraft = (): Draft => ({username:'', email:'', password:'', role:'student'});

async function adminRequest(path:string, method='GET', body?:object) {
  const response=await fetch(`/api/admin/users${path}`, {method, cache:'no-store', headers:body?{'Content-Type':'application/json'}:undefined, body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(result.error || 'Could not save this account.');
  return result;
}

export default function AdminPage() {
  const allowedMenus=useMenuAccess();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selfId, setSelfId] = useState('');
  const [tab, setTab] = useState<'accounts' | 'menus' | 'feedback' | 'setup'>('accounts');
  const [roleMenus,setRoleMenus]=useState<Record<Role,MenuItem[]>|null>(null);
  const [feedback,setFeedback]=useState<TeacherUpdate[]>([]);
  const [unread,setUnread]=useState(0);
  const setupEnabled=roleMenus?.admin.find(item=>item.key==='admin_setup')?.enabled ?? allowedMenus.includes('admin_setup');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const load = useCallback(async () => {
    const data = await adminRequest('');
    setAccounts(data.users); setSelfId(data.selfId);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  const loadMenus=useCallback(async()=>{const response=await fetch('/api/admin/menu-access',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not load menu settings.');setRoleMenus(result.roles);},[]);
  useEffect(()=>{void loadMenus().catch(e=>setError(e.message));},[loadMenus]);
  const loadFeedback=useCallback(async()=>{const response=await fetch('/api/admin/feedback',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not load teacher updates.');setFeedback(result.items);setUnread(result.unread);},[]);
  useEffect(()=>{void loadFeedback().catch(e=>setError(e.message));const timer=window.setInterval(()=>{void loadFeedback().catch(()=>{});},30000);return()=>window.clearInterval(timer);},[loadFeedback]);
  useEffect(()=>{if(tab==='setup'&&!setupEnabled)setTab('menus');},[tab,setupEnabled]);

  async function toggleMenu(role:Role,item:MenuItem){
    if(item.locked)return;
    setBusy(`${role}:${item.key}`);setError('');setMessage('');
    setRoleMenus(current=>current?{...current,[role]:current[role].map(menu=>menu.key===item.key?{...menu,enabled:!item.enabled}:menu)}:current);
    try{const response=await fetch('/api/admin/menu-access',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,menu_key:item.key,enabled:!item.enabled})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not update menu access.');setRoleMenus(result.roles);setMessage('Menu access saved. Affected users will see the change on their next session check.');}
    catch(caught){setError(caught instanceof Error?caught.message:'Could not update menu access.');void loadMenus();}
    finally{setBusy('');}
  }
  async function markFeedbackRead(id:string){setBusy(id);setError('');try{const response=await fetch(`/api/admin/feedback/${encodeURIComponent(id)}/read`,{method:'PUT'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not mark this update as read.');await loadFeedback();}catch(caught){setError(caught instanceof Error?caught.message:'Could not mark this update as read.');}finally{setBusy('');}}

  function openForm(account?:Account) {
    setError(''); setMessage(''); setEditingId(account?.id || null);
    setDraft(account?{username:account.username,email:account.email,password:'',role:account.role}:emptyDraft());
    setFormOpen(true);
  }
  async function saveUser(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return; setBusy('form'); setError(''); setMessage('');
    try {
      const payload=editingId&&!draft.password?{username:draft.username,email:draft.email,role:draft.role}:draft;
      const result=await adminRequest(editingId?`/${encodeURIComponent(editingId)}`:'', editingId?'PUT':'POST', payload);
      setAccounts(result.users); setFormOpen(false); setMessage(editingId?'Account updated. Its previous sessions were closed.':'Account created and ready to sign in.');
    } catch(caught) { setError(caught instanceof Error?caught.message:'Could not save this account.'); }
    finally { setBusy(''); }
  }
  async function deleteUser(account:Account) {
    if(!window.confirm(`Delete ${account.username}? Their account data, coursework, submissions, and reviews will be permanently removed.`))return;
    setBusy(account.id); setError(''); setMessage('');
    try { const result=await adminRequest(`/${encodeURIComponent(account.id)}`,'DELETE'); setAccounts(result.users); setMessage(`${account.username} was deleted.`); }
    catch(caught) { setError(caught instanceof Error?caught.message:'Could not delete this account.'); }
    finally { setBusy(''); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('password'); setError(''); setMessage('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const new_password = String(values.get('password') || '');
    if (new_password !== values.get('confirm')) { setError('Passwords do not match.'); setBusy(''); return; }
    try {
      const response = await fetch('/api/auth/change-password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({new_password, confirm_password: new_password}) });
      if (!response.ok) throw new Error((await response.json()).error || 'Could not change password.');
      form.reset(); setMessage('Password changed. Other sessions were closed.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not change password.'); }
    finally { setBusy(''); }
  }

  return <main className="admin-page">
    <header className="admin-header"><div><span className="admin-mark"><ShieldCheck size={23}/></span><div><strong>Shreehan HQ</strong><small>ADMINISTRATION</small></div></div><button onClick={async () => { await fetch('/api/auth/logout', {method:'POST'}); window.location.assign('/login'); }}><LogOut size={17}/> Sign out</button></header>
    <div className="admin-layout"><nav aria-label="Administration menu"><button className={tab==='accounts'?'selected':''} onClick={()=>setTab('accounts')}><Users size={18}/> Accounts</button><button className={tab==='menus'?'selected':''} onClick={()=>setTab('menus')}><Settings2 size={18}/> Menu access</button><button className={tab==='feedback'?'selected':''} onClick={()=>setTab('feedback')}><BellRing size={18}/> Teacher updates{unread>0&&<span className="admin-unread">{unread}</span>}</button>{setupEnabled&&<button className={tab==='setup'?'selected':''} onClick={()=>setTab('setup')}><KeyRound size={18}/> Setup</button>}</nav>
      <section className="admin-content"><div className="admin-heading"><span>ADMIN WORKSPACE</span><h1>{tab==='accounts'?'Manage users':tab==='menus'?'Menu access':tab==='feedback'?'Teacher updates':'Application setup'}</h1><p>{tab==='accounts'?'Create accounts, update their details and roles, or remove them.':tab==='menus'?'Choose which menus each role can open.':tab==='feedback'?'Read each daily update about Shreehan and track what needs attention.':'Review role access and change your own password.'}</p></div>
      {error&&!formOpen&&<p className="admin-alert" role="alert">{error}</p>}{message&&<p className="admin-success" role="status">{message}</p>}
      {tab==='accounts'?<div className="admin-card"><div className="admin-card-title"><h2>Users <span className="admin-count">{accounts.length}</span></h2><div><button onClick={()=>void load().catch(e=>setError(e.message))}>Refresh</button><button className="admin-add" onClick={()=>openForm()}><Plus size={16}/> Add user</button></div></div><div className="admin-users">{accounts.map(account=><div className="admin-user" key={account.id}><div className="admin-avatar">{account.username.slice(0,2).toUpperCase()}</div><div className="admin-user-info"><strong>{account.username}{account.id===selfId?' · You':''}</strong><span>{account.email}</span><small>{account.active?'Active':'Pending activation'} · {account.role}</small></div>{account.id!==selfId&&<div className="admin-user-actions"><button aria-label={`Edit ${account.username}`} onClick={()=>openForm(account)} disabled={!!busy}><Pencil size={15}/> Edit</button><button className="admin-delete" aria-label={`Delete ${account.username}`} onClick={()=>void deleteUser(account)} disabled={!!busy}><Trash2 size={15}/> Delete</button></div>}</div>)}</div><p className="admin-note">Editing an account closes its current sessions. Deleting an account also removes its coursework and personal data.</p></div>:tab==='menus'?<div className="admin-card"><div className="admin-card-title"><h2>Access by role</h2><button onClick={()=>void loadMenus().catch(e=>setError(e.message))}>Refresh</button></div><p className="admin-note">Switch a menu on or off for that role. Core administrator menus stay available so access cannot be lost.</p><div className="admin-menu-roles">{(['student','teacher','admin'] as Role[]).map(role=><section className="admin-menu-role" key={role}><h3>{role.charAt(0).toUpperCase()+role.slice(1)}</h3>{roleMenus?.[role].map(item=><label className="admin-menu-row" key={item.key}><span><strong>{item.label}</strong><small>{item.path}{item.locked?' · Always available':''}</small></span><input type="checkbox" checked={item.enabled} disabled={item.locked||!!busy} onChange={()=>void toggleMenu(role,item)} aria-label={`${role} ${item.label}`}/></label>)}</section>)}</div></div>:tab==='feedback'?<div className="admin-card"><div className="admin-card-title"><h2>Notifications <span className="admin-count">{unread} new</span></h2><button onClick={()=>void loadFeedback().catch(e=>setError(e.message))}>Refresh</button></div><div className="admin-feedback-list">{feedback.map(item=><article className={`admin-feedback-item ${item.read_at?'read':'unread'}`} key={item.id}><header><div><strong>{item.teacher_name} · {new Date(`${item.day}T12:00:00+06:00`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'})}</strong><small>Updated {new Date(item.updated_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'})}</small></div><span className={item.read_at?'admin-read-label':'admin-new-label'}>{item.read_at?'Read':'New'}</span></header><p>{item.body}</p>{!item.read_at&&<button disabled={busy===item.id} onClick={()=>void markFeedbackRead(item.id)}>Mark as read</button>}</article>)}{!feedback.length&&<p className="admin-note">No teacher updates yet. New daily feedback will appear here.</p>}</div></div>:<div className="admin-card"><h2>Role access</h2><div className="admin-role-grid"><div><strong>Student</strong><p>Learning hub, library, practice, personal tasks, and assigned coursework.</p></div><div><strong>Teacher</strong><p>Classroom tasks, student submissions, reviews, and teaching sources.</p></div><div><strong>Admin</strong><p>User management and administrator setup.</p></div></div><form className="admin-password" onSubmit={e=>void changePassword(e)}><h2><KeyRound size={19}/> Change your password</h2><label>New password<input name="password" type="password" minLength={6} maxLength={256} autoComplete="new-password" required/></label><label>Confirm password<input name="confirm" type="password" minLength={6} maxLength={256} autoComplete="new-password" required/></label><button disabled={busy==='password'}>Save password</button></form></div>}</section></div>
    {formOpen&&<div className="admin-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setFormOpen(false)}}><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-form-title"><div className="admin-dialog-heading"><h2 id="admin-form-title">{editingId?'Edit user':'Add user'}</h2><button type="button" onClick={()=>setFormOpen(false)} disabled={!!busy} aria-label="Close user form">×</button></div><p>{editingId?'Update account details. Leave password empty to keep the current password.':'This account will be active immediately and can sign in with the password you set.'}</p><form onSubmit={saveUser}><label>Username<input autoFocus required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" value={draft.username} onChange={event=>setDraft({...draft,username:event.target.value})}/></label><label>Email<input type="email" required maxLength={254} value={draft.email} onChange={event=>setDraft({...draft,email:event.target.value})}/></label><label>Role<select value={draft.role} onChange={event=>setDraft({...draft,role:event.target.value as Role})}><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></label><label>{editingId?'New password (optional)':'Password'}<input type="password" minLength={6} maxLength={256} required={!editingId} autoComplete="new-password" value={draft.password} onChange={event=>setDraft({...draft,password:event.target.value})}/></label>{error&&<p className="admin-alert" role="alert">{error}</p>}<div className="admin-form-actions"><button disabled={!!busy}>{busy?'Saving…':editingId?'Save changes':'Create user'}</button><button type="button" onClick={()=>setFormOpen(false)} disabled={!!busy}>Cancel</button></div></form></section></div>}
  </main>;
}
