'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, LogOut, Settings2, ShieldCheck, Users } from 'lucide-react';
import './admin.css';

type Role = 'student' | 'teacher' | 'admin';
type Account = { id: string; username: string; email: string; active: number; role: Role };

export default function AdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selfId, setSelfId] = useState('');
  const [tab, setTab] = useState<'accounts' | 'setup'>('accounts');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/users', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load accounts.');
    const data = await response.json();
    setAccounts(data.users); setSelfId(data.selfId);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);

  async function changeRole(id: string, role: Role) {
    setBusy(id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/role`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({role}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update the role.');
      setAccounts(data.users);
      setMessage('Role updated. That account must sign in again.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update the role.'); }
    finally { setBusy(''); }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
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
    <div className="admin-layout"><nav aria-label="Administration menu"><button className={tab==='accounts'?'selected':''} onClick={()=>setTab('accounts')}><Users size={18}/> Accounts</button><button className={tab==='setup'?'selected':''} onClick={()=>setTab('setup')}><Settings2 size={18}/> Setup</button></nav>
      <section className="admin-content"><div className="admin-heading"><span>ADMIN WORKSPACE</span><h1>{tab==='accounts'?'Accounts and roles':'Application setup'}</h1><p>{tab==='accounts'?'Assign each activated account a student, teacher, or admin workspace.':'Manage administrator access and review how roles reach their menus.'}</p></div>
      {error&&<p className="admin-alert" role="alert">{error}</p>}{message&&<p className="admin-success" role="status">{message}</p>}
      {tab==='accounts'?<div className="admin-card"><div className="admin-card-title"><h2>Members</h2><button onClick={()=>void load().catch(e=>setError(e.message))}>Refresh</button></div><div className="admin-users">{accounts.map(account=><div className="admin-user" key={account.id}><div className="admin-avatar">{account.username.slice(0,2).toUpperCase()}</div><div className="admin-user-info"><strong>{account.username}</strong><span>{account.email}</span><small>{account.active?'Active':'Pending activation'}</small></div><label>Role<select aria-label={`${account.username} role`} value={account.role} disabled={busy===account.id || account.id===selfId || !account.active} onChange={e=>void changeRole(account.id,e.target.value as Role)}><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option></select></label></div>)}</div><p className="admin-note">Changing a role ends that member’s current sessions. Existing coursework history stays attached to its original accounts.</p></div>:<div className="admin-card"><h2>Role access</h2><div className="admin-role-grid"><div><strong>Student</strong><p>Learning hub, library, practice, personal tasks, and assigned coursework.</p></div><div><strong>Teacher</strong><p>Classroom tasks, student submissions, reviews, and teaching sources.</p></div><div><strong>Admin</strong><p>Account roles and administrator setup. Class coursework is kept separate.</p></div></div><form className="admin-password" onSubmit={e=>void changePassword(e)}><h2><KeyRound size={19}/> Change your password</h2><label>New password<input name="password" type="password" minLength={6} maxLength={256} autoComplete="new-password" required/></label><label>Confirm password<input name="confirm" type="password" minLength={6} maxLength={256} autoComplete="new-password" required/></label><button disabled={busy==='password'}>Save password</button></form></div>}</section></div>
  </main>;
}
