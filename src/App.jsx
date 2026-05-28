import { useState, useEffect, useRef } from "react";

const CC_MONTHS = [
  "Jun 2026","Jul 2026","Aug 2026","Sep 2026","Oct 2026",
  "Nov 2026","Dec 2026","Jan 2027","Feb 2027"
];

const CARD1_DEADLINE_MONTHS = 9;  // Feb 2027
const CARD2_DEADLINE_MONTHS = 5;  // Nov 2026

const ONE_TIME_CARDS = [
  { id: "ot1", label: "Card A", balance: 348, apr: 28 },
  { id: "ot2", label: "Card B", balance: 348, apr: 28 },
  { id: "ot3", label: "Card C", balance: 35,  apr: 28 },
];

const CAR_APR = 7.59 / 100 / 12;
const CAR_ORIGINAL = 24249;

function buildCarPlan(startBal, monthlyPayment, startIdx) {
  let bal = startBal;
  const rows = [];
  const months = [
    "Jun 2026","Jul 2026","Aug 2026","Sep 2026","Oct 2026",
    "Nov 2026","Dec 2026","Jan 2027","Feb 2027","Mar 2027",
    "Apr 2027","May 2027","Jun 2027","Jul 2027","Aug 2027","Sep 2027",
    "Oct 2027","Nov 2027","Dec 2027","Jan 2028","Feb 2028","Mar 2028",
    "Apr 2028","May 2028","Jun 2028","Jul 2028","Aug 2028","Sep 2028"
  ];
  for (let i = 0; i < 28; i++) {
    const interest = bal * CAR_APR;
    const pmt = i < 7 ? 487 : monthlyPayment;
    const principal = Math.min(bal, Math.max(0, pmt - interest));
    bal = Math.max(0, bal - principal);
    rows.push({
      month: months[i],
      payment: pmt,
      balance: Math.round(bal),
      interest: Math.round(interest),
      phase: i < 7 ? "holding" : "attack"
    });
    if (bal === 0) break;
  }
  return rows;
}

function calcRequiredPayment(balance, monthsLeft) {
  if (balance <= 0 || monthsLeft <= 0) return 0;
  return Math.ceil(balance / monthsLeft);
}

function allocateExtra(amount, otPaid, card2Bal, card1Bal, carBal) {
  let remaining = amount;
  const allocs = [];
  const otRemaining = ONE_TIME_CARDS.filter(c => !otPaid[c.id]);
  for (const c of otRemaining) {
    if (remaining <= 0) break;
    const give = Math.min(remaining, c.balance);
    allocs.push({ label: c.label, amount: give, reason: "28% APR — highest priority" });
    remaining -= give;
  }
  if (remaining > 0 && card2Bal > 0) {
    const give = Math.min(remaining, card2Bal);
    allocs.push({ label: "Card 2 (0%)", amount: give, reason: "Expires Nov 2026 — most urgent deadline" });
    remaining -= give;
  }
  if (remaining > 0 && card1Bal > 0) {
    const give = Math.min(remaining, card1Bal);
    allocs.push({ label: "Card 1 (0%)", amount: give, reason: "Expires Feb 2027" });
    remaining -= give;
  }
  if (remaining > 0 && carBal > 0) {
    const give = Math.min(remaining, carBal);
    allocs.push({ label: "Car Loan", amount: give, reason: "7.59% APR — attack mode" });
  }
  return allocs;
}

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const TABS = ["Overview", "High-APR", "0% Cards", "Car Loan", "Extra Cash", "Bills"];

export default function App() {
  const [tab, setTab] = useState("Overview");

  // 0% card balances (editable)
  const [card1Bal, setCard1Bal] = useState(() => load("card1Bal", 3636));
  const [card2Bal, setCard2Bal] = useState(() => load("card2Bal", 2600));
  const [editingCardBal, setEditingCardBal] = useState(null);
  const [cardBalInput, setCardBalInput] = useState("");

  // OT cards
  const [otPaid, setOtPaid] = useState(() => load("otPaid", { ot1: false, ot2: false, ot3: false }));

  // Car loan
  const [carPayments, setCarPayments] = useState(() => load("carPayments", {})); // {idx: amount}
  const [editingCarIdx, setEditingCarIdx] = useState(null);
  const [carPayInput, setCarPayInput] = useState("");
  const tickerRef = useRef(null);

  // Extra cash
  const [extraInput, setExtraInput] = useState("");
  const [allocResult, setAllocResult] = useState(null);

  // Bills
  const [bills, setBills] = useState(() => load("bills", []));
  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");

  // Persist
  useEffect(() => save("card1Bal", card1Bal), [card1Bal]);
  useEffect(() => save("card2Bal", card2Bal), [card2Bal]);
  useEffect(() => save("otPaid", otPaid), [otPaid]);
  useEffect(() => save("carPayments", carPayments), [carPayments]);
  useEffect(() => save("bills", bills), [bills]);

  // Compute current car balance from logged payments
  const basePlan = buildCarPlan(CAR_ORIGINAL, 1411, 0);
  let carCurrentBal = CAR_ORIGINAL;
  let totalCarInterestPaid = 0;
  const carRows = basePlan.map((r, i) => {
    const actualPay = carPayments[i] ?? null;
    const interest = carCurrentBal * CAR_APR;
    totalCarInterestPaid += interest;
    if (actualPay !== null) {
      const principal = Math.min(carCurrentBal, Math.max(0, actualPay - interest));
      carCurrentBal = Math.max(0, carCurrentBal - principal);
    } else {
      carCurrentBal = r.balance;
    }
    return { ...r, actualPay, interestAmt: Math.round(interest) };
  });
  const lastLoggedIdx = Math.max(-1, ...Object.keys(carPayments).map(Number));
  const currentCarBal = lastLoggedIdx >= 0 ? (() => {
    let b = CAR_ORIGINAL;
    for (let i = 0; i <= lastLoggedIdx; i++) {
      const interest = b * CAR_APR;
      const pmt = carPayments[i] ?? (i < 7 ? 487 : 1411);
      const principal = Math.min(b, Math.max(0, pmt - interest));
      b = Math.max(0, b - principal);
    }
    return Math.round(b);
  })() : CAR_ORIGINAL;

  // Original plan interest total
  const origPlan = buildCarPlan(CAR_ORIGINAL, 1411, 0);
  const origTotalInterest = origPlan.reduce((s, r) => s + r.interest, 0);
  // Projected interest from current balance
  const projPlan = buildCarPlan(currentCarBal, 1411, 0);
  const projTotalInterest = projPlan.reduce((s, r) => s + r.interest, 0);
  const interestSaved = Math.max(0, origTotalInterest - projTotalInterest);
  const carPayoffMonth = projPlan[projPlan.length - 1]?.month ?? "N/A";

  // Daily interest ticker — counts from loan start date 5/16/2026
  const LOAN_START = new Date("2026-05-16T00:00:00").getTime();
  const CAR_APR_DAILY = 7.59 / 100 / 365;
  const dailyRate = currentCarBal * CAR_APR_DAILY;
  const secondRate = dailyRate / 86400;

  // Total interest accrued since loan start (simplified: days * daily rate on original balance)
  const daysSinceLoanStart = (Date.now() - LOAN_START) / 86400000;
  const totalInterestAccrued = CAR_ORIGINAL * CAR_APR_DAILY * daysSinceLoanStart;

  // Total interest actually paid from logged payments
  const totalInterestPaid = (() => {
    let bal = CAR_ORIGINAL;
    let paid = 0;
    basePlan.forEach((r, i) => {
      const interest = bal * CAR_APR;
      if (carPayments[i] !== undefined) {
        paid += interest;
        const principal = Math.min(bal, Math.max(0, carPayments[i] - interest));
        bal = Math.max(0, bal - principal);
      }
    });
    return paid;
  })();

  function getTickerSeed() {
    try {
      const lastTs = localStorage.getItem("tickerTimestamp");
      const lastVal = parseFloat(localStorage.getItem("tickerValue") || "0");
      const lastBal = parseFloat(localStorage.getItem("tickerBal") || "0");
      // If balance changed or no saved value, seed from total accrued since loan start
      if (Math.abs(lastBal - currentCarBal) > 1 || !lastTs) {
        return totalInterestAccrued;
      }
      const elapsed = (Date.now() - parseInt(lastTs)) / 1000;
      return lastVal + elapsed * secondRate;
    } catch { return totalInterestAccrued; }
  }

  const [dailyInterest, setDailyInterest] = useState(() => getTickerSeed());

  useEffect(() => {
    const saveInterval = setInterval(() => {
      try {
        localStorage.setItem("tickerTimestamp", Date.now().toString());
        localStorage.setItem("tickerBal", String(currentCarBal));
        setDailyInterest(d => { localStorage.setItem("tickerValue", String(d)); return d; });
      } catch {}
    }, 1000);

    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      setDailyInterest(d => d + secondRate * 0.05);
    }, 50);

    return () => { clearInterval(tickerRef.current); clearInterval(saveInterval); };
  }, [currentCarBal]);

  // Required monthly payments
  const req1 = calcRequiredPayment(card1Bal, CARD1_DEADLINE_MONTHS);
  const req2 = calcRequiredPayment(card2Bal, CARD2_DEADLINE_MONTHS);

  // Progress
  const bar1 = Math.min(100, ((3636 - card1Bal) / 3636) * 100);
  const bar2 = Math.min(100, ((2600 - card2Bal) / 2600) * 100);
  const carPct = Math.min(100, ((CAR_ORIGINAL - currentCarBal) / CAR_ORIGINAL) * 100);
  const allOtPaid = Object.values(otPaid).every(Boolean);
  const otRemaining = ONE_TIME_CARDS.filter(c => !otPaid[c.id]).reduce((s, c) => s + c.balance, 0);
  const totalDebt = card1Bal + card2Bal + currentCarBal + otRemaining;
  const totalOriginal = 3636 + 2600 + CAR_ORIGINAL + 731;
  const totalPct = Math.min(100, ((totalOriginal - totalDebt) / totalOriginal) * 100);

  // Bills
  const totalBills = bills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const totalDebtPayments = req1 + req2 + (currentCarBal > 0 ? 487 : 0);
  const totalMonthlyNeeded = totalBills + totalDebtPayments;

  function addBill() {
    if (!newBillName.trim() || !newBillAmount) return;
    setBills(prev => [...prev, { id: Date.now(), name: newBillName.trim(), amount: parseFloat(newBillAmount) }]);
    setNewBillName(""); setNewBillAmount("");
  }

  function removeBill(id) { setBills(prev => prev.filter(b => b.id !== id)); }

  function handleAllocate() {
    const amt = parseFloat(extraInput);
    if (!amt || amt <= 0) return;
    setAllocResult({ total: amt, items: allocateExtra(amt, otPaid, card2Bal, card1Bal, currentCarBal) });
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0d0d0d", fontFamily:"'DM Mono','Courier New',monospace", color:"#e8e0d0", padding:"28px 18px" }}>
      <style>{`
        * { box-sizing:border-box; }
        .tag { display:inline-block; font-size:10px; letter-spacing:0.15em; text-transform:uppercase; padding:2px 8px; border-radius:2px; }
        .urgent { background:#ff4444; color:#fff; }
        .safe { background:#2a7a4b; color:#b6ffda; }
        .done { background:#1a4a3a; color:#4dff9a; }
        .warn { background:#3a2a00; color:#ff9f43; }
        .attack { background:#1a2a4a; color:#7ab8ff; }
        .progress-bar { height:6px; background:#1e1e1e; border-radius:3px; overflow:hidden; margin-top:6px; }
        .progress-fill { height:100%; border-radius:3px; transition:width 0.6s ease; }
        .section-label { font-size:10px; letter-spacing:0.2em; color:#555; text-transform:uppercase; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #1e1e1e; }
        .tab-bar { display:flex; gap:4px; margin-bottom:24px; flex-wrap:wrap; }
        .tab-btn { background:#141414; border:1px solid #222; color:#555; font-family:inherit; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; padding:7px 10px; border-radius:3px; cursor:pointer; transition:all 0.15s; }
        .tab-btn.active { background:#1e1e1e; border-color:#444; color:#e8e0d0; }
        .tab-btn:hover { color:#e8e0d0; }
        .overview-card { background:#141414; border:1px solid #222; border-radius:8px; padding:14px 16px; margin-bottom:10px; }
        .ot-card { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#141414; border:1px solid #222; border-radius:6px; margin-bottom:8px; transition:opacity 0.3s; }
        .ot-card.paid { opacity:0.4; }
        .check-btn { background:none; border:2px solid #ff4444; color:#ff4444; font-family:inherit; font-size:11px; padding:4px 10px; border-radius:3px; cursor:pointer; transition:all 0.2s; white-space:nowrap; }
        .check-btn:hover { background:#ff4444; color:#fff; }
        .check-btn.checked { background:#1a4a3a; border-color:#4dff9a; color:#4dff9a; }
        .money-input { background:#141414; border:1px solid #333; color:#e8e0d0; font-family:inherit; font-size:16px; padding:10px 12px; border-radius:6px; width:100%; outline:none; margin-bottom:10px; }
        .money-input:focus { border-color:#ff9f43; }
        .action-btn { background:#ff9f43; border:none; color:#0d0d0d; font-family:inherit; font-size:12px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:11px; border-radius:6px; width:100%; cursor:pointer; transition:opacity 0.2s; margin-bottom:8px; }
        .action-btn:hover { opacity:0.85; }
        .action-btn.secondary { background:#1e1e1e; color:#e8e0d0; border:1px solid #333; }
        .alloc-item { background:#141414; border:1px solid #222; border-radius:6px; padding:12px 14px; margin-bottom:8px; }
        .cell-edit { background:#1a1a1a; border:1px solid #ff9f43; color:#ff9f43; font-family:inherit; font-size:12px; width:90px; padding:3px 6px; border-radius:3px; text-align:right; outline:none; }
        .edit-cell-btn { background:none; border:none; color:inherit; font-family:inherit; font-size:12px; cursor:pointer; padding:2px 4px; border-radius:2px; width:100%; text-align:right; }
        .edit-cell-btn:hover { background:#1e1e1e; }
        tr:hover td { background:#111 !important; }
        .ticker { font-variant-numeric:tabular-nums; color:#ff4444; font-size:22px; font-weight:500; }
        .bill-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#141414; border:1px solid #222; border-radius:6px; margin-bottom:6px; }
        .del-btn { background:none; border:none; color:#444; font-size:14px; cursor:pointer; padding:2px 6px; }
        .del-btn:hover { color:#ff4444; }
        .card-bal-btn { background:none; border:1px dashed #333; color:#ff9f43; font-family:inherit; font-size:11px; padding:3px 8px; border-radius:3px; cursor:pointer; margin-top:4px; }
        .card-bal-btn:hover { border-color:#ff9f43; }
      `}</style>

      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:10, letterSpacing:"0.25em", color:"#555", textTransform:"uppercase", marginBottom:4 }}>Full Debt Payoff Plan — May 2026</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, letterSpacing:"-0.02em", lineHeight:1.1 }}>
          Zero Before<br /><span style={{ color:"#ff9f43" }}>Interest Hits</span>
        </div>
      </div>

      <div className="tab-bar">
        {TABS.map(t => <button key={t} className={`tab-btn${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {/* OVERVIEW */}
      {tab === "Overview" && (
        <div>
          <div className="section-label">Total Debt Remaining</div>
          <div style={{ background:"#141414", border:"1px solid #222", borderRadius:8, padding:16, marginBottom:20 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:500, color:"#ff9f43" }}>${totalDebt.toLocaleString()}</div>
            <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>of ${totalOriginal.toLocaleString()} original</div>
            <div className="progress-bar" style={{ height:8 }}>
              <div className="progress-fill" style={{ width:`${totalPct}%`, background:"linear-gradient(90deg,#ff9f43,#4dff9a)" }} />
            </div>
            <div style={{ fontSize:10, color:"#555", marginTop:4 }}>{Math.round(totalPct)}% paid off</div>
          </div>
          <div className="section-label">Debt Breakdown</div>
          {[
            { label:"⚡ High-APR Cards", apr:"28%", bal:otRemaining, orig:731, color:"#ff4444", status:allOtPaid?"done":"urgent", statusLabel:allOtPaid?"✓ Cleared":"Pay This Week" },
            { label:"Card 2 (0% APR)", apr:"0%", bal:card2Bal, orig:2600, color:"#4dff9a", status:card2Bal===0?"done":"urgent", statusLabel:card2Bal===0?"✓ Cleared":"Due Nov 2026" },
            { label:"Card 1 (0% APR)", apr:"0%", bal:card1Bal, orig:3636, color:"#ff9f43", status:card1Bal===0?"done":"safe", statusLabel:card1Bal===0?"✓ Cleared":"Due Feb 2027" },
            { label:"Car Loan", apr:"7.59%", bal:currentCarBal, orig:CAR_ORIGINAL, color:"#7ab8ff", status:"attack", statusLabel:`Payoff ~${carPayoffMonth}` },
          ].map(d => (
            <div key={d.label} className="overview-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12 }}>{d.label}</span>
                <span className={`tag ${d.status}`}>{d.statusLabel}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                <div style={{ fontSize:18, fontWeight:500, color:d.color }}>${d.bal.toLocaleString()}</div>
                <div style={{ fontSize:10, color:"#555" }}>{d.apr} APR</div>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.min(100,((d.orig-d.bal)/d.orig)*100)}%`, background:d.color }} /></div>
            </div>
          ))}
          <div style={{ marginTop:20, background:"#141414", border:"1px solid #1e1e1e", borderRadius:8, padding:"14px 16px" }}>
            <div className="section-label" style={{ marginBottom:10 }}>Attack Timeline</div>
            {[
              { period:"Now",          action:"Pay off $731 in 28% APR cards immediately",                  color:"#ff4444" },
              { period:"Jun–Dec 2026", action:"$924/mo toward 0% cards — clear both before promos expire", color:"#4dff9a" },
              { period:"Dec/Jan 2027", action:"Consider refinancing car if rate drops below 6%",           color:"#7ab8ff" },
              { period:"Jan 2027+",    action:"Roll freed-up cash → $1,411/mo attack on car loan",        color:"#ff9f43" },
              { period:"~Sept 2028",   action:"Car paid off — completely debt free",                       color:"#fff"    },
            ].map(s => (
              <div key={s.period} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
                <div style={{ fontSize:10, color:s.color, whiteSpace:"nowrap", minWidth:90, paddingTop:1 }}>{s.period}</div>
                <div style={{ fontSize:11, color:"#888", lineHeight:1.5 }}>{s.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HIGH APR */}
      {tab === "High-APR" && (
        <div>
          <div className="section-label">
            ⚡ This Week — 28% APR Cards
            {allOtPaid ? <span className="tag done" style={{ marginLeft:10 }}>All Clear ✓</span> : <span className="tag warn" style={{ marginLeft:10 }}>${otRemaining} remaining</span>}
          </div>
          {ONE_TIME_CARDS.map(c => (
            <div key={c.id} className={`ot-card${otPaid[c.id]?" paid":""}`}>
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, marginBottom:2 }}>{c.label}</div>
                <div style={{ fontSize:11, color:"#555" }}>{c.apr}% APR · ${c.balance.toLocaleString()}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:16, fontWeight:500, color:otPaid[c.id]?"#2a7a4b":"#ff4444" }}>${c.balance.toLocaleString()}</span>
                <button className={`check-btn${otPaid[c.id]?" checked":""}`} onClick={()=>setOtPaid(p=>({...p,[c.id]:!p[c.id]}))}>
                  {otPaid[c.id]?"✓ Paid":"Mark Paid"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 0% CARDS */}
      {tab === "0% Cards" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
            {[
              { label:"Card 1", deadline:"Feb 2027", bal:card1Bal, pct:bar1, color:"#ff9f43", req:req1, months:CARD1_DEADLINE_MONTHS, setFn: setCard1Bal, id:"c1" },
              { label:"Card 2", deadline:"Nov 2026", bal:card2Bal, pct:bar2, color:"#4dff9a", req:req2, months:CARD2_DEADLINE_MONTHS, setFn: setCard2Bal, id:"c2" },
            ].map(c => (
              <div key={c.label} style={{ background:"#141414", border:"1px solid #222", borderRadius:8, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>{c.label}</span>
                  {c.bal===0?<span className="tag done">✓ Paid</span>:c.deadline==="Nov 2026"?<span className="tag urgent">⚠ Urgent</span>:<span className="tag safe">On Track</span>}
                </div>
                <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>Deadline: {c.deadline}</div>
                {(editingCardBal === c.id+"_pay" || editingCardBal === c.id+"_set") ? (
                  <div style={{ marginTop:6 }}>
                    <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>
                      {editingCardBal === c.id+"_pay" ? "Amount paid:" : "Set new balance:"}
                    </div>
                    <input className="cell-edit" style={{ width:"100%", fontSize:14 }} value={cardBalInput} autoFocus
                      placeholder="0"
                      onChange={e=>setCardBalInput(e.target.value)}
                      onBlur={()=>{
                        const n=parseFloat(cardBalInput);
                        if(!isNaN(n)&&n>=0) {
                          if(editingCardBal === c.id+"_pay") c.setFn(prev => Math.max(0, Math.round(prev - n)));
                          else c.setFn(Math.round(n));
                        }
                        setEditingCardBal(null);
                      }}
                      onKeyDown={e=>{ if(e.key==="Enter"){
                        const n=parseFloat(cardBalInput);
                        if(!isNaN(n)&&n>=0) {
                          if(editingCardBal === c.id+"_pay") c.setFn(prev => Math.max(0, Math.round(prev - n)));
                          else c.setFn(Math.round(n));
                        }
                        setEditingCardBal(null);
                      }}} />
                    <div style={{ fontSize:10, color:"#555", marginTop:4 }}>Press Enter or tap away to confirm</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:20, fontWeight:500, color:c.color }}>${c.bal.toLocaleString()}</div>
                    <div style={{ display:"flex", gap:6, marginTop:4 }}>
                      <button className="card-bal-btn" onClick={()=>{ setEditingCardBal(c.id+"_pay"); setCardBalInput(""); }}>+ Log Payment</button>
                      <button className="card-bal-btn" style={{ color:"#888", borderColor:"#2a2a2a" }} onClick={()=>{ setEditingCardBal(c.id+"_set"); setCardBalInput(String(c.bal)); }}>✏ Set Balance</button>
                    </div>
                  </>
                )}
                <div className="progress-bar"><div className="progress-fill" style={{ width:`${c.pct}%`, background:c.color }} /></div>
                <div style={{ fontSize:10, color:"#555", marginTop:6 }}>
                  {c.bal > 0 ? <>Need <span style={{ color:c.color }}>${c.req}/mo</span> over {c.months} months</> : "Paid off! 🎉"}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:"#141414", border:"1px solid #1a3a1a", borderRadius:8, padding:"14px 16px", marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.1em" }}>Required Monthly Total</div>
            <div style={{ fontSize:22, fontWeight:500, color:"#ff9f43" }}>${(req1 + req2).toLocaleString()}/mo</div>
            <div style={{ fontSize:10, color:"#555", marginTop:4 }}>Card 1: ${req1}/mo · Card 2: ${req2}/mo — auto-updates when you edit balances</div>
          </div>
          <div style={{ fontSize:10, color:"#444", lineHeight:1.8 }}>
            ▸ Tap "Edit Balance" on any card to update after a purchase or payment.<br />
            ▸ Required monthly payment recalculates automatically.
          </div>
        </div>
      )}

      {/* CAR LOAN */}
      {tab === "Car Loan" && (
        <div>
          {/* Live ticker */}
          <div style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", borderRadius:8, padding:"16px", marginBottom:12, textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#666", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:6 }}>Total Interest Accrued Since 5/16/2026</div>
            <div className="ticker">${dailyInterest.toFixed(4)}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:4 }}>+${dailyRate.toFixed(4)} per day · live</div>
          </div>

          {/* Interest stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
            {[
              { label:"Total Interest Accrued", value:`$${totalInterestAccrued.toFixed(2)}`, color:"#ff4444" },
              { label:"Total Interest Paid",    value:`$${totalInterestPaid.toFixed(2)}`,    color:"#ff9f43" },
              { label:"Current APR Rate",       value:"7.59%",                               color:"#7ab8ff" },
            ].map(s => (
              <div key={s.label} style={{ background:"#141414", border:"1px solid #222", borderRadius:6, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#555", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.08em", lineHeight:1.4 }}>{s.label}</div>
                <div style={{ fontSize:14, fontWeight:500, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              { label:"Remaining",      value:`$${currentCarBal.toLocaleString()}`, color:"#7ab8ff" },
              { label:"Interest Saved", value:`$${Math.round(interestSaved).toLocaleString()}`, color:"#4dff9a" },
              { label:"Daily Rate",     value:`$${dailyRate.toFixed(2)}/day`,       color:"#ff4444" },
              { label:"Jan 2027+",      value:"$1,411/mo",                          color:"#ff9f43" },
            ].map(s => (
              <div key={s.label} style={{ background:"#141414", border:"1px solid #222", borderRadius:6, padding:"12px 14px" }}>
                <div style={{ fontSize:10, color:"#555", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.1em" }}>{s.label}</div>
                <div style={{ fontSize:16, fontWeight:500, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"#141414", border:"1px solid #222", borderRadius:8, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Payoff Progress</div>
            <div style={{ fontSize:22, fontWeight:500, color:"#7ab8ff" }}>${currentCarBal.toLocaleString()}</div>
            <div className="progress-bar" style={{ height:8 }}>
              <div className="progress-fill" style={{ width:`${carPct}%`, background:"#7ab8ff" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#555", marginTop:4 }}>
              <span>{Math.round(carPct)}% paid</span>
              <span>Est. payoff: {carPayoffMonth}</span>
            </div>
          </div>

          <div className="section-label">Log Monthly Payments</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #2a2a2a" }}>
                  {["Month","Phase","Scheduled","Actual Paid","Interest","Balance"].map(h => (
                    <th key={h} style={{ padding:"8px 8px", textAlign:"right", color:"#555", fontWeight:400, fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                      {h==="Month"||h==="Phase"?<span style={{ textAlign:"left", display:"block" }}>{h}</span>:h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {basePlan.map((r,i) => {
                  const actual = carPayments[i] ?? null;
                  const isEd = editingCarIdx === i;
                  let runBal = CAR_ORIGINAL;
                  for (let j = 0; j <= i; j++) {
                    const int = runBal * CAR_APR;
                    const pmt = carPayments[j] ?? (j < 7 ? 487 : 1411);
                    runBal = Math.max(0, runBal - Math.max(0, pmt - int));
                  }
                  return (
                    <tr key={r.month}>
                      <td style={{ padding:"8px 8px", color:"#888", borderBottom:"1px solid #181818", whiteSpace:"nowrap" }}>{r.month}</td>
                      <td style={{ padding:"8px 8px", borderBottom:"1px solid #181818" }}>
                        {r.phase==="attack"?<span className="tag attack" style={{ fontSize:9 }}>🚀</span>:<span style={{ fontSize:9, color:"#444" }}>Hold</span>}
                      </td>
                      <td style={{ padding:"8px 8px", textAlign:"right", borderBottom:"1px solid #181818", color:"#555" }}>${r.payment}</td>
                      <td style={{ padding:"8px 8px", textAlign:"right", borderBottom:"1px solid #181818", color:"#ff9f43" }}>
                        {isEd ? (
                          <input className="cell-edit" value={carPayInput} autoFocus
                            onChange={e=>setCarPayInput(e.target.value)}
                            onBlur={()=>{ const n=parseFloat(carPayInput); if(!isNaN(n)&&n>0) setCarPayments(p=>({...p,[i]:n})); setEditingCarIdx(null); }}
                            onKeyDown={e=>{ if(e.key==="Enter"){ const n=parseFloat(carPayInput); if(!isNaN(n)&&n>0) setCarPayments(p=>({...p,[i]:n})); setEditingCarIdx(null); }}} />
                        ) : (
                          <button className="edit-cell-btn" style={{ color: actual ? "#ff9f43" : "#333" }}
                            onClick={()=>{ setEditingCarIdx(i); setCarPayInput(actual?String(actual):""); }}>
                            {actual ? `$${actual.toLocaleString()}` : "— tap"}
                          </button>
                        )}
                      </td>
                      <td style={{ padding:"8px 8px", textAlign:"right", borderBottom:"1px solid #181818", color:"#ff4444", fontSize:11 }}>${r.interest}</td>
                      <td style={{ padding:"8px 8px", textAlign:"right", borderBottom:"1px solid #181818", color: Math.round(runBal)===0?"#2a7a4b":"#888" }}>${Math.round(runBal).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:16, background:"#0f1a0f", border:"1px solid #1a3a1a", borderRadius:6, padding:"12px 14px", fontSize:11, color:"#4dff9a", lineHeight:1.7 }}>
            💡 Refinance check: Dec 2026 — if you can get below 6%, refinancing before Jan 2027 attack mode saves an extra $300–600.
          </div>
        </div>
      )}

      {/* EXTRA CASH */}
      {tab === "Extra Cash" && (
        <div>
          <div className="section-label">💰 Smart Money Allocator</div>
          <div style={{ background:"#141414", border:"1px solid #222", borderRadius:8, padding:16, marginBottom:20, fontSize:11, color:"#888", lineHeight:1.7 }}>
            Enter any extra money you have and we'll split it across your debts in the smartest order — highest urgency first.
          </div>
          <input className="money-input" type="number" placeholder="$0.00" value={extraInput}
            onChange={e=>{ setExtraInput(e.target.value); setAllocResult(null); }} />
          <button className="action-btn" onClick={handleAllocate}>Allocate →</button>
          {allocResult && (
            <div>
              <div className="section-label">Recommended — ${allocResult.total.toLocaleString()}</div>
              {allocResult.items.length === 0
                ? <div style={{ fontSize:12, color:"#4dff9a", padding:"12px 0" }}>🎉 All debts paid off!</div>
                : allocResult.items.map((item,i) => (
                  <div key={i} className="alloc-item">
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>{item.label}</span>
                      <span style={{ fontSize:18, fontWeight:500, color:"#ff9f43" }}>${item.amount.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize:10, color:"#555" }}>{item.reason}</div>
                  </div>
                ))
              }
              <div style={{ marginTop:12, fontSize:10, color:"#444", lineHeight:1.7 }}>
                Priority: 28% APR → Card 2 (Nov deadline) → Card 1 (Feb deadline) → Car loan
              </div>
            </div>
          )}
        </div>
      )}

      {/* BILLS */}
      {tab === "Bills" && (
        <div>
          <div className="section-label">Monthly Bills</div>

          {/* Add bill */}
          <div style={{ background:"#141414", border:"1px solid #222", borderRadius:8, padding:"14px 16px", marginBottom:20 }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.1em" }}>Add a Bill</div>
            <input className="money-input" type="text" placeholder="Bill name (e.g. Rent)" value={newBillName}
              onChange={e=>setNewBillName(e.target.value)} style={{ marginBottom:8 }} />
            <input className="money-input" type="number" placeholder="Monthly amount" value={newBillAmount}
              onChange={e=>setNewBillAmount(e.target.value)} />
            <button className="action-btn" onClick={addBill}>Add Bill +</button>
          </div>

          {/* Bill list */}
          {bills.length === 0 ? (
            <div style={{ fontSize:11, color:"#444", textAlign:"center", padding:"20px 0" }}>No bills added yet — add your first one above.</div>
          ) : (
            <>
              {bills.map(b => (
                <div key={b.id} className="bill-row">
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>{b.name}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:16, fontWeight:500, color:"#e8e0d0" }}>${parseFloat(b.amount).toLocaleString()}</span>
                    <button className="del-btn" onClick={()=>removeBill(b.id)}>✕</button>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div style={{ marginTop:16, background:"#141414", border:"1px solid #222", borderRadius:8, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10, paddingBottom:10, borderBottom:"1px solid #1e1e1e" }}>
                  <span style={{ fontSize:11, color:"#555" }}>Total Bills</span>
                  <span style={{ fontSize:16, fontWeight:500, color:"#e8e0d0" }}>${totalBills.toLocaleString()}/mo</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:11, color:"#555" }}>Debt Payments</span>
                  <span style={{ fontSize:14, color:"#ff9f43" }}>${totalDebtPayments.toLocaleString()}/mo</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, borderTop:"1px solid #1e1e1e" }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>Total Monthly Needed</span>
                  <span style={{ fontSize:18, fontWeight:700, color:"#ff9f43" }}>${totalMonthlyNeeded.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop:28, fontSize:10, color:"#333", lineHeight:1.8 }}>
        <span style={{ color:"#ff4444" }}>▸</span> All data saves automatically to this device.<br />
        <span style={{ color:"#ff9f43" }}>▸</span> Edit card balances anytime — payments auto-recalculate.<br />
        <span style={{ color:"#7ab8ff" }}>▸</span> Log car payments to track interest saved in real time.<br />
        <span style={{ color:"#555" }}>▸</span> Daily interest ticker updates live based on current balance.
      </div>
    </div>
  );
}
