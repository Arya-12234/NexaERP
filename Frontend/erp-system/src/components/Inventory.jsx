import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, AlertTriangle, BarChart2,
  ShoppingCart, ArrowDown, ArrowUp, ArrowLeftRight,
  Wrench, FileText, CheckCircle, XCircle,
  TrendingDown, Layers, Search,
} from 'lucide-react';
import axios from 'axios';

// ── API client ─────────────────────────────────────────────────
const BASE = 'http://localhost:8000/api';
const api  = axios.create({ baseURL: BASE });

const inventoryApi = {
  // Dashboard & Reports
  getDashboard:      ()           => api.get('/inventory/dashboard/'),
  getValuation:      ()           => api.get('/inventory/valuation/'),
  getReorderAlerts:  ()           => api.get('/inventory/reorder-alerts/'),

  // Categories
  getCategories:     ()           => api.get('/inventory/categories/'),
  createCategory:    (data)       => api.post('/inventory/categories/', data),
  getCategory:       (id)         => api.get(`/inventory/categories/${id}/`),
  updateCategory:    (id, data)   => api.put(`/inventory/categories/${id}/`, data),

  // Warehouses
  getWarehouses:     ()           => api.get('/inventory/warehouses/'),
  createWarehouse:   (data)       => api.post('/inventory/warehouses/', data),
  getWarehouse:      (id)         => api.get(`/inventory/warehouses/${id}/`),
  updateWarehouse:   (id, data)   => api.put(`/inventory/warehouses/${id}/`, data),

  // Products
  getProducts:       (params)     => api.get('/inventory/products/', { params }),
  getProduct:        (id)         => api.get(`/inventory/products/${id}/`),
  createProduct:     (data)       => api.post('/inventory/products/', data),
  updateProduct:     (id, data)   => api.put(`/inventory/products/${id}/`, data),

  // Stock Operations
  receiveStock:      (id, data)   => api.post(`/inventory/products/${id}/receive/`, data),
  issueStock:        (id, data)   => api.post(`/inventory/products/${id}/issue/`, data),
  transferStock:     (id, data)   => api.post(`/inventory/products/${id}/transfer/`, data),
  adjustStock:       (id, data)   => api.post(`/inventory/products/${id}/adjust/`, data),

  // Movement & Adjustment History
  getMovements:      (params)     => api.get('/inventory/movements/', { params }),
  getAdjustments:    (params)     => api.get('/inventory/adjustments/', { params }),

  // Purchase Orders
  getPOs:            (params)     => api.get('/inventory/pos/', { params }),
  getPO:             (id)         => api.get(`/inventory/pos/${id}/`),
  createPO:          (data)       => api.post('/inventory/pos/', data),
  approvePO:         (id)         => api.post(`/inventory/pos/${id}/approve/`),
  receivePO:         (id, data)   => api.post(`/inventory/pos/${id}/receive/`, data),
  cancelPO:          (id)         => api.post(`/inventory/pos/${id}/cancel/`),
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

const PO_STATUS_COLORS = {
  Draft:     { color: T.muted,  bg: '#f1f5f9'   },
  Submitted: { color: T.amber,  bg: T.amberDim  },
  Approved:  { color: T.blue,   bg: T.blueDim   },
  Partial:   { color: T.amber,  bg: T.amberDim  },
  Received:  { color: T.green,  bg: T.greenDim  },
  Cancelled: { color: T.muted,  bg: '#f1f5f9'   },
};

const MOVE_COLORS = {
  Receipt:    { color: T.green,  bg: T.greenDim  },
  Issue:      { color: T.blue,   bg: T.blueDim   },
  Adjustment: { color: T.amber,  bg: T.amberDim  },
  Transfer:   { color: T.accent, bg: T.accentDim },
  Write_Off:  { color: T.red,    bg: T.redDim    },
  Opening:    { color: T.muted,  bg: '#f1f5f9'   },
  Return:     { color: T.green,  bg: T.greenDim  },
};

const TABS = [
  { id: 'dashboard', icon: <BarChart2 size={14} />,    label: 'Dashboard'       },
  { id: 'products',  icon: <Package size={14} />,       label: 'Products'        },
  { id: 'pos',       icon: <ShoppingCart size={14} />,  label: 'Purchase Orders' },
  { id: 'movements', icon: <Layers size={14} />,        label: 'Movements'       },
  { id: 'valuation', icon: <FileText size={14} />,      label: 'Valuation'       },
  { id: 'alerts',    icon: <AlertTriangle size={14} />, label: 'Reorder Alerts'  },
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
          ? <tr><td colSpan={headers.length} style={{ padding: '20px 12px', color: T.muted, fontSize: 12, textAlign: 'center' }}>No data</td></tr>
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

const WfButton = ({ label, icon, color, onClick, loading, disabled }) => (
  <button onClick={onClick} disabled={loading || disabled}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (loading || disabled) ? 0.6 : 1 }}>
    {icon}{loading ? 'Working…' : label}
  </button>
);

// ── MAIN COMPONENT ─────────────────────────────────────────────
const Inventory = () => {
  const [tab, setTab] = useState('dashboard');

  const switchTab = (t) => {
    setTab(t);
  };

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Inventory Management</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>
          Products · Warehouses · Stock Control · Purchase Orders · WAC & FIFO Valuation
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)}
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
      {tab === 'dashboard' && <DashboardPanel />}
      {tab === 'products'  && <ProductsPanel />}
      {tab === 'pos'       && <POPanel />}
      {tab === 'movements' && <MovementsPanel />}
      {tab === 'valuation' && <ValuationPanel />}
      {tab === 'alerts'    && <AlertsPanel />}
    </div>
  );
};

// ── DASHBOARD ─────────────────────────────────────────────────
const DashboardPanel = () => {
  const [data, setData]           = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([inventoryApi.getDashboard(), inventoryApi.getWarehouses()])
      .then(([d, w]) => {
        setData(d.data);
        setWarehouses(w.data.results || w.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Total Products',    value: data?.total_products,             color: T.text,   icon: <Package size={20} color={T.accent} />,       bg: T.accentDim },
          { label: 'Inventory Value',   value: usd(data?.total_inventory_value), color: T.accent, icon: <BarChart2 size={20} color={T.accent} />,     bg: T.accentDim },
          { label: 'Low Stock Items',   value: data?.low_stock_count,            color: T.amber,  icon: <AlertTriangle size={20} color={T.amber} />,  bg: T.amberDim  },
          { label: 'Out of Stock',      value: data?.out_of_stock_count,         color: T.red,    icon: <TrendingDown size={20} color={T.red} />,     bg: T.redDim    },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Second KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Active Warehouses', value: data?.warehouses,      color: T.text   },
          { label: 'Pending POs',       value: data?.pending_pos,     color: T.blue   },
          { label: 'Movements Today',   value: data?.movements_today, color: T.accent },
          { label: 'Adjustments MTD',   value: data?.adjustments_mtd, color: T.amber  },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '14px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
            <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{k.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Low stock table */}
        <Card title="Low Stock Alerts" subtitle={`${data?.low_stock_count} items`}>
          {!data?.low_stock_products?.length
            ? <p style={{ color: T.green, fontSize: 12 }}>✓ All stock levels healthy</p>
            : <Table
                headers={['SKU', 'Product', 'Stock', 'Reorder Pt']}
                rows={data.low_stock_products.map(p => [
                  <code style={{ fontSize: 11 }}>{p.sku}</code>,
                  p.name,
                  <span style={{ color: T.amber, fontWeight: 700 }}>{p.stock}</span>,
                  p.reorder_point,
                ])}
              />
          }
        </Card>

        {/* Warehouses */}
        <Card title="Warehouse Overview">
          {warehouses.map(wh => (
            <div key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{wh.name}</span>
                <span style={{ ...pill(T.accent, T.accentDim), marginLeft: 8 }}>{wh.code}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontWeight: 700, color: T.accent }}>{usd(wh.total_value)}</p>
                <p style={{ margin: 0, fontSize: 11, color: T.muted }}>{wh.total_products} products</p>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {data?.out_of_stock_products?.length > 0 && (
        <Card title="Out of Stock" subtitle="Immediate action required">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.out_of_stock_products.map(p => (
              <span key={p.sku} style={{ ...pill(T.red, T.redDim) }}>
                <Package size={10} /> {p.sku} — {p.name}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ── PRODUCTS ──────────────────────────────────────────────────
const ProductsPanel = () => {
  const [products, setProducts]   = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]             = useState('');
  const [err, setErr]             = useState('');
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [activeAction, setActiveAction] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [receiveForm, setReceiveForm] = useState({ warehouse: '', quantity: '', unit_cost: '', date: today, source_ref: '', notes: '' });
  const [issueForm,   setIssueForm]   = useState({ warehouse: '', quantity: '', date: today, source_ref: '', notes: '' });
  const [transferForm, setTransferForm] = useState({ from_warehouse: '', to_warehouse: '', quantity: '', date: today, notes: '' });
  const [adjustForm,  setAdjustForm]  = useState({ warehouse: '', new_quantity: '', reason: 'Damage', date: today, notes: '' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [categories,  setCategories]  = useState([]);
  const [newProduct,  setNewProduct]  = useState({
    sku: '', name: '', category: '', product_type: 'Goods', unit_of_measure: 'Piece',
    valuation_method: 'WAC', cost_price: '', selling_price: '', vat_rate: 16,
    track_stock: true, reorder_point: 10, reorder_quantity: 50,
    preferred_supplier: '', lead_time_days: 7, description: '',
  });
  const [creating, setCreating] = useState(false);

  const loadProducts = useCallback(() => {
    const params = {};
    if (search)                    params.search       = search;
    if (typeFilter)                params.product_type = typeFilter;
    if (stockFilter === 'low')     params.low_stock    = 'true';
    if (stockFilter === 'out')     params.out_of_stock = 'true';
    setLoading(true);
    Promise.all([inventoryApi.getProducts(params), inventoryApi.getWarehouses(), inventoryApi.getCategories()])
      .then(([p, w, c]) => {
        setProducts(p.data.results || p.data);
        setWarehouses(w.data.results || w.data);
        setCategories(c.data.results || c.data);
      })
      .finally(() => setLoading(false));
  }, [search, typeFilter, stockFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const selectProduct = async (p) => {
    const res = await inventoryApi.getProduct(p.id);
    setSelected(res.data);
    setActiveAction('');
    setMsg(''); setErr('');
  };

  const action = async (label, fn) => {
    setActionLoading(label); setErr(''); setMsg('');
    try {
      const res = await fn();
      setMsg(res.data.detail || 'Done.');
      loadProducts();
      if (selected) {
        const updated = await inventoryApi.getProduct(selected.id);
        setSelected(updated.data);
      }
    } catch (e) {
      setErr(e.response?.data?.detail || `${label} failed.`);
    } finally {
      setActionLoading('');
      setActiveAction('');
    }
  };

  const createProduct = async () => {
    if (!newProduct.sku || !newProduct.name || !newProduct.category || !newProduct.cost_price) {
      setErr('SKU, Name, Category and Cost Price are required.'); return;
    }
    setCreating(true); setErr(''); setMsg('');
    try {
      await inventoryApi.createProduct({
        ...newProduct,
        category:      parseInt(newProduct.category),
        cost_price:    parseFloat(newProduct.cost_price),
        selling_price: parseFloat(newProduct.selling_price) || 0,
        vat_rate:      parseFloat(newProduct.vat_rate) || 16,
        reorder_point: parseFloat(newProduct.reorder_point) || 0,
        reorder_quantity: parseFloat(newProduct.reorder_quantity) || 0,
        lead_time_days:   parseInt(newProduct.lead_time_days) || 0,
      });
      setMsg('Product created successfully.');
      setShowNewForm(false);
      setNewProduct({ sku: '', name: '', category: '', product_type: 'Goods', unit_of_measure: 'Piece', valuation_method: 'WAC', cost_price: '', selling_price: '', vat_rate: 16, track_stock: true, reorder_point: 10, reorder_quantity: 50, preferred_supplier: '', lead_time_days: 7, description: '' });
      loadProducts();
    } catch (e) {
      setErr(e.response?.data?.sku?.[0] || e.response?.data?.name?.[0] || e.response?.data?.detail || 'Failed to create product.');
    } finally { setCreating(false); }
  };

  const stockColor = (p) => p.is_out_of_stock ? T.red : p.is_below_reorder_point ? T.amber : T.green;
  const stockLabel = (p) => p.is_out_of_stock ? 'Out of Stock' : p.is_below_reorder_point ? 'Low Stock' : 'In Stock';

  if (loading) return <Spin />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { setShowNewForm(!showNewForm); setMsg(''); setErr(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + New Product
        </button>
      </div>

      {/* New Product form */}
      {showNewForm && (
        <Card title="Add New Product">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>SKU *</p>
              <input value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="e.g. SKU-0100"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '2 / 4' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Product Name *</p>
              <input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g. Dell Latitude Laptop"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Category *</p>
              <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Product Type</p>
              <select value={newProduct.product_type} onChange={e => setNewProduct({ ...newProduct, product_type: e.target.value, track_stock: e.target.value === 'Goods' })}
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }}>
                <option value="Goods">Physical Goods</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Unit of Measure</p>
              <select value={newProduct.unit_of_measure} onChange={e => setNewProduct({ ...newProduct, unit_of_measure: e.target.value })}
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }}>
                {['Piece','Kg','Litre','Metre','Box','Carton','Hour','Month'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Valuation Method</p>
              <select value={newProduct.valuation_method} onChange={e => setNewProduct({ ...newProduct, valuation_method: e.target.value })}
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }}>
                <option value="WAC">Weighted Average Cost (WAC)</option>
                <option value="FIFO">First In First Out (FIFO)</option>
              </select>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Cost Price (KES) *</p>
              <input type="number" value={newProduct.cost_price} onChange={e => setNewProduct({ ...newProduct, cost_price: e.target.value })} placeholder="0"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Selling Price (KES)</p>
              <input type="number" value={newProduct.selling_price} onChange={e => setNewProduct({ ...newProduct, selling_price: e.target.value })} placeholder="0"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>VAT Rate (%)</p>
              <input type="number" value={newProduct.vat_rate} onChange={e => setNewProduct({ ...newProduct, vat_rate: e.target.value })} placeholder="16"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            {newProduct.product_type === 'Goods' && (<>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Reorder Point</p>
                <input type="number" value={newProduct.reorder_point} onChange={e => setNewProduct({ ...newProduct, reorder_point: e.target.value })} placeholder="10"
                  style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Reorder Quantity</p>
                <input type="number" value={newProduct.reorder_quantity} onChange={e => setNewProduct({ ...newProduct, reorder_quantity: e.target.value })} placeholder="50"
                  style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Lead Time (Days)</p>
                <input type="number" value={newProduct.lead_time_days} onChange={e => setNewProduct({ ...newProduct, lead_time_days: e.target.value })} placeholder="7"
                  style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </>)}
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: T.muted }}>Preferred Supplier</p>
              <input value={newProduct.preferred_supplier} onChange={e => setNewProduct({ ...newProduct, preferred_supplier: e.target.value })} placeholder="Supplier name"
                style={{ width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createProduct} disabled={creating}
              style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Saving…' : 'Save Product'}
            </button>
            <button onClick={() => { setShowNewForm(false); setErr(''); }}
              style={{ background: T.border, color: T.text, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Search & filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.card, borderRadius: 10, padding: '8px 14px', border: `1px solid ${T.border}`, flex: 1, minWidth: 200 }}>
          <Search size={14} color={T.muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU or barcode…"
            style={{ border: 'none', outline: 'none', fontSize: 12, color: T.text, width: '100%', background: 'transparent' }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Types</option>
          <option value="Goods">Goods</option>
          <option value="Service">Services</option>
        </select>
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Stock Levels</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {msg && <div style={{ padding: '10px 14px', background: T.greenDim, borderRadius: 8, fontSize: 13, color: T.green }}>{msg}</div>}
      {err && <div style={{ padding: '10px 14px', background: T.redDim,   borderRadius: 8, fontSize: 13, color: T.red   }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Product list */}
        <Card title={`Products (${products.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
            {products.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No products found.</p>}
            {products.map(p => (
              <div key={p.id} onClick={() => selectProduct(p)}
                style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                  background: selected?.id === p.id ? T.accentDim : T.bg,
                  border: `1px solid ${selected?.id === p.id ? T.accent : T.border}`,
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <code style={{ fontSize: 10, color: T.muted }}>{p.sku}</code>
                  <span style={{ ...pill(stockColor(p), stockColor(p) + '22'), fontSize: 10 }}>{stockLabel(p)}</span>
                </div>
                <p style={{ margin: '2px 0', fontWeight: 600, fontSize: 12 }}>{p.name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                  <span>{p.category_name} · {p.product_type}</span>
                  <span style={{ fontWeight: 700, color: T.text }}>
                    {p.product_type === 'Goods' ? `${p.total_stock} ${p.unit_of_measure}` : 'Service'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: T.muted }}>Cost: {usd(p.cost_price)}</span>
                  <span style={{ fontSize: 10, color: T.accent }}>{p.valuation_method}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Product detail */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${selected.sku} — ${selected.name}`}>
              {/* Badges */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(T.accent, T.accentDim) }}>{selected.product_type}</span>
                <span style={{ ...pill(T.blue, T.blueDim) }}>{selected.valuation_method}</span>
                <span style={{ ...pill(T.muted, '#f1f5f9') }}>{selected.unit_of_measure}</span>
                {selected.barcode && <span style={{ ...pill(T.muted, '#f1f5f9') }}>🔖 {selected.barcode}</span>}
              </div>

              {/* Financial metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Cost Price',    value: usd(selected.cost_price),    color: T.text   },
                  { label: 'Selling Price', value: usd(selected.selling_price), color: T.green  },
                  { label: 'Total Stock',   value: `${selected.total_stock} ${selected.unit_of_measure}`,
                    color: selected.is_out_of_stock ? T.red : selected.is_below_reorder_point ? T.amber : T.accent },
                  { label: 'Stock Value',   value: usd(selected.total_stock_value), color: T.text },
                  { label: 'Reorder Point', value: selected.reorder_point,      color: T.amber  },
                  { label: 'Reorder Qty',   value: selected.reorder_quantity,   color: T.blue   },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Per-warehouse stock */}
              {selected.inventory?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: T.muted }}>Stock by Warehouse</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected.inventory.map(inv => (
                      <div key={inv.id} style={{ background: T.bg, borderRadius: 10, padding: '8px 12px', fontSize: 11, minWidth: 100 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: T.accent }}>{inv.warehouse_code}</p>
                        <p style={{ margin: '2px 0 0', color: T.text }}>{inv.quantity_on_hand} on hand</p>
                        <p style={{ margin: '1px 0 0', color: T.muted }}>{inv.quantity_available} available</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons — Goods only */}
              {selected.product_type === 'Goods' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <WfButton label="Receive Stock"  icon={<ArrowDown size={13} />}       color={T.green}  onClick={() => setActiveAction(activeAction === 'receive'  ? '' : 'receive')}  />
                  <WfButton label="Issue Stock"    icon={<ArrowUp size={13} />}          color={T.blue}   onClick={() => setActiveAction(activeAction === 'issue'    ? '' : 'issue')}    />
                  <WfButton label="Transfer"       icon={<ArrowLeftRight size={13} />}  color={T.amber}  onClick={() => setActiveAction(activeAction === 'transfer' ? '' : 'transfer')} />
                  <WfButton label="Adjust Stock"   icon={<Wrench size={13} />}           color={T.red}    onClick={() => setActiveAction(activeAction === 'adjust'   ? '' : 'adjust')}   />
                </div>
              )}

              {/* ── Receive form ── */}
              {activeAction === 'receive' && (
                <div style={{ marginTop: 12, background: T.greenDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.green }}>Receive Stock</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select value={receiveForm.warehouse} onChange={e => setReceiveForm({ ...receiveForm, warehouse: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <input type="number" placeholder="Quantity" value={receiveForm.quantity}
                      onChange={e => setReceiveForm({ ...receiveForm, quantity: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="number" placeholder="Unit Cost (KES)" value={receiveForm.unit_cost}
                      onChange={e => setReceiveForm({ ...receiveForm, unit_cost: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Date (YYYY-MM-DD)" value={receiveForm.date}
                      onChange={e => setReceiveForm({ ...receiveForm, date: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Source Ref (PO number)" value={receiveForm.source_ref}
                      onChange={e => setReceiveForm({ ...receiveForm, source_ref: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Notes" value={receiveForm.notes}
                      onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <WfButton label="Confirm Receipt" icon={<CheckCircle size={13} />} color={T.green}
                      loading={actionLoading === 'Receive'}
                      onClick={() => action('Receive', () => inventoryApi.receiveStock(selected.id, {
                        warehouse: parseInt(receiveForm.warehouse),
                        quantity:  parseFloat(receiveForm.quantity),
                        unit_cost: parseFloat(receiveForm.unit_cost),
                        date: receiveForm.date, source_ref: receiveForm.source_ref, notes: receiveForm.notes,
                      }))} />
                    <button onClick={() => setActiveAction('')}
                      style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Issue form ── */}
              {activeAction === 'issue' && (
                <div style={{ marginTop: 12, background: T.blueDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.blue }}>Issue Stock</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select value={issueForm.warehouse} onChange={e => setIssueForm({ ...issueForm, warehouse: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <input type="number" placeholder="Quantity" value={issueForm.quantity}
                      onChange={e => setIssueForm({ ...issueForm, quantity: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Date (YYYY-MM-DD)" value={issueForm.date}
                      onChange={e => setIssueForm({ ...issueForm, date: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Source Ref (Invoice no.)" value={issueForm.source_ref}
                      onChange={e => setIssueForm({ ...issueForm, source_ref: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <WfButton label="Confirm Issue" icon={<ArrowUp size={13} />} color={T.blue}
                      loading={actionLoading === 'Issue'}
                      onClick={() => action('Issue', () => inventoryApi.issueStock(selected.id, {
                        warehouse: parseInt(issueForm.warehouse),
                        quantity:  parseFloat(issueForm.quantity),
                        date: issueForm.date, source_ref: issueForm.source_ref, notes: issueForm.notes,
                      }))} />
                    <button onClick={() => setActiveAction('')}
                      style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Transfer form ── */}
              {activeAction === 'transfer' && (
                <div style={{ marginTop: 12, background: T.amberDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.amber }}>Transfer Between Warehouses</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select value={transferForm.from_warehouse} onChange={e => setTransferForm({ ...transferForm, from_warehouse: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                      <option value="">From Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <select value={transferForm.to_warehouse} onChange={e => setTransferForm({ ...transferForm, to_warehouse: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                      <option value="">To Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <input type="number" placeholder="Quantity" value={transferForm.quantity}
                      onChange={e => setTransferForm({ ...transferForm, quantity: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Date (YYYY-MM-DD)" value={transferForm.date}
                      onChange={e => setTransferForm({ ...transferForm, date: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <WfButton label="Confirm Transfer" icon={<ArrowLeftRight size={13} />} color={T.amber}
                      loading={actionLoading === 'Transfer'}
                      onClick={() => action('Transfer', () => inventoryApi.transferStock(selected.id, {
                        from_warehouse: parseInt(transferForm.from_warehouse),
                        to_warehouse:   parseInt(transferForm.to_warehouse),
                        quantity:       parseFloat(transferForm.quantity),
                        date: transferForm.date, notes: transferForm.notes,
                      }))} />
                    <button onClick={() => setActiveAction('')}
                      style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Adjust form ── */}
              {activeAction === 'adjust' && (
                <div style={{ marginTop: 12, background: T.redDim, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: T.red }}>Stock Adjustment</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select value={adjustForm.warehouse} onChange={e => setAdjustForm({ ...adjustForm, warehouse: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <input type="number" placeholder="New Quantity (absolute)" value={adjustForm.new_quantity}
                      onChange={e => setAdjustForm({ ...adjustForm, new_quantity: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <select value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                      {['Damage', 'Expiry', 'Theft', 'Count_Variance', 'Return', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input type="text" placeholder="Date (YYYY-MM-DD)" value={adjustForm.date}
                      onChange={e => setAdjustForm({ ...adjustForm, date: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12 }} />
                    <input type="text" placeholder="Notes" value={adjustForm.notes}
                      onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, gridColumn: '1 / -1' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <WfButton label="Confirm Adjustment" icon={<Wrench size={13} />} color={T.red}
                      loading={actionLoading === 'Adjust'}
                      onClick={() => action('Adjust', () => inventoryApi.adjustStock(selected.id, {
                        warehouse:    parseInt(adjustForm.warehouse),
                        new_quantity: parseFloat(adjustForm.new_quantity),
                        reason: adjustForm.reason, date: adjustForm.date, notes: adjustForm.notes,
                      }))} />
                    <button onClick={() => setActiveAction('')}
                      style={{ background: T.border, color: T.text, border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card title="Select a product">
            <p style={{ color: T.muted, fontSize: 13 }}>
              Click a product on the left to view details, receive stock, issue, transfer, or adjust quantities.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── PURCHASE ORDERS ───────────────────────────────────────────
const POPanel = () => {
  const [pos, setPOs]           = useState([]);
  const [selected, setSelected] = useState(null);
  const [poDetail, setPODetail] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setMsg(''); setErr('');
    inventoryApi.getPOs(statusFilter ? { status: statusFilter } : {})
      .then(res => setPOs(res.data.results || res.data))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const selectPO = async (po) => {
    setSelected(po); setPODetail(null); setMsg(''); setErr('');
    const res = await inventoryApi.getPO(po.id);
    setPODetail(res.data);
  };

  const action = async (label, fn) => {
    setActionLoading(label); setErr(''); setMsg('');
    try {
      const res = await fn();
      setMsg(res.data.detail || 'Done.');
      load();
      if (selected) {
        const updated = await inventoryApi.getPO(selected.id);
        setSelected(updated.data); setPODetail(updated.data);
      }
    } catch (e) { setErr(e.response?.data?.detail || `${label} failed.`); }
    finally { setActionLoading(''); }
  };

  if (loading) return <Spin />;
  const poSC = selected ? (PO_STATUS_COLORS[selected.status] || PO_STATUS_COLORS.Draft) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && <div style={{ padding: '10px 14px', background: T.greenDim, borderRadius: 8, fontSize: 13, color: T.green }}>{msg}</div>}
      {err && <div style={{ padding: '10px 14px', background: T.redDim,   borderRadius: 8, fontSize: 13, color: T.red   }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Statuses</option>
          {['Draft', 'Approved', 'Partial', 'Received', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center' }}>{pos.length} orders</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* PO list */}
        <Card title={`Purchase Orders (${pos.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
            {pos.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>No purchase orders.</p>}
            {pos.map(po => {
              const sc = PO_STATUS_COLORS[po.status] || PO_STATUS_COLORS.Draft;
              return (
                <div key={po.id} onClick={() => selectPO(po)}
                  style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                    background: selected?.id === po.id ? T.accentDim : T.bg,
                    border: `1px solid ${selected?.id === po.id ? T.accent : T.border}`,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 11 }}>{po.po_number}</strong>
                    <span style={{ ...pill(sc.color, sc.bg), fontSize: 10 }}>{po.status}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontWeight: 500 }}>{po.supplier}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.muted }}>
                    <span>{po.warehouse_name}</span>
                    <span style={{ fontWeight: 700, color: T.text }}>{usd(po.total_amount)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: T.muted }}>
                    {po.order_date} · Expected: {po.expected_date || '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* PO detail */}
        {selected && poDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title={`${poDetail.po_number} — ${poDetail.supplier}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...pill(poSC.color, poSC.bg) }}>{poDetail.status}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{poDetail.warehouse_name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Subtotal',   value: usd(poDetail.subtotal),       color: T.text   },
                  { label: 'VAT',        value: usd(poDetail.vat_amount),     color: T.blue   },
                  { label: 'Total',      value: usd(poDetail.total_amount),   color: T.accent },
                  { label: 'Order Date', value: poDetail.order_date,          color: T.text   },
                  { label: 'Expected',   value: poDetail.expected_date || '—', color: T.amber },
                  { label: 'Lines',      value: poDetail.lines?.length,       color: T.text   },
                ].map(k => (
                  <div key={k.label} style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{k.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {poDetail.status === 'Draft' && (
                  <WfButton label="Approve PO" icon={<CheckCircle size={13} />} color={T.accent}
                    loading={actionLoading === 'Approve PO'}
                    onClick={() => action('Approve PO', () => inventoryApi.approvePO(poDetail.id))} />
                )}
                {['Approved', 'Partial'].includes(poDetail.status) && (
                  <WfButton label="Receive All Items" icon={<ArrowDown size={13} />} color={T.green}
                    loading={actionLoading === 'Receive PO'}
                    onClick={() => action('Receive PO', () => inventoryApi.receivePO(poDetail.id, { date: new Date().toISOString().split('T')[0] }))} />
                )}
                {!['Received', 'Cancelled'].includes(poDetail.status) && (
                  <WfButton label="Cancel PO" icon={<XCircle size={13} />} color={T.red}
                    loading={actionLoading === 'Cancel PO'}
                    onClick={() => action('Cancel PO', () => inventoryApi.cancelPO(poDetail.id))} />
                )}
              </div>
            </Card>

            {poDetail.lines?.length > 0 && (
              <Card title="PO Line Items">
                <Table
                  headers={['SKU', 'Product', 'Ordered', 'Received', 'Pending', 'Unit Cost', 'Total']}
                  rows={poDetail.lines.map(l => [
                    <code style={{ fontSize: 11 }}>{l.product_sku}</code>,
                    l.product_name,
                    l.quantity_ordered,
                    <span style={{ color: l.is_fully_received ? T.green : T.amber }}>{l.quantity_received}</span>,
                    l.quantity_pending,
                    usd(l.unit_cost),
                    <strong>{usd(l.line_total)}</strong>,
                  ])}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card title="Select a PO">
            <p style={{ color: T.muted, fontSize: 13 }}>Click a purchase order to view line items and manage receiving.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── MOVEMENTS ─────────────────────────────────────────────────
const MovementsPanel = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    inventoryApi.getMovements(typeFilter ? { movement_type: typeFilter } : {})
      .then(res => setMovements(res.data.results || res.data))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  if (loading) return <Spin />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, color: T.text }}>
          <option value="">All Movement Types</option>
          {['Receipt', 'Issue', 'Adjustment', 'Transfer', 'Write_Off', 'Opening', 'Return'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: T.muted }}>{movements.length} records</span>
      </div>
      <Card title="Stock Movement History">
        <Table
          headers={['Reference', 'Date', 'Product', 'Warehouse', 'Type', 'Qty', 'Unit Cost', 'Total']}
          rows={movements.map(m => {
            const mc = MOVE_COLORS[m.movement_type] || MOVE_COLORS.Opening;
            const isOut = ['Issue', 'Write_Off'].includes(m.movement_type);
            return [
              <code style={{ fontSize: 11 }}>{m.reference}</code>,
              m.date,
              <span style={{ fontSize: 11 }}>{m.product_sku} — {m.product_name}</span>,
              m.warehouse_name,
              <span style={{ ...pill(mc.color, mc.bg) }}>{m.movement_type}</span>,
              <span style={{ fontWeight: 700, color: isOut ? T.red : T.green }}>
                {isOut ? '−' : '+'}{m.quantity}
              </span>,
              usd(m.unit_cost),
              <strong>{usd(m.total_cost)}</strong>,
            ];
          })}
        />
      </Card>
    </div>
  );
};

// ── VALUATION ─────────────────────────────────────────────────
const ValuationPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryApi.getValuation()
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { label: 'Total WAC Value',  value: usd(data?.total_wac_value),  color: T.accent, subtitle: 'Weighted Average Cost' },
          { label: 'Total FIFO Value', value: usd(data?.total_fifo_value), color: T.blue,   subtitle: 'First In First Out'     },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
            <p style={{ margin: 0, fontSize: 12, color: T.muted }}>{k.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: T.muted }}>{k.subtitle} · as of {data?.as_of_date}</p>
          </div>
        ))}
      </div>
      <Card title={`Stock Valuation Report (${data?.products?.length || 0} products)`}>
        <Table
          headers={['SKU', 'Product', 'Category', 'Method', 'Qty', 'WAC Unit Cost', 'WAC Total', 'FIFO Total']}
          rows={(data?.products || []).map(p => [
            <code style={{ fontSize: 11 }}>{p.sku}</code>,
            p.name, p.category,
            <span style={{ ...pill(p.valuation_method === 'FIFO' ? T.blue : T.accent, p.valuation_method === 'FIFO' ? T.blueDim : T.accentDim) }}>{p.valuation_method}</span>,
            `${p.quantity} ${p.unit_of_measure}`,
            usd(p.wac_unit_cost),
            <strong style={{ color: T.accent }}>{usd(p.wac_total)}</strong>,
            <strong style={{ color: T.blue }}>{usd(p.fifo_total)}</strong>,
          ])}
        />
      </Card>
    </div>
  );
};

// ── REORDER ALERTS ────────────────────────────────────────────
const AlertsPanel = () => {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryApi.getReorderAlerts()
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { label: 'Critical — Out of Stock', value: data?.critical, color: T.red,   bg: T.redDim   },
          { label: 'Warning — Low Stock',     value: data?.warning,  color: T.amber, bg: T.amberDim },
        ].map(k => (
          <div key={k.label} style={{ background: T.card, borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,.06)', borderLeft: `4px solid ${k.color}` }}>
            <p style={{ margin: 0, fontSize: 12, color: T.muted }}>{k.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 700, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {data?.total_alerts === 0 ? (
        <Card title="Reorder Alerts">
          <p style={{ color: T.green, fontSize: 13 }}>✓ All stock levels are healthy — no reorder action needed.</p>
        </Card>
      ) : (
        <Card title={`${data?.total_alerts} Products Need Attention`}>
          <Table
            headers={['Alert', 'SKU', 'Product', 'Stock', 'Reorder Pt', 'Reorder Qty', 'Supplier', 'Lead Time']}
            rows={(data?.alerts || []).map(a => [
              <span style={{ ...pill(a.alert_level === 'critical' ? T.red : T.amber, a.alert_level === 'critical' ? T.redDim : T.amberDim) }}>
                {a.alert_level === 'critical' ? '🔴 Critical' : '🟡 Warning'}
              </span>,
              <code style={{ fontSize: 11 }}>{a.sku}</code>,
              a.name,
              <span style={{ fontWeight: 700, color: a.alert_level === 'critical' ? T.red : T.amber }}>{a.current_stock}</span>,
              a.reorder_point,
              <span style={{ color: T.blue }}>{a.reorder_quantity}</span>,
              a.preferred_supplier || '—',
              a.lead_time_days ? `${a.lead_time_days}d` : '—',
            ])}
          />
        </Card>
      )}
    </div>
  );
};

export default Inventory;
