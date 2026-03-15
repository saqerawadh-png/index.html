import { useState, useEffect, useCallback } from “react”;

// ✅ قائمة العملات للتحليل
const COINS = [
“BTCUSDT”,“ETHUSDT”,“BNBUSDT”,“SOLUSDT”,“XRPUSDT”,
“ADAUSDT”,“DOGEUSDT”,“AVAXUSDT”,“DOTUSDT”,“MATICUSDT”
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📐 حسابات تقنية
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const calcRSI = (closes, period = 14) => {
if (closes.length < period + 1) return 50;
let gains = 0, losses = 0;
for (let i = closes.length - period; i < closes.length; i++) {
const d = closes[i] - closes[i - 1];
if (d > 0) gains += d; else losses += Math.abs(d);
}
const ag = gains / period, al = losses / period;
if (al === 0) return 100;
return 100 - 100 / (1 + ag / al);
};

const calcEMA = (closes, period) => {
if (closes.length < period) return closes.at(-1);
const k = 2 / (period + 1);
let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
return ema;
};

const calcATR = (closes, period = 14) => {
const trs = [];
for (let i = 1; i < closes.length; i++)
trs.push(Math.abs(closes[i] - closes[i - 1]));
return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
};

const scoreAndBuild = (rawList) =>
rawList.map(({ symbol, price, change24h, closes, volumes }) => {
const rsi     = calcRSI(closes);
const ema20   = calcEMA(closes, 20);
const ema50   = calcEMA(closes, 50);
const atr     = calcATR(closes);
const avgVol  = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
const volBoost = volumes.at(-1) / avgVol;

```
let score = 0;
if (rsi > 45 && rsi < 70) score += 30;
else if (rsi < 35) score += 15;
else if (rsi >= 70) score -= 10;
if (price > ema20)  score += 20;
if (ema20 > ema50)  score += 20;
if (volBoost > 1.3) score += 15;
if (change24h > 0)  score += 15;

const trend    = ema20 > ema50 ? "صاعد" : "هابط";
const entry    = price;
const stopLoss = price - atr * 1.5;
const target1  = price + atr * 2;
const target2  = price + atr * 3.5;

return {
  symbol, price, change24h, closes, rsi, score, trend,
  volBoost, entry, stopLoss, target1, target2, atr,
  stopPct:    ((entry - stopLoss) / entry * 100).toFixed(2),
  t1Pct:      ((target1 - entry) / entry * 100).toFixed(2),
  t2Pct:      ((target2 - entry) / entry * 100).toFixed(2),
  rr:         ((target1 - entry) / (entry - stopLoss)).toFixed(2),
};
```

})
.sort((a, b) => b.score - a.score)
.slice(0, 3);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌐 جلب البيانات من Binance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const fetchOne = async (symbol) => {
const [t, k] = await Promise.all([
fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(r => r.json()),
fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=100`).then(r => r.json()),
]);
return {
symbol,
price:     parseFloat(t.lastPrice),
change24h: parseFloat(t.priceChangePercent),
closes:    k.map(c => parseFloat(c[4])),
volumes:   k.map(c => parseFloat(c[5])),
};
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📈 Sparkline مصغّر
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const Sparkline = ({ closes }) => {
const data = closes.slice(-20);
const mn = Math.min(…data), mx = Math.max(…data);
const pts = data.map((c, i) => `${(i / 19) * 100},${100 - ((c - mn) / (mx - mn || 1)) * 100}`).join(” “);
const up  = data.at(-1) > data[0];
return (
<svg viewBox=“0 0 100 100” preserveAspectRatio=“none” style={{ width: “100%”, height: 44 }}>
<polyline points={pts} fill=“none”
stroke={up ? “#00ff94” : “#ff4d6d”} strokeWidth=“2.5” strokeLinejoin=“round” />
</svg>
);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🃏 بطاقة العملة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MEDALS = [“🥇”,“🥈”,“🥉”];
const RANK_COLORS = [”#FFD700”,”#C0C0C0”,”#CD7F32”];

const fmt = (p) => {
if (!p && p !== 0) return “—”;
if (p >= 1000) return p.toLocaleString(“en”, { maximumFractionDigits: 2 });
if (p >= 1)    return Number(p).toFixed(4);
return Number(p).toFixed(6);
};

const Card = ({ coin, rank }) => {
const [open, setOpen] = useState(false);
const rc = RANK_COLORS[rank];

const levels = [
{ icon:“⟶”, label:“دخول”,       val:coin.entry,    pct:“السعر الحالي”, color:”#94a3b8” },
{ icon:“✕”, label:“وقف الخسارة”, val:coin.stopLoss, pct:`-${coin.stopPct}%`, color:”#ff4d6d” },
{ icon:“◎”, label:“هدف 1”,       val:coin.target1,  pct:`+${coin.t1Pct}%`,  color:”#00c97a” },
{ icon:“◉”, label:“هدف 2”,       val:coin.target2,  pct:`+${coin.t2Pct}%`,  color:”#00ff94” },
];

return (
<div onClick={() => setOpen(!open)} style={{
background:“rgba(15,23,42,0.85)”, border:`1px solid rgba(255,255,255,0.09)`,
borderRadius:20, padding:“1.4rem”, position:“relative”, overflow:“hidden”,
cursor:“pointer”, backdropFilter:“blur(14px)”,
transition:“transform .3s,box-shadow .3s”,
animation:`slideUp .5s ease ${rank*0.13}s both`,
}}
onMouseEnter={e => { e.currentTarget.style.transform=“translateY(-4px)”; e.currentTarget.style.boxShadow=`0 20px 50px rgba(0,0,0,.5),0 0 25px ${rc}28`; }}
onMouseLeave={e => { e.currentTarget.style.transform=“translateY(0)”;    e.currentTarget.style.boxShadow=“none”; }}
>
{/* shimmer top */}
<div style={{ position:“absolute”,inset:0,pointerEvents:“none”,
background:`radial-gradient(ellipse at 50% -10%, ${rc}1a 0%, transparent 65%)`,borderRadius:20 }} />

```
  {/* header */}
  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.9rem" }}>
    <div style={{ display:"flex",alignItems:"flex-start",gap:"0.7rem" }}>
      <span style={{ fontSize:"1.8rem",lineHeight:1 }}>{MEDALS[rank]}</span>
      <div>
        <div style={{ fontSize:"1.35rem",fontWeight:900,color:"#fff" }}>
          {coin.symbol.replace("USDT","")}<span style={{ fontSize:"0.78rem",fontWeight:400,color:"#64748b" }}>/USDT</span>
        </div>
        <div style={{
          display:"inline-flex",alignItems:"center",gap:"0.25rem",
          marginTop:"0.25rem",padding:"0.18rem 0.55rem",borderRadius:6,fontSize:"0.7rem",fontWeight:700,
          background: coin.trend==="صاعد" ? "#00ff9420":"#ff4d6d20",
          color:       coin.trend==="صاعد" ? "#00ff94"  :"#ff4d6d",
          border:`1px solid ${coin.trend==="صاعد"?"#00ff9440":"#ff4d6d40"}`,
        }}>
          {coin.trend==="صاعد"?"↑":"↓"} {coin.trend}
        </div>
      </div>
    </div>
    <div style={{ textAlign:"left" }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:"1.05rem",fontWeight:600,color:"#fff" }}>
        ${fmt(coin.price)}
      </div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.88rem",fontWeight:700,
        color: coin.change24h>=0?"#00ff94":"#ff4d6d" }}>
        {coin.change24h>=0?"+":""}{Number(coin.change24h).toFixed(2)}%
      </div>
    </div>
  </div>

  {/* sparkline */}
  <div style={{ margin:"0 -0.4rem 0.9rem",opacity:0.85 }}>
    <Sparkline closes={coin.closes} />
  </div>

  {/* stats */}
  <div style={{ display:"flex",gap:"0.9rem",marginBottom:"1.1rem",alignItems:"center" }}>
    {/* RSI */}
    <div style={{ flex:1,display:"flex",flexDirection:"column",gap:"0.28rem" }}>
      <span style={lbl}>RSI</span>
      <div style={{ height:4,background:"rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${coin.rsi}%`,borderRadius:99,
          background: coin.rsi>70?"#ff4d6d":coin.rsi<35?"#00ff94":"#f0a500",
          transition:"width .8s ease" }} />
      </div>
      <span style={{ ...mono, fontSize:"0.82rem",fontWeight:600,
        color: coin.rsi>70?"#ff4d6d":coin.rsi<35?"#00ff94":"#f0a500" }}>
        {coin.rsi.toFixed(1)}
      </span>
    </div>
    {/* Volume */}
    <div style={{ display:"flex",flexDirection:"column",gap:"0.28rem",alignItems:"flex-start" }}>
      <span style={lbl}>حجم</span>
      <span style={{ ...mono,fontSize:"0.82rem",fontWeight:600,
        color:coin.volBoost>1.5?"#00ff94":"#94a3b8" }}>{coin.volBoost.toFixed(2)}x</span>
    </div>
    {/* R:R */}
    <div style={{ display:"flex",flexDirection:"column",gap:"0.28rem",alignItems:"flex-start" }}>
      <span style={lbl}>R:R</span>
      <span style={{ ...mono,fontSize:"0.82rem",fontWeight:600,color:"#a78bfa" }}>1:{coin.rr}</span>
    </div>
  </div>

  {/* levels */}
  <div style={{ display:"flex",flexDirection:"column",gap:"0.5rem" }}>
    {levels.map(l => (
      <div key={l.label} style={{
        display:"flex",alignItems:"center",gap:"0.65rem",
        padding:"0.55rem 0.75rem",borderRadius:10,
        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize:"0.95rem",width:20,textAlign:"center",color:l.color }}>{l.icon}</span>
        <div style={{ flex:1 }}>
          <span style={{ display:"block",...lbl }}>{l.label}</span>
          <span style={{ ...mono,fontSize:"0.86rem",fontWeight:600,color:"#e2e8f0" }}>${fmt(l.val)}</span>
        </div>
        <span style={{ ...mono,fontSize:"0.76rem",fontWeight:700,color:l.color }}>{l.pct}</span>
      </div>
    ))}
  </div>

  {/* expanded */}
  {open && (
    <div style={{ marginTop:"1rem",paddingTop:"1rem",
      borderTop:"1px solid rgba(255,255,255,0.07)",
      display:"flex",flexDirection:"column",gap:"0.7rem",
      animation:"fadeIn .3s ease" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"0.7rem" }}>
        <span style={lbl}>قوة الإشارة</span>
        <div style={{ flex:1,height:6,background:"rgba(255,255,255,0.08)",borderRadius:99,overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${coin.score}%`,borderRadius:99,
            background:"linear-gradient(90deg,#a78bfa,#00ff94)",transition:"width 1s ease" }} />
        </div>
        <span style={{ ...mono,fontSize:"0.82rem",fontWeight:600,color:"#e2e8f0" }}>{coin.score}/100</span>
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <span style={lbl}>ATR (التقلب)</span>
        <span style={{ ...mono,fontSize:"0.82rem",fontWeight:600,color:"#94a3b8" }}>${fmt(coin.atr)}</span>
      </div>
    </div>
  )}

  <div style={{ textAlign:"center",fontSize:"0.68rem",color:"#334155",
    marginTop:"0.65rem",fontFamily:"'IBM Plex Mono',monospace",transition:"color .2s" }}>
    {open?"▲ إخفاء":"▼ تفاصيل"}
  </div>
</div>
```

);
};

const lbl  = { fontSize:“0.68rem”,color:”#64748b”,fontWeight:600,textTransform:“uppercase”,letterSpacing:“0.05em” };
const mono = { fontFamily:”‘IBM Plex Mono’,monospace” };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🏠 التطبيق الرئيسي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function App() {
const [coins,   setCoins]   = useState([]);
const [loading, setLoading] = useState(false);
const [error,   setError]   = useState(null);
const [updated, setUpdated] = useState(null);

const load = useCallback(async () => {
setLoading(true); setError(null);
try {
const raw  = await Promise.all(COINS.map(fetchOne));
const top3 = scoreAndBuild(raw);
setCoins(top3);
setUpdated(new Date());
} catch {
setError(“تعذّر الاتصال بـ Binance API. تحقق من الاتصال بالإنترنت.”);
} finally {
setLoading(false);
}
}, []);

useEffect(() => {
load();
const t = setInterval(load, 60_000);
return () => clearInterval(t);
}, [load]);

return (
<>
<style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Cairo:wght@400;600;700;900&display=swap'); *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} body{background:#030712;color:#e2e8f0;font-family:'Cairo',sans-serif;direction:rtl;min-height:100vh} @keyframes slideUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}} @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,40px)}} @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,30px)}}`}</style>

```
  <div style={{ minHeight:"100vh",background:"#030712",position:"relative",overflow:"hidden" }}>

    {/* خلفية */}
    <div style={{ position:"fixed",inset:0,
      backgroundImage:"linear-gradient(rgba(0,255,148,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,148,.03) 1px,transparent 1px)",
      backgroundSize:"40px 40px",pointerEvents:"none",zIndex:0 }} />
    <div style={{ position:"fixed",width:500,height:500,borderRadius:"50%",
      background:"#00ff94",filter:"blur(80px)",opacity:.1,top:-200,right:-150,
      animation:"drift1 12s ease-in-out infinite",pointerEvents:"none",zIndex:0 }} />
    <div style={{ position:"fixed",width:400,height:400,borderRadius:"50%",
      background:"#a78bfa",filter:"blur(80px)",opacity:.1,bottom:-100,left:-100,
      animation:"drift2 15s ease-in-out infinite",pointerEvents:"none",zIndex:0 }} />

    <div style={{ maxWidth:1100,margin:"0 auto",padding:"2rem 1.5rem",position:"relative",zIndex:1 }}>

      {/* العنوان */}
      <div style={{ textAlign:"center",marginBottom:"2.5rem" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:"1rem",marginBottom:"0.4rem" }}>
          <div style={{ width:52,height:52,background:"linear-gradient(135deg,#00ff94,#a78bfa)",
            borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:"1.6rem",boxShadow:"0 0 28px #00ff9444" }}>📊</div>
          <h1 style={{ fontSize:"clamp(1.8rem,5vw,2.8rem)",fontWeight:900,
            background:"linear-gradient(135deg,#fff 30%,#00ff94 100%)",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>
            إشارات التداول
          </h1>
        </div>
        <p style={{ color:"#64748b",fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.9rem" }}>
          أفضل 3 عملات · Binance · تحديث تلقائي كل 60 ثانية
        </p>
      </div>

      {/* شريط الحالة */}
      {updated && (
        <div style={{ display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"center",
          gap:"1.5rem",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",
          borderRadius:12,padding:".7rem 1.4rem",marginBottom:"2rem" }}>
          {[
            ["🟢","مباشر"],
            [`⏱`,`آخر تحديث: ${updated.toLocaleTimeString("ar")}`],
            ["📡","Binance API"],
            ["🕯","الشمعة: 4 ساعات"],
          ].map(([ic,tx]) => (
            <span key={tx} style={{ display:"flex",alignItems:"center",gap:"0.35rem",
              fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.78rem",color:"#94a3b8" }}>
              {ic} {tx}
            </span>
          ))}
        </div>
      )}

      {/* تنبيه */}
      <div style={{ background:"rgba(240,165,0,.07)",border:"1px solid rgba(240,165,0,.18)",
        borderRadius:12,padding:".85rem 1.4rem",marginBottom:"2rem",
        fontSize:"0.8rem",color:"#92400e",textAlign:"center",lineHeight:1.7 }}>
        ⚠️ هذه الإشارات للأغراض التعليمية فقط · ليست نصيحة مالية · تداول بحذر وإدارة رأس مال سليمة
      </div>

      {/* محتوى */}
      {loading && coins.length === 0 ? (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"1.5rem",padding:"4rem" }}>
          <div style={{ width:56,height:56,border:"3px solid rgba(0,255,148,.12)",
            borderTopColor:"#00ff94",borderRadius:"50%",animation:"spin .8s linear infinite" }} />
          <span style={{ fontFamily:"'IBM Plex Mono',monospace",color:"#64748b",fontSize:"0.9rem" }}>
            جاري تحليل السوق...
          </span>
        </div>
      ) : error ? (
        <div style={{ background:"rgba(255,77,109,.08)",border:"1px solid rgba(255,77,109,.25)",
          borderRadius:16,padding:"2rem",textAlign:"center",color:"#ff4d6d",
          display:"flex",flexDirection:"column",alignItems:"center",gap:"1rem" }}>
          <span style={{ fontSize:"2rem" }}>⚠️</span>
          <span>{error}</span>
          <button onClick={load} style={btnStyle}>إعادة المحاولة</button>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(310px,1fr))",gap:"1.4rem" }}>
          {coins.map((c, i) => <Card key={c.symbol} coin={c} rank={i} />)}
        </div>
      )}

      {/* زر تحديث */}
      <div style={{ display:"flex",justifyContent:"center",marginTop:"2rem" }}>
        <button onClick={load} disabled={loading} style={btnStyle}>
          <span style={loading ? { display:"inline-block",animation:"spin 1s linear infinite" } : {}}>↻</span>
          {loading ? " جاري التحديث..." : " تحديث يدوي"}
        </button>
      </div>

      <p style={{ textAlign:"center",marginTop:"2.5rem",
        fontFamily:"'IBM Plex Mono',monospace",fontSize:"0.72rem",color:"#1e293b" }}>
        © {new Date().getFullYear()} إشارات التداول · البيانات من Binance API
      </p>
    </div>
  </div>
</>
```

);
}

const btnStyle = {
display:“flex”,alignItems:“center”,gap:“0.5rem”,
background:“rgba(0,255,148,.09)”,border:“1px solid rgba(0,255,148,.28)”,
color:”#00ff94”,padding:”.7rem 2rem”,borderRadius:12,
fontFamily:”‘Cairo’,sans-serif”,fontSize:“1rem”,fontWeight:700,
cursor:“pointer”,transition:“all .2s”,
};
