import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard,
  BarChart2, HelpCircle, Settings, LogOut, Search,
  Bell, TrendingUp, AlertTriangle, DollarSign,
  FileText, RefreshCw, CheckCircle, Activity,
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import {
  BarChart, Bar, Cell, Tooltip, ResponsiveContainer,
  PieChart, Pie, CartesianGrid, XAxis, YAxis,
} from 'recharts';
import axios from 'axios';
import Finance   from './Finance';
import Inventory from './Inventory';
import Orders    from './Orders';
import Purchase  from './Purchase';
import Reporting from './Reporting';
import SupportPage from './Support';
import SettingsPage from './Settings';

// ── API ────────────────────────────────────────────────────────
const api = axios.create({ baseURL: 'http://localhost:8000/api' });

// ── Colours ────────────────────────────────────────────────────
const C = {
  sidebar:     '#1a2e35',
  sidebarHover:'#243b44',
  accent:      '#2fb8a0',
  accentDim:   '#e6f7f4',
  bg:          '#f0f4f8',
  card:        '#ffffff',
  text:        '#1a2e35',
  muted:       '#7a9199',
  border:      '#e2eaed',
  blue:        '#3b82f6',
  blueDim:     '#eff6ff',
  amber:       '#f59e0b',
  amberDim:    '#fffbeb',
  red:         '#ef4444',
  redDim:      '#fef2f2',
  green:       '#22c55e',
  greenDim:    '#f0fdf4',
  purple:      '#8b5cf6',
  purpleDim:   '#f5f3ff',
};

const usd = (n) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

const navItems = [
  { id:'dashboard', icon:<LayoutDashboard size={18}/>, label:'Dashboard' },
  { id:'finance',   icon:<DollarSign size={18}/>,      label:'Finance'   },
  { id:'inventory', icon:<Package size={18}/>,         label:'Inventory' },
  { id:'orders',    icon:<ShoppingCart size={18}/>,    label:'Orders'    },
  { id:'purchase',  icon:<CreditCard size={18}/>,      label:'Purchase'  },
  { id:'reporting', icon:<BarChart2 size={18}/>,       label:'Reporting' },
  { id:'support',   icon:<HelpCircle size={18}/>,      label:'Support'   },
  { id:'settings',  icon:<Settings size={18}/>,        label:'Settings'  },
];

// ── Shell ──────────────────────────────────────────────────────
const Dashboard = ({ userEmail }) => {
  const [active, setActive]       = useState('dashboard');
  const [notifCount, setNotifCount] = useState(0);
  const handleLogout = () => signOut(auth);

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'DM Sans',sans-serif", background:C.bg, overflow:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>

      {/* Sidebar */}
      <aside style={{ width:210, background:C.sidebar, display:'flex', flexDirection:'column', padding:'24px 0', flexShrink:0, boxShadow:'2px 0 12px rgba(0,0,0,.15)' }}>
        {/* Brand */}
        <div style={{ padding:'0 20px 20px', borderBottom:`1px solid rgba(255,255,255,.07)`, marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#2fb8a0,#1a7a6a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff' }}>E</div>
            <div>
              <p style={{ color:'#fff', fontWeight:700, fontSize:14, margin:0 }}>ERP System</p>
              <p style={{ color:C.muted, fontSize:10, margin:0 }}>Enterprise Suite</p>
            </div>
          </div>
        </div>

        {/* User badge */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px 16px', borderBottom:`1px solid rgba(255,255,255,.07)`, marginBottom:8 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#2fb8a0,#1a7a6a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
            {userEmail?.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow:'hidden' }}>
            <p style={{ color:'#fff', fontWeight:600, fontSize:12, margin:0 }}>Administrator</p>
            <p style={{ color:C.muted, fontSize:10, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{userEmail}</p>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex:1 }}>
          {navItems.map(({ id, icon, label }) => (
            <div key={id} onClick={() => setActive(id)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', cursor:'pointer', fontSize:13, transition:'all .15s',
                fontWeight: active===id ? 600 : 400,
                color:      active===id ? '#fff' : C.muted,
                background: active===id ? 'rgba(47,184,160,.15)' : 'transparent',
                borderLeft: active===id ? `3px solid ${C.accent}` : '3px solid transparent',
              }}>
              <span style={{ color: active===id ? C.accent : 'inherit' }}>{icon}</span>
              {label}
              {id === 'support' && notifCount > 0 && (
                <span style={{ marginLeft:'auto', background:C.red, color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{notifCount}</span>
              )}
            </div>
          ))}
        </nav>

        <div onClick={handleLogout}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', cursor:'pointer', color:'#e05c5c', fontSize:13, borderTop:`1px solid rgba(255,255,255,.07)` }}>
          <LogOut size={16}/> Logout
        </div>
      </aside>

      {/* Main area */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <header style={{ height:58, background:C.card, borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:C.text }}>
            {navItems.find(n => n.id === active)?.label || 'Dashboard'}
          </h2>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ position:'relative' }}>
              <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.muted }}/>
              <input placeholder="Search…" style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px 6px 30px', fontSize:12, outline:'none', width:180, color:C.text, background:C.bg }}/>
            </div>
            <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setActive('support')}>
              <Bell size={18} style={{ color:C.muted }}/>
              {notifCount > 0 && (
                <div style={{ position:'absolute', top:-4, right:-4, width:14, height:14, background:C.red, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700 }}>{notifCount}</div>
              )}
            </div>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#2fb8a0,#1a7a6a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer' }}>
              {userEmail?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          {active === 'dashboard' && <DashboardOverview onNavigate={setActive} onNotif={setNotifCount} />}
          {active === 'finance'   && <Finance />}
          {active === 'inventory' && <Inventory />}
          {active === 'orders'    && <Orders />}
          {active === 'purchase'  && <Purchase />}
          {active === 'reporting' && <Reporting />}
          {active === 'support'   && <SupportPage />}
          {active === 'settings'  && <SettingsPage />}
        </div>
      </main>
    </div>
  );
};

// ── DASHBOARD OVERVIEW ─────────────────────────────────────────
const DashboardOverview = ({ onNavigate, onNotif }) => {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, ord, pur, ar, ap, exec] = await Promise.allSettled([
        api.get('/inventory/dashboard/'),
        api.get('/orders/dashboard/'),
        api.get('/purchase/dashboard/'),
        api.get('/ar/dashboard/'),
        api.get('/ap/dashboard/'),
        api.get('/reporting/executive-summary/'),
      ]);
      const get = (r) => r.status === 'fulfilled' ? r.value.data : {};
      const invD = get(inv), ordD = get(ord), purD = get(pur);
      const arD  = get(ar),  apD  = get(ap),  execD = get(exec);

      // Badge count
      onNotif((invD.low_stock_count || 0) + (purD.pending_requisitions || 0) + (arD.overdue_count || 0));
      setData({ inv: invD, ord: ordD, pur: purD, ar: arD, ap: apD, exec: execD });
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [onNotif]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, gap:12, color:C.muted }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      <Activity size={32} color={C.accent} style={{ animation:'spin 1s linear infinite' }}/>
      <p style={{ fontSize:13 }}>Loading dashboard…</p>
    </div>
  );

  const fin = data?.exec?.finance || {};
  const inv = data?.inv           || {};
  const ord = data?.ord           || {};
  const pur = data?.pur           || {};
  const ar  = data?.ar            || {};
  const ap  = data?.ap            || {};

  const arApChart = [
    { name:'Receivables', value: parseFloat(ar.total_receivable || 0), fill:C.green  },
    { name:'Payables',    value: parseFloat(ap.total_payable    || 0), fill:C.red    },
    { name:'Overdue AR',  value: parseFloat(ar.overdue          || 0), fill:C.amber  },
    { name:'Overdue AP',  value: parseFloat(ap.overdue          || 0), fill:C.purple },
  ];

  const stockPie = [
    { name:'Healthy',      value: Math.max(0,(inv.total_products||0)-(inv.low_stock_count||0)-(inv.out_of_stock_count||0)) },
    { name:'Low Stock',    value: inv.low_stock_count    || 0 },
    { name:'Out of Stock', value: inv.out_of_stock_count || 0 },
  ].filter(d => d.value > 0);
  const PIE_COLORS = [C.accent, C.amber, C.red];

  const alerts = [
    { show:(inv.low_stock_count||0)>0,        label:`${inv.low_stock_count} products below reorder point`,  color:C.amber, nav:'inventory' },
    { show:(inv.out_of_stock_count||0)>0,      label:`${inv.out_of_stock_count} products out of stock`,       color:C.red,   nav:'inventory' },
    { show:parseFloat(ar.overdue||0)>0,        label:`Overdue receivables: ${usd(ar.overdue)}`,               color:C.red,   nav:'finance'   },
    { show:parseFloat(ap.overdue||0)>0,        label:`Overdue payables: ${usd(ap.overdue)}`,                  color:C.amber, nav:'finance'   },
    { show:(pur.pending_requisitions||0)>0,    label:`${pur.pending_requisitions} requisitions need approval`, color:C.blue,  nav:'purchase'  },
    { show:(ord.overdue_sales_orders||0)>0,    label:`${ord.overdue_sales_orders} sales orders are overdue`,  color:C.red,   nav:'orders'    },
  ].filter(a => a.show);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18, fontFamily:"'DM Sans',sans-serif" }}>

      {/* Toolbar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ margin:0, fontWeight:700, fontSize:17, color:C.text }}>Business Overview</p>
          {lastRefresh && <p style={{ margin:'2px 0 0', fontSize:11, color:C.muted }}>Last refreshed {lastRefresh}</p>}
        </div>
        <button onClick={load}
          style={{ display:'flex', alignItems:'center', gap:6, background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:'7px 14px', fontSize:12, color:C.text, cursor:'pointer' }}>
          <RefreshCw size={12} color={C.accent}/> Refresh
        </button>
      </div>

      {/* Primary KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {[
          { label:'Total Revenue',       value:usd(fin.revenue),               color:C.green,  bg:C.greenDim,  icon:<TrendingUp size={20} color={C.green} />,  nav:'reporting'  },
          { label:'Inventory Value',     value:usd(inv.total_inventory_value), color:C.accent, bg:C.accentDim, icon:<Package size={20} color={C.accent} />,    nav:'inventory'  },
          { label:'Active Sales Orders', value:ord.active_sales_orders ?? '—', color:C.blue,   bg:C.blueDim,   icon:<ShoppingCart size={20} color={C.blue} />, nav:'orders'     },
          { label:'Total Receivables',   value:usd(ar.total_receivable),       color:C.purple, bg:C.purpleDim, icon:<FileText size={20} color={C.purple} />,   nav:'finance'    },
        ].map(k => (
          <div key={k.label} onClick={() => onNavigate(k.nav)}
            style={{ background:C.card, borderRadius:14, padding:'16px 18px', boxShadow:'0 1px 8px rgba(0,0,0,.06)', display:'flex', alignItems:'center', gap:12, cursor:'pointer', transition:'all .15s' }}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 18px rgba(0,0,0,.10)'}}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';  e.currentTarget.style.boxShadow='0 1px 8px rgba(0,0,0,.06)'}}>
            <div style={{ width:44, height:44, borderRadius:12, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{k.icon}</div>
            <div>
              <p style={{ margin:0, fontSize:19, fontWeight:700, color:k.color }}>{k.value}</p>
              <p style={{ margin:0, fontSize:11, color:C.muted }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12 }}>
        {[
          { label:'Net Income',         value:usd(fin.net_income),           color:parseFloat(fin.net_income||0)>=0?C.green:C.red },
          { label:'Total Payables',     value:usd(ap.total_payable),         color:C.red    },
          { label:'Overdue AR',         value:usd(ar.overdue),               color:C.amber  },
          { label:'Low Stock',          value:inv.low_stock_count ?? '—',    color:C.amber  },
          { label:'Pending Deliveries', value:ord.pending_deliveries ?? '—', color:C.blue   },
          { label:'Active Suppliers',   value:pur.active_suppliers  ?? '—',  color:C.accent },
        ].map(k => (
          <div key={k.label} style={{ background:C.card, borderRadius:12, padding:'12px 14px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
            <p style={{ margin:0, fontSize:10, color:C.muted }}>{k.label}</p>
            <p style={{ margin:'4px 0 0', fontSize:16, fontWeight:700, color:k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap:16 }}>

        <Card title="AR / AP Overview" nav="finance" onNavigate={onNavigate}>
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={arApChart} margin={{top:4,right:4,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="name" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v=>usd(v)}/>
              <Bar dataKey="value" radius={[6,6,0,0]}>
                {arApChart.map((d,i)=><Cell key={i} fill={d.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Stock Status" nav="inventory" onNavigate={onNavigate}>
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:4 }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={stockPie} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                  {stockPie.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {stockPie.map((d,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                  <span style={{ width:10,height:10,borderRadius:2,background:PIE_COLORS[i],display:'inline-block',flexShrink:0 }}/>
                  <span style={{ color:C.muted }}>{d.name}:</span>
                  <strong style={{ color:C.text }}>{d.value}</strong>
                </div>
              ))}
              <p style={{ margin:'4px 0 0', fontSize:10, color:C.muted }}>Total: <strong style={{ color:C.text }}>{inv.total_products||0}</strong></p>
            </div>
          </div>
        </Card>

        <Card title="Orders Status" nav="orders" onNavigate={onNavigate}>
          <div style={{ display:'flex', flexDirection:'column', gap:7, paddingTop:4 }}>
            {[
              { label:'Active SO',          value:ord.active_sales_orders     ||0, color:C.amber  },
              { label:'Delivered MTD',      value:ord.delivered_mtd           ||0, color:C.green  },
              { label:'Pending POs',        value:ord.pending_purchase_orders ||0, color:C.blue   },
              { label:'Open Deliveries',    value:ord.pending_deliveries      ||0, color:C.purple },
              { label:'Open Quotations',    value:ord.pending_quotations      ||0, color:C.muted  },
            ].map(r=>(
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                <span style={{ color:C.muted }}>{r.label}</span>
                <span style={{ fontWeight:700, color:r.color, background:r.color+'18', padding:'2px 9px', borderRadius:10, fontSize:11 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Finance + Purchase row */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:16 }}>

        <Card title="Financial Highlights" nav="reporting" onNavigate={onNavigate}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[
              { label:'Revenue',     value:usd(fin.revenue),          color:C.green  },
              { label:'Expenses',    value:usd(fin.expenses),         color:C.red    },
              { label:'Net Income',  value:usd(fin.net_income),       color:parseFloat(fin.net_income||0)>=0?C.accent:C.amber },
              { label:'Assets',      value:usd(fin.total_assets),     color:C.blue   },
              { label:'Liabilities', value:usd(fin.total_liabilities),color:C.red    },
              { label:'Equity',      value:usd(fin.equity),           color:C.accent },
            ].map(k=>(
              <div key={k.label} style={{ background:C.bg, borderRadius:8, padding:'8px 10px' }}>
                <p style={{ margin:0, fontSize:10, color:C.muted }}>{k.label}</p>
                <p style={{ margin:'3px 0 0', fontSize:13, fontWeight:700, color:k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Purchase Snapshot" nav="purchase" onNavigate={onNavigate}>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {[
              { label:'Active Suppliers',      value:pur.active_suppliers      ||0,    color:C.accent },
              { label:'Pending Requisitions',  value:pur.pending_requisitions  ||0,    color:C.amber  },
              { label:'GRNs This Month',        value:pur.grns_this_month       ||0,    color:C.blue   },
              { label:'Budget Utilized',        value:`${pur.budget_utilization ||0}%`, color:(pur.budget_utilization||0)>90?C.red:C.green },
              { label:'Budget Remaining',       value:usd(pur.budget_remaining),       color:C.text   },
            ].map(r=>(
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                <span style={{ color:C.muted }}>{r.label}</span>
                <span style={{ fontWeight:700, color:r.color }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alerts + Quick Actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        <Card title="⚠ Active Alerts">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {alerts.length === 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, color:C.green, fontSize:13, padding:'8px 0' }}>
                <CheckCircle size={16}/> All systems healthy — no alerts
              </div>
            ) : alerts.map((a,i) => (
              <div key={i} onClick={() => onNavigate(a.nav)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:a.color+'14', borderRadius:10, cursor:'pointer', border:`1px solid ${a.color}33` }}>
                <AlertTriangle size={13} color={a.color}/>
                <span style={{ fontSize:12, color:a.color, fontWeight:600, flex:1 }}>{a.label}</span>
                <span style={{ fontSize:10, color:a.color }}>View →</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick Actions">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:'New Sales Order',  icon:'🛒', nav:'orders',    bg:C.blueDim,   color:C.blue   },
              { label:'Receive Stock',    icon:'📦', nav:'inventory', bg:C.accentDim, color:C.accent },
              { label:'Run Reports',      icon:'📊', nav:'reporting', bg:C.purpleDim, color:C.purple },
              { label:'New Requisition',  icon:'📋', nav:'purchase',  bg:C.amberDim,  color:C.amber  },
              { label:'View Deliveries',  icon:'🚚', nav:'orders',    bg:C.blueDim,   color:C.blue   },
              { label:'Support Ticket',   icon:'🎧', nav:'support',   bg:C.accentDim, color:C.accent },
              { label:'Asset Register',   icon:'🏗',  nav:'reporting', bg:C.greenDim,  color:C.green  },
              { label:'Settings',         icon:'⚙️', nav:'settings',  bg:'#f1f5f9',   color:C.muted  },
            ].map(a => (
              <div key={a.label} onClick={() => onNavigate(a.nav)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 13px', background:a.bg, borderRadius:10, cursor:'pointer', transition:'transform .15s', border:`1px solid ${a.color}22` }}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.03)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                <span style={{ fontSize:17 }}>{a.icon}</span>
                <span style={{ fontSize:12, fontWeight:600, color:a.color }}>{a.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* AR + AP detail */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card title="Accounts Receivable" nav="finance" onNavigate={onNavigate}>
          {[
            { label:'Total Receivable', value:usd(ar.total_receivable), color:C.green  },
            { label:'Overdue Amount',   value:usd(ar.overdue),          color:C.red    },
            { label:'Collected MTD',    value:usd(ar.collected_mtd),    color:C.accent },
            { label:'Open Invoices',    value:ar.invoice_count ?? '—',  color:C.text   },
            { label:'Overdue Invoices', value:ar.overdue_count ?? '—',  color:C.amber  },
          ].map(r=>(
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
              <span style={{ color:C.muted }}>{r.label}</span>
              <span style={{ fontWeight:700, color:r.color }}>{r.value}</span>
            </div>
          ))}
        </Card>

        <Card title="Accounts Payable" nav="finance" onNavigate={onNavigate}>
          {[
            { label:'Total Payable',  value:usd(ap.total_payable), color:C.red    },
            { label:'Overdue Amount', value:usd(ap.overdue),       color:C.amber  },
            { label:'Paid MTD',       value:usd(ap.paid_mtd),      color:C.green  },
            { label:'Open Bills',     value:ap.bill_count ?? '—',  color:C.text   },
            { label:'Overdue Bills',  value:ap.overdue_count ?? '—', color:C.amber},
          ].map(r=>(
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
              <span style={{ color:C.muted }}>{r.label}</span>
              <span style={{ fontWeight:700, color:r.color }}>{r.value}</span>
            </div>
          ))}
        </Card>
      </div>

    </div>
  );
};

// ── Shared Card ────────────────────────────────────────────────
const Card = ({ title, children, nav, onNavigate }) => (
  <div style={{ background:C.card, borderRadius:14, padding:'16px 18px', boxShadow:'0 1px 6px rgba(0,0,0,.06)' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
      <p style={{ margin:0, fontWeight:600, fontSize:13, color:C.text }}>{title}</p>
      {nav && onNavigate && (
        <span onClick={() => onNavigate(nav)} style={{ fontSize:11, color:C.accent, cursor:'pointer' }}>View →</span>
      )}
    </div>
    {children}
  </div>
);

export default Dashboard;