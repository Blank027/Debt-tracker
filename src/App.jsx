
const MONTHS = [
  "Jun 2026","Jul 2026","Aug 2026","Sep 2026","Oct 2026",
  "Nov 2026","Dec 2026","Jan 2027","Feb 2027","Mar 2027",
  "Apr 2027","May 2027","Jun 2027","Jul 2027","Aug 2027","Sep 2027",
  "Oct 2027","Nov 2027","Dec 2027","Jan 2028","Feb 2028","Mar 2028",
  "Apr 2028","May 2028","Jun 2028","Jul 2028","Aug 2028","Sep 2028"
];

const CC_MONTHS = [
  "Jun 2026","Jul 2026","Aug 2026","Sep 2026","Oct 2026",
  "Nov 2026","Dec 2026","Jan 2027","Feb 2027"
];

const initialPlan = [
  { month: "Jun 2026",  card1Pay: 404, card2Pay: 520, card1Bal: 3232, card2Bal: 2080 },
  { month: "Jul 2026",  card1Pay: 404, card2Pay: 520, card1Bal: 2828, card2Bal: 1560 },
  { month: "Aug 2026",  card1Pay: 404, card2Pay: 520, card1Bal: 2424, card2Bal: 1040 },
  { month: "Sep 2026",  card1Pay: 404, card2Pay: 520, card1Bal: 2020, card2Bal: 520  },
  { month: "Oct 2026",  card1Pay: 404, card2Pay: 520, card1Bal: 1616, card2Bal: 0    },
  { month: "Nov 2026",  card1Pay: 924, card2Pay: 0,   card1Bal: 692,  card2Bal: 0    },
  { month: "Dec 2026",  card1Pay: 692, card2Pay: 0,   card1Bal: 0,    card2Bal: 0    },
  { month: "Jan 2027",  card1Pay: 0,   card2Pay: 0,   card1Bal: 0,    card2Bal: 0    },
  { month: "Feb 2027",  card1Pay: 0,   card2Pay: 0,   card1Bal: 0,    card2Bal: 0    },
];

const ONE_TIME_CARDS = [
  { id: "ot1", label: "Card A", balance: 348, apr: 28 },
  { id: "ot2", label: "Card B", balance: 348, apr: 28 },
  { id: "ot3", label: "Card C", balance: 35,  apr: 28 },
];

function buildCarPlan() {
  const APR = 7.59 / 100 / 12;
  let bal = 24249;
  const rows = [];
  for (let i = 0; i < 28; i++) {
    const interest = bal * APR;
    const payment = i < 7 ? 487 : 1411;
    const principal = Math.min(bal, payment - interest);
    bal = Math.max(0, bal - principal);
    rows.push({
      month: MONTHS[i],
      payment: bal === 0 && i >= 7 ? Math.round(principal + interest) : payment,
      balance: Math.round(bal),
      interest: Math.round(interest),
      phase: i < 7 ? "holding" : "attack"
    });
    if (bal === 0) break;
  }
  return rows;
}

const CAR_PLAN = buildCarPlan();
const CAR_PAYOFF_MONTH = CAR_PLAN[CAR_PLAN.length - 1].month;

function recompute(paid1, paid2) {
  let b1 = 3636, b2 = 2600;
  const rows = [];
  for (let i = 0; i < 9; i++) {
    const p1 = paid1[i] ?? 0;
    const p2 = paid2[i] ?? 0;
    b1 = Math.max(0, b1 - p1);
    b2 = Math.max(0, b2 - p2);
    rows.push({ month: CC_MONTHS[i], card1Pay: p1, card2Pay: p2, card1Bal: b1, card2Bal: b2 });
  }
  return rows;
}

// Smart allocator — urgency priority
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
    remaining -= give;
  }

  return allocs;
}

const TABS = ["Overview", "High-APR Payoff", "0% Cards", "Car Loan", "Extra Cash"];

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function App() {
  const [tab, setTab] = useState("Overview");
  const [paid1, setPaid1] = useState(() => load("paid1", {}));
  const [paid2, setPaid2] = useState(() => load("paid2", {}));
  const [otPaid, setOtPaid] = useState(() => load("otPaid", { ot1: false, ot2: false, ot3: false }));
  const [carPaid, setCarPaid] = useState(() => load("carPaid", {}));
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [extraInput, setExtraInput] = useState("");
  const [allocResult, setAllocResult] = useState(null);

  useEffect(() => save("paid1", paid1), [paid1]);
  useEffect(() => save("paid2", paid2), [paid2]);
  useEffect(() => save("otPaid", otPaid), [otPaid]);
  useEffect(() => save("carPaid", carPaid), [carPaid]);

  const rows = recompute(paid1, paid2);
  const card2ClearIdx = rows.findIndex(r => r.card2Bal === 0);
  const card1ClearIdx = rows.findIndex(r => r.card1Bal === 0);
  const bar1 = Math.min(100, ((3636 - rows[rows.length-1].card1Bal) / 3636) * 100);
  const bar2 = Math.min(100, ((2600 - rows[rows.length-1].card2Bal) / 2600) * 100);
  const allOtPaid = Object.values(otPaid).every(Boolean);
  const otRemaining = ONE_TIME_CARDS.filter(c => !otPaid[c.id]).reduce((s, c) => s + c.balance, 0);
  const lastCarPaidIdx = Math.max(-1, ...Object.keys(carPaid).map(Number));
  const carCurrentBal = lastCarPaidIdx >= 0 ? (carPaid[lastCarPaidIdx]?.bal ?? CAR_PLAN[lastCarPaidIdx].balance) : 24249;
  const carPct = Math.min(100, ((24249 - carCurrentBal) / 24249) * 100);
  const totalPaid1 = rows.reduce((s, r) => s + r.card1Pay, 0);
  const totalPaid2 = rows.reduce((s, r) => s + r.card2Pay, 0);
  const totalDebt = rows[rows.length-1].card1Bal + rows[rows.length-1].card2Bal + carCurrentBal + otRemaining;
  const totalOriginal = 3636 + 2600 + 24249 + 731;
  const totalPct = Math.min(100, ((totalOriginal - totalDebt) / totalOriginal) * 100);

  function handleEdit(cardNum, idx) {
    const val = cardNum === 1 ? (paid1[idx] ?? initialPlan[idx].card1Pay) : (paid2[idx] ?? initialPlan[idx].card2Pay);
    setEditing({ cardNum, idx });
    setEditVal(String(val));
  }

  function commitEdit() {
    if (!editing) return;
    const num = parseFloat(editVal) || 0;
    if (editing.cardNum === 1) setPaid1(p => ({ ...p, [editing.idx]: num }));
    else setPaid2(p => ({ ...p, [editing.idx]: num }));
    setEditing(null);
  }

  function handleAllocate() {
    const amt = parseFloat(extraInput);
    if (!amt || amt <= 0) return;
    const result = allocateExtra(amt, otPaid, rows[rows.length-1].card2Bal, rows[rows.length-1].card1Bal, carCurrentBal);
    setAllocResult({ total: amt, items: result });
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
        .edit-input { background:#1a1a1a; border:1px solid #ff9f43; color:#ff9f43; font-family:inherit; font-size:13px; width:80px; padding:4px 6px; border-radius:3px; text-align:right; outline:none; }
        .cell-btn { background:none; border:none; color:inherit; font-family:inherit; font-size:13px; cursor:pointer; padding:2px 4px; border-radius:2px; width:100%; text-align:right; }
        .cell-btn:hover { background:#1e1e1e; }
        tr:hover td { background:#111 !important; }
        .cleared-row td { opacity:0.45; }
        .ot-card { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#141414; border:1px solid #222; border-radius:6px; margin-bottom:8px; transition:opacity 0.3s; }
        .ot-card.paid { opacity:0.4; }
        .check-btn { background:none; border:2px solid #ff4444; color:#ff4444; font-family:inherit; font-size:11px; padding:4px 10px; border-radius:3px; cursor:pointer; letter-spacing:0.08em; transition:all 0.2s; white-space:nowrap; }
        .check-btn:hover { background:#ff4444; color:#fff; }
        .check-btn.checked { background:#1a4a3a; border-color:#4dff9a; color:#4dff9a; }
        .section-label { font-size:10px; letter-spacing:0.2em; color:#555; text-transform:uppercase; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #1e1e1e; }
        .tab-bar { display:flex; gap:4px; margin-bottom:24px; flex-wrap:wrap; }
        .tab-btn { background:#141414; border:1px solid #222; color:#555; font-family:inherit; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; padding:7px 12px; border-radius:3px; cursor:pointer; transition:all 0.15s; }
        .tab-btn.active { background:#1e1e1e; border-color:#444; color:#e8e0d0; }
        .tab-btn:hover { color:#e8e0d0; }
        .overview-card { background:#141414; border:1px solid #222; border-radius:8px; padding:14px 16px; margin-bottom:10px; }
        .money-input { background:#141414; border:1px solid #333; color:#e8e0d0; font-family:inherit; font-size:18px; padding:12px 14px; border-radius:6px; width:100%; outline:none; margin-bottom:10px; }
        .money-input:focus { border-color:#ff9f43; }
        .alloc-btn { background:#ff9f43; border:none; color:#0d0d0d; font-family:inherit; font-size:12px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:12px; border-radius:6px; width:100%; cursor:pointer; transition:opacity 0.2s; }
        .alloc-btn:hover { opacity:0.85; }
        .alloc-item { background:#141414; border:1px solid #222; border-radius:6px; padding:12px 14px; margin-bottom:8px; }
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
            <div style={{ fontSize:28, fontWeight:500, color:"#ff9f43", fontFamily:"'Syne',sans-serif" }}>${totalDebt.toLocaleString()}</div>
            <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>of ${totalOriginal.toLocaleString()} original</div>
            <div className="progress-bar" style={{ height:8 }}>
              <div className="progress-fill" style={{ width:`${totalPct}%`, background:"linear-gradient(90deg,#ff9f43,#4dff9a)" }} />
            </div>
            <div style={{ fontSize:10, color:"#555", marginTop:4 }}>{Math.round(totalPct)}% paid off</div>
          </div>
          <div className="section-label">Debt Breakdown</div>
          {[
            { label:"⚡ High-APR Cards (3x)", apr:"28%", bal:otRemaining, orig:731, color:"#ff4444", status:allOtPaid?"done":"urgent", statusLabel:allOtPaid?"✓ Cleared":"Pay This Week" },
            { label:"Card 2 (0% APR)", apr:"0%", bal:rows[rows.length-1].card2Bal, orig:2600, color:"#4dff9a", status:rows[rows.length-1].card2Bal===0?"done":"urgent", statusLabel:rows[rows.length-1].card2Bal===0?"✓ Cleared":"Due Nov 2026" },
            { label:"Card 1 (0% APR)", apr:"0%", bal:rows[rows.length-1].card1Bal, orig:3636, color:"#ff9f43", status:rows[rows.length-1].card1Bal===0?"done":"safe", statusLabel:rows[rows.length-1].card1Bal===0?"✓ Cleared":"Due Feb 2027" },
            { label:"Car Loan", apr:"7.59%", bal:carCurrentBal, orig:24249, color:"#7ab8ff", status:"attack", statusLabel:`Payoff ~${CAR_PAYOFF_MONTH}` },
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
              { period:"Jan 2027+",    action:"Roll $924 freed-up cash → $1,411/mo attack on car loan",   color:"#ff9f43" },
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
      {tab === "High-APR Payoff" && (
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
          <div style={{ fontSize:10, color:"#444", marginTop:8 }}>Paying these off stops 28% interest immediately — highest ROI move you can make.</div>
        </div>
      )}

      {/* 0% CARDS — fixed column order */}
      {tab === "0% Cards" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
            {[
              { label:"Card 1", deadline:"Feb 2027", bal:rows[rows.length-1].card1Bal, pct:bar1, color:"#ff9f43" },
              { label:"Card 2", deadline:"Nov 2026", bal:rows[rows.length-1].card2Bal, pct:bar2, color:"#4dff9a" },
            ].map(c => (
              <div key={c.label} style={{ background:"#141414", border:"1px solid #222", borderRadius:8, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>{c.label}</span>
                  {c.bal===0?<span className="tag done">✓ Paid</span>:c.deadline==="Nov 2026"?<span className="tag urgent">⚠ Urgent</span>:<span className="tag safe">On Track</span>}
                </div>
                <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>Deadline: {c.deadline}</div>
                <div style={{ fontSize:20, fontWeight:500, color:c.color }}>${c.bal.toLocaleString()}</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width:`${c.pct}%`, background:c.color }} /></div>
                <div style={{ fontSize:10, color:"#555", marginTop:4, textAlign:"right" }}>{Math.round(c.pct)}% paid</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #2a2a2a" }}>
                  {["Month","Card 1 Pay","Card 1 Bal","Card 2 Pay","Card 2 Bal","Total Out"].map(h => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:"right", color:"#555", fontWeight:400, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                      {h==="Month"?<span style={{ textAlign:"left", display:"block" }}>{h}</span>:h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i) => {
                  const s1=initialPlan[i].card1Pay, s2=initialPlan[i].card2Pay;
                  const e1=editing?.cardNum===1&&editing?.idx===i, e2=editing?.cardNum===2&&editing?.idx===i;
                  const cleared=r.card1Bal===0&&r.card2Bal===0&&i>0;
                  return (
                    <tr key={r.month} className={cleared?"cleared-row":""}>
                      <td style={{ padding:"9px 10px", color:"#888", borderBottom:"1px solid #181818" }}>
                        {r.month}
                        {i===card1ClearIdx&&r.card1Bal===0&&<span className="tag done" style={{ marginLeft:6, fontSize:9 }}>C1 ✓</span>}
                        {i===card2ClearIdx&&r.card2Bal===0&&<span className="tag done" style={{ marginLeft:6, fontSize:9 }}>C2 ✓</span>}
                      </td>
                      {/* Card 1 first */}
                      <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:"#ff9f43" }}>
                        {e1?<input className="edit-input" value={editVal} autoFocus onChange={e=>setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e=>e.key==="Enter"&&commitEdit()} />:
                        <button className="cell-btn" style={{ color:r.card1Pay>0?"#ff9f43":"#333" }} onClick={()=>handleEdit(1,i)}>
                          {r.card1Pay>0?`$${r.card1Pay.toLocaleString()}`:"—"}{s1>0&&r.card1Pay!==s1&&<span style={{ color:"#555", fontSize:10 }}> (rec ${s1})</span>}
                        </button>}
                      </td>
                      <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:r.card1Bal===0?"#2a7a4b":"#888" }}>${r.card1Bal.toLocaleString()}</td>
                      {/* Card 2 second */}
                      <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:"#4dff9a" }}>
                        {e2?<input className="edit-input" value={editVal} autoFocus onChange={e=>setEditVal(e.target.value)} onBlur={commitEdit} onKeyDown={e=>e.key==="Enter"&&commitEdit()} />:
                        <button className="cell-btn" style={{ color:r.card2Pay>0?"#4dff9a":"#333" }} onClick={()=>handleEdit(2,i)}>
                          {r.card2Pay>0?`$${r.card2Pay.toLocaleString()}`:"—"}{s2>0&&r.card2Pay!==s2&&<span style={{ color:"#555", fontSize:10 }}> (rec ${s2})</span>}
                        </button>}
                      </td>
                      <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:r.card2Bal===0?"#2a7a4b":"#888" }}>${r.card2Bal.toLocaleString()}</td>
                      <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:"#e8e0d0", fontWeight:500 }}>
                        {(r.card1Pay+r.card2Pay)>0?`$${(r.card1Pay+r.card2Pay).toLocaleString()}`:"—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:"1px solid #2a2a2a" }}>
                  <td style={{ padding:10, color:"#555", fontSize:11 }}>TOTAL</td>
                  <td style={{ padding:10, textAlign:"right", color:"#ff9f43", fontWeight:500 }}>${totalPaid1.toLocaleString()}</td>
                  <td />
                  <td style={{ padding:10, textAlign:"right", color:"#4dff9a", fontWeight:500 }}>${totalPaid2.toLocaleString()}</td>
                  <td />
                  <td style={{ padding:10, textAlign:"right", color:"#e8e0d0", fontWeight:700 }}>${(totalPaid1+totalPaid2).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* CAR LOAN */}
      {tab === "Car Loan" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              { label:"Remaining",      value:`$${carCurrentBal.toLocaleString()}`, color:"#7ab8ff" },
              { label:"APR",            value:"7.59%",                              color:"#e8e0d0" },
              { label:"Now → Dec 2026", value:"$487/mo",                            color:"#555"    },
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
            <div style={{ fontSize:22, fontWeight:500, color:"#7ab8ff" }}>${carCurrentBal.toLocaleString()}</div>
            <div className="progress-bar" style={{ height:8 }}>
              <div className="progress-fill" style={{ width:`${carPct}%`, background:"#7ab8ff" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#555", marginTop:4 }}>
              <span>{Math.round(carPct)}% paid</span>
              <span>Est. payoff: {CAR_PAYOFF_MONTH}</span>
            </div>
          </div>
          <div className="section-label">Month-by-Month Schedule</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #2a2a2a" }}>
                  {["Month","Phase","Payment","Interest","Balance"].map(h => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:"right", color:"#555", fontWeight:400, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                      {h==="Month"||h==="Phase"?<span style={{ textAlign:"left", display:"block" }}>{h}</span>:h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAR_PLAN.map((r,i) => (
                  <tr key={r.month} style={{ opacity:r.balance===0&&i>0?0.4:1 }}>
                    <td style={{ padding:"9px 10px", color:"#888", borderBottom:"1px solid #181818" }}>{r.month}</td>
                    <td style={{ padding:"9px 10px", borderBottom:"1px solid #181818" }}>
                      {r.phase==="attack"?<span className="tag attack">🚀 Attack</span>:<span style={{ fontSize:10, color:"#444", letterSpacing:"0.1em", textTransform:"uppercase" }}>Holding</span>}
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:r.phase==="attack"?"#ff9f43":"#666" }}>${r.payment.toLocaleString()}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:"#ff4444", fontSize:11 }}>${r.interest.toLocaleString()}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right", borderBottom:"1px solid #181818", color:r.balance===0?"#2a7a4b":"#888" }}>${r.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:16, background:"#0f1a0f", border:"1px solid #1a3a1a", borderRadius:6, padding:"12px 14px", fontSize:11, color:"#4dff9a", lineHeight:1.7 }}>
            💡 Refinance check: In Dec 2026, compare rates. If you can get below 6%, refinancing before Jan 2027 attack mode could save an additional $300–600 in interest.
          </div>
        </div>
      )}

      {/* EXTRA CASH ALLOCATOR */}
      {tab === "Extra Cash" && (
        <div>
          <div className="section-label">💰 Smart Money Allocator</div>
          <div style={{ background:"#141414", border:"1px solid #222", borderRadius:8, padding:"16px", marginBottom:20, fontSize:11, color:"#888", lineHeight:1.7 }}>
            Enter any extra money you have available and we'll automatically split it across your debts in the smartest order — highest urgency first.
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, color:"#555", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:8 }}>Extra Amount Available</div>
            <input
              className="money-input"
              type="number"
              placeholder="$0.00"
              value={extraInput}
              onChange={e => { setExtraInput(e.target.value); setAllocResult(null); }}
            />
            <button className="alloc-btn" onClick={handleAllocate}>Allocate →</button>
          </div>

          {allocResult && (
            <div>
              <div className="section-label">Recommended Allocation — ${allocResult.total.toLocaleString()}</div>
              {allocResult.items.length === 0 ? (
                <div style={{ fontSize:12, color:"#4dff9a", padding:"12px 0" }}>🎉 All debts are paid off!</div>
              ) : (
                allocResult.items.map((item, i) => (
                  <div key={i} className="alloc-item">
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>{item.label}</span>
                      <span style={{ fontSize:18, fontWeight:500, color:"#ff9f43" }}>${item.amount.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize:10, color:"#555" }}>{item.reason}</div>
                  </div>
                ))
              )}
              <div style={{ marginTop:12, fontSize:10, color:"#444", lineHeight:1.7 }}>
                Priority order: 28% APR cards → Card 2 (Nov deadline) → Card 1 (Feb deadline) → Car loan
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop:28, fontSize:10, color:"#333", lineHeight:1.8 }}>
        <span style={{ color:"#ff4444" }}>▸</span> All data saves automatically to this device.<br />
        <span style={{ color:"#ff9f43" }}>▸</span> Tap any payment cell to log actual payments.<br />
        <span style={{ color:"#4dff9a" }}>▸</span> Use Extra Cash tab anytime you have money to allocate.<br />
        <span style={{ color:"#555" }}>▸</span> Assumes $0 new charges on all cards.
      </div>
    </div>
  );
}
