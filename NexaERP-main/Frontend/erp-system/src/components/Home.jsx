import React, { useEffect, useRef, useState } from 'react';

/**
 * Landing page rendered as a full React component at /home
 * All styles, scripts and HTML are self-contained here.
 */
const Home = () => {
  const [annual, setAnnual]           = useState(false);
  const [openFaq, setOpenFaq]         = useState(null);
  const [selectedRating, setRating]   = useState(0);
  const [showPayModal, setPayModal]   = useState(false);
  const [currentPlan, setCurrentPlan] = useState('professional');
  const [payStep, setPayStep]         = useState('form'); // form | processing | success
  const [payMsg, setPayMsg]           = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const navRef = useRef(null);

  // Scroll nav shadow
  useEffect(() => {
    const handler = () => {
      if (navRef.current)
        navRef.current.style.boxShadow = window.scrollY > 20
          ? '0 2px 32px rgba(28,25,23,.09)' : 'none';
    };
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Scroll-reveal
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.transition = 'opacity .55s ease, transform .55s ease';
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Page title
  useEffect(() => {
    document.title = 'NexaERP — Run Your Business Smarter';
    return () => { document.title = 'NexaERP'; };
  }, []);

  const planCfg = {
    starter:      { badge: 'Starter Plan',      monthly: 8500,  annual: 6800  },
    professional: { badge: 'Professional Plan', monthly: 18500, annual: 14800 },
  };

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const initPayment = (plan) => {
    setCurrentPlan(plan);
    setPayStep('form');
    setPayMsg('');
    setPayModal(true);
  };

  const processPayment = async (e) => {
    e.preventDefault();
    const name   = e.target.querySelector('#pay-name').value.trim();
    const email  = e.target.querySelector('#pay-email').value.trim();
    const phone  = e.target.querySelector('#pay-phone').value.trim();
    const method = e.target.querySelector('#pay-method').value;
    if (!name || !email || !phone) return;

    const kes = annual ? planCfg[currentPlan].annual : planCfg[currentPlan].monthly;

    setPayStep('processing');
    setPayMsg(method === 'mpesa' ? `Sending M-Pesa STK push to ${phone}...` : 'Connecting to Paystack...');

    // ── Option A: NexaPay microservice (when running on port 8001) ──
    const PAYMENT_API     = 'http://localhost:8001';
    const NEXAPAY_API_KEY = 'npk_your_key_here'; // replace after running: POST /api/v1/apps/register

    const payload = {
      amount:      kes,
      currency:    'KES',
      description: `NexaERP ${planCfg[currentPlan].badge} — ${annual ? 'annual' : 'monthly'}`,
      method,
      customer:    { name, email, phone },
      metadata:    { plan: currentPlan, billing: annual ? 'annual' : 'monthly', trial_days: 14 },
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      const res  = await fetch(`${PAYMENT_API}/api/v1/pay/initiate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': NEXAPAY_API_KEY },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      const data = await res.json();
      if (data.checkout_url) {
        setPayMsg('Redirecting to Paystack...');
        setTimeout(() => { window.location.href = data.checkout_url; }, 600);
        return;
      }
    } catch (err) {
      // Microservice not running — fall through to Option B
      console.warn('[NexaERP] Microservice unavailable, falling back to direct Paystack:', err.message);
    }

    // ── Option B: Direct Paystack initialization (fallback) ──
    // Uses your Paystack public key to initialize directly from the browser
    try {
      setPayMsg('Connecting to Paystack...');
      const PAYSTACK_PUBLIC_KEY = 'pk_test_342235261339d71646636ac1eccc06d24efcd438'; // your key from .env

      const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${PAYSTACK_PUBLIC_KEY}`,
        },
        body: JSON.stringify({
          email:        email,
          amount:       kes * 100,
          currency:     'KES',
          reference:    `NEXA-${Date.now()}`,
          callback_url: window.location.origin + '/payment/success',
          metadata: {
            customer_name:  name,
            customer_phone: phone,
            plan:           currentPlan,
            billing:        annual ? 'annual' : 'monthly',
          },
          channels: method === 'mpesa' ? ['mobile_money'] : method === 'card' ? ['card'] : ['bank_transfer', 'card'],
        }),
      });
      const psData = await psRes.json();
      if (psData.data?.authorization_url) {
        setPayMsg('Redirecting to Paystack...');
        setTimeout(() => { window.location.href = psData.data.authorization_url; }, 600);
        return;
      }
    } catch (err) {
      console.error('[NexaERP] Paystack direct call failed:', err);
    }

    setPayMsg('Payment service unavailable. Please contact us directly.');
    setTimeout(() => setPayStep('form'), 4000);
  };

  const submitReview = (e) => {
    e.preventDefault();
    const name   = e.target.querySelector('#rv-name').value.trim();
    const review = e.target.querySelector('#rv-msg').value.trim();
    if (!name || !review || selectedRating === 0) {
      alert('Please add your name, a star rating, and your review.');
      return;
    }
    setReviewSuccess(true);
    setRating(0);
    e.target.reset();
    setTimeout(() => setReviewSuccess(false), 6000);
  };

  const submitContact = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    // ── EmailJS (free tier — 200 emails/month) ──────────────────
    // Setup: https://www.emailjs.com
    // 1. Create free account → Add Email Service → Add Template
    // 2. Replace the three IDs below with yours
    const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
    const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
    const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';

    const templateParams = {
      from_name:   `${fd.get('first_name')} ${fd.get('last_name')}`,
      from_email:  fd.get('email'),
      phone:       fd.get('phone') || 'Not provided',
      company:     fd.get('company'),
      interest:    fd.get('interest'),
      message:     fd.get('message') || 'No message',
      reply_to:    fd.get('email'),
      to_email:    'mutheuw62@gmail.com',
    };

    try {
      if (EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID') {
        await fetch(`https://api.emailjs.com/api/v1.0/email/send`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id:  EMAILJS_SERVICE_ID,
            template_id: EMAILJS_TEMPLATE_ID,
            user_id:     EMAILJS_PUBLIC_KEY,
            template_params: templateParams,
          }),
        });
      } else {
        // EmailJS not configured yet — log to console
        console.log('[NexaERP] Contact form submission:', templateParams);
        console.warn('Configure EmailJS to receive emails. See: https://www.emailjs.com');
      }
    } catch (err) {
      console.error('Email send failed:', err);
    }

    setFormSuccess(true);
  };

  // ── Styles ─────────────────────────────────────────────────────
  const S = {
    page: { fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#1c1917', background: '#fff', overflowX: 'hidden', lineHeight: '1.65' },
    nav: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5vw', height: 70, background: 'rgba(250,247,242,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(229,221,213,.6)', transition: 'box-shadow .3s' },
    brand: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 20 },
    brandMark: { width: 38, height: 38, borderRadius: 10, background: '#1a6b5a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 800 },
    navLinks: { display: 'flex', gap: 28, listStyle: 'none' },
    navLink: { fontSize: 14, fontWeight: 500, color: '#6b5f57', cursor: 'pointer', transition: 'color .2s' },
    btnPill: { fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#fff', background: '#1a6b5a', border: 'none', cursor: 'pointer', padding: '10px 22px', borderRadius: 100, transition: 'background .2s' },
    btnText: { background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#6b5f57', cursor: 'pointer' },
  };

  const T = { green: '#1a6b5a', greenMid: '#2a9070', greenLt: '#e6f7f4', cream: '#faf7f2', warm: '#f5ede0', ink: '#1c1917', ink2: '#3d3530', ink3: '#6b5f57', muted: '#a0948c', border: '#e5ddd5', amber: '#c8670a', amberLt: '#fef3e2', red: '#ef4444', blue: '#1e5fa0' };

  const btn = (color, bg, pad = '14px 32px') => ({
    fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color, background: bg,
    border: 'none', cursor: 'pointer', padding: pad, borderRadius: 100, transition: 'all .2s',
  });

  const input = { fontFamily: 'inherit', fontSize: 14, color: T.ink, background: T.cream, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '11px 14px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  const card = { background: '#fff', borderRadius: 14, border: `1px solid ${T.border}`, padding: 24 };

  const FAQS = [
    { q: 'Is NexaERP KRA compliant?', a: 'Yes — fully. The payroll module uses 2024 KRA PAYE bands, NSSF Tier I & II, SHIF at 2.75%, and Housing Levy at 1.5%. It generates P10, NSSF, SHIF, and bank payment files in the exact formats required.' },
    { q: 'Do I need a consultant to set it up?', a: 'No. NexaERP is designed for self-service onboarding. Most businesses are fully configured and live within 4–14 hours. We provide a guided setup wizard, sample data, and live chat support.' },
    { q: 'Can I import my existing data?', a: 'Yes. NexaERP supports CSV import for customers, suppliers, products, employees, and opening balances. Our team can help migrate from QuickBooks, Sage, Tally, or Excel.' },
    { q: 'Is there a mobile app?', a: 'NexaERP is fully responsive and works on any device. A dedicated mobile app is on the roadmap for Q3 2026.' },
    { q: 'Can we run it on our own servers?', a: 'Yes — Enterprise customers can deploy on-premise or in their own cloud (AWS, Azure, GCP). The stack is Django + PostgreSQL + React.' },
    { q: 'What happens to my data if I cancel?', a: 'Your data belongs to you. On cancellation we provide a full export in CSV and JSON. We retain your data for 90 days after cancellation.' },
  ];

  const MODULES = [
    { icon: '💰', name: 'Finance & GL',      desc: 'Double-entry accounting, journal entries, trial balance, P&L.',           tags: ['AR', 'AP', 'GL'] },
    { icon: '👥', name: 'HR & Payroll',       desc: 'KRA-compliant payroll with PAYE, NSSF, SHIF, Housing Levy.',              tags: ['PAYE', 'P10', 'NSSF'] },
    { icon: '📦', name: 'Inventory',           desc: 'Multi-warehouse stock with WAC & FIFO costing, reorder alerts.',          tags: ['WAC', 'FIFO', 'GRN'] },
    { icon: '🛒', name: 'Orders',              desc: 'Quotations → Sales Orders → Delivery, with auto AR invoicing.',           tags: ['Sales', 'Delivery'] },
    { icon: '🏭', name: 'Purchase',            desc: 'Suppliers, requisitions, GRNs, budgets, and performance ratings.',        tags: ['PR', 'Suppliers'] },
    { icon: '📊', name: 'Reporting',           desc: 'Executive summary, aging reports, inventory valuation, CSV export.',      tags: ['Analytics', 'CSV'] },
    { icon: '🏗', name: 'Fixed Assets',        desc: 'Asset register, SLM & DBM depreciation, disposal, revaluation.',         tags: ['Depreciation'] },
    { icon: '🎧', name: 'Support',             desc: 'Ticket management, FAQ, live chat assistant, system health.',             tags: ['Tickets', 'Chat'] },
    { icon: '⚙️', name: 'Settings & Users',   desc: 'Company profile, user roles, audit log, notification preferences.',       tags: ['RBAC', 'Audit'] },
  ];

  const TESTIMONIALS = [
    { photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&crop=face', name: 'Amina Wanjiku',  role: 'Finance Director, Naivas Distributors', stars: 5, quote: '"NexaERP replaced three systems we were using. Payroll used to take two full days — now it\'s done in under an hour, and KRA compliance is automatic."' },
    { photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face', name: 'Daniel Omondi',  role: 'Operations Manager, Delta Supplies Ltd', stars: 5, quote: '"Real-time stock levels across Nairobi, Mombasa, and Kisumu simultaneously. FIFO costing is exactly what our FMCG business needed."' },
    { photo: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&h=120&fit=crop&crop=face', name: 'Fatuma Hassan',  role: 'CEO, HorizonTech Kenya',                stars: 5, quote: '"The purchase requisition workflow transformed procurement. No more WhatsApp approvals — everything is tracked, audited, and within budget."' },
  ];

  return (
    <>
      <div style={S.page}>

        {/* ── NAV ─────────────────────────────────────────────── */}
        <nav ref={navRef} style={S.nav}>
          <div style={S.brand}>
            <div style={S.brandMark}>N</div>
            NexaERP
          </div>
          <ul style={S.navLinks}>
            {['features','modules','pricing','testimonials','contact'].map(id => (
              <li key={id} style={S.navLink} onClick={() => scrollTo(id)}>
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button style={S.btnText} onClick={() => window.location.href = '/login'}>Sign in</button>
            <button style={S.btnPill} onClick={() => scrollTo('contact')}>Get Started Free</button>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────── */}
        <section style={{ paddingTop: 140, paddingBottom: 80, paddingLeft: '5vw', paddingRight: '5vw', background: T.cream, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: T.greenLt, color: T.green, borderRadius: 100, padding: '6px 14px', fontSize: 13, fontWeight: 600, marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, animation: 'blink 2s infinite', display: 'inline-block' }} />
              Trusted by 200+ businesses across East Africa
            </div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(38px,4.5vw,64px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.02em', color: T.ink, marginBottom: 20 }}>
              Run your business{' '}
              <em style={{ fontStyle: 'italic', fontWeight: 400, color: T.greenMid }}>the smart way</em>
              {' '}— all from one place
            </h1>
            <p style={{ fontSize: 17, color: T.ink3, lineHeight: 1.75, maxWidth: 480, marginBottom: 36 }}>
              Finance, payroll, inventory, orders, and procurement — fully integrated, beautifully designed, and built for Kenyan businesses.
            </p>
            <div style={{ display: 'flex', gap: 14, marginBottom: 40 }}>
              <button style={{ ...btn('#fff', T.green), boxShadow: '0 4px 20px rgba(26,107,90,.3)' }} onClick={() => scrollTo('contact')}>Start Free 14-Day Trial</button>
              <button style={{ ...btn(T.ink3, 'none'), border: `1.5px solid ${T.border}`, fontSize: 15 }} onClick={() => scrollTo('features')}>See how it works</button>
            </div>
            {/* Social proof */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex' }}>
                {[
                  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&crop=face',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
                  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=80&h=80&fit=crop&crop=face',
                  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&h=80&fit=crop&crop=face',
                  'https://images.unsplash.com/photo-1494790108755-2616b612b5ff?w=80&h=80&fit=crop&crop=face',
                ].map((src, i) => (
                  <img key={i} src={src} alt="customer" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', marginLeft: i === 0 ? 0 : -10, border: `2.5px solid ${T.cream}` }} />
                ))}
              </div>
              <div>
                <div style={{ color: '#f59e0b', fontSize: 12, letterSpacing: 1 }}>★★★★★</div>
                <div style={{ fontSize: 13, color: T.ink3 }}><strong style={{ color: T.ink }}>4.9/5</strong> from 180+ verified reviews</div>
              </div>
            </div>
          </div>

          {/* Hero photo collage */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '280px 220px', gap: 14, position: 'relative' }}>
            {/* Tall card */}
            <div style={{ gridRow: 'span 2', borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
              <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&h=600&fit=crop&crop=center" alt="Business team working" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 20, left: -20, background: 'rgba(255,255,255,.95)', borderRadius: 14, padding: '12px 16px', boxShadow: '0 8px 32px rgba(28,25,23,.12)' }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 700, color: T.green }}>↑ 40%</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.ink3 }}>Team Efficiency</div>
              </div>
            </div>
            {/* Top right */}
            <div style={{ borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
              <img src="https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=280&fit=crop&crop=center" alt="Finance dashboard" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 16, right: -16, background: 'rgba(255,255,255,.95)', borderRadius: 14, padding: '12px 16px', boxShadow: '0 8px 32px rgba(28,25,23,.12)' }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 700, color: T.green }}>KES 51M</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.ink3 }}>Inventory Value</div>
              </div>
            </div>
            {/* Bottom right */}
            <div style={{ borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
              <img src="https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?w=400&h=220&fit=crop&crop=center" alt="Team collaboration" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 12, right: 8, background: 'rgba(255,255,255,.95)', borderRadius: 14, padding: '10px 14px', boxShadow: '0 8px 32px rgba(28,25,23,.12)' }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700, color: T.amber }}>200+</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.ink3 }}>Businesses live</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────── */}
        <section id="features" style={{ padding: '96px 5vw', background: '#fff' }}>
          {[
            {
              tag: 'Finance & Accounting', reverse: false,
              img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=700&h=500&fit=crop&crop=center',
              h: <>Know exactly <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>where every shilling goes</em></>,
              p: 'Full double-entry accounting with real-time P&L, trial balance, and cash flow. Stop guessing — start knowing.',
              items: ['General ledger with journal entry posting workflow','Accounts Receivable with aging and invoice tracking','Accounts Payable with vendor bills and WHT','Fixed assets with SLM & DBM depreciation','KRA-compliant payroll — PAYE, NSSF, SHIF, Housing Levy'],
            },
            {
              tag: 'Inventory & Stock Control', reverse: true,
              img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=700&h=500&fit=crop&crop=center',
              h: <>Stock that <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>manages itself</em> — across all locations</>,
              p: 'Multi-warehouse stock tracking with automated reorder alerts. Never lose a sale to a stockout again.',
              items: ['3 warehouse support — Nairobi, Mombasa, Kisumu','WAC & FIFO cost valuation methods','Receive, issue, transfer, and adjust stock','Automatic reorder point alerts','Full movement history and audit trail'],
            },
            {
              tag: 'HR & Payroll', reverse: false,
              img: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=700&h=500&fit=crop&crop=center',
              h: <>Payroll done in <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>minutes, not days</em></>,
              p: 'KRA-compliant payroll with automatic tax calculations. From salaries to statutory filings — fully automated.',
              items: ['2024 PAYE bands auto-calculated','NSSF Tier I & II, SHIF 2.75%, Housing Levy 1.5%','HR → Finance → Pay multi-step approval','P10, NSSF, SHIF statutory report exports','Bank payment file in one click'],
            },
          ].map((f, i) => (
            <div key={i} className="reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center', marginBottom: i < 2 ? 96 : 0, direction: f.reverse ? 'rtl' : 'ltr' }}>
              <div style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '4/3', direction: 'ltr' }}>
                <img src={f.img} alt={f.tag} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ direction: 'ltr' }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: T.green, marginBottom: 12 }}>{f.tag}</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(24px,2.5vw,36px)', fontWeight: 700, lineHeight: 1.15, color: T.ink, marginBottom: 14 }}>{f.h}</h2>
                <p style={{ fontSize: 16, color: T.ink3, lineHeight: 1.75, marginBottom: 24 }}>{f.p}</p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {f.items.map((item, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: T.ink2 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: T.greenLt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: T.green, flexShrink: 0, marginTop: 1 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button style={{ ...btn('#fff', T.green, '12px 24px'), fontSize: 14, boxShadow: '0 4px 16px rgba(26,107,90,.25)' }} onClick={() => scrollTo('contact')}>
                  See it in action →
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* ── MODULES ─────────────────────────────────────────── */}
        <section id="modules" style={{ padding: '96px 5vw', background: T.cream }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.green, marginBottom: 14 }}>
              <span style={{ width: 18, height: 2, background: T.green, display: 'inline-block', borderRadius: 1 }} /> All Modules
            </div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700, color: T.ink, lineHeight: 1.12 }}>9 modules. <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>One subscription.</em></h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {MODULES.map((m, i) => (
              <div key={i} className="reveal" style={{ ...card, transition: 'transform .2s, box-shadow .2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(28,25,23,.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{m.icon}</div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.6, marginBottom: 14 }}>{m.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {m.tags.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 600, color: T.green, background: T.greenLt, borderRadius: 100, padding: '3px 10px' }}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── STATS ───────────────────────────────────────────── */}
        <div style={{ background: T.warm, padding: '80px 5vw', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
          <div style={{ borderRadius: 24, overflow: 'hidden', aspectRatio: '5/4' }}>
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=700&h=560&fit=crop&crop=center" alt="Team at work" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.green, marginBottom: 14 }}>
              <span style={{ width: 18, height: 2, background: T.green, display: 'inline-block', borderRadius: 1 }} /> By the numbers
            </div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(28px,3vw,44px)', fontWeight: 700, color: T.ink, marginBottom: 40 }}>Businesses <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>thrive</em> on NexaERP</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
              {[
                { val: '200+', label: 'Businesses running on NexaERP today' },
                { val: '40%',  label: 'Average reduction in admin time' },
                { val: '4 hrs',label: 'Average onboarding to go-live' },
                { val: '99.9%',label: 'Uptime across all servers' },
              ].map(s => (
                <div key={s.val}>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: 48, fontWeight: 700, color: T.green, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: 15, color: T.ink3, marginTop: 6 }}>{s.label}</div>
                  <div style={{ height: 2, width: 32, background: T.greenLt, marginTop: 10, borderRadius: 1 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TESTIMONIALS ────────────────────────────────────── */}
        <section id="testimonials" style={{ background: T.ink, padding: '96px 5vw' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#9ddbc8', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 2, background: '#9ddbc8', display: 'inline-block', borderRadius: 1 }} /> Customer Stories
              </div>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700, color: '#fff', lineHeight: 1.12 }}>
                Real people. <em style={{ fontStyle:'italic',fontWeight:300,color:'rgba(255,255,255,.5)' }}>Real results.</em>
              </h2>
            </div>
            <button style={{ ...btn('#fff', 'rgba(255,255,255,.1)', '10px 22px'), fontSize: 14, flexShrink: 0 }} onClick={() => scrollTo('review-form')}>Leave a review →</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 48 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="reveal" style={{ background: 'rgba(255,255,255,.06)', borderRadius: 24, border: '1px solid rgba(255,255,255,.1)', padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <img src={t.photo} alt={t.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(255,255,255,.15)' }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>{t.role}</div>
                    <div style={{ color: '#fbbf24', fontSize: 13, letterSpacing: 1, marginTop: 3 }}>{'★'.repeat(t.stars)}</div>
                  </div>
                </div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontStyle: 'italic', fontWeight: 300, color: 'rgba(255,255,255,.85)', lineHeight: 1.7 }}>{t.quote}</div>
              </div>
            ))}
          </div>

          {/* Review form */}
          <div id="review-form" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: 36 }}>
            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Share your experience</h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', marginBottom: 28 }}>Your review helps other businesses make the right decision.</p>
            <form onSubmit={submitReview}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', display: 'block', marginBottom: 5 }}>Your Name *</label>
                  <input id="rv-name" type="text" placeholder="Jane Kariuki" style={{ ...input, background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.12)', color: '#fff' }} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', display: 'block', marginBottom: 5 }}>Company</label>
                  <input id="rv-co" type="text" placeholder="Your company" style={{ ...input, background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.12)', color: '#fff' }} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', display: 'block', marginBottom: 8 }}>Rating *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1,2,3,4,5].map(v => (
                    <span key={v} onClick={() => setRating(v)} style={{ fontSize: 28, cursor: 'pointer', opacity: v <= selectedRating ? 1 : 0.25, color: v <= selectedRating ? '#f59e0b' : '#fff', transition: 'opacity .2s' }}>★</span>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', display: 'block', marginBottom: 5 }}>Your Review *</label>
                <textarea id="rv-msg" placeholder="Tell others what you love about NexaERP..." style={{ ...input, background: 'rgba(255,255,255,.08)', border: '1.5px solid rgba(255,255,255,.12)', color: '#fff', minHeight: 100, resize: 'vertical' }} required />
              </div>
              <button type="submit" style={{ ...btn(T.ink, '#fff', '14px 32px'), fontSize: 15 }}>Submit Review</button>
              {reviewSuccess && <div style={{ display: 'inline-block', marginLeft: 16, padding: '10px 18px', background: 'rgba(42,144,112,.25)', borderRadius: 10, color: '#9ddbc8', fontSize: 14, fontWeight: 600 }}>✓ Thank you! Your review has been submitted.</div>}
            </form>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────── */}
        <section id="pricing" style={{ padding: '96px 5vw', background: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700, color: T.ink, lineHeight: 1.12, marginBottom: 14 }}>Simple pricing, <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>no surprises</em></h2>
            <p style={{ fontSize: 17, color: T.muted, maxWidth: 480, margin: '0 auto 32px' }}>All 9 modules included in every plan. No per-module fees.</p>
            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.ink3 }}>Monthly</span>
              <div onClick={() => setAnnual(a => !a)} style={{ width: 48, height: 26, borderRadius: 13, background: T.green, position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: '#fff', top: 3, left: 3, transition: 'transform .2s', transform: annual ? 'translateX(22px)' : 'translateX(0)', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.ink3 }}>Annual</span>
              <span style={{ background: T.amberLt, color: T.amber, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>Save 20%</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, maxWidth: 1000, margin: '0 auto' }}>
            {/* Starter */}
            <div className="reveal" style={{ borderRadius: 24, padding: '32px 28px', border: `1.5px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: T.muted, marginBottom: 16 }}>Starter</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 44, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{annual ? 'KES 6,800' : 'KES 8,500'}</div>
              <div style={{ fontSize: 14, color: T.muted, margin: '8px 0 20px' }}>/ month · For small teams</div>
              <div style={{ height: 1, background: T.border, margin: '20px 0' }} />
              {['Up to 3 users','Finance, Inventory & Payroll','1 warehouse','Basic reporting & CSV','Email support'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: T.ink2, marginBottom: 10 }}><span style={{ color: T.green }}>✓</span>{f}</div>
              ))}
              <button onClick={() => initPayment('starter')} style={{ ...btn(T.ink, 'none', '13px'), width: '100%', border: `2px solid ${T.border}`, marginTop: 8, fontSize: 15 }}>Get started</button>
            </div>

            {/* Professional */}
            <div className="reveal" style={{ borderRadius: 24, padding: '32px 28px', background: T.ink, border: 'none', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: T.green, color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 16px', borderRadius: 100, whiteSpace: 'nowrap' }}>Most Popular</div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 16 }}>Professional</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 44, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{annual ? 'KES 14,800' : 'KES 18,500'}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', margin: '8px 0 20px' }}>/ month · For growing SMEs</div>
              <div style={{ height: 1, background: 'rgba(255,255,255,.12)', margin: '20px 0' }} />
              {['Up to 10 users','All 9 modules included','3 warehouses (NBI, MSA, KSM)','Advanced reporting & PDF','Custom user roles','Priority support (8h response)','KRA statutory report exports'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'rgba(255,255,255,.8)', marginBottom: 10 }}><span style={{ color: T.greenMid }}>✓</span>{f}</div>
              ))}
              <button onClick={() => initPayment('professional')} style={{ ...btn('#fff', 'rgba(255,255,255,.12)', '13px'), width: '100%', marginTop: 8, fontSize: 15 }}>Start free trial</button>
            </div>

            {/* Enterprise */}
            <div className="reveal" style={{ borderRadius: 24, padding: '32px 28px', border: `1.5px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: T.muted, marginBottom: 16 }}>Enterprise</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 44, fontWeight: 700, color: T.ink, lineHeight: 1 }}>Custom</div>
              <div style={{ fontSize: 14, color: T.muted, margin: '8px 0 20px' }}>For large organisations</div>
              <div style={{ height: 1, background: T.border, margin: '20px 0' }} />
              {['Unlimited users','All 9 modules + custom','Unlimited warehouses','Dedicated account manager','4-hour SLA response','On-premise deployment','Custom API integrations'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: T.ink2, marginBottom: 10 }}><span style={{ color: T.green }}>✓</span>{f}</div>
              ))}
              <button onClick={() => scrollTo('contact')} style={{ ...btn(T.ink, 'none', '13px'), width: '100%', border: `2px solid ${T.border}`, marginTop: 8, fontSize: 15 }}>Talk to sales</button>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────── */}
        <section id="faq" style={{ padding: '96px 5vw', background: T.cream, display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 72, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.green, marginBottom: 14 }}>FAQ</div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(28px,3vw,44px)', fontWeight: 700, color: T.ink, marginBottom: 14 }}>Questions we <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>hear all the time</em></h2>
            <p style={{ fontSize: 16, color: T.muted, marginBottom: 32 }}>Still curious? Send us a message and we'll reply within one business day.</p>
            <button style={{ ...btn('#fff', T.green, '12px 24px'), fontSize: 14, boxShadow: '0 4px 16px rgba(26,107,90,.25)' }} onClick={() => scrollTo('contact')}>Ask us anything →</button>
          </div>
          <div>
            {FAQS.map((f, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                <div onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: openFaq === i ? T.green : T.ink, gap: 16 }}>
                  {f.q}
                  <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: T.muted, flexShrink: 0, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
                </div>
                {openFaq === i && <div style={{ fontSize: 15, color: T.muted, lineHeight: 1.7, paddingBottom: 20 }}>{f.a}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── CONTACT ─────────────────────────────────────────── */}
        <section id="contact" style={{ padding: '96px 5vw', background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 72, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: T.green, marginBottom: 14 }}>Get In Touch</div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(28px,3vw,44px)', fontWeight: 700, color: T.ink, marginBottom: 14 }}>Let's talk about <em style={{ fontStyle:'italic',fontWeight:300,color:T.ink3 }}>your business</em></h2>
            <p style={{ fontSize: 16, color: T.muted, marginBottom: 36 }}>Whether you're ready to start or just exploring — we'd love to hear from you.</p>
            {[
              { icon: '📍', h: 'Visit us',       p: 'Westlands Business Park, Nairobi, Kenya' },
              { icon: '📧', h: 'Email us',       p: 'hello@nexaerp.co.ke · support@nexaerp.co.ke' },
              { icon: '📞', h: 'Call or WhatsApp',p: '+254 700 000 000 · Mon–Fri, 8am–6pm EAT' },
              { icon: '⏱', h: 'Response time',  p: 'Sales: 4 hours · Support: 8 hours' },
            ].map(c => (
              <div key={c.h} style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: T.cream, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{c.h}</div>
                  <div style={{ fontSize: 14, color: T.muted }}>{c.p}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: T.cream, borderRadius: 24, border: `1px solid ${T.border}`, padding: 36, boxShadow: '0 4px 32px rgba(28,25,23,.07)' }}>
            {!formSuccess ? (
              <form onSubmit={submitContact}>
                <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Send us a message</h3>
                <p style={{ fontSize: 14, color: T.muted, marginBottom: 28 }}>We read and respond to every inquiry personally.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={{ fontSize: 13, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 5 }}>First Name *</label><input type="text" name="first_name" placeholder="Jane" style={input} required /></div>
                  <div><label style={{ fontSize: 13, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 5 }}>Last Name *</label><input type="text" name="last_name" placeholder="Kariuki" style={input} required /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div><label style={{ fontSize: 13, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 5 }}>Email *</label><input type="email" name="email" placeholder="jane@company.com" style={input} required /></div>
                  <div><label style={{ fontSize: 13, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 5 }}>Phone</label><input type="tel" name="phone" placeholder="+254 7XX XXX XXX" style={input} /></div>
                </div>
                <div style={{ marginBottom: 14 }}><label style={{ fontSize: 13, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 5 }}>Company *</label><input type="text" name="company" placeholder="Your company name" style={input} required /></div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 5 }}>I'm interested in</label>
                  <select name="interest" style={{ ...input }}>
                    <option>Free Trial — Professional Plan</option>
                    <option>Starter Plan</option>
                    <option>Enterprise / Custom Quote</option>
                    <option>Product Demo</option>
                    <option>General Inquiry</option>
                  </select>
                </div>
                <div style={{ marginBottom: 20 }}><label style={{ fontSize: 13, fontWeight: 600, color: T.ink2, display: 'block', marginBottom: 5 }}>Message</label><textarea name="message" placeholder="Tell us about your business..." style={{ ...input, minHeight: 100, resize: 'vertical' }} /></div>
                <button type="submit" style={{ ...btn('#fff', T.green), width: '100%', fontSize: 16, boxShadow: '0 4px 16px rgba(26,107,90,.25)' }}>Send Message →</button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 700, color: T.green, marginBottom: 8 }}>Message received!</h3>
                <p style={{ fontSize: 15, color: T.muted }}>We'll be in touch within 4 hours. Check your email for confirmation.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── CTA STRIP ───────────────────────────────────────── */}
        <div style={{ background: T.green, padding: '80px 5vw', display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 'clamp(26px,3vw,44px)', fontWeight: 700, color: '#fff', lineHeight: 1.15, marginBottom: 8 }}>Ready to <em style={{ fontStyle:'italic',fontWeight:300 }}>run your business smarter?</em></h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)' }}>14-day free trial. No credit card required.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            <button style={{ ...btn(T.green, '#fff', '14px 28px'), fontSize: 15, whiteSpace: 'nowrap' }} onClick={() => scrollTo('contact')}>Start Free Trial</button>
            <button style={{ ...btn('rgba(255,255,255,.85)', 'none', '13px 26px'), border: '2px solid rgba(255,255,255,.3)', fontSize: 15, whiteSpace: 'nowrap' }} onClick={() => scrollTo('contact')}>Talk to Sales</button>
          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────── */}
        <footer style={{ background: T.ink, padding: '64px 5vw 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, paddingBottom: 48, borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800 }}>N</div>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>NexaERP</span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', lineHeight: 1.65, maxWidth: 260 }}>The modern business operating system built for East African enterprises.</p>
            </div>
            {[
              { h: 'Product',  links: [
                  { label: 'Features',  id: 'features'  },
                  { label: 'Modules',   id: 'modules'   },
                  { label: 'Pricing',   id: 'pricing'   },
                  { label: 'FAQ',       id: 'faq'       },
              ]},
              { h: 'Modules',  links: [
                  { label: 'Finance & GL',  id: 'modules' },
                  { label: 'HR & Payroll',  id: 'modules' },
                  { label: 'Inventory',     id: 'modules' },
                  { label: 'Orders',        id: 'modules' },
                  { label: 'Purchase',      id: 'modules' },
                  { label: 'Reporting',     id: 'modules' },
              ]},
              { h: 'Company',  links: [
                  { label: 'Contact',          id: 'contact'      },
                  { label: 'Request Demo',     id: 'contact'      },
                  { label: 'Customer Reviews', id: 'testimonials' },
                  { label: 'Pricing',          id: 'pricing'      },
              ]},
            ].map(col => (
              <div key={col.h}>
                <h4 style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 16 }}>{col.h}</h4>
                <ul style={{ listStyle: 'none' }}>
                  {col.links.map(l => (
                    <li key={l.label} style={{ marginBottom: 10 }}>
                      <span
                        onClick={() => scrollTo(l.id)}
                        style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'color .2s' }}
                        onMouseEnter={e => e.target.style.color = '#2a9070'}
                        onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.35)'}
                      >{l.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>© 2026 NexaERP. Built in Kenya 🇰🇪 for East Africa.</p>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Privacy','Terms','Security','Support'].map(l => <span key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', cursor: 'pointer' }}>{l}</span>)}
            </div>
          </div>
        </footer>

        {/* ── PAYMENT MODAL ───────────────────────────────────── */}
        {showPayModal && (
          <div onClick={e => e.target === e.currentTarget && setPayModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(28,25,23,.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: 40, maxWidth: 460, width: '90%', position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
              <button onClick={() => setPayModal(false)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: T.ink3 }}>✕</button>

              <div style={{ background: T.greenLt, color: T.green, fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 100, display: 'inline-block', marginBottom: 14 }}>{planCfg[currentPlan]?.badge}</div>
              <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 700, color: T.ink, marginBottom: 5 }}>Complete your subscription</h3>
              <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>14-day free trial. No charge today. Cancel anytime.</p>

              <div style={{ background: T.cream, borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Due today</div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 700, color: T.green }}>KES 0</div><div style={{ fontSize: 11, color: T.muted }}>Free for 14 days</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>After trial</div><div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700, color: T.ink }}>KES {(annual ? planCfg[currentPlan]?.annual : planCfg[currentPlan]?.monthly)?.toLocaleString()}</div><div style={{ fontSize: 11, color: T.muted }}>per month</div></div>
              </div>

              {payStep === 'form' && (
                <form onSubmit={processPayment}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {[
                      { id: 'pay-name',   label: 'Full Name *',       type: 'text',     ph: 'Jane Kariuki' },
                      { id: 'pay-email',  label: 'Email *',           type: 'email',    ph: 'jane@company.com' },
                      { id: 'pay-phone',  label: 'Phone (M-Pesa) *',  type: 'tel',      ph: '0712 345 678' },
                    ].map(f => (
                      <div key={f.id}><label style={{ fontSize: 12, fontWeight: 700, color: T.ink2, display: 'block', marginBottom: 4 }}>{f.label}</label><input id={f.id} type={f.type} placeholder={f.ph} style={input} required /></div>
                    ))}
                    <div><label style={{ fontSize: 12, fontWeight: 700, color: T.ink2, display: 'block', marginBottom: 4 }}>Payment Method</label>
                      <select id="pay-method" style={{ ...input }}>
                        <option value="mpesa">M-Pesa STK Push</option>
                        <option value="card">Credit / Debit Card</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="invoice">Invoice / LPO</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" style={{ ...btn('#fff', T.green), width: '100%', fontSize: 15, boxShadow: '0 4px 16px rgba(26,107,90,.25)' }}>Start Free Trial</button>
                  <p style={{ fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 10 }}>Secured by 256-bit SSL. No charge for 14 days.</p>
                </form>
              )}

              {payStep === 'processing' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.green, marginBottom: 6 }}>{payMsg}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>Please wait...</div>
                </div>
              )}

              {payStep === 'success' && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 700, color: T.green, marginBottom: 6 }}>You're all set!</div>
                  <div style={{ fontSize: 13, color: T.muted }}>Check your email — login details arrive within 5 minutes.</div>
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          a { text-decoration: none; color: inherit; }
        `}</style>
      </div>
    </>
  );
};

export default Home;