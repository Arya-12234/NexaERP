import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle, MessageSquare, CheckCircle, Clock,
  AlertTriangle, Search, Plus, Send, ChevronDown,
  ChevronRight, Activity, Server, Database, Wifi,
  X,
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

const pill = (color, bg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 10px', borderRadius: 20,
  background: bg, color, fontSize: 11, fontWeight: 600,
});

const TABS = [
  { id: 'status',   icon: <Activity size={14} />,      label: 'System Status' },
  { id: 'tickets',  icon: <MessageSquare size={14} />, label: 'My Tickets'    },
  { id: 'new',      icon: <Plus size={14} />,           label: 'New Ticket'    },
  { id: 'faq',      icon: <HelpCircle size={14} />,    label: 'FAQ'           },
  { id: 'chat',     icon: <Send size={14} />,           label: 'Live Chat'     },
];

const TICKET_STATUS = {
  Open:        { color: T.blue,   bg: T.blueDim   },
  In_Progress: { color: T.amber,  bg: T.amberDim  },
  Resolved:    { color: T.green,  bg: T.greenDim  },
  Closed:      { color: T.muted,  bg: '#f1f5f9'   },
};

const PRIORITY_COLORS = {
  Low:      { color: T.muted,  bg: '#f1f5f9'   },
  Medium:   { color: T.blue,   bg: T.blueDim   },
  High:     { color: T.amber,  bg: T.amberDim  },
  Critical: { color: T.red,    bg: T.redDim    },
};

const FAQS = [
  {
    category: 'Finance',
    items: [
      { q: 'How do I post a journal entry?', a: 'Go to Finance → GL → New Entry. Fill in the account, debit/credit amounts, and a description. Click Post to commit it to the ledger. Entries must balance (debits = credits) before posting.' },
      { q: 'What is the difference between WAC and FIFO valuation?', a: 'WAC (Weighted Average Cost) recalculates the average unit cost every time stock is received. FIFO (First In First Out) assumes the oldest stock is sold first. Choose your method per product when creating it.' },
      { q: 'How do I run payroll?', a: 'Go to Finance → Payroll → New Run. Select the period, add employees, then click Calculate. Review the payslips, submit for HR approval, then Finance approval, then mark as Paid.' },
    ],
  },
  {
    category: 'Inventory',
    items: [
      { q: 'How do I receive stock?', a: 'Go to Inventory → Products, select the product, click Receive Stock. Enter the warehouse, quantity, unit cost, and a source reference (e.g. PO number). The stock level updates immediately.' },
      { q: 'How do I transfer stock between warehouses?', a: 'Select the product in Inventory → Products, click Transfer, choose the source and destination warehouses, enter the quantity. A stock movement record is created automatically.' },
      { q: 'What triggers a reorder alert?', a: 'When a product\'s total stock across all warehouses falls at or below the Reorder Point set on the product. You can view all alerts in Inventory → Reorder Alerts.' },
    ],
  },
  {
    category: 'Orders',
    items: [
      { q: 'How does a Sales Order become an invoice?', a: 'When a Sales Order is Approved, the system automatically creates an AR invoice if the order is linked to an AR Customer. You can link a customer when creating the order.' },
      { q: 'How do I convert a quotation to a sales order?', a: 'Go to Orders → Quotations, select the quotation, and click Convert to Sales Order. The order is created with all the same line items and the quotation is marked Accepted.' },
      { q: 'What happens when I process a Sales Order?', a: 'Processing deducts the ordered quantities from the linked warehouse inventory. Make sure there is enough stock before processing, or you will see stock errors in the response.' },
    ],
  },
  {
    category: 'Purchase',
    items: [
      { q: 'What is a Purchase Requisition?', a: 'A PR is a formal internal request for goods or services. Staff submit PRs which are approved by a manager before a PO is raised. PRs help control spending and maintain budget compliance.' },
      { q: 'How do I post a GRN to inventory?', a: 'Go to Purchase → GRNs, select the GRN, click Confirm, then Post to Inventory. This creates stock movement records and updates warehouse quantities for all Good condition lines.' },
      { q: 'How is supplier rating calculated?', a: 'Ratings are the average of four dimensions: Quality, Delivery, Pricing, and Communication — each scored 1-5. The overall rating updates automatically every time a new rating is submitted.' },
    ],
  },
];

const SYSTEM_SERVICES = [
  { name: 'API Server',       icon: <Server size={16} />,   key: 'api'   },
  { name: 'Database',         icon: <Database size={16} />, key: 'db'    },
  { name: 'Authentication',   icon: <Wifi size={16} />,     key: 'auth'  },
  { name: 'Finance Module',   icon: <Activity size={16} />, key: 'fin'   },
  { name: 'Inventory Module', icon: <Activity size={16} />, key: 'inv'   },
  { name: 'Orders Module',    icon: <Activity size={16} />, key: 'ord'   },
  { name: 'Purchase Module',  icon: <Activity size={16} />, key: 'pur'   },
  { name: 'Reporting Module', icon: <Activity size={16} />, key: 'rep'   },
];

const Card = ({ title, subtitle, children, action }) => (
  <div style={{ background: T.card, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: T.text }}>{title}</p>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

// ── MAIN ───────────────────────────────────────────────────────
const Support = () => {
  const [tab, setTab] = useState('status');

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Support Center</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
          System Status · Tickets · FAQ · Live Chat
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
      {tab === 'status'  && <SystemStatusPanel />}
      {tab === 'tickets' && <TicketsPanel />}
      {tab === 'new'     && <NewTicketPanel onCreated={() => setTab('tickets')} />}
      {tab === 'faq'     && <FAQPanel />}
      {tab === 'chat'    && <ChatPanel />}
    </div>
  );
};

// ── SYSTEM STATUS ─────────────────────────────────────────────
const SystemStatusPanel = () => {
  const [statuses, setStatuses] = useState({});
  const [checking, setChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  const checkServices = async () => {
    setChecking(true);
    const results = {};

    // Check Django API
    try {
      const r = await fetch('http://localhost:8000/api/inventory/dashboard/', { signal: AbortSignal.timeout(3000) });
      results['api'] = r.ok ? 'operational' : 'degraded';
    } catch { results['api'] = 'down'; }

    // Check auth module
    try {
      const r = await fetch('http://localhost:8000/api/users/', { signal: AbortSignal.timeout(3000) });
      results['auth'] = r.status < 500 ? 'operational' : 'degraded';
    } catch { results['auth'] = 'down'; }

    // If API is up, assume DB is up
    results['db'] = results['api'] === 'operational' ? 'operational' : 'unknown';

    // Module checks
    const modules = {
      fin: '/api/finance/accounts/',
      inv: '/api/inventory/dashboard/',
      ord: '/api/orders/dashboard/',
      pur: '/api/purchase/dashboard/',
      rep: '/api/reporting/executive-summary/',
    };

    await Promise.all(Object.entries(modules).map(async ([key, path]) => {
      try {
        const r = await fetch(`http://localhost:8000${path}`, { signal: AbortSignal.timeout(3000) });
        results[key] = r.status < 500 ? 'operational' : 'degraded';
      } catch { results[key] = 'down'; }
    }));

    setStatuses(results);
    setChecking(false);
    setLastChecked(new Date().toLocaleTimeString());
  };

  useEffect(() => { checkServices(); }, []);

  const allOk = Object.values(statuses).every(s => s === 'operational');
  const anyDown = Object.values(statuses).some(s => s === 'down');

  const statusStyle = (s) => ({
    operational: { color: T.green,  bg: T.greenDim,  label: 'Operational' },
    degraded:    { color: T.amber,  bg: T.amberDim,  label: 'Degraded'    },
    down:        { color: T.red,    bg: T.redDim,    label: 'Down'        },
    unknown:     { color: T.muted,  bg: '#f1f5f9',   label: 'Unknown'     },
  }[s] || { color: T.muted, bg: '#f1f5f9', label: 'Checking…' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overall banner */}
      <div style={{ background: checking ? T.amberDim : allOk ? T.greenDim : anyDown ? T.redDim : T.amberDim, borderRadius: 14, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {checking
            ? <Clock size={28} color={T.amber} />
            : allOk
            ? <CheckCircle size={28} color={T.green} />
            : <AlertTriangle size={28} color={anyDown ? T.red : T.amber} />
          }
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: T.text }}>
              {checking ? 'Checking system health…' : allOk ? 'All Systems Operational' : anyDown ? 'Service Disruption Detected' : 'Partial Degradation'}
            </p>
            {lastChecked && <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>Last checked: {lastChecked}</p>}
          </div>
        </div>
        <button onClick={checkServices} disabled={checking}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: checking ? 0.6 : 1 }}>
          <Activity size={13} />{checking ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {/* Service grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {SYSTEM_SERVICES.map(svc => {
          const s = statusStyle(statuses[svc.key]);
          return (
            <div key={svc.key} style={{ background: T.card, borderRadius: 12, padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', borderLeft: `4px solid ${s.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ color: s.color }}>{svc.icon}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{svc.name}</span>
              </div>
              <span style={{ ...pill(s.color, s.bg) }}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Uptime summary */}
      <Card title="System Information">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Backend',     value: 'Django 5.x + DRF'     },
            { label: 'Database',    value: 'PostgreSQL (erp_db)'  },
            { label: 'Frontend',    value: 'React 19'             },
            { label: 'Auth',        value: 'Firebase + JWT'       },
            { label: 'API Base',    value: 'http://localhost:8000' },
            { label: 'Environment', value: 'Development'          },
          ].map(r => (
            <div key={r.label} style={{ background: T.bg, borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{r.label}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 600, color: T.text }}>{r.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ── TICKETS ───────────────────────────────────────────────────
const TicketsPanel = () => {
  const [tickets, setTickets]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState('');
  const [reply, setReply]       = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('erp_tickets');
    if (stored) setTickets(JSON.parse(stored));
    else {
      // Seed sample tickets
      const samples = [
        { id: 1, subject: 'Cannot post journal entry', category: 'Finance', priority: 'High', status: 'Open', created: '2026-03-20', messages: [{ from: 'user', text: 'Getting a 400 error when trying to post.', time: '09:00' }, { from: 'support', text: 'Could you share the exact error message? We will look into it.', time: '09:30' }] },
        { id: 2, subject: 'Stock not updating after GRN post', category: 'Inventory', priority: 'Critical', status: 'In_Progress', created: '2026-03-21', messages: [{ from: 'user', text: 'Posted a GRN but inventory quantities are unchanged.', time: '14:00' }] },
        { id: 3, subject: 'How to add new payroll run', category: 'Payroll', priority: 'Low', status: 'Resolved', created: '2026-03-18', messages: [{ from: 'user', text: 'Need help creating a payroll run for March.', time: '11:00' }, { from: 'support', text: 'Go to Finance → Payroll → New Run and select March 2026.', time: '11:20' }] },
      ];
      setTickets(samples);
      localStorage.setItem('erp_tickets', JSON.stringify(samples));
    }
  }, []);

  const save = (updated) => {
    setTickets(updated);
    localStorage.setItem('erp_tickets', JSON.stringify(updated));
  };

  const sendReply = () => {
    if (!reply.trim() || !selected) return;
    const updated = tickets.map(t => t.id === selected.id
      ? { ...t, messages: [...t.messages, { from: 'user', text: reply, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }] }
      : t
    );
    save(updated);
    setSelected(updated.find(t => t.id === selected.id));
    setReply('');
  };

  const updateStatus = (id, status) => {
    const updated = tickets.map(t => t.id === id ? { ...t, status } : t);
    save(updated);
    setSelected(updated.find(t => t.id === id));
  };

  const filtered = filter
    ? tickets.filter(t => t.status === filter)
    : tickets;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Tickets</option>
          {['Open','In_Progress','Resolved','Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{filtered.length} tickets</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title="Tickets">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
            {filtered.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No tickets found.</p>}
            {filtered.map(t => {
              const sc = TICKET_STATUS[t.status] || TICKET_STATUS.Open;
              const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.Medium;
              return (
                <div key={t.id} onClick={() => setSelected(t)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === t.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === t.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <code style={{ fontSize: 10, color: T.muted }}>#{t.id}</code>
                    <span style={{ ...pill(sc.color, sc.bg), fontSize: 10 }}>{t.status.replace('_', ' ')}</span>
                  </div>
                  <p style={{ margin: '3px 0', fontWeight: 600 }}>{t.subject}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: T.muted }}>{t.category}</span>
                    <span style={{ ...pill(pc.color, pc.bg), fontSize: 10 }}>{t.priority}</span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: T.muted }}>{t.created} · {t.messages.length} messages</p>
                </div>
              );
            })}
          </div>
        </Card>

        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`#${selected.id} — ${selected.subject}`}
              action={
                <div style={{ display: 'flex', gap: 6 }}>
                  {selected.status !== 'Resolved' && (
                    <button onClick={() => updateStatus(selected.id, 'Resolved')}
                      style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={11} /> Resolve
                    </button>
                  )}
                  {selected.status !== 'Closed' && (
                    <button onClick={() => updateStatus(selected.id, 'Closed')}
                      style={{ background: T.muted, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <X size={11} /> Close
                    </button>
                  )}
                </div>
              }>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(TICKET_STATUS[selected.status]?.color || T.blue, TICKET_STATUS[selected.status]?.bg || T.blueDim) }}>{selected.status.replace('_', ' ')}</span>
                <span style={{ ...pill(PRIORITY_COLORS[selected.priority]?.color || T.blue, PRIORITY_COLORS[selected.priority]?.bg || T.blueDim) }}>{selected.priority}</span>
                <span style={{ ...pill(T.muted, '#f1f5f9') }}>{selected.category}</span>
              </div>

              {/* Message thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto', marginBottom: 14, padding: '4px 0' }}>
                {selected.messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 12,
                      background: m.from === 'user' ? T.accent : T.bg,
                      color: m.from === 'user' ? '#fff' : T.text,
                      borderBottomRightRadius: m.from === 'user' ? 2 : 12,
                      borderBottomLeftRadius:  m.from === 'user' ? 12 : 2,
                    }}>
                      <p style={{ margin: 0 }}>{m.text}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.6 }}>{m.from === 'support' ? '🛠 Support' : '👤 You'} · {m.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {!['Resolved','Closed'].includes(selected.status) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendReply()}
                    placeholder="Type a reply…"
                    style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none' }} />
                  <button onClick={sendReply}
                    style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <Send size={13} /> Send
                  </button>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card title="Select a ticket">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a ticket to view the conversation and manage its status.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── NEW TICKET ────────────────────────────────────────────────
const NewTicketPanel = ({ onCreated }) => {
  const [form, setForm] = useState({ subject: '', category: 'General', priority: 'Medium', description: '' });
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!form.subject.trim() || !form.description.trim()) return;
    const existing = JSON.parse(localStorage.getItem('erp_tickets') || '[]');
    const newTicket = {
      id: (existing.length > 0 ? Math.max(...existing.map(t => t.id)) + 1 : 1),
      ...form,
      status: 'Open',
      created: new Date().toISOString().split('T')[0],
      messages: [{ from: 'user', text: form.description, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }],
    };
    localStorage.setItem('erp_tickets', JSON.stringify([...existing, newTicket]));
    setSubmitted(true);
    setTimeout(() => { onCreated(); }, 1500);
  };

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
        <CheckCircle size={48} color={T.green} />
        <p style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Ticket submitted successfully!</p>
        <p style={{ fontSize: 13, color: T.muted }}>Redirecting to your tickets…</p>
      </div>
    );
  }

  return (
    <Card title="Raise a New Support Ticket">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 600 }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: T.muted }}>Subject *</p>
          <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
            placeholder="Brief description of the issue"
            style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: T.muted }}>Category</p>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: T.text }}>
              {['Finance', 'Inventory', 'Orders', 'Purchase', 'Payroll', 'Reporting', 'General', 'Technical'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: T.muted }}>Priority</p>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: T.text }}>
              {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: T.muted }}>Description *</p>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the issue in detail. Include steps to reproduce, error messages, and screenshots if possible."
            style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 120, boxSizing: 'border-box' }} />
        </div>
        <button onClick={submit}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
          <Send size={14} /> Submit Ticket
        </button>
      </div>
    </Card>
  );
};

// ── FAQ ───────────────────────────────────────────────────────
const FAQPanel = () => {
  const [search, setSearch]   = useState('');
  const [openItems, setOpenItems] = useState({});

  const toggle = (key) => setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));

  const filtered = FAQS.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card, borderRadius: 12, padding: '10px 16px', border: `1px solid ${T.border}`, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <Search size={16} color={T.muted} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search FAQs…"
          style={{ border: 'none', outline: 'none', fontSize: 13, color: T.text, width: '100%', background: 'transparent' }} />
      </div>

      {filtered.map(cat => (
        <Card key={cat.category} title={cat.category}>
          {cat.items.map((item, i) => {
            const key = `${cat.category}-${i}`;
            const open = openItems[key];
            return (
              <div key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                <div onClick={() => toggle(key)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.text }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HelpCircle size={14} color={T.accent} />
                    {item.q}
                  </div>
                  {open ? <ChevronDown size={14} color={T.muted} /> : <ChevronRight size={14} color={T.muted} />}
                </div>
                {open && (
                  <div style={{ padding: '4px 4px 14px 26px', fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: T.muted }}>
          <HelpCircle size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p>No FAQs match your search. <button type="button" onClick={() => {}} style={{ color: T.accent, cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline' }}>Raise a ticket</button> instead.</p>
        </div>
      )}
    </div>
  );
};

// ── LIVE CHAT ─────────────────────────────────────────────────
const ChatPanel = () => {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Hi! I\'m the ERP Support Assistant. How can I help you today?', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [input, setInput]   = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const BOT_RESPONSES = {
    'invoice':       'To create an invoice, go to Finance → AR → New Invoice. Link it to a customer, add line items, and click Approve to activate it.',
    'stock':         'For stock issues, check Inventory → Products and use the Receive, Issue, or Adjust buttons. For GRN posting, go to Purchase → GRNs.',
    'payroll':       'Payroll runs: Finance → Payroll → New Run. Calculate, then submit through the approval chain: HR → Finance → Mark Paid.',
    'purchase order':'Purchase Orders are in Orders → Purchase Orders. Draft → Submit → Approve → Send → Receive.',
    'quotation':     'Create a quotation in Orders → Quotations. Once accepted, use Convert to Sales Order to create an SO.',
    'report':        'All reports are in the Reporting module. Use date filters and Export CSV for data exports.',
    'budget':        'Purchase budgets are managed in Purchase → Budgets. The budget summary shows utilization per department.',
    'supplier':      'Supplier management is in Purchase → Suppliers. You can rate suppliers and track performance metrics.',
    'depreciation':  'Run depreciation in Finance → Assets. Use Depreciate All to process all active assets at once.',
    'grn':           'GRNs are in Purchase → GRNs. After confirming, click Post to Inventory to update stock levels.',
    'hello':         'Hello! How can I assist you with the ERP system today?',
    'hi':            'Hi there! What can I help you with?',
    'help':          'I can help with Finance, Inventory, Orders, Purchase, Payroll, and Reporting. What do you need?',
    'error':         'For errors, please check the Django server logs. Common fixes: ensure migrations are run, check the .env file, and verify the virtual environment is active.',
  };

  const getBotReply = (text) => {
    const lower = text.toLowerCase();
    for (const [keyword, reply] of Object.entries(BOT_RESPONSES)) {
      if (lower.includes(keyword)) return reply;
    }
    return 'I\'m not sure about that specific issue. I\'d recommend raising a support ticket so our team can assist you directly. You can do that in the New Ticket tab.';
  };

  const send = () => {
    if (!input.trim()) return;
    const userMsg = { from: 'user', text: input, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, {
        from: 'bot',
        text: getBotReply(userMsg.text),
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 1200);
  };

  return (
    <div style={{ background: T.card, borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.06)', overflow: 'hidden', maxWidth: 700 }}>
      {/* Header */}
      <div style={{ background: T.accent, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HelpCircle size={18} color="#fff" />
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#fff' }}>ERP Support Assistant</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a7f3d0' }} />
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,.8)' }}>Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ height: 380, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafb' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            {m.from === 'bot' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' }}>
                <HelpCircle size={14} color="#fff" />
              </div>
            )}
            <div style={{
              maxWidth: '72%', padding: '10px 14px', borderRadius: 14, fontSize: 13,
              background: m.from === 'user' ? T.accent : T.card,
              color: m.from === 'user' ? '#fff' : T.text,
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              borderBottomRightRadius: m.from === 'user' ? 2 : 14,
              borderBottomLeftRadius:  m.from === 'user' ? 14 : 2,
            }}>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{m.text}</p>
              <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.6 }}>{m.time}</p>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HelpCircle size={14} color="#fff" />
            </div>
            <div style={{ background: T.card, padding: '10px 14px', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: T.muted, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', background: T.card, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type your question…"
          style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }} />
        <button onClick={send}
          style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
          <Send size={13} /> Send
        </button>
      </div>
    </div>
  );
};

export default Support;