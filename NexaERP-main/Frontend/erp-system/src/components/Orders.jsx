import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, FileText, Package, Truck, BarChart2,
  CheckCircle, XCircle, ChevronRight, ThumbsUp,
  Clock, AlertTriangle, Send, RefreshCw, Plus,
  ArrowDown, ArrowUp, MapPin, User,
} from 'lucide-react';
import axios from 'axios';

// ── Inline API client ──────────────────────────────────────────
const BASE = 'http://localhost:8000/api';
const api  = axios.create({ baseURL: BASE });

const ordersApi = {
  getDashboard:        ()           => api.get('/orders/dashboard/'),
  getQuotations:       (params)     => api.get('/orders/quotations/', { params }),
  getQuotation:        (id)         => api.get(`/orders/quotations/${id}/`),
  createQuotation:     (data)       => api.post('/orders/quotations/', data),
  updateQuotation:     (id, data)   => api.put(`/orders/quotations/${id}/`, data),
  sendQuotation:       (id)         => api.post(`/orders/quotations/${id}/send/`),
  convertQuotation:    (id)         => api.post(`/orders/quotations/${id}/convert/`),
  getSalesOrders:      (params)     => api.get('/orders/sales/', { params }),
  getSalesOrder:       (id)         => api.get(`/orders/sales/${id}/`),
  createSalesOrder:    (data)       => api.post('/orders/sales/', data),
  confirmOrder:        (id)         => api.post(`/orders/sales/${id}/confirm/`),
  approveOrder:        (id)         => api.post(`/orders/sales/${id}/approve/`),
  processOrder:        (id)         => api.post(`/orders/sales/${id}/process/`),
  shipOrder:           (id)         => api.post(`/orders/sales/${id}/ship/`),
  deliverOrder:        (id)         => api.post(`/orders/sales/${id}/deliver/`),
  cancelOrder:         (id, reason) => api.post(`/orders/sales/${id}/cancel/`, { reason }),
  getPurchaseOrders:   (params)     => api.get('/orders/purchases/', { params }),
  getPurchaseOrder:    (id)         => api.get(`/orders/purchases/${id}/`),
  createPurchaseOrder: (data)       => api.post('/orders/purchases/', data),
  submitPO:            (id)         => api.post(`/orders/purchases/${id}/submit/`),
  approvePO:           (id)         => api.post(`/orders/purchases/${id}/approve/`),
  sendPO:              (id)         => api.post(`/orders/purchases/${id}/send/`),
  receivePO:           (id)         => api.post(`/orders/purchases/${id}/receive/`),
  cancelPO:            (id, reason) => api.post(`/orders/purchases/${id}/cancel/`, { reason }),
  getDeliveries:       (params)     => api.get('/orders/deliveries/', { params }),
  getDelivery:         (id)         => api.get(`/orders/deliveries/${id}/`),
  createDelivery:      (data)       => api.post('/orders/deliveries/', data),
  dispatchDelivery:    (id)         => api.post(`/orders/deliveries/${id}/dispatch/`),
  completeDelivery:    (id)         => api.post(`/orders/deliveries/${id}/complete/`),
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

const SO_STATUS = {
  Pending:    { color: T.muted,   bg: '#f1f5f9'   },
  Confirmed:  { color: T.blue,    bg: T.blueDim   },
  Approved:   { color: T.accent,  bg: T.accentDim },
  Processing: { color: T.amber,   bg: T.amberDim  },
  Shipped:    { color: T.purple,  bg: T.purpleDim },
  Delivered:  { color: T.green,   bg: T.greenDim  },
  Cancelled:  { color: T.red,     bg: T.redDim    },
  Returned:   { color: T.muted,   bg: '#f1f5f9'   },
};

const PO_STATUS = {
  Draft:     { color: T.muted,  bg: '#f1f5f9'   },
  Submitted: { color: T.amber,  bg: T.amberDim  },
  Approved:  { color: T.blue,   bg: T.blueDim   },
  Sent:      { color: T.purple, bg: T.purpleDim },
  Partial:   { color: T.amber,  bg: T.amberDim  },
  Received:  { color: T.green,  bg: T.greenDim  },
  Closed:    { color: T.accent, bg: T.accentDim },
  Cancelled: { color: T.red,    bg: T.redDim    },
};

const QT_STATUS = {
  Draft:    { color: T.muted,  bg: '#f1f5f9'   },
  Sent:     { color: T.blue,   bg: T.blueDim   },
  Accepted: { color: T.green,  bg: T.greenDim  },
  Rejected: { color: T.red,    bg: T.redDim    },
  Expired:  { color: T.muted,  bg: '#f1f5f9'   },
};

const DEL_STATUS = {
  Pending:    { color: T.amber,  bg: T.amberDim  },
  Dispatched: { color: T.blue,   bg: T.blueDim   },
  In_Transit: { color: T.purple, bg: T.purpleDim },
  Delivered:  { color: T.green,  bg: T.greenDim  },
  Failed:     { color: T.red,    bg: T.redDim    },
  Returned:   { color: T.muted,  bg: '#f1f5f9'   },
};

const TABS = [
  { id: 'dashboard',  icon: <BarChart2 size={14} />,   label: 'Dashboard'        },
  { id: 'sales',      icon: <ShoppingCart size={14} />, label: 'Sales Orders'    },
  { id: 'purchases',  icon: <Package size={14} />,      label: 'Purchase Orders' },
  { id: 'quotations', icon: <FileText size={14} />,     label: 'Quotations'      },
  { id: 'deliveries', icon: <Truck size={14} />,        label: 'Deliveries'      },
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
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
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

// ── MAIN COMPONENT ─────────────────────────────────────────────
const Orders = () => {
  const [tab, setTab] = useState('dashboard');
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Orders Management</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
          Quotations · Sales Orders · Purchase Orders · Delivery Tracking
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
      {tab === 'dashboard'  && <DashboardPanel />}
      {tab === 'sales'      && <SalesOrdersPanel />}
      {tab === 'purchases'  && <PurchaseOrdersPanel />}
      {tab === 'quotations' && <QuotationsPanel />}
      {tab === 'deliveries' && <DeliveriesPanel />}
    </div>
  );
};

// ── DASHBOARD ─────────────────────────────────────────────────
const DashboardPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi.getDashboard()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  const kpis = [
    { label: 'Active Sales Orders',   value: data?.active_sales_orders,   color: T.accent, icon: <ShoppingCart size={20} color={T.accent} />, bg: T.accentDim },
    { label: 'Overdue Orders',        value: data?.overdue_sales_orders,   color: T.red,    icon: <AlertTriangle size={20} color={T.red} />,   bg: T.redDim    },
    { label: 'Pending Deliveries',    value: data?.pending_deliveries,     color: T.purple, icon: <Truck size={20} color={T.purple} />,        bg: T.purpleDim },
    { label: 'Pending Purchase Orders', value: data?.pending_purchase_orders, color: T.blue, icon: <Package size={20} color={T.blue} />,     bg: T.blueDim   },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Total Sales Orders',    value: data?.total_sales_orders,   color: T.text   },
          { label: 'Sales Value MTD',       value: usd(data?.sales_value_mtd), color: T.green  },
          { label: 'Total Purchase Orders', value: data?.total_purchase_orders, color: T.text  },
          { label: 'Purchase Value MTD',    value: usd(data?.purchase_value_mtd), color: T.red },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '14px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
            <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Quotation Pipeline">
          {[
            { label: 'Total Quotations',    value: data?.total_quotations,    color: T.text   },
            { label: 'Pending (Draft/Sent)',value: data?.pending_quotations,  color: T.amber  },
            { label: 'Accepted',            value: data?.accepted_quotations, color: T.green  },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <span style={{ color: T.muted }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </Card>
        <Card title="Delivery Status">
          {[
            { label: 'Delivered MTD',      value: data?.delivered_mtd,      color: T.green  },
            { label: 'Pending Deliveries', value: data?.pending_deliveries, color: T.amber  },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <span style={{ color: T.muted }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ── SALES ORDERS ──────────────────────────────────────────────
const SalesOrdersPanel = () => {
  const [orders, setOrders]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const load = () => {
    setLoading(true); setMsg(''); setErr('');
    ordersApi.getSalesOrders(statusFilter ? { status: statusFilter } : {})
      .then(r => setOrders(r.data.results || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const select = async (o) => {
    setSelected(o); setDetail(null); setMsg(''); setErr('');
    const r = await ordersApi.getSalesOrder(o.id);
    setDetail(r.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setMsg(''); setErr('');
    try {
      const r = await fn();
      setMsg(r.data.detail || 'Done.');
      load();
      if (selected) { const u = await ordersApi.getSalesOrder(selected.id); setSelected(u.data); setDetail(u.data); }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const sc = selected ? (SO_STATUS[selected.status] || SO_STATUS.Pending) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Statuses</option>
          {['Pending','Confirmed','Approved','Processing','Shipped','Delivered','Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{orders.length} orders</span>
      </div>
      <Msg msg={msg} err={err} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* List */}
        <Card title={`Sales Orders (${orders.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {orders.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No orders found.</p>}
            {orders.map(o => {
              const s = SO_STATUS[o.status] || SO_STATUS.Pending;
              const overdue = o.requested_date && o.requested_date < new Date().toISOString().split('T')[0]
                && !['Delivered','Cancelled'].includes(o.status);
              return (
                <div key={o.id} onClick={() => select(o)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === o.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === o.id ? T.accent : overdue ? T.red : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 11 }}>{o.order_number}</strong>
                    <span style={{ ...pill(s.color, s.bg), fontSize: 10 }}>{o.status}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontWeight: 500 }}>{o.customer}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                    <span>📅 {o.order_date}</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{usd(o.total_amount)}</span>
                  </div>
                  {overdue && <span style={{ fontSize: 10, color: T.red }}>⚠ Overdue (due {o.requested_date})</span>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Detail */}
        {selected && detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${detail.order_number} — ${detail.customer}`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(sc.color, sc.bg) }}>{detail.status}</span>
                <span style={{ ...pill(
                  detail.payment_status === 'Paid' ? T.green : detail.payment_status === 'Partially_Paid' ? T.amber : T.red,
                  detail.payment_status === 'Paid' ? T.greenDim : detail.payment_status === 'Partially_Paid' ? T.amberDim : T.redDim,
                )}}>{detail.payment_status}</span>
                {detail.warehouse_name && <span style={{ ...pill(T.muted, '#f1f5f9') }}>{detail.warehouse_name}</span>}
                {detail.ar_invoice_number && <span style={{ ...pill(T.blue, T.blueDim) }}>Invoice: {detail.ar_invoice_number}</span>}
              </div>

              {/* Financials */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Subtotal',      value: usd(detail.subtotal),     color: T.text   },
                  { label: 'VAT',           value: usd(detail.vat_amount),   color: T.blue   },
                  { label: 'Total',         value: usd(detail.total_amount), color: T.accent },
                  { label: 'Order Date',    value: detail.order_date,        color: T.text   },
                  { label: 'Requested By',  value: detail.requested_date || '—', color: T.amber },
                  { label: 'Balance Due',   value: usd(detail.balance_due),  color: T.red    },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Workflow buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.status === 'Pending' && (
                  <WfBtn label="Confirm Order" icon={<CheckCircle size={13} />} color={T.blue}
                    loading={actionLoading === 'Confirm'}
                    onClick={() => action('Confirm', () => ordersApi.confirmOrder(detail.id))} />
                )}
                {detail.status === 'Confirmed' && (
                  <WfBtn label="Approve + Create Invoice" icon={<ThumbsUp size={13} />} color={T.accent}
                    loading={actionLoading === 'Approve'}
                    onClick={() => action('Approve', () => ordersApi.approveOrder(detail.id))} />
                )}
                {detail.status === 'Approved' && (
                  <WfBtn label="Start Processing" icon={<RefreshCw size={13} />} color={T.amber}
                    loading={actionLoading === 'Process'}
                    onClick={() => action('Process', () => ordersApi.processOrder(detail.id))} />
                )}
                {detail.status === 'Processing' && (
                  <WfBtn label="Mark as Shipped" icon={<Send size={13} />} color={T.purple}
                    loading={actionLoading === 'Ship'}
                    onClick={() => action('Ship', () => ordersApi.shipOrder(detail.id))} />
                )}
                {detail.status === 'Shipped' && (
                  <WfBtn label="Mark as Delivered" icon={<CheckCircle size={13} />} color={T.green}
                    loading={actionLoading === 'Deliver'}
                    onClick={() => action('Deliver', () => ordersApi.deliverOrder(detail.id))} />
                )}
                {!['Delivered','Cancelled'].includes(detail.status) && (
                  <WfBtn label="Cancel" icon={<XCircle size={13} />} color={T.red}
                    onClick={() => setShowCancel(true)} />
                )}
              </div>

              {/* Cancel form */}
              {showCancel && (
                <div style={{ marginTop: 12, background: T.redDim, borderRadius: 10, padding: 12 }}>
                  <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                    placeholder="Cancellation reason (optional)"
                    style={{ width: '100%', border: `1px solid ${T.red}`, borderRadius: 6, padding: 8, fontSize: 12, resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => { action('Cancel', () => ordersApi.cancelOrder(detail.id, cancelReason)); setShowCancel(false); setCancelReason(''); }}
                      style={{ background: T.red, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Confirm Cancel</button>
                    <button onClick={() => setShowCancel(false)}
                      style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>Back</button>
                  </div>
                </div>
              )}
            </Card>

            {/* Line items */}
            {detail.lines?.length > 0 && (
              <Card title="Order Line Items">
                <Table
                  headers={['Description', 'Qty', 'Unit Price', 'VAT%', 'Delivered', 'Line Total']}
                  rows={detail.lines.map(l => [
                    l.description,
                    l.quantity,
                    usd(l.unit_price),
                    `${l.vat_rate}%`,
                    <span style={{ color: l.is_fully_delivered ? T.green : T.amber }}>{l.quantity_delivered}/{l.quantity}</span>,
                    <strong>{usd(l.line_total)}</strong>,
                  ])}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a Sales Order">
            <p style={{ color: T.muted, fontSize: 13 }}>Click an order on the left to view details and manage the workflow.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── PURCHASE ORDERS ───────────────────────────────────────────
const PurchaseOrdersPanel = () => {
  const [orders, setOrders]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true); setMsg(''); setErr('');
    ordersApi.getPurchaseOrders(statusFilter ? { status: statusFilter } : {})
      .then(r => setOrders(r.data.results || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const select = async (o) => {
    setSelected(o); setDetail(null); setMsg(''); setErr('');
    const r = await ordersApi.getPurchaseOrder(o.id);
    setDetail(r.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setMsg(''); setErr('');
    try {
      const r = await fn();
      setMsg(r.data.detail || 'Done.');
      load();
      if (selected) { const u = await ordersApi.getPurchaseOrder(selected.id); setSelected(u.data); setDetail(u.data); }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const sc = selected ? (PO_STATUS[selected.status] || PO_STATUS.Draft) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Statuses</option>
          {['Draft','Submitted','Approved','Sent','Partial','Received','Closed','Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{orders.length} orders</span>
      </div>
      <Msg msg={msg} err={err} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title={`Purchase Orders (${orders.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {orders.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No orders found.</p>}
            {orders.map(o => {
              const s = PO_STATUS[o.status] || PO_STATUS.Draft;
              return (
                <div key={o.id} onClick={() => select(o)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === o.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === o.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 11 }}>{o.order_number}</strong>
                    <span style={{ ...pill(s.color, s.bg), fontSize: 10 }}>{o.status}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontWeight: 500 }}>{o.supplier}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                    <span>{o.warehouse_name || '—'}</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{usd(o.total_amount)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: T.muted }}>
                    Order: {o.order_date} · Expected: {o.expected_date || '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {selected && detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${detail.order_number} — ${detail.supplier}`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(sc.color, sc.bg) }}>{detail.status}</span>
                {detail.warehouse_name && <span style={{ ...pill(T.muted, '#f1f5f9') }}>{detail.warehouse_name}</span>}
                {detail.ap_bill_number && <span style={{ ...pill(T.amber, T.amberDim) }}>Bill: {detail.ap_bill_number}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Subtotal',     value: usd(detail.subtotal),     color: T.text   },
                  { label: 'VAT',          value: usd(detail.vat_amount),   color: T.blue   },
                  { label: 'Total',        value: usd(detail.total_amount), color: T.accent },
                  { label: 'Order Date',   value: detail.order_date,        color: T.text   },
                  { label: 'Expected',     value: detail.expected_date || '—', color: T.amber },
                  { label: 'Supplier Ref', value: detail.supplier_ref || '—', color: T.muted },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.status === 'Draft' && (
                  <WfBtn label="Submit for Approval" icon={<ChevronRight size={13} />} color={T.amber}
                    loading={actionLoading === 'Submit'}
                    onClick={() => action('Submit', () => ordersApi.submitPO(detail.id))} />
                )}
                {detail.status === 'Submitted' && (
                  <WfBtn label="Approve PO" icon={<ThumbsUp size={13} />} color={T.accent}
                    loading={actionLoading === 'Approve'}
                    onClick={() => action('Approve', () => ordersApi.approvePO(detail.id))} />
                )}
                {detail.status === 'Approved' && (
                  <WfBtn label="Send to Supplier" icon={<Send size={13} />} color={T.blue}
                    loading={actionLoading === 'Send'}
                    onClick={() => action('Send', () => ordersApi.sendPO(detail.id))} />
                )}
                {['Sent','Partial'].includes(detail.status) && (
                  <WfBtn label="Mark as Received" icon={<ArrowDown size={13} />} color={T.green}
                    loading={actionLoading === 'Receive'}
                    onClick={() => action('Receive', () => ordersApi.receivePO(detail.id))} />
                )}
                {!['Received','Closed','Cancelled'].includes(detail.status) && (
                  <WfBtn label="Cancel PO" icon={<XCircle size={13} />} color={T.red}
                    loading={actionLoading === 'Cancel PO'}
                    onClick={() => action('Cancel PO', () => ordersApi.cancelPO(detail.id))} />
                )}
              </div>
            </Card>

            {detail.lines?.length > 0 && (
              <Card title="PO Line Items">
                <Table
                  headers={['Description', 'Qty', 'Unit Cost', 'VAT%', 'Received', 'Line Total']}
                  rows={detail.lines.map(l => [
                    l.description,
                    l.quantity,
                    usd(l.unit_cost),
                    `${l.vat_rate}%`,
                    <span style={{ color: l.is_fully_received ? T.green : T.amber }}>{l.quantity_received}/{l.quantity}</span>,
                    <strong>{usd(l.line_total)}</strong>,
                  ])}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a Purchase Order">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a purchase order to view details and manage the workflow.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── QUOTATIONS ────────────────────────────────────────────────
const QuotationsPanel = () => {
  const [quotations, setQuotations] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]               = useState('');
  const [err, setErr]               = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true); setMsg(''); setErr('');
    ordersApi.getQuotations(statusFilter ? { status: statusFilter } : {})
      .then(r => setQuotations(r.data.results || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const select = async (q) => {
    setSelected(q); setDetail(null); setMsg(''); setErr('');
    const r = await ordersApi.getQuotation(q.id);
    setDetail(r.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setMsg(''); setErr('');
    try {
      const r = await fn();
      setMsg(r.data.detail || 'Done.');
      load();
      if (selected) { const u = await ordersApi.getQuotation(selected.id); setSelected(u.data); setDetail(u.data); }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const sc = selected ? (QT_STATUS[selected.status] || QT_STATUS.Draft) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Statuses</option>
          {['Draft','Sent','Accepted','Rejected','Expired'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{quotations.length} quotations</span>
      </div>
      <Msg msg={msg} err={err} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title={`Quotations (${quotations.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {quotations.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No quotations found.</p>}
            {quotations.map(q => {
              const s = QT_STATUS[q.status] || QT_STATUS.Draft;
              return (
                <div key={q.id} onClick={() => select(q)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === q.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === q.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 11 }}>{q.quotation_number}</strong>
                    <span style={{ ...pill(s.color, s.bg), fontSize: 10 }}>{q.status}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontWeight: 500 }}>{q.customer}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                    <span>Valid until: {q.valid_until}</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{usd(q.total_amount)}</span>
                  </div>
                  {q.is_expired && <span style={{ fontSize: 10, color: T.red }}>⚠ Expired</span>}
                </div>
              );
            })}
          </div>
        </Card>

        {selected && detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${detail.quotation_number} — ${detail.customer}`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(sc.color, sc.bg) }}>{detail.status}</span>
                {detail.is_expired && <span style={{ ...pill(T.red, T.redDim) }}>Expired</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Subtotal',     value: usd(detail.subtotal),     color: T.text   },
                  { label: 'VAT',          value: usd(detail.vat_amount),   color: T.blue   },
                  { label: 'Total',        value: usd(detail.total_amount), color: T.accent },
                  { label: 'Date',         value: detail.date,              color: T.text   },
                  { label: 'Valid Until',  value: detail.valid_until,       color: T.amber  },
                  { label: 'Email',        value: detail.customer_email || '—', color: T.muted },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.status === 'Draft' && (
                  <WfBtn label="Send to Customer" icon={<Send size={13} />} color={T.blue}
                    loading={actionLoading === 'Send'}
                    onClick={() => action('Send', () => ordersApi.sendQuotation(detail.id))} />
                )}
                {['Draft','Sent'].includes(detail.status) && (
                  <WfBtn label="Convert to Sales Order" icon={<ArrowUp size={13} />} color={T.accent}
                    loading={actionLoading === 'Convert'}
                    onClick={() => action('Convert', () => ordersApi.convertQuotation(detail.id))} />
                )}
              </div>

              {detail.notes && (
                <div style={{ marginTop: 12, background: T.bg, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.muted }}>
                  <strong>Notes:</strong> {detail.notes}
                </div>
              )}
              {detail.terms && (
                <div style={{ marginTop: 8, background: T.bg, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.muted }}>
                  <strong>Terms:</strong> {detail.terms}
                </div>
              )}
            </Card>

            {detail.lines?.length > 0 && (
              <Card title="Quotation Line Items">
                <Table
                  headers={['Description', 'Qty', 'Unit Price', 'VAT%', 'VAT Amount', 'Line Total']}
                  rows={detail.lines.map(l => [
                    l.description,
                    l.quantity,
                    usd(l.unit_price),
                    `${l.vat_rate}%`,
                    usd(l.vat_amount),
                    <strong>{usd(l.line_total)}</strong>,
                  ])}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a Quotation">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a quotation to view details, send to customer, or convert to a Sales Order.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── DELIVERIES ────────────────────────────────────────────────
const DeliveriesPanel = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]               = useState('');
  const [err, setErr]               = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true); setMsg(''); setErr('');
    ordersApi.getDeliveries(statusFilter ? { status: statusFilter } : {})
      .then(r => setDeliveries(r.data.results || r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const select = async (d) => {
    setSelected(d); setDetail(null); setMsg(''); setErr('');
    const r = await ordersApi.getDelivery(d.id);
    setDetail(r.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setMsg(''); setErr('');
    try {
      const r = await fn();
      setMsg(r.data.detail || 'Done.');
      load();
      if (selected) { const u = await ordersApi.getDelivery(selected.id); setSelected(u.data); setDetail(u.data); }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const sc = selected ? (DEL_STATUS[selected.status] || DEL_STATUS.Pending) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Statuses</option>
          {['Pending','Dispatched','In_Transit','Delivered','Failed','Returned'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{deliveries.length} deliveries</span>
      </div>
      <Msg msg={msg} err={err} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <Card title={`Deliveries (${deliveries.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {deliveries.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No deliveries found.</p>}
            {deliveries.map(d => {
              const s = DEL_STATUS[d.status] || DEL_STATUS.Pending;
              return (
                <div key={d.id} onClick={() => select(d)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === d.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === d.id ? T.accent : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 11 }}>{d.delivery_number}</strong>
                    <span style={{ ...pill(s.color, s.bg), fontSize: 10 }}>{d.status}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontWeight: 500, fontSize: 11, color: T.muted }}>Order: {d.order_number}</p>
                  <p style={{ margin: '2px 0', fontWeight: 500 }}>{d.customer}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                    <span>{d.carrier || 'No carrier'}</span>
                    <span>{d.scheduled_date || '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {selected && detail ? (
          <Card title={`${detail.delivery_number} — ${detail.customer}`}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ ...pill(sc.color, sc.bg) }}>{detail.status}</span>
              <span style={{ fontSize: 11, color: T.muted }}>Order: {detail.order_number}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Carrier',         value: detail.carrier || '—',          color: T.text   },
                { label: 'Tracking No.',    value: detail.tracking_number || '—',  color: T.blue   },
                { label: 'Scheduled Date',  value: detail.scheduled_date || '—',   color: T.amber  },
                { label: 'Driver',          value: detail.driver_name || '—',      color: T.text   },
                { label: 'Driver Phone',    value: detail.driver_phone || '—',     color: T.muted  },
                { label: 'Vehicle No.',     value: detail.vehicle_number || '—',   color: T.muted  },
              ].map(k => (
                <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                  <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            {detail.delivery_address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, background: T.bg, borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                <MapPin size={14} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ color: T.muted }}>{detail.delivery_address}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {detail.status === 'Pending' && (
                <WfBtn label="Dispatch" icon={<Truck size={13} />} color={T.blue}
                  loading={actionLoading === 'Dispatch'}
                  onClick={() => action('Dispatch', () => ordersApi.dispatchDelivery(detail.id))} />
              )}
              {['Dispatched','In_Transit'].includes(detail.status) && (
                <WfBtn label="Mark as Delivered" icon={<CheckCircle size={13} />} color={T.green}
                  loading={actionLoading === 'Complete'}
                  onClick={() => action('Complete', () => ordersApi.completeDelivery(detail.id))} />
              )}
            </div>
          </Card>
        ) : (
          <Card title="Select a Delivery">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a delivery to view details and track status.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Orders;