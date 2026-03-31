import React, { useState, useEffect } from 'react';
import {
  BookOpen, Building2, Users, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, PlusCircle, CheckCircle, Clock,
  DollarSign, BarChart2, FileText, Shield,
  ThumbsUp, XCircle, CreditCard, Download, RefreshCw,
  ChevronRight, Wrench, Trash2, ArrowUp, AlertTriangle,
  Store, Receipt, Banknote, Send, UserCheck, FileX,
  Activity, Layers, TrendingDown as TDIcon,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
  ComposedChart, Line,
} from 'recharts';
import { financeApi, payrollApi, assetsApi, apApi, arApi } from '../api';

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
  text:      '#1a2e35',
  muted:     '#7a9199',
  border:    '#e2eaed',
};

const pill = (color, bg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 10px', borderRadius: 20,
  background: bg, color: color, fontSize: 11, fontWeight: 600,
});

const usd  = (n) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
const Spin = () => <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 13 }}>Loading…</div>;
const Err  = ({ msg }) => <div style={{ padding: 16, color: T.red, fontSize: 13 }}>⚠ {msg || 'Failed to load data.'}</div>;

const INVOICE_STATUS_COLORS = {
  'Draft':               { color: T.muted,  bg: '#f1f5f9'   },
  'Approved':            { color: T.accent, bg: T.accentDim },
  'Sent':                { color: T.blue,   bg: T.blueDim   },
  'Partially_Collected': { color: T.amber,  bg: T.amberDim  },
  'Collected':           { color: T.green,  bg: T.greenDim  },
  'Cancelled':           { color: T.muted,  bg: '#f1f5f9'   },
};

const BILL_STATUS_COLORS = {
  'Draft':                { color: T.muted,  bg: '#f1f5f9'   },
  'Submitted':            { color: T.amber,  bg: T.amberDim  },
  'Approved_Procurement': { color: T.blue,   bg: T.blueDim   },
  'Approved_Finance':     { color: T.accent, bg: T.accentDim },
  'Partially_Paid':       { color: T.amber,  bg: T.amberDim  },
  'Paid':                 { color: T.green,  bg: T.greenDim  },
  'Rejected':             { color: T.red,    bg: T.redDim    },
};

const PAYROLL_STATUS_COLORS = {
  'Draft':            { color: T.muted,  bg: '#f1f5f9'   },
  'Submitted':        { color: T.amber,  bg: T.amberDim  },
  'Approved_HR':      { color: T.blue,   bg: T.blueDim   },
  'Approved_Finance': { color: T.green,  bg: T.greenDim  },
  'Paid':             { color: T.accent, bg: T.accentDim },
  'Rejected':         { color: T.red,    bg: T.redDim    },
};

const ASSET_STATUS_COLORS = {
  'Active':      { color: T.green, bg: T.greenDim },
  'Disposed':    { color: T.muted, bg: '#f1f5f9'  },
  'Written Off': { color: T.red,   bg: T.redDim   },
  'Idle':        { color: T.amber, bg: T.amberDim },
};

const TABS = [
  { id: 'overview', icon: <BarChart2 size={15} />,       label: 'Overview'       },
  { id: 'gl',       icon: <BookOpen size={15} />,         label: 'General Ledger' },
  { id: 'assets',   icon: <Building2 size={15} />,        label: 'Fixed Assets'   },
  { id: 'payroll',  icon: <Users size={15} />,            label: 'Payroll'        },
  { id: 'ap',       icon: <ArrowDownCircle size={15} />,  label: 'AP'             },
  { id: 'ar',       icon: <ArrowUpCircle size={15} />,    label: 'AR'             },
];

// ── Main Finance Component ─────────────────────────────────────
const Finance = () => {
  const [tab, setTab] = useState('overview');
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Finance Module</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
          General Ledger · Assets · Payroll · AP/AR — double-entry engine
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
      {tab === 'overview' && <OverviewPanel />}
      {tab === 'gl'       && <GLPanel />}
      {tab === 'assets'   && <AssetsPanel />}
      {tab === 'payroll'  && <PayrollPanel />}
      {tab === 'ap'       && <APPanel />}
      {tab === 'ar'       && <ARPanel />}
    </div>
  );
};

// ── EXECUTIVE OVERVIEW ────────────────────────────────────────
const OverviewPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    Promise.all([
      financeApi.getTrialBalance(),
      apApi.getDashboard(),
      apApi.getAging(),
      arApi.getDashboard(),
      arApi.getAging(),
      payrollApi.getRuns(),
      payrollApi.getEmployees({ status: 'Active' }),
      assetsApi.getSummary(),
    ])
      .then(([tbRes, apDashRes, apAgingRes, arDashRes, arAgingRes, runsRes, empRes, assetSumRes]) => {
        setData({
          tb:       tbRes.data,
          apDash:   apDashRes.data,
          apAging:  apAgingRes.data,
          arDash:   arDashRes.data,
          arAging:  arAgingRes.data,
          runs:     runsRes.data.results || runsRes.data,
          employees: empRes.data.results || empRes.data,
          assets:   assetSumRes.data,
        });
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
      <RefreshCw size={28} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>Loading executive dashboard…</p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  if (error) return <Err msg={error} />;

  // ── Derived values ────────────────────────────────────────
  const accounts    = data.tb?.accounts || [];
  const totalAssets = accounts.filter(a => a.account_type === 'Asset').reduce((s, a) => s + parseFloat(a.debit || 0), 0);
  const totalLiab   = accounts.filter(a => a.account_type === 'Liability').reduce((s, a) => s + parseFloat(a.credit || 0), 0);
  const revenue     = accounts.filter(a => a.account_type === 'Revenue').reduce((s, a) => s + parseFloat(a.credit || 0), 0);
  const expenses    = accounts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + parseFloat(a.debit || 0), 0);
  const netIncome   = revenue - expenses;
  const equity      = totalAssets - totalLiab;

  const latestRun   = data.runs[0];
  const lastRunSC   = latestRun ? (PAYROLL_STATUS_COLORS[latestRun.status] || PAYROLL_STATUS_COLORS['Draft']) : null;

  // AP aging chart data
  const apAgingChart = Object.entries(data.apAging?.buckets || {}).map(([key, b]) => ({
    name: key === 'current' ? 'Current' : key === '1_30' ? '1-30d' : key === '31_60' ? '31-60d' : key === '61_90' ? '61-90d' : '90+d',
    value: parseFloat(b.total) || 0,
    fill: key === 'current' ? T.green : key === '1_30' ? T.amber : T.red,
  }));

  // AR aging chart data
  const arAgingChart = Object.entries(data.arAging?.buckets || {}).map(([key, b]) => ({
    name: key === 'current' ? 'Current' : key === '1_30' ? '1-30d' : key === '31_60' ? '31-60d' : key === '61_90' ? '61-90d' : '90+d',
    value: parseFloat(b.total) || 0,
    fill: key === 'current' ? T.green : key === '1_30' ? T.amber : T.red,
  }));

  // AP vs AR comparison
  const apVsArData = [
    { name: 'Total', ap: parseFloat(data.apDash?.total_payable || 0), ar: parseFloat(data.arDash?.total_receivable || 0) },
    { name: 'Overdue', ap: parseFloat(data.apDash?.total_overdue || 0), ar: parseFloat(data.arDash?.total_overdue || 0) },
    { name: 'MTD', ap: parseFloat(data.apDash?.total_paid_mtd || 0), ar: parseFloat(data.arDash?.total_collected_mtd || 0) },
  ];

  // P&L donut data
  const plData = [
    { name: 'Net Income', value: Math.max(0, netIncome), fill: T.green  },
    { name: 'Expenses',   value: expenses,               fill: T.red    },
  ];

  // Balance sheet donut
  const bsData = [
    { name: 'Equity',      value: Math.max(0, equity),  fill: T.accent },
    { name: 'Liabilities', value: totalLiab,             fill: T.red    },
  ];

  // Asset depreciation donut
  const assetDeprData = [
    { name: 'Net Book Value',    value: parseFloat(data.assets?.total_book_value || 0),          fill: T.accent },
    { name: 'Accum. Depr.',      value: parseFloat(data.assets?.total_accumulated_depr || 0),    fill: T.amber  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Row 1: Top KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        {[
          { label: 'Net Income',       value: usd(netIncome),                          color: netIncome >= 0 ? T.green : T.red,  icon: <TrendingUp size={18} />,    bg: T.greenDim  },
          { label: 'Total Receivable', value: usd(data.arDash?.total_receivable),      color: T.blue,    icon: <ArrowUpCircle size={18} />,  bg: T.blueDim   },
          { label: 'Total Payable',    value: usd(data.apDash?.total_payable),         color: T.text,    icon: <ArrowDownCircle size={18} />,bg: T.accentDim },
          { label: 'Active Employees', value: data.employees?.length,                  color: T.text,    icon: <Users size={18} />,          bg: T.accentDim },
          { label: 'Net Book Value',   value: usd(data.assets?.total_book_value),      color: T.accent,  icon: <Building2 size={18} />,      bg: T.accentDim },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: k.color }}>{k.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: k.color }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Alert strip ── */}
      {(data.apDash?.total_overdue > 0 || data.arDash?.total_overdue > 0 || data.apDash?.pending_approval > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {data.apDash?.total_overdue > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.redDim, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: T.red, fontWeight: 600 }}>
              <AlertTriangle size={14} /> AP Overdue: {usd(data.apDash.total_overdue)} ({data.apDash.overdue_bill_count} bills)
            </div>
          )}
          {data.arDash?.total_overdue > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.amberDim, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: T.amber, fontWeight: 600 }}>
              <AlertTriangle size={14} /> AR Overdue: {usd(data.arDash.total_overdue)} ({data.arDash.overdue_count} invoices)
            </div>
          )}
          {data.apDash?.pending_approval > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.blueDim, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: T.blue, fontWeight: 600 }}>
              <Clock size={14} /> {data.apDash.pending_approval} bills pending approval
            </div>
          )}
          {data.arDash?.draft_invoices > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: T.muted, fontWeight: 600 }}>
              <FileText size={14} /> {data.arDash.draft_invoices} draft invoices
            </div>
          )}
        </div>
      )}

      {/* ── Row 3: P&L + Balance Sheet + Asset donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        <Card title="P&L Snapshot">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={plData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                  {plData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {[
                { label: 'Revenue',    value: usd(revenue),  color: T.green  },
                { label: 'Expenses',   value: usd(expenses), color: T.red    },
                { label: 'Net Income', value: usd(netIncome),color: netIncome >= 0 ? T.green : T.red },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                  <span style={{ color: T.muted }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Balance Sheet">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={bsData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                  {bsData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {[
                { label: 'Total Assets',  value: usd(totalAssets), color: T.accent },
                { label: 'Liabilities',   value: usd(totalLiab),   color: T.red    },
                { label: 'Equity',        value: usd(equity),      color: T.green  },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                  <span style={{ color: T.muted }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
              ))}
              <p style={{ fontSize: 10, color: data.tb?.balanced ? T.green : T.red, marginTop: 6 }}>
                {data.tb?.balanced ? '✓ Books balanced' : '⚠ Books imbalanced'}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Fixed Assets">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={assetDeprData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                  {assetDeprData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {[
                { label: 'Active Assets',   value: data.assets?.active_assets,                      color: T.text   },
                { label: 'Total Cost',      value: usd(data.assets?.total_cost),                    color: T.text   },
                { label: 'Net Book Value',  value: usd(data.assets?.total_book_value),              color: T.accent },
                { label: 'Depr. Ratio',     value: `${data.assets?.depreciation_ratio || 0}%`,      color: T.amber  },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                  <span style={{ color: T.muted }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 4: AP vs AR comparison bar chart + Payroll card ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

        <Card title="AP vs AR Comparison" subtitle="Payables vs Receivables">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={apVsArData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip formatter={v => usd(v)} />
              <Bar dataKey="ap" name="AP (Payable)"    fill={T.red}   radius={[4, 4, 0, 0]} />
              <Bar dataKey="ar" name="AR (Receivable)" fill={T.accent} radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            {[{ color: T.red, label: 'AP (Payable)' }, { color: T.accent, label: 'AR (Receivable)' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.muted }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />{l.label}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Payroll">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Active Staff',    value: data.employees?.length || 0,         color: T.text   },
                { label: 'Total Runs',      value: data.runs?.length || 0,              color: T.accent },
              ].map(k => (
                <div key={k.label} style={{ background: T.bg, borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>
            {latestRun && (
              <div style={{ background: T.bg, borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: T.muted, fontWeight: 600 }}>Latest Run</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{latestRun.reference}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{latestRun.period_label}</p>
                  </div>
                  <span style={{ ...pill(lastRunSC.color, lastRunSC.bg) }}>{latestRun.status}</span>
                </div>
                {latestRun.totals && (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: T.muted }}>Gross: <strong style={{ color: T.text }}>{usd(latestRun.totals.total_gross)}</strong></span>
                    <span style={{ color: T.muted }}>Net: <strong style={{ color: T.green }}>{usd(latestRun.totals.total_net)}</strong></span>
                  </div>
                )}
              </div>
            )}
            {!latestRun && <p style={{ color: T.muted, fontSize: 12 }}>No payroll runs yet.</p>}
          </div>
        </Card>
      </div>

      {/* ── Row 5: AP Aging + AR Aging bar charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        <Card title="AP Aging Breakdown" subtitle="Outstanding bills by age">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={apAgingChart} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => usd(v)} />
              <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                {apAgingChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.muted }}>Grand Total</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.red }}>{usd(data.apAging?.grand_total)}</span>
          </div>
        </Card>

        <Card title="AR Aging Breakdown" subtitle="Outstanding invoices by age">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={arAgingChart} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => usd(v)} />
              <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                {arAgingChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, color: T.muted }}>Grand Total</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>{usd(data.arAging?.grand_total)}</span>
          </div>
        </Card>
      </div>

      {/* ── Row 6: AP/AR KPI details ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        <Card title="Accounts Payable" subtitle="This month">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Total Payable',    value: usd(data.apDash?.total_payable),      color: T.text   },
              { label: 'Overdue',          value: usd(data.apDash?.total_overdue),       color: T.red    },
              { label: 'Paid MTD',         value: usd(data.apDash?.total_paid_mtd),      color: T.green  },
              { label: 'Billed MTD',       value: usd(data.apDash?.total_billed_mtd),    color: T.text   },
              { label: 'Active Vendors',   value: data.apDash?.active_vendors,           color: T.accent },
              { label: 'Pending Approval', value: data.apDash?.pending_approval,         color: T.amber  },
            ].map(k => (
              <div key={k.label} style={{ background: T.bg, borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Accounts Receivable" subtitle="This month">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Total Receivable',  value: usd(data.arDash?.total_receivable),    color: T.text   },
              { label: 'Overdue',           value: usd(data.arDash?.total_overdue),        color: T.red    },
              { label: 'Collected MTD',     value: usd(data.arDash?.total_collected_mtd),  color: T.green  },
              { label: 'Invoiced MTD',      value: usd(data.arDash?.total_invoiced_mtd),   color: T.text   },
              { label: 'Active Customers',  value: data.arDash?.active_customers,          color: T.accent },
              { label: `DSO`,               value: `${data.arDash?.dso_days || 0} days`,   color: T.amber  },
            ].map(k => (
              <div key={k.label} style={{ background: T.bg, borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
};

// ── GENERAL LEDGER ─────────────────────────────────────────────
const GLPanel = () => {
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ desc: '', debit: '', credit: '', amount: '' });
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([financeApi.getAccounts(), financeApi.getJournalEntries()])
      .then(([accRes, jeRes]) => {
        setAccounts(accRes.data.results || accRes.data);
        setEntries(jeRes.data.results   || jeRes.data);
      })
      .catch(() => setErr('Failed to load GL data.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!form.desc || !form.debit || !form.credit || !form.amount) return setErr('All fields required.');
    if (form.debit === form.credit) return setErr('Debit and Credit accounts must differ.');
    const debitAccount  = accounts.find(a => a.code === form.debit);
    const creditAccount = accounts.find(a => a.code === form.credit);
    if (!debitAccount)  return setErr(`Account code "${form.debit}" not found.`);
    if (!creditAccount) return setErr(`Account code "${form.credit}" not found.`);
    setErr(''); setSubmitting(true);
    try {
      const res = await financeApi.createJournalEntry({
        date: new Date().toISOString().split('T')[0],
        description: form.desc, source: 'Manual',
        lines: [
          { account: debitAccount.id,  debit: parseFloat(form.amount), credit: 0 },
          { account: creditAccount.id, debit: 0, credit: parseFloat(form.amount) },
        ],
      });
      await financeApi.postJournalEntry(res.data.id);
      const updated = await financeApi.getJournalEntries();
      setEntries(updated.data.results || updated.data);
      setForm({ desc: '', debit: '', credit: '', amount: '' });
      setShowForm(false);
    } catch (e) {
      setErr(e.response?.data?.detail || 'Failed to create entry.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <Spin />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ ...pill(T.green, T.greenDim) }}><CheckCircle size={12} /> Ledger Balanced — enforced by backend</div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <PlusCircle size={14} /> New Journal Entry
        </button>
      </div>
      {showForm && (
        <Card title="New Double-Entry Journal">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
            {[{ key: 'desc', placeholder: 'Description', type: 'text' }, { key: 'debit', placeholder: 'Debit Acct code', type: 'text' }, { key: 'credit', placeholder: 'Credit Acct code', type: 'text' }, { key: 'amount', placeholder: 'Amount (KES)', type: 'number' }].map(f => (
              <input key={f.key} type={f.type} placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none', color: T.text }} />
            ))}
          </div>
          {err && <p style={{ color: T.red, fontSize: 11, marginTop: 6 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={submit} disabled={submitting} style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Posting…' : 'Post Entry'}</button>
            <button onClick={() => setShowForm(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </Card>
      )}
      <Card title="Chart of Accounts">
        <Table headers={['Code', 'Account Name', 'Type', 'Balance']} rows={accounts.map(a => [<code style={{ fontSize: 11, color: T.muted }}>{a.code}</code>, a.name, <span style={{ ...pill(a.account_type === 'Asset' ? T.accent : a.account_type === 'Revenue' ? T.green : a.account_type === 'Expense' ? T.red : T.amber, a.account_type === 'Asset' ? T.accentDim : a.account_type === 'Revenue' ? T.greenDim : a.account_type === 'Expense' ? T.redDim : T.amberDim) }}>{a.account_type}</span>, <strong>{usd(Math.abs(a.balance || 0))}</strong>])} />
      </Card>
      <Card title="Journal Entries">
        <Table headers={['Reference', 'Date', 'Description', 'Source', 'Status']} rows={entries.map(e => [<code style={{ fontSize: 11 }}>{e.reference}</code>, e.date, e.description, <span style={{ ...pill(e.source === 'Manual' ? T.muted : T.blue, e.source === 'Manual' ? '#f1f5f9' : T.blueDim) }}>{e.source}</span>, <span style={{ ...pill(e.status === 'Posted' ? T.green : T.amber, e.status === 'Posted' ? T.greenDim : T.amberDim) }}>{e.status}</span>])} />
      </Card>
    </div>
  );
};

// ── FIXED ASSETS ──────────────────────────────────────────────
const AssetsPanel = () => {
  const [summary, setSummary]   = useState(null);
  const [assets, setAssets]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [showMaintForm, setShowMaintForm]     = useState(false);
  const [showDisposeForm, setShowDisposeForm] = useState(false);
  const [showRevalueForm, setShowRevalueForm] = useState(false);
  const [maintForm, setMaintForm]     = useState({ maintenance_type: 'Preventive', date: '', description: '', cost: '', vendor: '', performed_by: '' });
  const [disposeForm, setDisposeForm] = useState({ disposal_method: 'Sale', proceeds: '', disposal_date: '', notes: '' });
  const [revalueForm, setRevalueForm] = useState({ new_cost: '', reason: '' });

  const load = () => {
    setLoading(true);
    Promise.all([assetsApi.getSummary(), assetsApi.getAssets()])
      .then(([sumRes, assetsRes]) => { setSummary(sumRes.data); setAssets(assetsRes.data.results || assetsRes.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const selectAsset = async (asset) => {
    setSelected(asset); setSchedule([]); setMaintenance([]); setMsg(''); setErr('');
    const [schedRes, maintRes] = await Promise.all([assetsApi.getSchedule(asset.id), assetsApi.getMaintenance(asset.id)]);
    setSchedule(schedRes.data.schedule || []);
    setMaintenance(maintRes.data.results || maintRes.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setErr(''); setMsg('');
    try {
      const res = await fn();
      setMsg(res.data.detail || 'Done.');
      load();
      if (selected) {
        const updated = await assetsApi.getAsset(selected.id);
        setSelected(updated.data);
        const [schedRes, maintRes] = await Promise.all([assetsApi.getSchedule(selected.id), assetsApi.getMaintenance(selected.id)]);
        setSchedule(schedRes.data.schedule || []);
        setMaintenance(maintRes.data.results || maintRes.data);
      }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const sc = selected ? (ASSET_STATUS_COLORS[selected.status] || ASSET_STATUS_COLORS['Active']) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[{ label: 'Active Assets', value: summary.active_assets, color: T.text }, { label: 'Total Cost', value: usd(summary.total_cost), color: T.text }, { label: 'Net Book Value', value: usd(summary.total_book_value), color: T.accent }, { label: 'Depreciation Ratio', value: `${summary.depreciation_ratio}%`, color: T.amber }].map(k => (
            <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
              <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {msg && <div style={{ padding: '8px 14px', background: T.greenDim, borderRadius: 8, fontSize: 12, color: T.green }}>{msg}</div>}
        {err && <div style={{ padding: '8px 14px', background: T.redDim, borderRadius: 8, fontSize: 12, color: T.red }}>{err}</div>}
        <button onClick={() => action('Depreciate All', () => assetsApi.depreciateAll())} disabled={actionLoading === 'Depreciate All'} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: T.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={13} /> {actionLoading === 'Depreciate All' ? 'Running…' : 'Run Monthly Depreciation (All)'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title={`Asset Register (${assets.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
            {assets.map(a => {
              const asc = ASSET_STATUS_COLORS[a.status] || ASSET_STATUS_COLORS['Active'];
              return (
                <div key={a.id} onClick={() => selectAsset(a)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, background: selected?.id === a.id ? T.accentDim : T.bg, border: `1px solid ${selected?.id === a.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 11 }}>{a.asset_number}</strong><span style={{ ...pill(asc.color, asc.bg), fontSize: 10 }}>{a.status}</span></div>
                  <p style={{ margin: '2px 0 0', color: T.text, fontSize: 12, fontWeight: 500 }}>{a.name}</p>
                  <p style={{ margin: '2px 0 0', color: T.muted, fontSize: 11 }}>{a.category_name} · {a.depreciation_method}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: T.muted }}>Book: {usd(a.book_value)}</span>
                    <span style={{ fontSize: 10, color: T.amber }}>{a.depreciation_percentage}% depr.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${selected.asset_number} — ${selected.name}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ ...pill(sc.color, sc.bg) }}>{selected.status}</span>
                <span style={{ ...pill(T.blue, T.blueDim) }}>{selected.depreciation_method}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{selected.category_name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[{ label: 'Cost', value: usd(selected.cost), color: T.text }, { label: 'Accumulated', value: usd(selected.accumulated_depreciation), color: T.red }, { label: 'Book Value', value: usd(selected.book_value), color: T.accent }, { label: 'Salvage', value: usd(selected.salvage_value), color: T.muted }, { label: 'Useful Life', value: `${selected.useful_life_months} months`, color: T.text }, { label: 'Remaining', value: `${selected.remaining_life_months} mo`, color: T.amber }].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}><p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p><p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p></div>
                ))}
              </div>
              {selected.status === 'Active' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <WfButton label="Depreciate" icon={<RefreshCw size={13} />} color={T.blue} loading={actionLoading === 'Depreciate'} onClick={() => action('Depreciate', () => assetsApi.depreciateOne(selected.id))} />
                  <WfButton label="Log Maintenance" icon={<Wrench size={13} />} color={T.amber} onClick={() => setShowMaintForm(!showMaintForm)} />
                  <WfButton label="Dispose Asset" icon={<Trash2 size={13} />} color={T.red} onClick={() => setShowDisposeForm(!showDisposeForm)} />
                  <WfButton label="Revalue Asset" icon={<ArrowUp size={13} />} color={T.accent} onClick={() => setShowRevalueForm(!showRevalueForm)} />
                </div>
              )}
              {showMaintForm && (
                <div style={{ marginTop: 12, background: T.amberDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.amber }}>Log Maintenance</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[{ key: 'date', placeholder: 'Date (YYYY-MM-DD)', type: 'text' }, { key: 'cost', placeholder: 'Cost (KES)', type: 'number' }, { key: 'vendor', placeholder: 'Vendor', type: 'text' }, { key: 'performed_by', placeholder: 'Performed by', type: 'text' }].map(f => (
                      <input key={f.key} type={f.type} placeholder={f.placeholder} value={maintForm[f.key]} onChange={e => setMaintForm({ ...maintForm, [f.key]: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    ))}
                    <select value={maintForm.maintenance_type} onChange={e => setMaintForm({ ...maintForm, maintenance_type: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>{['Preventive', 'Corrective', 'Inspection', 'Upgrade'].map(t => <option key={t}>{t}</option>)}</select>
                    <input type="text" placeholder="Description" value={maintForm.description} onChange={e => setMaintForm({ ...maintForm, description: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => action('Log Maintenance', () => assetsApi.addMaintenance(selected.id, maintForm)).then(() => setShowMaintForm(false))} style={{ background: T.amber, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setShowMaintForm(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {showDisposeForm && (
                <div style={{ marginTop: 12, background: T.redDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.red }}>Dispose Asset</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select value={disposeForm.disposal_method} onChange={e => setDisposeForm({ ...disposeForm, disposal_method: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>{['Sale', 'Scrap', 'Donation', 'Trade-In', 'Theft/Loss'].map(t => <option key={t}>{t}</option>)}</select>
                    <input type="text" placeholder="Disposal Date" value={disposeForm.disposal_date} onChange={e => setDisposeForm({ ...disposeForm, disposal_date: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="number" placeholder="Proceeds (KES)" value={disposeForm.proceeds} onChange={e => setDisposeForm({ ...disposeForm, proceeds: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Notes" value={disposeForm.notes} onChange={e => setDisposeForm({ ...disposeForm, notes: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => { action('Dispose', () => assetsApi.dispose(selected.id, { ...disposeForm, proceeds: parseFloat(disposeForm.proceeds) || 0 })); setShowDisposeForm(false); }} style={{ background: T.red, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Confirm</button>
                    <button onClick={() => setShowDisposeForm(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {showRevalueForm && (
                <div style={{ marginTop: 12, background: T.accentDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.accent }}>Revalue Asset</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input type="number" placeholder="New Cost (KES)" value={revalueForm.new_cost} onChange={e => setRevalueForm({ ...revalueForm, new_cost: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Reason" value={revalueForm.reason} onChange={e => setRevalueForm({ ...revalueForm, reason: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => { action('Revalue', () => assetsApi.revalue(selected.id, { new_cost: parseFloat(revalueForm.new_cost), reason: revalueForm.reason })); setShowRevalueForm(false); }} style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Confirm</button>
                    <button onClick={() => setShowRevalueForm(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </Card>
            {schedule.length > 0 && (
              <Card title={`Depreciation Schedule (${schedule.length} periods remaining)`}>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <Table headers={['Period', 'Depreciation', 'Accumulated', 'Book Value']} rows={schedule.slice(0, 24).map(s => [s.period, <span style={{ color: T.red }}>{usd(s.depreciation)}</span>, usd(s.accumulated_depreciation), <strong style={{ color: T.accent }}>{usd(s.book_value)}</strong>])} />
                </div>
              </Card>
            )}
            {maintenance.length > 0 && (
              <Card title={`Maintenance Log (${maintenance.length} entries)`}>
                <Table headers={['Date', 'Type', 'Description', 'Cost', 'Vendor']} rows={maintenance.map(m => [m.date, <span style={{ ...pill(T.amber, T.amberDim) }}>{m.maintenance_type}</span>, m.description, <span style={{ color: T.red }}>{usd(m.cost)}</span>, m.vendor || '—'])} />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select an asset"><p style={{ color: T.muted, fontSize: 13 }}>Click an asset on the left to view details.</p></Card>
        )}
      </div>
    </div>
  );
};

// ── PAYROLL ───────────────────────────────────────────────────
const PayrollPanel = () => {
  const [runs, setRuns]           = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [summary, setSummary]     = useState(null);
  const [payslips, setPayslips]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showNewRun, setShowNewRun] = useState(false);
  const [newRun, setNewRun]       = useState({ period_year: 2026, period_month: new Date().getMonth() + 1, description: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [msg, setMsg]             = useState('');
  const [err, setErr]             = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([payrollApi.getRuns(), payrollApi.getEmployees({ status: 'Active' })])
      .then(([runsRes, empRes]) => { setRuns(runsRes.data.results || runsRes.data); setEmployees(empRes.data.results || empRes.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const selectRun = async (run) => {
    setSelectedRun(run); setSummary(null); setPayslips([]);
    if (run.status !== 'Draft') {
      const [sumRes, psRes] = await Promise.all([payrollApi.getSummary(run.id), payrollApi.getPayslips(run.id)]);
      setSummary(sumRes.data); setPayslips(psRes.data.results || psRes.data);
    }
  };

  const action = async (label, fn) => {
    setActionLoading(label); setErr(''); setMsg('');
    try {
      const res = await fn();
      setMsg(res.data.detail || 'Done.');
      load();
      if (selectedRun) {
        const updated = await payrollApi.getRun(selectedRun.id);
        setSelectedRun(updated.data);
        if (updated.data.status !== 'Draft') {
          const [sumRes, psRes] = await Promise.all([payrollApi.getSummary(selectedRun.id), payrollApi.getPayslips(selectedRun.id)]);
          setSummary(sumRes.data); setPayslips(psRes.data.results || psRes.data);
        }
      }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  const createRun = async () => { await action('Creating run', () => payrollApi.createRun(newRun)); setShowNewRun(false); };
  if (loading) return <Spin />;
  const statusInfo = selectedRun ? (PAYROLL_STATUS_COLORS[selectedRun.status] || PAYROLL_STATUS_COLORS['Draft']) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[{ label: 'Active Employees', value: employees.length, color: T.text }, { label: 'Payroll Runs', value: runs.length, color: T.accent }, { label: 'Latest Status', value: runs[0]?.status || '—', color: T.amber }].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
            <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>
      {msg && <div style={{ padding: '10px 14px', background: T.greenDim, borderRadius: 8, fontSize: 13, color: T.green }}>{msg}</div>}
      {err && <div style={{ padding: '10px 14px', background: T.redDim, borderRadius: 8, fontSize: 13, color: T.red }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title="Payroll Runs">
          <button onClick={() => setShowNewRun(!showNewRun)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}><PlusCircle size={13} /> New Run</button>
          {showNewRun && (
            <div style={{ background: T.bg, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="number" placeholder="Year" value={newRun.period_year} onChange={e => setNewRun({ ...newRun, period_year: parseInt(e.target.value) })} style={{ width: 70, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
                <input type="number" placeholder="Month" min="1" max="12" value={newRun.period_month} onChange={e => setNewRun({ ...newRun, period_month: parseInt(e.target.value) })} style={{ width: 60, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
              </div>
              <input type="text" placeholder="Description" value={newRun.description} onChange={e => setNewRun({ ...newRun, description: e.target.value })} style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 8px', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
              <button onClick={createRun} style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Create</button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {runs.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No runs yet.</p>}
            {runs.map(r => {
              const sc = PAYROLL_STATUS_COLORS[r.status] || PAYROLL_STATUS_COLORS['Draft'];
              return (
                <div key={r.id} onClick={() => selectRun(r)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, background: selectedRun?.id === r.id ? T.accentDim : T.bg, border: `1px solid ${selectedRun?.id === r.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>{r.reference}</strong><span style={{ ...pill(sc.color, sc.bg), fontSize: 10 }}>{r.status}</span></div>
                  <p style={{ margin: '2px 0 0', color: T.muted, fontSize: 11 }}>{r.period_label}</p>
                </div>
              );
            })}
          </div>
        </Card>
        {selectedRun ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${selectedRun.reference} — ${selectedRun.period_label}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ ...pill(statusInfo.color, statusInfo.bg) }}>{selectedRun.status}</span>
                {selectedRun.rejection_reason && <span style={{ fontSize: 11, color: T.red }}>Reason: {selectedRun.rejection_reason}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedRun.status === 'Draft' && (<><WfButton label="Calculate Payslips" icon={<RefreshCw size={13} />} color={T.blue} loading={actionLoading === 'Calculate Payslips'} onClick={() => action('Calculate Payslips', () => payrollApi.calculateRun(selectedRun.id))} /><WfButton label="Submit for HR" icon={<ChevronRight size={13} />} color={T.amber} loading={actionLoading === 'Submit for HR'} onClick={() => action('Submit for HR', () => payrollApi.submitRun(selectedRun.id))} /></>)}
                {selectedRun.status === 'Submitted' && (<><WfButton label="HR Approve" icon={<ThumbsUp size={13} />} color={T.green} loading={actionLoading === 'HR Approve'} onClick={() => action('HR Approve', () => payrollApi.approveHR(selectedRun.id))} /><WfButton label="Reject" icon={<XCircle size={13} />} color={T.red} onClick={() => setShowReject(true)} /></>)}
                {selectedRun.status === 'Approved_HR' && (<><WfButton label="Finance Approve + Post GL" icon={<ThumbsUp size={13} />} color={T.accent} loading={actionLoading === 'Finance Approve + Post GL'} onClick={() => action('Finance Approve + Post GL', () => payrollApi.approveFinance(selectedRun.id))} /><WfButton label="Reject" icon={<XCircle size={13} />} color={T.red} onClick={() => setShowReject(true)} /></>)}
                {selectedRun.status === 'Approved_Finance' && (<WfButton label="Mark as Paid" icon={<CreditCard size={13} />} color={T.green} loading={actionLoading === 'Mark as Paid'} onClick={() => action('Mark as Paid', () => payrollApi.markPaid(selectedRun.id))} />)}
              </div>
              {showReject && (
                <div style={{ marginTop: 12, background: T.redDim, borderRadius: 10, padding: 12 }}>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required)" style={{ width: '100%', border: `1px solid ${T.red}`, borderRadius: 6, padding: 8, fontSize: 12, resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => { action('Reject', () => payrollApi.rejectRun(selectedRun.id, rejectReason)); setShowReject(false); setRejectReason(''); }} style={{ background: T.red, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Confirm</button>
                    <button onClick={() => setShowReject(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {['Approved_Finance', 'Paid'].includes(selectedRun.status) && (
                <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[{ label: 'Payment File', url: payrollApi.paymentFileUrl(selectedRun.id) }, { label: 'KRA P10', url: payrollApi.p10Url(selectedRun.id) }, { label: 'NSSF', url: payrollApi.nssfUrl(selectedRun.id) }, { label: 'SHIF', url: payrollApi.shifUrl(selectedRun.id) }, { label: 'Housing Levy', url: payrollApi.housingLevyUrl(selectedRun.id) }].map(d => (
                    <a key={d.label} href={d.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.accentDim, color: T.accent, borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}><Download size={12} />{d.label}</a>
                  ))}
                </div>
              )}
            </Card>
            {summary && (
              <Card title="Payroll Cost Summary">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[{ label: 'Total Gross', value: usd(summary.total_gross), color: T.text }, { label: 'Total PAYE', value: usd(summary.kra_paye_due), color: T.red }, { label: 'Total NSSF', value: usd(summary.nssf_due), color: T.amber }, { label: 'Total SHIF', value: usd(summary.shif_due), color: T.amber }, { label: 'Housing Levy', value: usd(summary.housing_levy_due), color: T.amber }, { label: 'Total Net Pay', value: usd(summary.total_net_pay), color: T.green }, { label: 'Employer NSSF', value: usd(summary.employer_nssf), color: T.blue }, { label: 'Employer Housing', value: usd(summary.employer_housing), color: T.blue }, { label: 'Total CTC', value: usd(summary.total_ctc), color: T.accent }].map(k => (
                    <div key={k.label} style={{ background: T.bg, borderRadius: 10, padding: '10px 14px' }}><p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p><p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: k.color }}>{k.value}</p></div>
                  ))}
                </div>
              </Card>
            )}
            {payslips.length > 0 && (
              <Card title={`Payslips (${payslips.length} employees)`}>
                <Table headers={['Employee', 'Dept', 'Gross', 'PAYE', 'NSSF', 'SHIF', 'Housing', 'Net Pay']} rows={payslips.map(p => [p.employee_name, p.department || '—', usd(p.gross_salary), <span style={{ color: T.red }}>{usd(p.paye)}</span>, usd(p.nssf_total), usd(p.shif), usd(p.housing_levy), <strong style={{ color: T.green }}>{usd(p.net_pay)}</strong>])} />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a payroll run"><p style={{ color: T.muted, fontSize: 13 }}>Click a run on the left to view details.</p></Card>
        )}
      </div>
    </div>
  );
};

// ── ACCOUNTS PAYABLE ──────────────────────────────────────────
const APPanel = () => {
  const [dashboard, setDashboard]   = useState(null);
  const [aging, setAging]           = useState(null);
  const [vendors, setVendors]       = useState([]);
  const [bills, setBills]           = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billDetail, setBillDetail] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]               = useState('');
  const [err, setErr]               = useState('');
  const [activeView, setActiveView] = useState('bills');
  const [showReject, setShowReject] = useState(false);
  const [showPay, setShowPay]       = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [payForm, setPayForm]       = useState({ amount: '', payment_method: 'Bank Transfer', payment_date: new Date().toISOString().split('T')[0], reference: '', apply_early_discount: false });
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([apApi.getDashboard(), apApi.getAging(), apApi.getVendors(), apApi.getBills(statusFilter ? { status: statusFilter } : {})])
      .then(([dashRes, agingRes, vendorsRes, billsRes]) => { setDashboard(dashRes.data); setAging(agingRes.data); setVendors(vendorsRes.data.results || vendorsRes.data); setBills(billsRes.data.results || billsRes.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const selectBill = async (bill) => { setSelectedBill(bill); setBillDetail(null); setMsg(''); setErr(''); const res = await apApi.getBill(bill.id); setBillDetail(res.data); };
  const action = async (label, fn) => {
    setActionLoading(label); setErr(''); setMsg('');
    try { const res = await fn(); setMsg(res.data.detail || 'Done.'); load(); if (selectedBill) { const updated = await apApi.getBill(selectedBill.id); setSelectedBill(updated.data); setBillDetail(updated.data); } }
    catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const billSC = selectedBill ? (BILL_STATUS_COLORS[selectedBill.status] || BILL_STATUS_COLORS['Draft']) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[{ label: 'Total Payable', value: usd(dashboard.total_payable), color: T.text, icon: <Banknote size={20} color={T.accent} />, bg: T.accentDim }, { label: 'Overdue', value: usd(dashboard.total_overdue), color: T.red, icon: <AlertTriangle size={20} color={T.red} />, bg: T.redDim }, { label: 'Paid This Month', value: usd(dashboard.total_paid_mtd), color: T.green, icon: <CheckCircle size={20} color={T.green} />, bg: T.greenDim }, { label: 'Pending Approval', value: dashboard.pending_approval, color: T.amber, icon: <Clock size={20} color={T.amber} />, bg: T.amberDim }].map(k => (
            <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
              <div><p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</p><p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p></div>
            </div>
          ))}
        </div>
      )}
      {msg && <div style={{ padding: '10px 14px', background: T.greenDim, borderRadius: 8, fontSize: 13, color: T.green }}>{msg}</div>}
      {err && <div style={{ padding: '10px 14px', background: T.redDim, borderRadius: 8, fontSize: 13, color: T.red }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: 'bills', label: 'Bills', icon: <Receipt size={13} /> }, { id: 'vendors', label: 'Vendors', icon: <Store size={13} /> }, { id: 'aging', label: 'Aging', icon: <Clock size={13} /> }].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: activeView === v.id ? T.accent : T.card, color: activeView === v.id ? '#fff' : T.muted, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>{v.icon}{v.label}</button>
        ))}
        {activeView === 'bills' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ marginLeft: 'auto', border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
            <option value="">All Statuses</option>
            {['Draft', 'Submitted', 'Approved_Procurement', 'Approved_Finance', 'Partially_Paid', 'Paid', 'Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      {activeView === 'bills' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Card title={`Bills (${bills.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
              {bills.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No bills found.</p>}
              {bills.map(b => {
                const bsc = BILL_STATUS_COLORS[b.status] || BILL_STATUS_COLORS['Draft'];
                return (
                  <div key={b.id} onClick={() => selectBill(b)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, background: selectedBill?.id === b.id ? T.accentDim : T.bg, border: `1px solid ${selectedBill?.id === b.id ? T.accent : b.is_overdue ? T.red : T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 11 }}>{b.bill_number}</strong><span style={{ ...pill(bsc.color, bsc.bg), fontSize: 10 }}>{b.status}</span></div>
                    <p style={{ margin: '2px 0 0', color: T.text, fontSize: 12, fontWeight: 500 }}>{b.vendor_name}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={{ fontSize: 11, color: T.muted }}>Due: {b.due_date}</span><span style={{ fontSize: 11, fontWeight: 700, color: b.is_overdue ? T.red : T.text }}>{usd(b.balance_due)}</span></div>
                    {b.is_overdue && <span style={{ fontSize: 10, color: T.red }}>{b.days_overdue} days overdue</span>}
                  </div>
                );
              })}
            </div>
          </Card>
          {selectedBill && billDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Card title={`${billDetail.bill_number} — ${billDetail.vendor_name}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ ...pill(billSC.color, billSC.bg) }}>{billDetail.status}</span>
                  {billDetail.wht_category !== 'None' && <span style={{ ...pill(T.amber, T.amberDim) }}>WHT: {billDetail.wht_category}</span>}
                  {billDetail.is_overdue && <span style={{ ...pill(T.red, T.redDim) }}>{billDetail.days_overdue} days overdue</span>}
                  {billDetail.early_payment_discount > 0 && <span style={{ ...pill(T.green, T.greenDim) }}>Early discount: {usd(billDetail.early_payment_discount)}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                  {[{ label: 'Subtotal', value: usd(billDetail.subtotal), color: T.text }, { label: 'VAT', value: usd(billDetail.vat_amount), color: T.blue }, { label: 'WHT', value: usd(billDetail.wht_amount), color: T.amber }, { label: 'Total', value: usd(billDetail.total_amount), color: T.text }, { label: 'Paid', value: usd(billDetail.amount_paid), color: T.green }, { label: 'Balance Due', value: usd(billDetail.balance_due), color: T.red }].map(k => (
                    <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}><p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p><p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p></div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {billDetail.status === 'Draft' && <WfButton label="Submit for Procurement" icon={<ChevronRight size={13} />} color={T.amber} loading={actionLoading === 'Submit'} onClick={() => action('Submit', () => apApi.submitBill(billDetail.id))} />}
                  {billDetail.status === 'Submitted' && (<><WfButton label="Procurement Approve" icon={<ThumbsUp size={13} />} color={T.blue} loading={actionLoading === 'Procurement Approve'} onClick={() => action('Procurement Approve', () => apApi.approveProcurement(billDetail.id))} /><WfButton label="Reject" icon={<XCircle size={13} />} color={T.red} onClick={() => setShowReject(true)} /></>)}
                  {billDetail.status === 'Approved_Procurement' && (<><WfButton label="Finance Approve + Post GL" icon={<ThumbsUp size={13} />} color={T.accent} loading={actionLoading === 'Finance Approve'} onClick={() => action('Finance Approve', () => apApi.approveFinance(billDetail.id))} /><WfButton label="Reject" icon={<XCircle size={13} />} color={T.red} onClick={() => setShowReject(true)} /></>)}
                  {['Approved_Finance', 'Partially_Paid'].includes(billDetail.status) && <WfButton label="Record Payment" icon={<Banknote size={13} />} color={T.green} onClick={() => setShowPay(true)} />}
                </div>
                {showReject && (
                  <div style={{ marginTop: 12, background: T.redDim, borderRadius: 10, padding: 12 }}>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required)" style={{ width: '100%', border: `1px solid ${T.red}`, borderRadius: 6, padding: 8, fontSize: 12, resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => { action('Reject', () => apApi.rejectBill(billDetail.id, rejectReason)); setShowReject(false); setRejectReason(''); }} style={{ background: T.red, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Confirm</button>
                      <button onClick={() => setShowReject(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
                {showPay && (
                  <div style={{ marginTop: 12, background: T.greenDim, borderRadius: 10, padding: 14 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.green }}>Record Payment (Balance: {usd(billDetail.balance_due)})</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input type="number" placeholder="Amount (KES)" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                      <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>{['Bank Transfer', 'Cheque', 'M-Pesa', 'Cash'].map(m => <option key={m}>{m}</option>)}</select>
                      <input type="text" placeholder="Payment Date (YYYY-MM-DD)" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                      <input type="text" placeholder="Reference" value={payForm.reference} onChange={e => setPayForm({ ...payForm, reference: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    </div>
                    {billDetail.early_payment_discount > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: T.green, cursor: 'pointer' }}>
                        <input type="checkbox" checked={payForm.apply_early_discount} onChange={e => setPayForm({ ...payForm, apply_early_discount: e.target.checked })} />
                        Apply early payment discount ({usd(billDetail.early_payment_discount)})
                      </label>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => { action('Pay', () => apApi.payBill(billDetail.id, { ...payForm, amount: parseFloat(payForm.amount) })); setShowPay(false); }} style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Confirm Payment</button>
                      <button onClick={() => setShowPay(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </Card>
              {billDetail.lines?.length > 0 && (
                <Card title="Bill Line Items">
                  <Table headers={['Description', 'Qty', 'Unit Price', 'VAT %', 'Line Total']} rows={billDetail.lines.map(l => [l.description, l.quantity, usd(l.unit_price), `${l.vat_rate}%`, <strong>{usd(l.line_total)}</strong>])} />
                </Card>
              )}
            </div>
          ) : (
            <Card title="Select a bill"><p style={{ color: T.muted, fontSize: 13 }}>Click a bill on the left to view details and manage the approval workflow.</p></Card>
          )}
        </div>
      )}
      {activeView === 'vendors' && (
        <Card title={`Vendors (${vendors.length})`}>
          <Table headers={['Vendor No.', 'Name', 'Type', 'WHT Category', 'Credit Limit', 'Outstanding', 'Status']} rows={vendors.map(v => [<code style={{ fontSize: 11 }}>{v.vendor_number}</code>, v.name, v.vendor_type, v.wht_category === 'None' ? '—' : <span style={{ ...pill(T.amber, T.amberDim) }}>{v.wht_category}</span>, v.credit_limit > 0 ? usd(v.credit_limit) : 'No limit', <span style={{ color: v.is_over_credit_limit ? T.red : T.text, fontWeight: 600 }}>{usd(v.outstanding_balance)}{v.is_over_credit_limit && ' ⚠'}</span>, <span style={{ ...pill(v.status === 'Active' ? T.green : T.red, v.status === 'Active' ? T.greenDim : T.redDim) }}>{v.status}</span>])} />
        </Card>
      )}
      {activeView === 'aging' && aging && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {Object.entries(aging.buckets).map(([key, bucket]) => (
              <div key={key} style={{ background: T.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', borderTop: `3px solid ${key === 'current' ? T.green : key === '1_30' ? T.amber : T.red}` }}>
                <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{bucket.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: key === 'current' ? T.green : key === '1_30' ? T.amber : T.red }}>{usd(bucket.total)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{bucket.bills.length} bills</p>
              </div>
            ))}
          </div>
          {Object.entries(aging.buckets).filter(([, b]) => b.bills.length > 0).map(([key, bucket]) => (
            <Card key={key} title={bucket.label}>
              <Table headers={['Bill No.', 'Vendor', 'Bill Date', 'Due Date', 'Days Overdue', 'Balance']} rows={bucket.bills.map(b => [<code style={{ fontSize: 11 }}>{b.bill_number}</code>, b.vendor, b.bill_date, b.due_date, b.days_overdue > 0 ? <span style={{ color: T.red, fontWeight: 600 }}>{b.days_overdue} days</span> : '—', <strong style={{ color: T.red }}>{usd(b.balance_due)}</strong>])} />
            </Card>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Grand Total: {usd(aging.grand_total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── ACCOUNTS RECEIVABLE ───────────────────────────────────────
const ARPanel = () => {
  const [dashboard, setDashboard]   = useState(null);
  const [aging, setAging]           = useState(null);
  const [customers, setCustomers]   = useState([]);
  const [invoices, setInvoices]     = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetail, setInvoiceDetail]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]               = useState('');
  const [err, setErr]               = useState('');
  const [activeView, setActiveView] = useState('invoices');
  const [showCollect, setShowCollect]     = useState(false);
  const [showCreditNote, setShowCreditNote] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', payment_method: 'Bank Transfer', receipt_date: new Date().toISOString().split('T')[0], reference: '', apply_early_discount: false });
  const [creditNoteForm, setCreditNoteForm] = useState({ amount: '', reason: '' });
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([arApi.getDashboard(), arApi.getAging(), arApi.getCustomers(), arApi.getInvoices(statusFilter ? { status: statusFilter } : {})])
      .then(([dashRes, agingRes, custRes, invRes]) => { setDashboard(dashRes.data); setAging(agingRes.data); setCustomers(custRes.data.results || custRes.data); setInvoices(invRes.data.results || invRes.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const selectInvoice = async (inv) => { setSelectedInvoice(inv); setInvoiceDetail(null); setMsg(''); setErr(''); const res = await arApi.getInvoice(inv.id); setInvoiceDetail(res.data); };
  const action = async (label, fn) => {
    setActionLoading(label); setErr(''); setMsg('');
    try { const res = await fn(); setMsg(res.data.detail || 'Done.'); load(); if (selectedInvoice) { const updated = await arApi.getInvoice(selectedInvoice.id); setSelectedInvoice(updated.data); setInvoiceDetail(updated.data); } }
    catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const invSC = selectedInvoice ? (INVOICE_STATUS_COLORS[selectedInvoice.status] || INVOICE_STATUS_COLORS['Draft']) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[{ label: 'Total Receivable', value: usd(dashboard.total_receivable), color: T.text, icon: <FileText size={20} color={T.accent} />, bg: T.accentDim }, { label: 'Overdue', value: usd(dashboard.total_overdue), color: T.red, icon: <AlertTriangle size={20} color={T.red} />, bg: T.redDim }, { label: 'Collected MTD', value: usd(dashboard.total_collected_mtd), color: T.green, icon: <CheckCircle size={20} color={T.green} />, bg: T.greenDim }, { label: `DSO (${dashboard.dso_days}d)`, value: usd(dashboard.total_invoiced_mtd), color: T.amber, icon: <Clock size={20} color={T.amber} />, bg: T.amberDim }].map(k => (
            <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
              <div><p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</p><p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p></div>
            </div>
          ))}
        </div>
      )}
      {msg && <div style={{ padding: '10px 14px', background: T.greenDim, borderRadius: 8, fontSize: 13, color: T.green }}>{msg}</div>}
      {err && <div style={{ padding: '10px 14px', background: T.redDim, borderRadius: 8, fontSize: 13, color: T.red }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: 'invoices', label: 'Invoices', icon: <FileText size={13} /> }, { id: 'customers', label: 'Customers', icon: <UserCheck size={13} /> }, { id: 'aging', label: 'Aging', icon: <Clock size={13} /> }].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: activeView === v.id ? T.accent : T.card, color: activeView === v.id ? '#fff' : T.muted, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>{v.icon}{v.label}</button>
        ))}
        {activeView === 'invoices' && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ marginLeft: 'auto', border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
            <option value="">All Statuses</option>
            {['Draft', 'Approved', 'Sent', 'Partially_Collected', 'Collected', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      {activeView === 'invoices' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
          <Card title={`Invoices (${invoices.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
              {invoices.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No invoices found.</p>}
              {invoices.map(inv => {
                const isc = INVOICE_STATUS_COLORS[inv.status] || INVOICE_STATUS_COLORS['Draft'];
                return (
                  <div key={inv.id} onClick={() => selectInvoice(inv)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, background: selectedInvoice?.id === inv.id ? T.accentDim : T.bg, border: `1px solid ${selectedInvoice?.id === inv.id ? T.accent : inv.is_overdue ? T.red : T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 11 }}>{inv.invoice_number}</strong><span style={{ ...pill(isc.color, isc.bg), fontSize: 10 }}>{inv.status}</span></div>
                    <p style={{ margin: '2px 0 0', color: T.text, fontSize: 12, fontWeight: 500 }}>{inv.customer_name}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span style={{ fontSize: 11, color: T.muted }}>Due: {inv.due_date}</span><span style={{ fontSize: 11, fontWeight: 700, color: inv.is_overdue ? T.red : T.text }}>{usd(inv.balance_due)}</span></div>
                    {inv.is_overdue && <span style={{ fontSize: 10, color: T.red }}>{inv.days_overdue} days overdue</span>}
                  </div>
                );
              })}
            </div>
          </Card>
          {selectedInvoice && invoiceDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Card title={`${invoiceDetail.invoice_number} — ${invoiceDetail.customer_name}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ ...pill(invSC.color, invSC.bg) }}>{invoiceDetail.status}</span>
                  <span style={{ ...pill(T.blue, T.blueDim) }}>{invoiceDetail.invoice_type}</span>
                  {invoiceDetail.wht_category !== 'None' && <span style={{ ...pill(T.amber, T.amberDim) }}>WHT: {invoiceDetail.wht_category}</span>}
                  {invoiceDetail.is_overdue && <span style={{ ...pill(T.red, T.redDim) }}>{invoiceDetail.days_overdue} days overdue</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                  {[{ label: 'Subtotal', value: usd(invoiceDetail.subtotal), color: T.text }, { label: 'VAT (16%)', value: usd(invoiceDetail.vat_amount), color: T.blue }, { label: 'WHT', value: usd(invoiceDetail.wht_amount), color: T.amber }, { label: 'Total', value: usd(invoiceDetail.total_amount), color: T.text }, { label: 'Collected', value: usd(invoiceDetail.amount_collected), color: T.green }, { label: 'Balance Due', value: usd(invoiceDetail.balance_due), color: T.red }].map(k => (
                    <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}><p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p><p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p></div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {invoiceDetail.status === 'Draft' && <WfButton label="Approve + Post GL" icon={<ThumbsUp size={13} />} color={T.accent} loading={actionLoading === 'Approve'} onClick={() => action('Approve', () => arApi.approveInvoice(invoiceDetail.id))} />}
                  {invoiceDetail.status === 'Approved' && <WfButton label="Send to Customer" icon={<Send size={13} />} color={T.blue} loading={actionLoading === 'Send'} onClick={() => action('Send', () => arApi.sendInvoice(invoiceDetail.id))} />}
                  {['Approved', 'Sent', 'Partially_Collected'].includes(invoiceDetail.status) && <WfButton label="Record Receipt" icon={<Banknote size={13} />} color={T.green} onClick={() => setShowCollect(true)} />}
                  {['Approved', 'Sent', 'Partially_Collected', 'Collected'].includes(invoiceDetail.status) && <WfButton label="Issue Credit Note" icon={<FileX size={13} />} color={T.amber} onClick={() => setShowCreditNote(true)} />}
                  {['Draft', 'Approved', 'Sent'].includes(invoiceDetail.status) && <WfButton label="Cancel" icon={<XCircle size={13} />} color={T.muted} loading={actionLoading === 'Cancel'} onClick={() => action('Cancel', () => arApi.cancelInvoice(invoiceDetail.id))} />}
                </div>
                {showCollect && (
                  <div style={{ marginTop: 12, background: T.greenDim, borderRadius: 10, padding: 14 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.green }}>Record Receipt (Balance: {usd(invoiceDetail.balance_due)})</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input type="number" placeholder="Amount (KES)" value={collectForm.amount} onChange={e => setCollectForm({ ...collectForm, amount: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                      <select value={collectForm.payment_method} onChange={e => setCollectForm({ ...collectForm, payment_method: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>{['Bank Transfer', 'Cheque', 'M-Pesa', 'Cash'].map(m => <option key={m}>{m}</option>)}</select>
                      <input type="text" placeholder="Receipt Date (YYYY-MM-DD)" value={collectForm.receipt_date} onChange={e => setCollectForm({ ...collectForm, receipt_date: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                      <input type="text" placeholder="Reference" value={collectForm.reference} onChange={e => setCollectForm({ ...collectForm, reference: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    </div>
                    {invoiceDetail.early_payment_discount > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: T.green, cursor: 'pointer' }}>
                        <input type="checkbox" checked={collectForm.apply_early_discount} onChange={e => setCollectForm({ ...collectForm, apply_early_discount: e.target.checked })} />
                        Apply early payment discount ({usd(invoiceDetail.early_payment_discount)})
                      </label>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => { action('Collect', () => arApi.collectInvoice(invoiceDetail.id, { ...collectForm, amount: parseFloat(collectForm.amount) })); setShowCollect(false); }} style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Confirm Receipt</button>
                      <button onClick={() => setShowCollect(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
                {showCreditNote && (
                  <div style={{ marginTop: 12, background: T.amberDim, borderRadius: 10, padding: 14 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.amber }}>Issue Credit Note</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input type="number" placeholder="Amount (KES)" value={creditNoteForm.amount} onChange={e => setCreditNoteForm({ ...creditNoteForm, amount: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                      <input type="text" placeholder="Reason (required)" value={creditNoteForm.reason} onChange={e => setCreditNoteForm({ ...creditNoteForm, reason: e.target.value })} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => { action('Credit Note', () => arApi.issueCreditNote(invoiceDetail.id, { amount: parseFloat(creditNoteForm.amount), reason: creditNoteForm.reason })); setShowCreditNote(false); setCreditNoteForm({ amount: '', reason: '' }); }} style={{ background: T.amber, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Issue Credit Note</button>
                      <button onClick={() => setShowCreditNote(false)} style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </Card>
              {invoiceDetail.lines?.length > 0 && (
                <Card title="Invoice Line Items">
                  <Table headers={['Description', 'Qty', 'Unit Price', 'VAT %', 'VAT Amount', 'Line Total']} rows={invoiceDetail.lines.map(l => [l.description, l.quantity, usd(l.unit_price), `${l.vat_rate}%`, usd(l.vat_amount), <strong>{usd(l.line_total)}</strong>])} />
                </Card>
              )}
            </div>
          ) : (
            <Card title="Select an invoice"><p style={{ color: T.muted, fontSize: 13 }}>Click an invoice on the left to view details.</p></Card>
          )}
        </div>
      )}
      {activeView === 'customers' && (
        <Card title={`Customers (${customers.length})`}>
          <Table headers={['Customer No.', 'Name', 'Type', 'WHT Category', 'Credit Limit', 'Outstanding', 'Status']} rows={customers.map(c => [<code style={{ fontSize: 11 }}>{c.customer_number}</code>, c.name, c.customer_type, c.wht_category === 'None' ? '—' : <span style={{ ...pill(T.amber, T.amberDim) }}>{c.wht_category}</span>, c.credit_limit > 0 ? usd(c.credit_limit) : 'No limit', <span style={{ color: c.is_over_credit_limit ? T.red : T.text, fontWeight: 600 }}>{usd(c.outstanding_balance)}{c.is_over_credit_limit && ' ⚠'}</span>, <span style={{ ...pill(c.status === 'Active' ? T.green : T.red, c.status === 'Active' ? T.greenDim : T.redDim) }}>{c.status}</span>])} />
        </Card>
      )}
      {activeView === 'aging' && aging && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {Object.entries(aging.buckets).map(([key, bucket]) => (
              <div key={key} style={{ background: T.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', borderTop: `3px solid ${key === 'current' ? T.green : key === '1_30' ? T.amber : T.red}` }}>
                <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{bucket.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: key === 'current' ? T.green : key === '1_30' ? T.amber : T.red }}>{usd(bucket.total)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{bucket.invoices.length} invoices</p>
              </div>
            ))}
          </div>
          {Object.entries(aging.buckets).filter(([, b]) => b.invoices.length > 0).map(([key, bucket]) => (
            <Card key={key} title={bucket.label}>
              <Table headers={['Invoice No.', 'Customer', 'Invoice Date', 'Due Date', 'Days Overdue', 'Balance']} rows={bucket.invoices.map(i => [<code style={{ fontSize: 11 }}>{i.invoice_number}</code>, i.customer, i.invoice_date, i.due_date, i.days_overdue > 0 ? <span style={{ color: T.red, fontWeight: 600 }}>{i.days_overdue} days</span> : '—', <strong style={{ color: T.red }}>{usd(i.balance_due)}</strong>])} />
            </Card>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Grand Total: {usd(aging.grand_total)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

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
      <thead><tr>{headers.map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: T.muted, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>{row.map((cell, j) => <td key={j} style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const WfButton = ({ label, icon, color, onClick, loading }) => (
  <button onClick={onClick} disabled={loading}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
    {icon}{loading ? 'Working…' : label}
  </button>
);

export default Finance;