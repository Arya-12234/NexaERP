import React, { useState, useEffect } from 'react';
import {
  BarChart2, Users, FileText, Package, Star,
  DollarSign, CheckCircle, XCircle, ChevronRight,
  ThumbsUp, AlertTriangle, Clock, Send, TrendingUp,
  Search, MapPin, Phone, Mail, Award,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import axios from 'axios';

// ── Inline API ─────────────────────────────────────────────────
const BASE = 'http://localhost:8000/api';
const api  = axios.create({ baseURL: BASE });

const purchaseApi = {
  getDashboard:    ()           => api.get('/purchase/dashboard/'),
  getAnalytics:    ()           => api.get('/purchase/analytics/'),

  getSuppliers:    (params)     => api.get('/purchase/suppliers/', { params }),
  getSupplier:     (id)         => api.get(`/purchase/suppliers/${id}/`),
  createSupplier:  (data)       => api.post('/purchase/suppliers/', data),
  updateSupplier:  (id, data)   => api.put(`/purchase/suppliers/${id}/`, data),
  getSupplierRatings:(id)       => api.get(`/purchase/suppliers/${id}/ratings/`),

  getRequisitions: (params)     => api.get('/purchase/requisitions/', { params }),
  getRequisition:  (id)         => api.get(`/purchase/requisitions/${id}/`),
  createRequisition:(data)      => api.post('/purchase/requisitions/', data),
  submitPR:        (id)         => api.post(`/purchase/requisitions/${id}/submit/`),
  approvePR:       (id)         => api.post(`/purchase/requisitions/${id}/approve/`),
  rejectPR:        (id, reason) => api.post(`/purchase/requisitions/${id}/reject/`, { reason }),
  convertPR:       (id)         => api.post(`/purchase/requisitions/${id}/convert/`),

  getBudgets:      (params)     => api.get('/purchase/budgets/', { params }),
  getBudgetSummary:()           => api.get('/purchase/budgets/summary/'),
  createBudget:    (data)       => api.post('/purchase/budgets/', data),

  getGRNs:         (params)     => api.get('/purchase/grns/', { params }),
  getGRN:          (id)         => api.get(`/purchase/grns/${id}/`),
  createGRN:       (data)       => api.post('/purchase/grns/', data),
  confirmGRN:      (id)         => api.post(`/purchase/grns/${id}/confirm/`),
  postGRN:         (id)         => api.post(`/purchase/grns/${id}/post/`),

  getRatings:      (params)     => api.get('/purchase/ratings/', { params }),
  createRating:    (data)       => api.post('/purchase/ratings/', data),
};

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

const usd  = (n) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
const Spin = () => <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 13 }}>Loading…</div>;

const PR_STATUS = {
  Draft:     { color: T.muted,  bg: '#f1f5f9'   },
  Submitted: { color: T.amber,  bg: T.amberDim  },
  Approved:  { color: T.green,  bg: T.greenDim  },
  Rejected:  { color: T.red,    bg: T.redDim    },
  Converted: { color: T.accent, bg: T.accentDim },
  Closed:    { color: T.muted,  bg: '#f1f5f9'   },
};

const GRN_STATUS = {
  Draft:     { color: T.muted,  bg: '#f1f5f9'   },
  Confirmed: { color: T.blue,   bg: T.blueDim   },
  Posted:    { color: T.green,  bg: T.greenDim  },
};

const PRIORITY_COLORS = {
  Low:    { color: T.muted,  bg: '#f1f5f9'   },
  Medium: { color: T.blue,   bg: T.blueDim   },
  High:   { color: T.amber,  bg: T.amberDim  },
  Urgent: { color: T.red,    bg: T.redDim    },
};

const TABS = [
  { id: 'dashboard',    icon: <BarChart2 size={14} />,  label: 'Dashboard'    },
  { id: 'suppliers',    icon: <Users size={14} />,       label: 'Suppliers'    },
  { id: 'requisitions', icon: <FileText size={14} />,   label: 'Requisitions' },
  { id: 'grns',         icon: <Package size={14} />,     label: 'GRNs'         },
  { id: 'budgets',      icon: <DollarSign size={14} />,  label: 'Budgets'      },
  { id: 'analytics',    icon: <TrendingUp size={14} />,  label: 'Analytics'    },
];

// ── Shared UI ──────────────────────────────────────────────────
const Card = ({ title, subtitle, children }) => (
  <div style={{ background: T.card, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: T.text }}>{title}</p>
      {subtitle && <span style={{ fontSize: 11, color: T.muted }}>{subtitle}</span>}
    </div>
    {children}
  </div>
);

const Table = ({ headers, rows }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>{headers.map(h => (
          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: T.muted, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={headers.length} style={{ padding: '20px 12px', color: T.muted, textAlign: 'center', fontSize: 12 }}>No data</td></tr>
          : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
              {row.map((cell, j) => <td key={j} style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{cell}</td>)}
            </tr>
          ))
        }
      </tbody>
    </table>
  </div>
);

const WfBtn = ({ label, icon, color, onClick, loading }) => (
  <button onClick={onClick} disabled={loading}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
    {icon}{loading ? 'Working…' : label}
  </button>
);

const Msg = ({ msg, err }) => (
  <>
    {msg && <div style={{ padding: '10px 14px', background: T.greenDim, borderRadius: 8, fontSize: 13, color: T.green }}>{msg}</div>}
    {err && <div style={{ padding: '10px 14px', background: T.redDim,   borderRadius: 8, fontSize: 13, color: T.red   }}>{err}</div>}
  </>
);

const StarRating = ({ value }) => {
  const stars = Math.round(Number(value) * 2) / 2;
  return (
    <span style={{ color: T.amber, fontSize: 13 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ opacity: i <= stars ? 1 : 0.25 }}>★</span>
      ))}
      <span style={{ color: T.muted, fontSize: 11, marginLeft: 4 }}>{Number(value).toFixed(1)}</span>
    </span>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────
const Purchase = () => {
  const [tab, setTab] = useState('dashboard');
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Purchase Management</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
          Suppliers · Requisitions · GRNs · Budgets · Analytics
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
      {tab === 'dashboard'    && <DashboardPanel />}
      {tab === 'suppliers'    && <SuppliersPanel />}
      {tab === 'requisitions' && <RequisitionsPanel />}
      {tab === 'grns'         && <GRNsPanel />}
      {tab === 'budgets'      && <BudgetsPanel />}
      {tab === 'analytics'    && <AnalyticsPanel />}
    </div>
  );
};

// ── DASHBOARD ─────────────────────────────────────────────────
const DashboardPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purchaseApi.getDashboard()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  const utilPct = data?.budget_utilization || 0;
  const utilColor = utilPct > 90 ? T.red : utilPct > 70 ? T.amber : T.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Active Suppliers',      value: data?.active_suppliers,      color: T.accent, icon: <Users size={20} color={T.accent} />,          bg: T.accentDim },
          { label: 'Pending Requisitions',  value: data?.pending_requisitions,  color: T.amber,  icon: <Clock size={20} color={T.amber} />,            bg: T.amberDim  },
          { label: 'Approved Requisitions', value: data?.approved_requisitions, color: T.green,  icon: <CheckCircle size={20} color={T.green} />,      bg: T.greenDim  },
          { label: 'GRNs This Month',       value: data?.grns_this_month,       color: T.blue,   icon: <Package size={20} color={T.blue} />,           bg: T.blueDim   },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Budget utilization */}
        <Card title="Budget Overview" subtitle={`${data?.budget_utilization}% utilized`}>
          {[
            { label: 'Total Budget',    value: usd(data?.total_budget),    color: T.text   },
            { label: 'Total Spent',     value: usd(data?.total_spent),     color: T.red    },
            { label: 'Remaining',       value: usd(data?.budget_remaining),color: T.green  },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <span style={{ color: T.muted }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted, marginBottom: 4 }}>
              <span>Budget Utilization</span><span style={{ color: utilColor }}>{utilPct}%</span>
            </div>
            <div style={{ background: T.border, borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(utilPct, 100)}%`, height: '100%', background: utilColor, borderRadius: 6, transition: 'width .5s' }} />
            </div>
          </div>
        </Card>

        {/* Top suppliers */}
        <Card title="Top Suppliers by Spend">
          {(data?.top_suppliers || []).map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{s.name}</p>
                <StarRating value={s.average_rating} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontWeight: 700, color: T.accent }}>{usd(s.total_spend)}</p>
                <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{s.on_time_delivery_pct}% on-time</p>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <Award size={14} color={T.amber} />
            <span style={{ color: T.muted }}>Avg supplier rating: </span>
            <StarRating value={data?.avg_supplier_rating || 0} />
          </div>
        </Card>
      </div>
    </div>
  );
};

// ── SUPPLIERS ─────────────────────────────────────────────────
const SuppliersPanel = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [ratings, setRatings]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm]   = useState({ quality_rating: 4, delivery_rating: 4, pricing_rating: 4, communication_rating: 4, on_time_delivery: true, comments: '', date: new Date().toISOString().split('T')[0], po_reference: '' });
  const [msg, setMsg]             = useState('');
  const [err, setErr]             = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    purchaseApi.getSuppliers(search ? { search } : {})
      .then(r => setSuppliers(r.data.results || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const selectSupplier = async (s) => {
    setSelected(s); setRatings(null); setMsg(''); setErr('');
    const r = await purchaseApi.getSupplierRatings(s.id);
    setRatings(r.data);
  };

  const submitRating = async () => {
    setSubmitting(true); setErr(''); setMsg('');
    try {
      await purchaseApi.createRating({ ...rateForm, supplier: selected.id });
      setMsg('Rating submitted successfully.');
      setShowRateForm(false);
      const r = await purchaseApi.getSupplierRatings(selected.id);
      setRatings(r.data);
      load();
    } catch (e) { setErr('Failed to submit rating.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <Spin />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card, borderRadius: 10, padding: '8px 14px', border: `1px solid ${T.border}`, flex: 1, maxWidth: 320 }}>
          <Search size={14} color={T.muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
            style={{ border: 'none', outline: 'none', fontSize: 12, color: T.text, width: '100%', background: 'transparent' }} />
        </div>
        <span style={{ fontSize: 12, color: T.muted }}>{suppliers.length} suppliers</span>
      </div>
      <Msg msg={msg} err={err} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Supplier list */}
        <Card title={`Suppliers (${suppliers.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {suppliers.map(s => (
              <div key={s.id} onClick={() => selectSupplier(s)}
                style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                  background: selected?.id === s.id ? T.accentDim : T.bg,
                  border: `1px solid ${selected?.id === s.id ? T.accent : T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 11 }}>{s.supplier_number}</strong>
                  <span style={{ ...pill(s.status === 'Active' ? T.green : T.red, s.status === 'Active' ? T.greenDim : T.redDim), fontSize: 10 }}>{s.status}</span>
                </div>
                <p style={{ margin: '2px 0', fontWeight: 600 }}>{s.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{s.supplier_type} · {s.city}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <StarRating value={s.average_rating} />
                  <span style={{ fontSize: 10, color: T.accent }}>{usd(s.total_spend)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Supplier detail */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${selected.supplier_number} — ${selected.name}`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(T.accent, T.accentDim) }}>{selected.supplier_type}</span>
                <span style={{ ...pill(selected.status === 'Active' ? T.green : T.red, selected.status === 'Active' ? T.greenDim : T.redDim) }}>{selected.status}</span>
              </div>

              {/* Contact info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { icon: <Mail size={12} />,   label: selected.email || '—'         },
                  { icon: <Phone size={12} />,  label: selected.phone || '—'         },
                  { icon: <MapPin size={12} />, label: `${selected.city}, ${selected.country}` },
                  { icon: <FileText size={12} />, label: `KRA: ${selected.kra_pin || '—'}` },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.muted }}>
                    {c.icon} {c.label}
                  </div>
                ))}
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Total Orders',   value: selected.total_orders,              color: T.text   },
                  { label: 'Total Spend',    value: usd(selected.total_spend),          color: T.accent },
                  { label: 'Payment Terms',  value: `${selected.payment_terms_days}d`,  color: T.text   },
                  { label: 'Lead Time',      value: `${selected.lead_time_days} days`,  color: T.blue   },
                  { label: 'On-Time Delivery', value: `${selected.on_time_delivery_pct}%`, color: T.green },
                  { label: 'Credit Limit',   value: usd(selected.credit_limit),         color: T.amber  },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              <WfBtn label="Rate This Supplier" icon={<Star size={13} />} color={T.amber}
                onClick={() => setShowRateForm(!showRateForm)} />

              {showRateForm && (
                <div style={{ marginTop: 12, background: T.amberDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.amber }}>Submit Supplier Rating</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { key: 'quality_rating',       label: 'Quality (1-5)'       },
                      { key: 'delivery_rating',      label: 'Delivery (1-5)'      },
                      { key: 'pricing_rating',       label: 'Pricing (1-5)'       },
                      { key: 'communication_rating', label: 'Communication (1-5)' },
                    ].map(f => (
                      <div key={f.key}>
                        <p style={{ margin: '0 0 4px', fontSize: 10, color: T.muted }}>{f.label}</p>
                        <select value={rateForm[f.key]} onChange={e => setRateForm({ ...rateForm, [f.key]: parseInt(e.target.value) })}
                          style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                          {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} ★</option>)}
                        </select>
                      </div>
                    ))}
                    <input type="text" placeholder="PO Reference" value={rateForm.po_reference}
                      onChange={e => setRateForm({ ...rateForm, po_reference: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Date (YYYY-MM-DD)" value={rateForm.date}
                      onChange={e => setRateForm({ ...rateForm, date: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', gridColumn: '1/-1' }}>
                      <input type="checkbox" checked={rateForm.on_time_delivery}
                        onChange={e => setRateForm({ ...rateForm, on_time_delivery: e.target.checked })} />
                      Delivered on time
                    </label>
                    <textarea placeholder="Comments" value={rateForm.comments}
                      onChange={e => setRateForm({ ...rateForm, comments: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, resize: 'vertical', minHeight: 60, gridColumn: '1/-1' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={submitRating} disabled={submitting}
                      style={{ background: T.amber, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
                      {submitting ? 'Submitting…' : 'Submit Rating'}
                    </button>
                    <button onClick={() => setShowRateForm(false)}
                      style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </Card>

            {/* Ratings history */}
            {ratings && (
              <Card title={`Ratings History (${ratings.total_ratings} reviews)`}
                subtitle={<StarRating value={ratings.average_rating} />}>
                <Table
                  headers={['Date', 'Quality', 'Delivery', 'Pricing', 'Comm.', 'Overall', 'On-Time', 'Comments']}
                  rows={(ratings.ratings || []).slice(0, 10).map(r => [
                    r.date,
                    `${r.quality_rating}★`,
                    `${r.delivery_rating}★`,
                    `${r.pricing_rating}★`,
                    `${r.communication_rating}★`,
                    <StarRating value={r.overall_rating} />,
                    r.on_time_delivery
                      ? <span style={{ color: T.green }}>✓</span>
                      : <span style={{ color: T.red }}>✗</span>,
                    <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{r.comments || '—'}</span>,
                  ])}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a Supplier">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a supplier to view details, metrics, and rating history.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── REQUISITIONS ──────────────────────────────────────────────
const RequisitionsPanel = () => {
  const [prs, setPRs]           = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true); setMsg(''); setErr('');
    purchaseApi.getRequisitions(statusFilter ? { status: statusFilter } : {})
      .then(r => setPRs(r.data.results || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const select = async (pr) => {
    setSelected(pr); setDetail(null); setMsg(''); setErr('');
    const r = await purchaseApi.getRequisition(pr.id);
    setDetail(r.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setMsg(''); setErr('');
    try {
      const r = await fn();
      setMsg(r.data.detail || 'Done.');
      load();
      if (selected) { const u = await purchaseApi.getRequisition(selected.id); setSelected(u.data); setDetail(u.data); }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const sc = selected ? (PR_STATUS[selected.status] || PR_STATUS.Draft) : null;
  const pc = selected ? (PRIORITY_COLORS[selected.priority] || PRIORITY_COLORS.Medium) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Statuses</option>
          {['Draft','Submitted','Approved','Rejected','Converted','Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{prs.length} requisitions</span>
      </div>
      <Msg msg={msg} err={err} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title={`Requisitions (${prs.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {prs.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No requisitions found.</p>}
            {prs.map(pr => {
              const s = PR_STATUS[pr.status]   || PR_STATUS.Draft;
              const p = PRIORITY_COLORS[pr.priority] || PRIORITY_COLORS.Medium;
              return (
                <div key={pr.id} onClick={() => select(pr)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === pr.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === pr.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 11 }}>{pr.pr_number}</strong>
                    <span style={{ ...pill(s.color, s.bg), fontSize: 10 }}>{pr.status}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontWeight: 500, fontSize: 12 }}>{pr.title}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                    <span>{pr.department}</span>
                    <span style={{ ...pill(p.color, p.bg), fontSize: 10 }}>{pr.priority}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11 }}>
                    <span style={{ color: T.muted }}>By: {pr.requested_by}</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{usd(pr.total_amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {selected && detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${detail.pr_number} — ${detail.title}`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(sc.color, sc.bg) }}>{detail.status}</span>
                <span style={{ ...pill(pc.color, pc.bg) }}>{detail.priority}</span>
                {detail.supplier_name && <span style={{ ...pill(T.blue, T.blueDim) }}>{detail.supplier_name}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Department',    value: detail.department || '—',   color: T.text  },
                  { label: 'Requested By',  value: detail.requested_by || '—', color: T.text  },
                  { label: 'Date Required', value: detail.date_required || '—',color: T.amber },
                  { label: 'Total Amount',  value: usd(detail.total_amount),   color: T.accent},
                  { label: 'Lines',         value: detail.lines?.length || 0,  color: T.text  },
                  { label: 'Created',       value: detail.created_at?.split('T')[0], color: T.muted },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {detail.justification && (
                <div style={{ background: T.bg, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.muted, marginBottom: 14 }}>
                  <strong>Justification:</strong> {detail.justification}
                </div>
              )}

              {detail.rejection_reason && (
                <div style={{ background: T.redDim, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.red, marginBottom: 14 }}>
                  <strong>Rejection Reason:</strong> {detail.rejection_reason}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.status === 'Draft' && (
                  <WfBtn label="Submit for Approval" icon={<ChevronRight size={13} />} color={T.amber}
                    loading={actionLoading === 'Submit'}
                    onClick={() => action('Submit', () => purchaseApi.submitPR(detail.id))} />
                )}
                {detail.status === 'Submitted' && (<>
                  <WfBtn label="Approve" icon={<ThumbsUp size={13} />} color={T.green}
                    loading={actionLoading === 'Approve'}
                    onClick={() => action('Approve', () => purchaseApi.approvePR(detail.id))} />
                  <WfBtn label="Reject" icon={<XCircle size={13} />} color={T.red}
                    onClick={() => setShowReject(true)} />
                </>)}
                {detail.status === 'Approved' && (
                  <WfBtn label="Convert to PO" icon={<Send size={13} />} color={T.accent}
                    loading={actionLoading === 'Convert'}
                    onClick={() => action('Convert', () => purchaseApi.convertPR(detail.id))} />
                )}
              </div>

              {showReject && (
                <div style={{ marginTop: 12, background: T.redDim, borderRadius: 10, padding: 12 }}>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    style={{ width: '100%', border: `1px solid ${T.red}`, borderRadius: 6, padding: 8, fontSize: 12, resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => { action('Reject', () => purchaseApi.rejectPR(detail.id, rejectReason)); setShowReject(false); setRejectReason(''); }}
                      style={{ background: T.red, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Confirm</button>
                    <button onClick={() => setShowReject(false)}
                      style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </Card>

            {detail.lines?.length > 0 && (
              <Card title="Requisition Line Items">
                <Table
                  headers={['Description', 'Qty', 'UoM', 'Est. Price', 'Est. Total']}
                  rows={detail.lines.map(l => [
                    l.description,
                    l.quantity,
                    l.unit_of_measure || '—',
                    usd(l.estimated_price),
                    <strong>{usd(l.estimated_total)}</strong>,
                  ])}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a Requisition">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a requisition to view details and manage the approval workflow.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── GRNs ──────────────────────────────────────────────────────
const GRNsPanel = () => {
  const [grns, setGRNs]         = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true); setMsg(''); setErr('');
    purchaseApi.getGRNs(statusFilter ? { status: statusFilter } : {})
      .then(r => setGRNs(r.data.results || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const select = async (g) => {
    setSelected(g); setDetail(null); setMsg(''); setErr('');
    const r = await purchaseApi.getGRN(g.id);
    setDetail(r.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setMsg(''); setErr('');
    try {
      const r = await fn();
      setMsg(r.data.detail || 'Done.');
      load();
      if (selected) { const u = await purchaseApi.getGRN(selected.id); setSelected(u.data); setDetail(u.data); }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const sc = selected ? (GRN_STATUS[selected.status] || GRN_STATUS.Draft) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Statuses</option>
          {['Draft','Confirmed','Posted'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{grns.length} GRNs</span>
      </div>
      <Msg msg={msg} err={err} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title={`Goods Received Notes (${grns.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {grns.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No GRNs found.</p>}
            {grns.map(g => {
              const s = GRN_STATUS[g.status] || GRN_STATUS.Draft;
              return (
                <div key={g.id} onClick={() => select(g)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === g.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === g.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 11 }}>{g.grn_number}</strong>
                    <span style={{ ...pill(s.color, s.bg), fontSize: 10 }}>{g.status}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontWeight: 500 }}>{g.supplier_name}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                    <span>PO: {g.po_reference || '—'}</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{usd(g.total_value)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: T.muted }}>{g.received_date} · {g.total_items} items</p>
                </div>
              );
            })}
          </div>
        </Card>

        {selected && detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${detail.grn_number} — ${detail.supplier_name}`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(sc.color, sc.bg) }}>{detail.status}</span>
                {detail.warehouse_name && <span style={{ ...pill(T.muted, '#f1f5f9') }}>{detail.warehouse_name}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Received Date',  value: detail.received_date,            color: T.text   },
                  { label: 'PO Reference',   value: detail.po_reference || '—',      color: T.blue   },
                  { label: 'Delivery Note',  value: detail.delivery_note_no || '—',  color: T.muted  },
                  { label: 'Vehicle No.',    value: detail.vehicle_number || '—',    color: T.muted  },
                  { label: 'Driver',         value: detail.driver_name || '—',       color: T.text   },
                  { label: 'Total Value',    value: usd(detail.total_value),         color: T.accent },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>
              {detail.condition_notes && (
                <div style={{ background: T.amberDim, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.amber, marginBottom: 14 }}>
                  <strong>Condition Notes:</strong> {detail.condition_notes}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                {detail.status === 'Draft' && (
                  <WfBtn label="Confirm GRN" icon={<CheckCircle size={13} />} color={T.blue}
                    loading={actionLoading === 'Confirm'}
                    onClick={() => action('Confirm', () => purchaseApi.confirmGRN(detail.id))} />
                )}
                {detail.status === 'Confirmed' && (
                  <WfBtn label="Post to Inventory" icon={<Package size={13} />} color={T.green}
                    loading={actionLoading === 'Post'}
                    onClick={() => action('Post', () => purchaseApi.postGRN(detail.id))} />
                )}
              </div>
            </Card>

            {detail.lines?.length > 0 && (
              <Card title="GRN Line Items">
                <Table
                  headers={['Description', 'Qty Ordered', 'Qty Received', 'Variance', 'Unit Cost', 'Condition', 'Total']}
                  rows={detail.lines.map(l => [
                    l.description,
                    l.quantity_ordered,
                    l.quantity_received,
                    <span style={{ color: l.quantity_variance < 0 ? T.red : l.quantity_variance > 0 ? T.amber : T.green, fontWeight: 600 }}>
                      {l.quantity_variance > 0 ? '+' : ''}{l.quantity_variance}
                    </span>,
                    usd(l.unit_cost),
                    <span style={{ ...pill(l.condition === 'Good' ? T.green : l.condition === 'Damaged' ? T.amber : T.red, l.condition === 'Good' ? T.greenDim : l.condition === 'Damaged' ? T.amberDim : T.redDim) }}>{l.condition}</span>,
                    <strong>{usd(l.line_total)}</strong>,
                  ])}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a GRN">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a GRN to view details, confirm, and post to inventory.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── BUDGETS ───────────────────────────────────────────────────
const BudgetsPanel = () => {
  const [summary, setSummary] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([purchaseApi.getBudgetSummary(), purchaseApi.getBudgets()])
      .then(([sumRes, budRes]) => {
        setSummary(sumRes.data);
        setBudgets(budRes.data.results || budRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  const utilPct = summary?.utilization_pct || 0;
  const utilColor = utilPct > 90 ? T.red : utilPct > 70 ? T.amber : T.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Total Budget',     value: usd(summary?.total_budget),    color: T.text   },
          { label: 'Total Spent',      value: usd(summary?.total_spent),     color: T.red    },
          { label: 'Remaining',        value: usd(summary?.total_remaining), color: T.green  },
          { label: 'Utilization',      value: `${utilPct}%`,                 color: utilColor },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
            <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Department breakdown */}
      <Card title={`Budget by Department — ${summary?.year}`}>
        {(summary?.by_department || []).map(d => {
          const pct   = d.utilization_pct;
          const color = pct > 90 ? T.red : pct > 70 ? T.amber : T.green;
          return (
            <div key={d.department} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{d.department}</span>
                <span style={{ color: T.muted }}>
                  {usd(d.spent)} / {usd(d.budget)}
                  <span style={{ marginLeft: 8, color, fontWeight: 700 }}>{pct}%</span>
                </span>
              </div>
              <div style={{ background: T.border, borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .5s' }} />
              </div>
              {d.remaining < 0 && (
                <p style={{ margin: '3px 0 0', fontSize: 10, color: T.red }}>
                  ⚠ Over budget by {usd(Math.abs(d.remaining))}
                </p>
              )}
            </div>
          );
        })}
      </Card>

      {/* Budget table */}
      <Card title="All Budgets">
        <Table
          headers={['Department', 'Category', 'Period', 'Year', 'Month', 'Budget', 'Spent', 'Remaining', 'Utilization']}
          rows={budgets.map(b => [
            b.department,
            b.category || '—',
            b.period,
            b.year,
            b.month || '—',
            usd(b.budget_amount),
            <span style={{ color: T.red }}>{usd(b.spent_amount)}</span>,
            <span style={{ color: b.is_over_budget ? T.red : T.green }}>{usd(b.remaining)}</span>,
            <span style={{ color: b.utilization_pct > 90 ? T.red : b.utilization_pct > 70 ? T.amber : T.green, fontWeight: 600 }}>
              {b.utilization_pct}%
            </span>,
          ])}
        />
      </Card>
    </div>
  );
};

// ── ANALYTICS ─────────────────────────────────────────────────
const AnalyticsPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purchaseApi.getAnalytics()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  const COLORS = [T.accent, T.blue, T.amber, T.purple, T.green, T.red, '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

  const prData = Object.entries(data?.pr_breakdown || {}).map(([name, value]) => ({
    name, value, fill: PR_STATUS[name]?.color || T.muted,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Spend by supplier */}
        <Card title="Top 10 Suppliers by Spend">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.spend_by_supplier || []} layout="vertical"
              margin={{ top: 0, right: 10, bottom: 0, left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={80} />
              <Tooltip formatter={v => usd(v)} />
              <Bar dataKey="total_spend" name="Total Spend" radius={[0,4,4,0]}>
                {(data?.spend_by_supplier || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Requisition status pie */}
        <Card title="Requisition Status Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={prData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {prData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Monthly GRN trend */}
      <Card title="Monthly GRN Value (Last 6 Months)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data?.monthly_grn || []} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={v => usd(v)} />
            <Bar dataKey="value" name="GRN Value" fill={T.accent} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Top suppliers table */}
      <Card title="Supplier Performance">
        <Table
          headers={['Supplier', 'Total Orders', 'Total Spend', 'Avg Rating', 'On-Time %']}
          rows={(data?.spend_by_supplier || []).map(s => [
            s.name,
            s.total_orders,
            <strong style={{ color: T.accent }}>{usd(s.total_spend)}</strong>,
            <StarRating value={s.average_rating} />,
            <span style={{ color: T.green, fontWeight: 600 }}>—</span>,
          ])}
        />
      </Card>
    </div>
  );
};

export default Purchase;