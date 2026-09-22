import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, FileText, Package, ShoppingCart,
  TrendingUp, DollarSign, AlertTriangle, Download,
  RefreshCw, Calendar, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import axios from 'axios';

// ── Inline API ─────────────────────────────────────────────────
const BASE = 'http://localhost:8000/api';
const api  = axios.create({ baseURL: BASE });

const reportingApi = {
  getExecutiveSummary:       ()       => api.get('/reporting/executive-summary/'),
  getARaging:                (params) => api.get('/reporting/ar-aging/', { params }),
  getAPaging:                (params) => api.get('/reporting/ap-aging/', { params }),
  getInventoryValuation:     (params) => api.get('/reporting/inventory-valuation/', { params }),
  getStockMovements:         (params) => api.get('/reporting/stock-movements/', { params }),
  getReorderAlerts:          (params) => api.get('/reporting/reorder-alerts/', { params }),
  getSalesReport:            (params) => api.get('/reporting/sales/', { params }),
  getPurchaseReport:         (params) => api.get('/reporting/purchase/', { params }),
  getAssetRegister:          (params) => api.get('/reporting/asset-register/', { params }),
  getDepreciationSchedule:   (params) => api.get('/reporting/depreciation-schedule/', { params }),

  // CSV download URLs
  csvUrl: (endpoint, params = {}) => {
    const q = new URLSearchParams({ ...params, format: 'csv' }).toString();
    return `${BASE}/reporting/${endpoint}/?${q}`;
  },
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

const CHART_COLORS = [T.accent, T.blue, T.amber, T.purple, T.green, T.red, '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

const usd   = (n) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
const pct   = (n) => `${Number(n || 0).toFixed(1)}%`;
const Spin  = () => <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 13 }}>Loading report…</div>;

const today      = new Date().toISOString().split('T')[0];
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
const yearStart  = `${new Date().getFullYear()}-01-01`;

const TABS = [
  { id: 'executive',   icon: <BarChart2 size={14} />,     label: 'Executive Summary'    },
  { id: 'ar-aging',    icon: <DollarSign size={14} />,    label: 'AR Aging'             },
  { id: 'ap-aging',    icon: <DollarSign size={14} />,    label: 'AP Aging'             },
  { id: 'inventory',   icon: <Package size={14} />,        label: 'Inventory Valuation'  },
  { id: 'movements',   icon: <TrendingUp size={14} />,    label: 'Stock Movements'      },
  { id: 'sales',       icon: <ShoppingCart size={14} />,  label: 'Sales Report'         },
  { id: 'purchase',    icon: <FileText size={14} />,      label: 'Purchase Report'      },
  { id: 'assets',      icon: <Filter size={14} />,        label: 'Asset Register'       },
];

// ── Shared UI ──────────────────────────────────────────────────
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

const KPI = ({ label, value, color, bg, icon }) => (
  <div style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
    <div>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{label}</p>
    </div>
  </div>
);

const Table = ({ headers, rows, stickyHeader }) => (
  <div style={{ overflowX: 'auto', maxHeight: stickyHeader ? 380 : 'none', overflowY: stickyHeader ? 'auto' : 'visible' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead style={{ position: stickyHeader ? 'sticky' : 'static', top: 0, background: T.card, zIndex: 1 }}>
        <tr>{headers.map(h => (
          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: T.muted, fontWeight: 600, fontSize: 11, borderBottom: `2px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={headers.length} style={{ padding: '24px', color: T.muted, textAlign: 'center' }}>No data</td></tr>
          : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
              {row.map((cell, j) => <td key={j} style={{ padding: '9px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{cell}</td>)}
            </tr>
          ))
        }
      </tbody>
    </table>
  </div>
);

const DateFilter = ({ from, to, onFrom, onTo, onRun, loading }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: T.card, borderRadius: 10, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
    <Calendar size={14} color={T.muted} />
    <input type="date" value={from} onChange={e => onFrom(e.target.value)}
      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: T.text }} />
    <span style={{ color: T.muted, fontSize: 12 }}>to</span>
    <input type="date" value={to} onChange={e => onTo(e.target.value)}
      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: T.text }} />
    <button onClick={onRun} disabled={loading}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
      <RefreshCw size={12} />{loading ? 'Loading…' : 'Run Report'}
    </button>
  </div>
);

const CsvBtn = ({ url, label }) => (
  <a href={url} download
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.green, color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
    <Download size={13} />{label || 'Export CSV'}
  </a>
);

const AgingBar = ({ label, value, total, color }) => {
  const w = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: T.muted }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{usd(value)}</span>
      </div>
      <div style={{ background: T.border, borderRadius: 6, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .5s' }} />
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────
const Reporting = () => {
  const [tab, setTab] = useState('executive');
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Reports & Analytics</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
          Executive Summary · AR/AP Aging · Inventory · Sales · Purchase · Assets
        </p>
      </div>

      {/* Tab bar — scrollable */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
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

      {tab === 'executive' && <ExecutivePanel />}
      {tab === 'ar-aging'  && <ARAgingPanel />}
      {tab === 'ap-aging'  && <APAgingPanel />}
      {tab === 'inventory' && <InventoryValuationPanel />}
      {tab === 'movements' && <StockMovementsPanel />}
      {tab === 'sales'     && <SalesPanel />}
      {tab === 'purchase'  && <PurchasePanel />}
      {tab === 'assets'    && <AssetRegisterPanel />}
    </div>
  );
};

// ── EXECUTIVE SUMMARY ─────────────────────────────────────────
const ExecutivePanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportingApi.getExecutiveSummary()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  const fin = data?.finance || {};
  const ar  = data?.ar      || {};
  const ap  = data?.ap      || {};
  const inv = data?.inventory|| {};
  const ast = data?.assets  || {};
  const ord = data?.orders  || {};

  const plData = [
    { name: 'Revenue',  value: fin.revenue   || 0, fill: T.green  },
    { name: 'Expenses', value: fin.expenses  || 0, fill: T.red    },
    { name: 'Net Income', value: fin.net_income || 0, fill: fin.net_income >= 0 ? T.accent : T.amber },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 11, color: T.muted }}>Generated: {data?.generated_at}</p>

      {/* Finance KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KPI label="Total Revenue"    value={usd(fin.revenue)}    color={T.green}  bg={T.greenDim}  icon={<TrendingUp size={20} color={T.green} />} />
        <KPI label="Total Expenses"   value={usd(fin.expenses)}   color={T.red}    bg={T.redDim}    icon={<DollarSign size={20} color={T.red} />} />
        <KPI label="Net Income"       value={usd(fin.net_income)} color={fin.net_income >= 0 ? T.accent : T.amber} bg={fin.net_income >= 0 ? T.accentDim : T.amberDim} icon={<BarChart2 size={20} color={T.accent} />} />
        <KPI label="Total Assets"     value={usd(fin.total_assets)} color={T.blue} bg={T.blueDim}   icon={<Package size={20} color={T.blue} />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* P&L Chart */}
        <Card title="P&L Summary">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={plData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => usd(v)} />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {plData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Balance Sheet */}
        <Card title="Balance Sheet Snapshot">
          {[
            { label: 'Total Assets',      value: usd(fin.total_assets),      color: T.blue   },
            { label: 'Total Liabilities', value: usd(fin.total_liabilities),  color: T.red    },
            { label: 'Equity',            value: usd(fin.equity),             color: T.accent },
            { label: 'Total Receivables', value: usd(ar.total_receivable),    color: T.green  },
            { label: 'Overdue AR',        value: usd(ar.overdue),             color: T.amber  },
            { label: 'Total Payables',    value: usd(ap.total_payable),       color: T.purple },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <span style={{ color: T.muted }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KPI label="Active SO"         value={ord.active_so}          color={T.accent} bg={T.accentDim} icon={<ShoppingCart size={20} color={T.accent} />} />
        <KPI label="Inventory Value"   value={usd(inv.total_value)}   color={T.blue}   bg={T.blueDim}   icon={<Package size={20} color={T.blue} />} />
        <KPI label="Low Stock Items"   value={inv.low_stock}          color={T.amber}  bg={T.amberDim}  icon={<AlertTriangle size={20} color={T.amber} />} />
        <KPI label="Asset Net Value"   value={usd(ast.net_book_value)} color={T.purple} bg={T.purpleDim} icon={<BarChart2 size={20} color={T.purple} />} />
      </div>

      {/* Module grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { title: 'Accounts Receivable', items: [
            { label: 'Total Receivable', value: usd(ar.total_receivable), color: T.green },
            { label: 'Overdue',          value: usd(ar.overdue),         color: T.red   },
            { label: 'Collected MTD',    value: usd(ar.collected_mtd),   color: T.accent},
            { label: 'Open Invoices',    value: ar.invoice_count,        color: T.text  },
          ]},
          { title: 'Accounts Payable', items: [
            { label: 'Total Payable',    value: usd(ap.total_payable),   color: T.red   },
            { label: 'Overdue',          value: usd(ap.overdue),         color: T.amber },
            { label: 'Paid MTD',         value: usd(ap.paid_mtd),        color: T.green },
            { label: 'Open Bills',       value: ap.bill_count,           color: T.text  },
          ]},
          { title: 'Fixed Assets', items: [
            { label: 'Active Assets',    value: ast.active_count,        color: T.text  },
            { label: 'Total Cost',       value: usd(ast.total_cost),     color: T.blue  },
            { label: 'Net Book Value',   value: usd(ast.net_book_value), color: T.accent},
          ]},
        ].map(sec => (
          <Card key={sec.title} title={sec.title}>
            {sec.items.map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                <span style={{ color: T.muted }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ── AR AGING ──────────────────────────────────────────────────
const ARAgingPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    reportingApi.getARaging()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { run(); }, [run]);

  const BUCKETS = [
    { key: 'current', label: 'Current',     color: T.green  },
    { key: '1_30',    label: '1-30 Days',   color: T.blue   },
    { key: '31_60',   label: '31-60 Days',  color: T.amber  },
    { key: '61_90',   label: '61-90 Days',  color: T.purple },
    { key: 'over_90', label: '90+ Days',    color: T.red    },
  ];

  const chartData = BUCKETS.map(b => ({
    name:  b.label,
    value: data?.totals?.[b.key] || 0,
    fill:  b.color,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 11, color: T.muted }}>As of {data?.as_of_date}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={run} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: T.text }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <CsvBtn url={reportingApi.csvUrl('ar-aging')} label="Export CSV" />
        </div>
      </div>

      {loading ? <Spin /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {BUCKETS.map(b => (
              <div key={b.key} style={{ background: T.card, borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', borderTop: `3px solid ${b.color}` }}>
                <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{b.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: b.color }}>{usd(data.totals?.[b.key] || 0)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: T.muted }}>{data.buckets?.[b.key]?.length || 0} invoices</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Aging Distribution">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => usd(v)} />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Aging Summary">
              {BUCKETS.map(b => (
                <AgingBar key={b.key} label={b.label} value={data.totals?.[b.key] || 0}
                  total={data.grand_total || 1} color={b.color} />
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `2px solid ${T.border}`, fontSize: 13 }}>
                <strong>Grand Total</strong>
                <strong style={{ color: T.accent }}>{usd(data.grand_total)}</strong>
              </div>
            </Card>
          </div>

          {BUCKETS.map(b => data.buckets?.[b.key]?.length > 0 && (
            <Card key={b.key} title={`${b.label} — ${data.buckets[b.key].length} invoices`}
              subtitle={usd(data.totals?.[b.key])}>
              <Table stickyHeader
                headers={['Invoice No', 'Customer', 'Invoice Date', 'Due Date', 'Balance Due', 'Days Overdue']}
                rows={data.buckets[b.key].map(r => [
                  <code style={{ fontSize: 11 }}>{r.invoice_number}</code>,
                  r.customer,
                  r.invoice_date,
                  r.due_date,
                  <strong style={{ color: b.color }}>{usd(r.balance_due)}</strong>,
                  <span style={{ color: r.days_overdue > 0 ? T.red : T.green }}>{r.days_overdue}d</span>,
                ])}
              />
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

// ── AP AGING ──────────────────────────────────────────────────
const APAgingPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(() => {
    setLoading(true);
    reportingApi.getAPaging()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { run(); }, [run]);

  const BUCKETS = [
    { key: 'current', label: 'Current',    color: T.green  },
    { key: '1_30',    label: '1-30 Days',  color: T.blue   },
    { key: '31_60',   label: '31-60 Days', color: T.amber  },
    { key: '61_90',   label: '61-90 Days', color: T.purple },
    { key: 'over_90', label: '90+ Days',   color: T.red    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 11, color: T.muted }}>As of {data?.as_of_date}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={run} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: T.text }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <CsvBtn url={reportingApi.csvUrl('ap-aging')} label="Export CSV" />
        </div>
      </div>

      {loading ? <Spin /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {BUCKETS.map(b => (
              <div key={b.key} style={{ background: T.card, borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', borderTop: `3px solid ${b.color}` }}>
                <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{b.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: b.color }}>{usd(data.totals?.[b.key] || 0)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: T.muted }}>{data.buckets?.[b.key]?.length || 0} bills</p>
              </div>
            ))}
          </div>

          <Card title="Aging Summary">
            {BUCKETS.map(b => (
              <AgingBar key={b.key} label={b.label} value={data.totals?.[b.key] || 0}
                total={data.grand_total || 1} color={b.color} />
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `2px solid ${T.border}`, fontSize: 13 }}>
              <strong>Grand Total</strong>
              <strong style={{ color: T.red }}>{usd(data.grand_total)}</strong>
            </div>
          </Card>

          {BUCKETS.map(b => data.buckets?.[b.key]?.length > 0 && (
            <Card key={b.key} title={`${b.label} — ${data.buckets[b.key].length} bills`}
              subtitle={usd(data.totals?.[b.key])}>
              <Table stickyHeader
                headers={['Bill No', 'Vendor', 'Bill Date', 'Due Date', 'Balance Due', 'Days Overdue']}
                rows={data.buckets[b.key].map(r => [
                  <code style={{ fontSize: 11 }}>{r.bill_number}</code>,
                  r.vendor,
                  r.bill_date,
                  r.due_date,
                  <strong style={{ color: b.color }}>{usd(r.balance_due)}</strong>,
                  <span style={{ color: r.days_overdue > 0 ? T.red : T.green }}>{r.days_overdue}d</span>,
                ])}
              />
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

// ── INVENTORY VALUATION ───────────────────────────────────────
const InventoryValuationPanel = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');

  const run = useCallback(() => {
    setLoading(true);
    reportingApi.getInventoryValuation(category ? { category } : {})
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => { run(); }, [run]);

  const chartData = (data?.rows || [])
    .reduce((acc, r) => {
      const existing = acc.find(a => a.name === r.category);
      if (existing) existing.value += r.total_value;
      else acc.push({ name: r.category, value: r.total_value });
      return acc;
    }, [])
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Filter by category…"
            style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }} />
          <button onClick={run} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={12} />{loading ? 'Loading…' : 'Run'}
          </button>
        </div>
        <CsvBtn url={reportingApi.csvUrl('inventory-valuation', category ? { category } : {})} label="Export CSV" />
      </div>

      {loading ? <Spin /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <KPI label="Total Products"  value={data.product_count}    color={T.text}   bg={T.accentDim} icon={<Package size={20} color={T.accent} />} />
            <KPI label="Total Value"     value={usd(data.total_value)} color={T.accent} bg={T.accentDim} icon={<DollarSign size={20} color={T.accent} />} />
            <KPI label="As of Date"      value={data.as_of_date}       color={T.muted}  bg={T.bg}        icon={<Calendar size={20} color={T.muted} />} />
          </div>

          <Card title="Value by Category">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => usd(v)} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title={`Stock Valuation — ${data.product_count} products`}>
            <Table stickyHeader
              headers={['SKU', 'Product', 'Category', 'Method', 'Qty', 'Unit Cost', 'Total Value', 'Status']}
              rows={(data.rows || []).map(r => [
                <code style={{ fontSize: 11 }}>{r.sku}</code>,
                r.name,
                r.category,
                <span style={{ fontSize: 11, background: r.valuation_method === 'FIFO' ? T.blueDim : T.accentDim, color: r.valuation_method === 'FIFO' ? T.blue : T.accent, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{r.valuation_method}</span>,
                `${r.quantity} ${r.unit_of_measure}`,
                usd(r.unit_cost),
                <strong style={{ color: T.accent }}>{usd(r.total_value)}</strong>,
                <span style={{ fontSize: 11, background: r.status === 'OK' ? T.greenDim : r.status === 'LOW' ? T.amberDim : T.redDim, color: r.status === 'OK' ? T.green : r.status === 'LOW' ? T.amber : T.red, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{r.status}</span>,
              ])}
            />
          </Card>
        </>
      )}
    </div>
  );
};

// ── STOCK MOVEMENTS ───────────────────────────────────────────
const StockMovementsPanel = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo]     = useState(today);

  const run = useCallback(() => {
    setLoading(true);
    reportingApi.getStockMovements({ date_from: dateFrom, date_to: dateTo })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { run(); }, [run]);

  const typeData = (data?.rows || []).reduce((acc, r) => {
    const existing = acc.find(a => a.name === r.movement_type);
    if (existing) { existing.count++; existing.value += r.total_cost; }
    else acc.push({ name: r.movement_type, count: 1, value: r.total_cost });
    return acc;
  }, []);

  const TYPE_COLORS = { Receipt: T.green, Issue: T.red, Adjustment: T.amber, Transfer: T.blue, Write_Off: T.purple, Opening: T.muted };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <DateFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onRun={run} loading={loading} />
        {data && <CsvBtn url={reportingApi.csvUrl('stock-movements', { date_from: dateFrom, date_to: dateTo })} />}
      </div>

      {loading ? <Spin /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <KPI label="Total Movements" value={data.count}            color={T.text}   bg={T.accentDim} icon={<TrendingUp size={20} color={T.accent} />} />
            <KPI label="Total Value"     value={usd(data.total_value)} color={T.accent} bg={T.accentDim} icon={<DollarSign size={20} color={T.accent} />} />
            <KPI label="Date Range"      value={`${data.date_from} → ${data.date_to}`} color={T.muted} bg={T.bg} icon={<Calendar size={20} color={T.muted} />} />
          </div>

          <Card title="Movements by Type">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={typeData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" name="Count" radius={[4,4,0,0]}>
                  {typeData.map((d, i) => <Cell key={i} fill={TYPE_COLORS[d.name] || T.accent} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title={`Movement History — ${data.count} records`}>
            <Table stickyHeader
              headers={['Reference', 'Date', 'Product', 'Warehouse', 'Type', 'Qty', 'Unit Cost', 'Total', 'Source Ref']}
              rows={(data.rows || []).map(r => [
                <code style={{ fontSize: 10 }}>{r.reference}</code>,
                r.date,
                <span style={{ fontSize: 11 }}>{r.product_sku} — {r.product_name}</span>,
                r.warehouse,
                <span style={{ fontSize: 11, background: `${TYPE_COLORS[r.movement_type] || T.accent}22`, color: TYPE_COLORS[r.movement_type] || T.accent, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{r.movement_type}</span>,
                <span style={{ fontWeight: 700, color: ['Issue','Write_Off'].includes(r.movement_type) ? T.red : T.green }}>
                  {['Issue','Write_Off'].includes(r.movement_type) ? '−' : '+'}{r.quantity}
                </span>,
                usd(r.unit_cost),
                <strong>{usd(r.total_cost)}</strong>,
                <code style={{ fontSize: 10 }}>{r.source_ref}</code>,
              ])}
            />
          </Card>
        </>
      )}
    </div>
  );
};

// ── SALES REPORT ──────────────────────────────────────────────
const SalesPanel = () => {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo]     = useState(today);

  const run = useCallback(() => {
    setLoading(true);
    reportingApi.getSalesReport({ date_from: dateFrom, date_to: dateTo })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { run(); }, [run]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <DateFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onRun={run} loading={loading} />
        {data && <CsvBtn url={reportingApi.csvUrl('sales', { date_from: dateFrom, date_to: dateTo })} />}
      </div>

      {loading ? <Spin /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <KPI label="Total Orders"   value={data.total_orders}          color={T.text}   bg={T.accentDim} icon={<ShoppingCart size={20} color={T.accent} />} />
            <KPI label="Total Revenue"  value={usd(data.total_revenue)}    color={T.green}  bg={T.greenDim}  icon={<TrendingUp size={20} color={T.green} />} />
            <KPI label="Date Range"     value={`${data.date_from} → ${data.date_to}`} color={T.muted} bg={T.bg} icon={<Calendar size={20} color={T.muted} />} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Revenue by Month">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.by_month || []} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={T.accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={T.accent} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => usd(v)} />
                  <Area type="monotone" dataKey="total" stroke={T.accent} strokeWidth={2} fill="url(#salesGrad)" name="Revenue" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Top Customers by Revenue">
              <Table
                headers={['Customer', 'Orders', 'Total Revenue']}
                rows={(data.by_customer || []).slice(0, 8).map(r => [
                  r.customer,
                  r.count,
                  <strong style={{ color: T.accent }}>{usd(r.total)}</strong>,
                ])}
              />
            </Card>
          </div>

          <Card title={`Order Details — ${data.total_orders} orders`}>
            <Table stickyHeader
              headers={['Order No', 'Customer', 'Order Date', 'Status', 'Payment', 'Total Amount']}
              rows={(data.rows || []).map(r => [
                <code style={{ fontSize: 11 }}>{r.order_number}</code>,
                r.customer,
                r.order_date,
                r.status,
                r.payment_status,
                <strong style={{ color: T.accent }}>{usd(r.total_amount)}</strong>,
              ])}
            />
          </Card>
        </>
      )}
    </div>
  );
};

// ── PURCHASE REPORT ───────────────────────────────────────────
const PurchasePanel = () => {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo]     = useState(today);

  const run = useCallback(() => {
    setLoading(true);
    reportingApi.getPurchaseReport({ date_from: dateFrom, date_to: dateTo })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { run(); }, [run]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <DateFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onRun={run} loading={loading} />
        {data && <CsvBtn url={reportingApi.csvUrl('purchase', { date_from: dateFrom, date_to: dateTo })} />}
      </div>

      {loading ? <Spin /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <KPI label="Total GRNs"    value={data.total_grns}          color={T.text}   bg={T.accentDim} icon={<Package size={20} color={T.accent} />} />
            <KPI label="Total Value"   value={usd(data.total_value)}    color={T.red}    bg={T.redDim}    icon={<DollarSign size={20} color={T.red} />} />
            <KPI label="Date Range"    value={`${data.date_from} → ${data.date_to}`} color={T.muted} bg={T.bg} icon={<Calendar size={20} color={T.muted} />} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="Top Suppliers by GRN Value">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={(data.by_supplier || []).slice(0, 8)} layout="vertical"
                  margin={{ top: 0, right: 10, bottom: 0, left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="supplier" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={v => usd(v)} />
                  <Bar dataKey="total" name="Value" fill={T.accent} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Supplier Summary">
              <Table
                headers={['Supplier', 'GRNs', 'Total Value']}
                rows={(data.by_supplier || []).slice(0, 8).map(r => [
                  r.supplier,
                  r.count,
                  <strong style={{ color: T.accent }}>{usd(r.total)}</strong>,
                ])}
              />
            </Card>
          </div>

          <Card title={`GRN Details — ${data.total_grns} GRNs`}>
            <Table stickyHeader
              headers={['GRN No', 'Supplier', 'Warehouse', 'Date', 'PO Ref', 'Status', 'Items', 'Total Value']}
              rows={(data.rows || []).map(r => [
                <code style={{ fontSize: 11 }}>{r.grn_number}</code>,
                r.supplier,
                r.warehouse,
                r.received_date,
                r.po_reference || '—',
                r.status,
                r.total_items,
                <strong style={{ color: T.accent }}>{usd(r.total_value)}</strong>,
              ])}
            />
          </Card>
        </>
      )}
    </div>
  );
};

// ── ASSET REGISTER ────────────────────────────────────────────
const AssetRegisterPanel = () => {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [category, setCategory] = useState('');

  const run = useCallback(() => {
    setLoading(true);
    reportingApi.getAssetRegister(category ? { category } : {})
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => { run(); }, [run]);

  const catData = (data?.rows || []).reduce((acc, r) => {
    const existing = acc.find(a => a.name === r.category);
    if (existing) { existing.cost += r.cost; existing.nbv += r.book_value; }
    else acc.push({ name: r.category, cost: r.cost, nbv: r.book_value });
    return acc;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Filter by category…"
            style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }} />
          <button onClick={run} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={12} />{loading ? 'Loading…' : 'Run'}
          </button>
        </div>
        {data && <CsvBtn url={reportingApi.csvUrl('asset-register', category ? { category } : {})} />}
      </div>

      {loading ? <Spin /> : data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            <KPI label="Total Assets"       value={data.asset_count}          color={T.text}   bg={T.accentDim} icon={<Package size={20} color={T.accent} />} />
            <KPI label="Total Cost"         value={usd(data.total_cost)}      color={T.blue}   bg={T.blueDim}   icon={<DollarSign size={20} color={T.blue} />} />
            <KPI label="Accum. Depreciation"value={usd(data.total_accumulated)} color={T.amber} bg={T.amberDim} icon={<TrendingUp size={20} color={T.amber} />} />
            <KPI label="Net Book Value"     value={usd(data.total_nbv)}       color={T.accent} bg={T.accentDim} icon={<BarChart2 size={20} color={T.accent} />} />
          </div>

          <Card title="Cost vs Net Book Value by Category">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={catData} margin={{ top: 5, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: T.muted }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => usd(v)} />
                <Legend />
                <Bar dataKey="cost" name="Cost"          fill={T.blue}   radius={[4,4,0,0]} />
                <Bar dataKey="nbv"  name="Net Book Value" fill={T.accent} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title={`Asset Register — ${data.asset_count} assets`} subtitle={`As of ${data.as_of_date}`}>
            <Table stickyHeader
              headers={['Asset No', 'Name', 'Category', 'Method', 'Status', 'Cost', 'Accum. Depr', 'Net Book Value', 'Depr %', 'In Service']}
              rows={(data.rows || []).map(r => [
                <code style={{ fontSize: 11 }}>{r.asset_number}</code>,
                r.name,
                r.category,
                r.depreciation_method,
                <span style={{ fontSize: 11, background: r.status === 'Active' ? T.greenDim : T.redDim, color: r.status === 'Active' ? T.green : T.red, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{r.status}</span>,
                usd(r.cost),
                <span style={{ color: T.amber }}>{usd(r.accumulated_depreciation)}</span>,
                <strong style={{ color: T.accent }}>{usd(r.book_value)}</strong>,
                <span style={{ color: r.depreciation_pct > 80 ? T.red : T.muted }}>{pct(r.depreciation_pct)}</span>,
                r.in_service_date || '—',
              ])}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Reporting;