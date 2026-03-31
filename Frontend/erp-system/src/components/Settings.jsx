import React, { useState, useEffect } from 'react';
import {
  Building2, Globe, Users, Sliders, Bell,
  ClipboardList, Save, Plus, Trash2, Eye,
  EyeOff, CheckCircle, Shield, UserPlus,
  Edit2, ToggleLeft, ToggleRight, AlertTriangle,
  Key, Mail, Phone, MapPin, FileText,
} from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────
const T = {
  bg:        '#f0f4f8',
  card:      '#ffffff',
  accent:    '#2fb8a0',
  accentDim: '#e6f7f4',
  blue:      '#3b82f6',
  blueDim:   '#eff6ff',
  amber:     '#f59e0b',
  amberDim:  '#fffbeb',
  red:       '#ef4444',
  redDim:    '#fef2f2',
  green:     '#22c55e',
  greenDim:  '#f0fdf4',
  purple:    '#8b5cf6',
  purpleDim: '#f5f3ff',
  text:      '#1a2e35',
  muted:     '#7a9199',
  border:    '#e2eaed',
};

const TABS = [
  { id: 'company',       icon: <Building2 size={14} />,     label: 'Company'       },
  { id: 'preferences',   icon: <Globe size={14} />,         label: 'Preferences'   },
  { id: 'users',         icon: <Users size={14} />,         label: 'User Management'},
  { id: 'modules',       icon: <Sliders size={14} />,       label: 'Modules'       },
  { id: 'notifications', icon: <Bell size={14} />,          label: 'Notifications' },
  { id: 'audit',         icon: <ClipboardList size={14} />, label: 'Audit Log'     },
];

const ROLES = ['Administrator', 'Finance Manager', 'Accountant', 'Inventory Manager',
               'Procurement Officer', 'Sales Manager', 'HR Manager', 'Viewer'];

const MODULES_LIST = [
  { key: 'finance',   label: 'Finance',   desc: 'GL, Payroll, Fixed Assets', icon: '💰', critical: true  },
  { key: 'inventory', label: 'Inventory', desc: 'Products, Warehouses, Stock', icon: '📦', critical: false },
  { key: 'orders',    label: 'Orders',    desc: 'Sales Orders, Quotations, Deliveries', icon: '🛒', critical: false },
  { key: 'purchase',  label: 'Purchase',  desc: 'Suppliers, Requisitions, GRNs', icon: '🏭', critical: false },
  { key: 'reporting', label: 'Reporting', desc: 'Reports, Analytics, Exports', icon: '📊', critical: false },
  { key: 'support',   label: 'Support',   desc: 'Tickets, FAQ, Chat', icon: '🎧', critical: false },
];

const DEFAULT_COMPANY = {
  name: 'My Company Ltd', legal_name: '', kra_pin: '', vat_number: '',
  address: '', city: 'Nairobi', country: 'Kenya', phone: '', email: '',
  website: '', logo_url: '', industry: 'General',
  fiscal_year_start: '01', registration_number: '',
};

const DEFAULT_PREFS = {
  currency: 'KES', date_format: 'YYYY-MM-DD', timezone: 'Africa/Nairobi',
  language: 'en', number_format: '1,000.00', vat_rate: '16',
  payment_terms: '30', fiscal_year_end: 'December',
};

const DEFAULT_NOTIFICATIONS = {
  low_stock:          true,
  overdue_invoices:   true,
  pending_approvals:  true,
  payroll_due:        true,
  budget_exceeded:    true,
  grn_posted:         false,
  new_ticket:         true,
  order_delivered:    false,
  email_notifications:false,
};

const DEFAULT_MODULES = {
  finance: true, inventory: true, orders: true,
  purchase: true, reporting: true, support: true,
};

const LS_KEY = 'erp_settings';

const loadSettings = () => {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return {
    company: DEFAULT_COMPANY,
    preferences: DEFAULT_PREFS,
    notifications: DEFAULT_NOTIFICATIONS,
    modules: DEFAULT_MODULES,
    users: [
      { id: 1, name: 'Administrator', email: 'admin@company.com', role: 'Administrator', status: 'Active',  lastLogin: '2026-03-23' },
      { id: 2, name: 'Jane Kariuki',  email: 'jane@company.com',  role: 'Finance Manager',  status: 'Active',  lastLogin: '2026-03-22' },
      { id: 3, name: 'Bob Omondi',    email: 'bob@company.com',   role: 'Inventory Manager', status: 'Inactive', lastLogin: '2026-03-10' },
    ],
    audit: [
      { id: 1, user: 'Administrator', action: 'Login',               module: 'System',    time: '2026-03-23 09:00', ip: '127.0.0.1' },
      { id: 2, user: 'Jane Kariuki',  action: 'Created Invoice',      module: 'Finance',   time: '2026-03-23 09:15', ip: '127.0.0.1' },
      { id: 3, user: 'Administrator', action: 'Approved Payroll Run', module: 'Payroll',   time: '2026-03-23 10:00', ip: '127.0.0.1' },
      { id: 4, user: 'Bob Omondi',    action: 'Received Stock',       module: 'Inventory', time: '2026-03-22 14:30', ip: '127.0.0.1' },
      { id: 5, user: 'Jane Kariuki',  action: 'Posted GRN',           module: 'Purchase',  time: '2026-03-22 15:00', ip: '127.0.0.1' },
    ],
  };
};

const saveSettings = (data) => {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
};

// ── Shared UI ──────────────────────────────────────────────────
const Card = ({ title, subtitle, children, action }) => (
  <div style={{ background: T.card, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: T.text }}>{title}</p>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 600, color: T.muted }}>{label}</p>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: T.text }} />
);

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={onChange}
    style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: T.text }}>
    {options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const SaveBtn = ({ onClick, saved }) => (
  <button onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 6, background: saved ? T.green : T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background .3s' }}>
    {saved ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Changes</>}
  </button>
);

const Toggle = ({ checked, onChange }) => (
  <div onClick={() => onChange(!checked)} style={{ cursor: 'pointer', color: checked ? T.accent : T.muted }}>
    {checked ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
  </div>
);

// ── MAIN ───────────────────────────────────────────────────────
const Settings = () => {
  const [tab, setTab]           = useState('company');
  const [settings, setSettings] = useState(loadSettings);

  const update = (section, data) => {
    const updated = { ...settings, [section]: data };
    setSettings(updated);
    saveSettings(updated);
  };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Settings</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
          Company · Preferences · Users · Modules · Notifications · Audit Log
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: tab === t.id ? T.accent : T.card,
              color:      tab === t.id ? '#fff'   : T.muted,
              boxShadow:  tab === t.id ? `0 2px 10px ${T.accent}55` : '0 1px 4px rgba(0,0,0,.06)',
              transition: 'all .2s',
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === 'company'       && <CompanyPanel       data={settings.company}       onChange={d => update('company', d)} />}
      {tab === 'preferences'   && <PreferencesPanel   data={settings.preferences}   onChange={d => update('preferences', d)} />}
      {tab === 'users'         && <UsersPanel         data={settings.users}         onChange={d => update('users', d)} />}
      {tab === 'modules'       && <ModulesPanel       data={settings.modules}       onChange={d => update('modules', d)} />}
      {tab === 'notifications' && <NotificationsPanel data={settings.notifications} onChange={d => update('notifications', d)} />}
      {tab === 'audit'         && <AuditLogPanel      data={settings.audit} />}
    </div>
  );
};

// ── COMPANY ───────────────────────────────────────────────────
const CompanyPanel = ({ data, onChange }) => {
  const [form, setForm] = useState(data);
  const [saved, setSaved] = useState(false);

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = () => { onChange(form); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <>
      <Card title="Company Identity"
        action={<SaveBtn onClick={save} saved={saved} />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Company Name *"><Input value={form.name}             onChange={f('name')}              placeholder="My Company Ltd" /></Field>
          <Field label="Legal Name">    <Input value={form.legal_name}       onChange={f('legal_name')}        placeholder="Same as company name" /></Field>
          <Field label="Industry">
            <Select value={form.industry} onChange={f('industry')}
              options={['General','Manufacturing','Retail','Services','Agriculture','Technology','Healthcare','Education','Finance','Hospitality']} />
          </Field>
          <Field label="Registration No."><Input value={form.registration_number} onChange={f('registration_number')} placeholder="CPR/2020/12345" /></Field>
        </div>
      </Card>

      <Card title="Tax & Compliance">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="KRA PIN"><Input value={form.kra_pin}    onChange={f('kra_pin')}    placeholder="P000000000A" /></Field>
          <Field label="VAT Number"><Input value={form.vat_number} onChange={f('vat_number')} placeholder="00000000A" /></Field>
          <Field label="Fiscal Year Start Month">
            <Select value={form.fiscal_year_start} onChange={f('fiscal_year_start')}
              options={['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => ({ value: m, label: new Date(2024, parseInt(m)-1).toLocaleString('en', { month: 'long' }) }))} />
          </Field>
        </div>
      </Card>

      <Card title="Contact Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Phone">   <Input value={form.phone}   onChange={f('phone')}   placeholder="+254 20 000 0000" /></Field>
          <Field label="Email">   <Input value={form.email}   onChange={f('email')}   placeholder="info@company.com" type="email" /></Field>
          <Field label="Website"> <Input value={form.website} onChange={f('website')} placeholder="https://company.com" /></Field>
          <Field label="City">    <Input value={form.city}    onChange={f('city')}    placeholder="Nairobi" /></Field>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Address">
              <textarea value={form.address} onChange={f('address')} placeholder="P.O. Box 00000, Nairobi"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 70, boxSizing: 'border-box', color: T.text }} />
            </Field>
          </div>
        </div>
      </Card>
    </>
  );
};

// ── PREFERENCES ───────────────────────────────────────────────
const PreferencesPanel = ({ data, onChange }) => {
  const [form, setForm] = useState(data);
  const [saved, setSaved] = useState(false);

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = () => { onChange(form); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <Card title="System Preferences" action={<SaveBtn onClick={save} saved={saved} />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Default Currency">
          <Select value={form.currency} onChange={f('currency')}
            options={['KES','USD','EUR','GBP','UGX','TZS','ETB','ZAR']} />
        </Field>
        <Field label="Date Format">
          <Select value={form.date_format} onChange={f('date_format')}
            options={['YYYY-MM-DD','DD/MM/YYYY','MM/DD/YYYY','DD-MMM-YYYY']} />
        </Field>
        <Field label="Timezone">
          <Select value={form.timezone} onChange={f('timezone')}
            options={['Africa/Nairobi','Africa/Lagos','Africa/Cairo','Africa/Johannesburg','UTC','Europe/London','Asia/Dubai']} />
        </Field>
        <Field label="Number Format">
          <Select value={form.number_format} onChange={f('number_format')}
            options={['1,000.00','1.000,00','1 000.00']} />
        </Field>
        <Field label="Default VAT Rate (%)">
          <Input value={form.vat_rate} onChange={f('vat_rate')} placeholder="16" type="number" />
        </Field>
        <Field label="Default Payment Terms (Days)">
          <Input value={form.payment_terms} onChange={f('payment_terms')} placeholder="30" type="number" />
        </Field>
        <Field label="Fiscal Year End">
          <Select value={form.fiscal_year_end} onChange={f('fiscal_year_end')}
            options={['January','February','March','April','May','June','July','August','September','October','November','December']} />
        </Field>
        <Field label="Language">
          <Select value={form.language} onChange={f('language')}
            options={[{ value: 'en', label: 'English' }, { value: 'sw', label: 'Swahili' }]} />
        </Field>
      </div>
    </Card>
  );
};

// ── USERS ─────────────────────────────────────────────────────
const UsersPanel = ({ data, onChange }) => {
  const [users, setUsers]       = useState(data);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState({ name: '', email: '', role: 'Viewer', status: 'Active' });
  const [saved, setSaved]       = useState(false);

  const save = (updated) => {
    setUsers(updated);
    onChange(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addUser = () => {
    if (!form.name || !form.email) return;
    const updated = editId
      ? users.map(u => u.id === editId ? { ...u, ...form } : u)
      : [...users, { ...form, id: Date.now(), lastLogin: '—' }];
    save(updated);
    setShowForm(false);
    setEditId(null);
    setForm({ name: '', email: '', role: 'Viewer', status: 'Active' });
  };

  const removeUser = (id) => save(users.filter(u => u.id !== id));

  const startEdit = (u) => {
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status });
    setEditId(u.id);
    setShowForm(true);
  };

  return (
    <>
      <Card title={`User Management — ${users.length} users`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {saved && <span style={{ fontSize: 12, color: T.green, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> Saved</span>}
            <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', email: '', role: 'Viewer', status: 'Active' }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <UserPlus size={13} /> Invite User
            </button>
          </div>
        }>

        {showForm && (
          <div style={{ background: T.accentDim, borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: T.accent }}>{editId ? 'Edit User' : 'Invite New User'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Full Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" /></Field>
              <Field label="Email"><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" type="email" /></Field>
              <Field label="Role"><Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} options={ROLES} /></Field>
              <Field label="Status"><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={['Active','Inactive']} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={addUser}
                style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {editId ? 'Update User' : 'Send Invite'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }}
                style={{ background: T.border, color: T.text, border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${T.border}` }}>
              {['User', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: T.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {u.name.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px', color: T.muted, fontSize: 12 }}>{u.email}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ background: T.accentDim, color: T.accent, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10 }}>{u.role}</span>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ background: u.status === 'Active' ? T.greenDim : T.redDim, color: u.status === 'Active' ? T.green : T.red, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10 }}>{u.status}</span>
                </td>
                <td style={{ padding: '12px', color: T.muted, fontSize: 12 }}>{u.lastLogin}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => startEdit(u)}
                      style={{ background: T.blueDim, color: T.blue, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Edit2 size={11} /> Edit
                    </button>
                    {u.id !== 1 && (
                      <button onClick={() => removeUser(u.id)}
                        style={{ background: T.redDim, color: T.red, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Trash2 size={11} /> Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Role Permissions" subtitle="Overview of access levels">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { role: 'Administrator',     perms: ['All modules', 'User management', 'Settings'] },
            { role: 'Finance Manager',   perms: ['Finance', 'Payroll', 'AR', 'AP', 'Reporting'] },
            { role: 'Inventory Manager', perms: ['Inventory', 'Purchase', 'Reporting'] },
            { role: 'Viewer',            perms: ['Read-only access to all modules'] },
          ].map(r => (
            <div key={r.role} style={{ background: T.bg, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: T.text }}>{r.role}</p>
              {r.perms.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted, marginBottom: 4 }}>
                  <CheckCircle size={10} color={T.green} /> {p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
};

// ── MODULES ───────────────────────────────────────────────────
const ModulesPanel = ({ data, onChange }) => {
  const [modules, setModules] = useState(data);
  const [saved, setSaved]     = useState(false);

  const toggle = (key) => {
    const mod = MODULES_LIST.find(m => m.key === key);
    if (mod?.critical) return; // Cannot disable critical modules
    const updated = { ...modules, [key]: !modules[key] };
    setModules(updated);
    onChange(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card title="Module Settings" subtitle="Enable or disable ERP modules"
      action={saved && <span style={{ fontSize: 12, color: T.green, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> Saved</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MODULES_LIST.map(mod => (
          <div key={mod.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: T.bg, borderRadius: 12, border: `1px solid ${modules[mod.key] ? T.accent + '44' : T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>{mod.icon}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: T.text }}>{mod.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{mod.desc}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {mod.critical && (
                <span style={{ fontSize: 10, color: T.amber, background: T.amberDim, padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>Core</span>
              )}
              <Toggle checked={modules[mod.key]} onChange={() => toggle(mod.key)} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: '10px 14px', background: T.amberDim, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.amber }}>
        <AlertTriangle size={14} /> Core modules (Finance) cannot be disabled.
      </div>
    </Card>
  );
};

// ── NOTIFICATIONS ─────────────────────────────────────────────
const NotificationsPanel = ({ data, onChange }) => {
  const [notifs, setNotifs] = useState(data);
  const [saved, setSaved]   = useState(false);

  const toggle = (key) => {
    const updated = { ...notifs, [key]: !notifs[key] };
    setNotifs(updated);
    onChange(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const NOTIFICATION_GROUPS = [
    { group: 'Inventory Alerts', items: [
      { key: 'low_stock',        label: 'Low stock alerts',         desc: 'Notify when products fall below reorder point' },
    ]},
    { group: 'Finance Alerts', items: [
      { key: 'overdue_invoices', label: 'Overdue invoice alerts',   desc: 'Notify when AR invoices are past due date' },
      { key: 'budget_exceeded',  label: 'Budget exceeded alerts',   desc: 'Notify when department spend exceeds budget' },
      { key: 'payroll_due',      label: 'Payroll due reminders',    desc: 'Remind when payroll run is due for processing' },
    ]},
    { group: 'Workflow Alerts', items: [
      { key: 'pending_approvals',label: 'Pending approval alerts',  desc: 'Notify when items are awaiting your approval' },
      { key: 'grn_posted',       label: 'GRN posted to inventory',  desc: 'Notify when a GRN is successfully posted' },
      { key: 'order_delivered',  label: 'Order delivered alerts',   desc: 'Notify when a sales order is delivered' },
      { key: 'new_ticket',       label: 'New support ticket',       desc: 'Notify when a new support ticket is raised' },
    ]},
    { group: 'Delivery Method', items: [
      { key: 'email_notifications', label: 'Email notifications',   desc: 'Send notifications via email (requires SMTP config)' },
    ]},
  ];

  return (
    <Card title="Notification Preferences"
      action={saved && <span style={{ fontSize: 12, color: T.green, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> Saved</span>}>
      {NOTIFICATION_GROUPS.map(group => (
        <div key={group.group} style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{group.group}</p>
          {group.items.map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: T.bg, borderRadius: 10, marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.text }}>{item.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{item.desc}</p>
              </div>
              <Toggle checked={notifs[item.key]} onChange={() => toggle(item.key)} />
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
};

// ── AUDIT LOG ─────────────────────────────────────────────────
const AuditLogPanel = ({ data }) => {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const modules = [...new Set(data.map(e => e.module))];

  const filtered = data.filter(e =>
    (!search || e.user.toLowerCase().includes(search.toLowerCase()) || e.action.toLowerCase().includes(search.toLowerCase())) &&
    (!moduleFilter || e.module === moduleFilter)
  );

  const MODULE_COLORS = {
    System:    { color: T.muted,  bg: '#f1f5f9'   },
    Finance:   { color: T.green,  bg: T.greenDim  },
    Payroll:   { color: T.blue,   bg: T.blueDim   },
    Inventory: { color: T.accent, bg: T.accentDim },
    Purchase:  { color: T.amber,  bg: T.amberDim  },
    Orders:    { color: T.purple, bg: T.purpleDim },
    AR:        { color: T.green,  bg: T.greenDim  },
    AP:        { color: T.red,    bg: T.redDim    },
  };

  return (
    <Card title="Audit Log" subtitle="System activity history">
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bg, borderRadius: 8, padding: '7px 12px', border: `1px solid ${T.border}`, flex: 1, minWidth: 200 }}>
          <Shield size={13} color={T.muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user or action…"
            style={{ border: 'none', outline: 'none', fontSize: 12, color: T.text, width: '100%', background: 'transparent' }} />
        </div>
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Modules</option>
          {modules.map(m => <option key={m}>{m}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{filtered.length} events</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${T.border}` }}>
              {['Time', 'User', 'Action', 'Module', 'IP Address'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: T.muted, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const mc = MODULE_COLORS[e.module] || MODULE_COLORS.System;
              return (
                <tr key={e.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '10px 12px', color: T.muted, fontSize: 12, whiteSpace: 'nowrap' }}>{e.time}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {e.user.charAt(0)}
                      </div>
                      {e.user}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: T.text }}>{e.action}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: mc.bg, color: mc.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10 }}>{e.module}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: T.muted, fontSize: 12, fontFamily: 'monospace' }}>{e.ip}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: T.muted }}>No audit events found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default Settings;