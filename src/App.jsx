import { initializeApp, getApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, EmailAuthProvider,
  reauthenticateWithCredential, updatePassword,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, getDocs, deleteDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const DARK = {
  bg: "#021024", sidebar: "#031830", card: "#052659",
  input: "#021a3a", border: "#0d3a6e", text: "#c1e8ff",
  muted: "#5483b3", gold: "#7da0ca", goldD: "#5483b3",
  blue: "#7da0ca", blueL: "#c1e8ff", green: "#3dd68c",
  red: "#f16c6c", orange: "#f5a623", purp: "#5483b3",
  redBg: "#1a0808", greenBg: "#0d2a1a",
};
const LIGHT = {
  bg: "#e1d4c2", sidebar: "#f5f0e8", card: "#f5f0e8",
  input: "#beb5a9", border: "#a78d78", text: "#291c0e",
  muted: "#6e473b", gold: "#6e473b", goldD: "#291c0e",
  blue: "#6e473b", blueL: "#a78d78", green: "#4a7c59",
  red: "#c43030", orange: "#a05c2a", purp: "#6e473b",
  redBg: "#f5e8e8", greenBg: "#e8f2ec",
};
let C = { ...DARK };

const GLOBAL_CSS = `
  @keyframes fadeSlideIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes popIn { 0%{opacity:0;transform:scale(.92)} 65%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  .page-enter  { animation: fadeSlideIn .26s cubic-bezier(.4,0,.2,1) both; }
  .modal-enter { animation: popIn .2s cubic-bezier(.4,0,.2,1) both; }
  .card-anim   { transition: border-color .18s, transform .18s, box-shadow .18s !important; }
  .card-anim:hover { transform: translateY(-3px) !important; box-shadow: 0 8px 28px rgba(0,0,0,.22) !important; }
  .theme-all * { transition: background .22s, color .18s, border-color .18s !important; }
  .nav-btn { transition: background .15s, color .15s !important; }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #5483b355, #7da0ca44); border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #7da0ca99, #c1e8ff77); }
  ::-webkit-scrollbar-corner { background: transparent; }
  * { scrollbar-width: thin; scrollbar-color: #5483b344 transparent; }
  .theme-all ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #6e473b55, #a78d7844); }
  @media (max-width: 767px) {
    ::-webkit-scrollbar { width: 0; height: 0; }
    * { scrollbar-width: none !important; }
    .g4 { grid-template-columns: repeat(2,1fr) !important; }
    .g3 { grid-template-columns: 1fr !important; }
    .g2 { grid-template-columns: 1fr !important; }
    .pos-layout { grid-template-columns: 1fr !important; }
    .pos-cards { grid-template-columns: repeat(2,1fr) !important; }
    .hide-mobile { display: none !important; }
    .tbl { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
  }
  @media (max-width: 480px) {
    .g4 { grid-template-columns: 1fr 1fr !important; }
    .pos-cards { grid-template-columns: 1fr 1fr !important; }
  }
`;

const COP = (n) => "$" + Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const today = () => new Date().toLocaleDateString("es-CO");
const todayISO = () => new Date().toISOString().split("T")[0];
const genId = () => Math.random().toString(36).slice(2, 9);

const mkS = () => ({
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "1.25rem" },
  input: { width: "100%", boxSizing: "border-box", padding: "9px 13px", background: C.input, border: `1px solid ${C.border}`, borderRadius: "8px", color: C.text, fontSize: "13px", outline: "none", fontFamily: "inherit" },
  btnGold: { padding: "10px 20px", background: C.blue, color: C.bg, fontWeight: "700", fontSize: "13px", border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit" },
  btnOut: { padding: "7px 14px", background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" },
  label: { fontSize: "11px", color: C.muted, display: "block", marginBottom: "4px", letterSpacing: "0.5px" },
  sectionTitle: { fontSize: "14px", fontWeight: "600", color: C.text, marginBottom: "1rem" },
});
let s = mkS();

// ─── EXPORTAR ────────────────────────────────────────────────────────────────
const loadSheetJS = () => new Promise((resolve) => {
  if (window.XLSX) { resolve(window.XLSX); return; }
  const sc = document.createElement("script");
  sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  sc.onload = () => resolve(window.XLSX);
  document.head.appendChild(sc);
});

const loadJsPDF = () => new Promise((resolve) => {
  if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
  const sc = document.createElement("script");
  sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  sc.onload = () => {
    const sc2 = document.createElement("script");
    sc2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
    sc2.onload = () => resolve(window.jspdf.jsPDF);
    document.head.appendChild(sc2);
  };
  document.head.appendChild(sc);
});

const exportToExcel = async (sheets, filename) => {
  const XLSX = await loadSheetJS();
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const cols = Object.keys(data[0] || {}).map(k => ({
      wch: Math.max(k.length, ...data.map(r => String(r[k] || "").length)) + 2
    }));
    ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename + ".xlsx");
};

const exportToPDF = async (title, headers, rows, filename, subtitle = "") => {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16); doc.setTextColor(5, 38, 89);
  doc.text(title, 40, 40);
  if (subtitle) { doc.setFontSize(10); doc.setTextColor(84, 131, 179); doc.text(subtitle, 40, 58); }
  doc.autoTable({
    head: [headers], body: rows, startY: subtitle ? 72 : 56,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [5, 38, 89], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [235, 245, 255] },
    margin: { left: 40, right: 40 },
  });
  doc.save(filename + ".pdf");
};

function ExportButtons({ onExcel, onPDF, loading }) {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <button onClick={onExcel} disabled={loading}
        style={{ padding: "8px 14px", background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44`, borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
        📊 Excel
      </button>
      <button onClick={onPDF} disabled={loading}
        style={{ padding: "8px 14px", background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}44`, borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
        📄 PDF
      </button>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <div style={{ background: C.input, borderRadius: "4px", height: "6px", width: "100%", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "4px", transition: "width .4s" }} /></div>;
}

function BarChart({ data, color }) {
  const max = Math.max(...data.map(d => d.val), 1);
  const W = 100, H = 72, BAR_W = Math.max(4, (W / data.length) * 0.52), SP = W / data.length;
  const showLabel = (i) => data.length <= 7 || i % 2 === 0;
  const gridLines = [0.25, 0.5, 0.75, 1];
  return (
    <div style={{ background: C.input, borderRadius: "12px", padding: "1rem 1rem 0.5rem", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${H + 4}px`, paddingBottom: "4px", flexShrink: 0 }}>
          {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((v, i) => (
            <div key={i} style={{ fontSize: "8px", color: C.muted, textAlign: "right", lineHeight: 1 }}>
              {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v) === 0 ? "0" : Math.round(v)}
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: "100%", display: "block", flex: 1 }}>
          {gridLines.map((pct, i) => (
            <line key={i} x1="0" y1={H - pct * H} x2={W} y2={H - pct * H} stroke={C.border} strokeWidth="0.4" strokeDasharray="2,2" opacity="0.6" />
          ))}
          <line x1="0" y1={H} x2={W} y2={H} stroke={C.border} strokeWidth="0.5" opacity="0.8" />
          {data.map((d, i) => {
            const barH = Math.max((d.val / max) * H, d.val > 0 ? 2 : 0);
            const x = i * SP + SP / 2; const barX = x - BAR_W / 2;
            return (
              <g key={i}>
                <rect x={barX + 0.5} y={H - barH + 1} width={BAR_W} height={barH} rx="2" fill={color} opacity=".15" />
                <rect x={barX} y={H - barH} width={BAR_W} height={barH} rx="2" fill={color} opacity=".9" />
                {d.val > 0 && barH > 10 && (
                  <text x={x} y={H - barH - 3} textAnchor="middle" fontSize="3.8" fill={color} fontWeight="600">
                    {d.val >= 1000000 ? `${(d.val / 1000000).toFixed(1)}M` : d.val >= 1000 ? `${Math.round(d.val / 1000)}k` : d.val}
                  </text>
                )}
                {showLabel(i) && (
                  <text x={x} y={H + 7} textAnchor="middle" fontSize="4" fill={C.muted}
                    transform={data.length > 7 ? `rotate(-35,${x},${H + 7})` : ""}
                    style={{ textAnchor: data.length > 7 ? "end" : "middle" }}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Spinner({ text = "Cargando..." }) {
  const css = `.iw-loader{position:relative;width:120px;height:90px;margin:0 auto}.iw-loader:before{content:"";position:absolute;bottom:30px;left:50px;height:30px;width:30px;border-radius:50%;background:#5483b3;animation:iw-bounce .5s ease-in-out infinite alternate}.iw-loader:after{content:"";position:absolute;right:0;top:0;height:7px;width:45px;border-radius:4px;box-shadow:0 5px 0 #7da0ca,-35px 50px 0 #7da0ca,-70px 95px 0 #7da0ca;animation:iw-step 1s ease-in-out infinite}@keyframes iw-bounce{0%{transform:scale(1,.7)}40%{transform:scale(.8,1.2)}60%{transform:scale(1,1)}100%{bottom:140px}}@keyframes iw-step{0%{box-shadow:0 10px 0 rgba(0,0,0,0),0 10px 0 #e2c97e,-35px 50px 0 #e2c97e,-70px 90px 0 #e2c97e}100%{box-shadow:0 10px 0 #e2c97e,-35px 50px 0 #e2c97e,-70px 90px 0 #e2c97e,-70px 90px 0 rgba(0,0,0,0)}}`;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2rem" }}>
      <style>{css}</style>
      <div style={{ fontSize: "22px", fontWeight: "800", color: C.blue, letterSpacing: "2px" }}>Inventario Will</div>
      <div className="iw-loader" />
      <div style={{ fontSize: "13px", color: C.muted, letterSpacing: "1px" }}>{text}</div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, user, onLogout, darkMode, toggleTheme, open, setOpen }) {
  const items = [
    { id: "dashboard", icon: "⊞", label: "Inicio" },
    { id: "pos", icon: "🛒", label: "Punto de Venta" },
    { id: "products", icon: "📦", label: "Productos" },
    { id: "sales", icon: "📋", label: "Ventas" },
    { id: "ventaslote", icon: "🏷️", label: "Ventas por Lote" },
    { id: "reports", icon: "📊", label: "Reportes" },
    { id: "payments", icon: "💳", label: "Métodos de Pago" },
  ];
  if (user?.role === "admin") items.push({ id: "admin", icon: "⚙", label: "Admin" });
  const navigate = (id) => { setPage(id); if (window.innerWidth < 768) setOpen(false); };
  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 29 }} className="iw-overlay" />}
      <style>{`.iw-overlay{display:block!important;}@media(min-width:768px){.iw-overlay{display:none!important;}}`}</style>
      <div style={{ width: "240px", minHeight: "100vh", background: C.sidebar, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 30, transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform .3s cubic-bezier(.4,0,.2,1)" }}>
        <div style={{ padding: "1.4rem 1.25rem 1rem", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "17px", fontWeight: "800", color: C.blue, letterSpacing: "2px", lineHeight: 1.2 }}>Inventario</div>
            <div style={{ fontSize: "17px", fontWeight: "800", color: C.blue, letterSpacing: "2px" }}>Will</div>
            <div style={{ fontSize: "10px", color: C.muted, letterSpacing: "1px", marginTop: "3px" }}>GESTIÓN DE INVENTARIO</div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "20px", padding: "2px", lineHeight: 1 }}>✕</button>
        </div>
        <nav style={{ flex: 1, padding: "0.75rem 0", overflowY: "auto" }}>
          {items.map(it => (
            <button key={it.id} onClick={() => navigate(it.id)} className="nav-btn"
              style={{ width: "100%", textAlign: "left", padding: "13px 1.25rem", background: page === it.id ? `${C.blue}18` : "transparent", border: "none", borderLeft: page === it.id ? `3px solid ${C.blue}` : `3px solid transparent`, color: page === it.id ? C.blue : C.muted, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "17px" }}>{it.icon}</span><span>{it.label}</span>
              {page === it.id && <span style={{ marginLeft: "auto", fontSize: "8px", color: C.blue }}>●</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: "1rem 1.25rem", borderTop: `1px solid ${C.border}` }}>
          <button onClick={toggleTheme} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: C.input, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", color: C.muted }}>{darkMode ? "🌙 Modo oscuro" : "☀️ Modo claro"}</span>
            <div style={{ width: "34px", height: "18px", background: darkMode ? C.blue : C.border, borderRadius: "9px", position: "relative", transition: "background .25s" }}>
              <div style={{ width: "13px", height: "13px", borderRadius: "50%", background: darkMode ? C.bg : "#fff", position: "absolute", top: "2.5px", left: darkMode ? "18px" : "3px", transition: "left .22s" }} />
            </div>
          </button>
          <div style={{ fontSize: "13px", fontWeight: "600", color: C.text }}>{user?.name}</div>
          <div style={{ fontSize: "11px", color: C.muted, marginBottom: "10px" }}>{user?.role === "admin" ? "Administrador" : "Usuario"}</div>
          <button onClick={onLogout} style={{ ...s.btnOut, width: "100%", textAlign: "center" }}>Cerrar sesión</button>
        </div>
      </div>
    </>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
// ✅ Pega esto al inicio de la función Products:
const sanitizar = (str) => String(str || '').trim().slice(0, 200);
const validarPrecio = (val) => {
  const num = parseFloat(val);
  return !isNaN(num) && num >= 0 && num < 10_000_000;
};
const validarCantidad = (val) => {
  const num = parseInt(val);
  return !isNaN(num) && num >= 0 && num < 100_000;
};
function Dashboard({ products, sales, setPage, isAdmin, allUsers }) {
  if (isAdmin) {
    const empresas = (allUsers || []).filter(u => u.role === "user");
    const totalV = empresas.reduce((a, u) => a + (u.sales || []).reduce((b, s) => b + s.total, 0), 0);
    const totalG = empresas.reduce((a, u) => a + (u.sales || []).reduce((b, s) => b + s.profit, 0), 0);
    const totalP = empresas.reduce((a, u) => a + (u.products || []).length, 0);
    return (
      <div>
        <div style={{ marginBottom: "1.5rem" }}><div style={{ fontSize: "18px", fontWeight: "700", color: C.text }}>Panel General</div><div style={{ fontSize: "13px", color: C.muted, marginTop: "3px" }}>Vista global de todas las empresas</div></div>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.5rem" }}>
          {[{ label: "Empresas activas", val: empresas.filter(u => u.active).length, color: C.green }, { label: "Ingresos totales", val: COP(totalV), color: C.blue }, { label: "Ganancias totales", val: COP(totalG), color: C.blue }, { label: "Productos registrados", val: totalP, color: C.purp }].map((st, i) => (
            <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "22px", fontWeight: "700", color: st.color }}>{st.val}</div></div>
          ))}
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>Resumen por empresa</div>
          {empresas.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px" }}>Sin empresas registradas.</div>
            : empresas.map((u, i) => {
              const vHoy = (u.sales || []).filter(s => s.date === todayISO()).reduce((a, s) => a + s.total, 0);
              const gTot = (u.sales || []).reduce((a, s) => a + s.profit, 0);
              return (
                <div key={u.uid || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: i < empresas.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div><div style={{ fontSize: "14px", fontWeight: "700", color: C.text }}>{u.name}</div><div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>{u.email} · {(u.products || []).length} productos · {(u.sales || []).length} ventas</div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: "11px", color: C.muted }}>Ventas hoy</div><div style={{ fontSize: "14px", fontWeight: "700", color: C.blue }}>{COP(vHoy)}</div></div>
                    <div style={{ textAlign: "right" }}><div style={{ fontSize: "11px", color: C.muted }}>Ganancias</div><div style={{ fontSize: "14px", fontWeight: "700", color: C.green }}>{COP(gTot)}</div></div>
                    <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: u.active ? C.greenBg : C.redBg, color: u.active ? C.green : C.red, fontWeight: "600" }}>{u.active ? "ACTIVO" : "INACTIVO"}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }
  const todaySales = sales.filter(s => s.date === todayISO());
  const totalHoy = todaySales.reduce((a, s) => a + s.total, 0);
  const ganHoy = todaySales.reduce((a, s) => a + s.profit, 0);
  const lowStock = products.filter(p => p.qty <= 5);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const iso = d.toISOString().split("T")[0]; return { label: d.toLocaleDateString("es-CO", { weekday: "short" }).slice(0, 3), val: sales.filter(s => s.date === iso).reduce((a, s) => a + s.total, 0) }; });
  const profitDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const iso = d.toISOString().split("T")[0]; return { label: d.toLocaleDateString("es-CO", { weekday: "short" }).slice(0, 3), val: sales.filter(s => s.date === iso).reduce((a, s) => a + s.profit, 0) }; });
  const stats = [
    { label: "Ventas hoy", val: COP(totalHoy), sub: `${todaySales.length} transacciones`, color: C.blue, icon: "🛒" },
    { label: "Ganancias hoy", val: COP(ganHoy), sub: totalHoy > 0 ? `${Math.round((ganHoy / totalHoy) * 100)}% margen` : "—", color: C.green, icon: "💰" },
    { label: "Productos", val: products.length, sub: `${products.reduce((a, p) => a + p.qty, 0)} uds en stock`, color: C.blue, icon: "📦" },
    { label: "Stock bajo", val: lowStock.length, sub: lowStock.length > 0 ? "Requiere atención" : "Todo en orden", color: lowStock.length > 0 ? C.red : C.green, icon: "⚠️" },
  ];
  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}><div style={{ fontSize: "22px", fontWeight: "700", color: C.text }}>Buenas, bienvenido 👋</div><div style={{ fontSize: "13px", color: C.muted, marginTop: "3px" }}>Resumen del sistema · {today()}</div></div>
      <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
        {stats.map((st, i) => (
          <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ fontSize: "11px", color: C.muted, letterSpacing: "0.5px", marginBottom: "6px" }}>{st.label}</div><div style={{ fontSize: "22px", fontWeight: "700", color: st.color }}>{st.val}</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>{st.sub}</div></div>
              <span style={{ fontSize: "22px" }}>{st.icon}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "1.25rem" }}>
        <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>Ventas — últimos 7 días</div><div style={{ fontSize: "11px", color: C.muted, marginBottom: "10px" }}>{COP(days.reduce((a, d) => a + d.val, 0))} total</div><BarChart data={days} color={C.blue} /></div>
        <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>Ganancias — últimos 7 días</div><div style={{ fontSize: "11px", color: C.muted, marginBottom: "10px" }}>{COP(profitDays.reduce((a, d) => a + d.val, 0))} total</div><BarChart data={profitDays} color={C.green} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={s.card}>
          <div style={s.sectionTitle}>Acciones rápidas</div>
          {[{ label: "Nueva venta", icon: "🛒", page: "pos", color: C.blue }, { label: "Gestionar productos", icon: "📦", page: "products", color: C.blue }, { label: "Ver reportes", icon: "📊", page: "reports", color: C.green }].map((a, i) => (
            <button key={i} onClick={() => setPage(a.page)} className="card-anim" style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "12px", marginBottom: "8px", background: C.input, border: `1px solid ${C.border}`, borderRadius: "9px", color: a.color, cursor: "pointer", fontSize: "13px", fontWeight: "600", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ fontSize: "18px" }}>{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>Últimas ventas hoy</div>
          {todaySales.length === 0 ? <div style={{ color: C.muted, fontSize: "13px", textAlign: "center", padding: "1.5rem 0" }}>Sin ventas hoy.</div>
            : todaySales.slice(-5).reverse().map((sl, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < 4 ? `1px solid ${C.border}` : "none" }}>
                <div><div style={{ fontSize: "13px", color: C.text }}>{sl.items.map(it => it.name).join(", ").slice(0, 30)}</div><div style={{ fontSize: "11px", color: C.muted }}>{sl.items.length} ítem(s)</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: "13px", fontWeight: "700", color: C.blue }}>{COP(sl.total)}</div><div style={{ fontSize: "11px", color: C.green }}>+{COP(sl.profit)}</div></div>
              </div>
            ))}
        </div>
      </div>
      {lowStock.length > 0 && (
        <div style={{ ...s.card, marginTop: "1.25rem", borderLeft: `3px solid ${C.red}` }}>
          <div style={{ ...s.sectionTitle, color: C.red }}>⚠️ Productos con stock bajo</div>
          <div className="pos-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
            {lowStock.map(p => (
              <div key={p.id} style={{ background: C.redBg, borderRadius: "9px", padding: "10px 12px", border: `1px solid #3d1212` }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: C.text }}>{p.name}</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: C.red, margin: "4px 0" }}>{p.qty}</div>
                <div style={{ fontSize: "11px", color: C.muted }}>unidades restantes</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POS ─────────────────────────────────────────────────────────────────────
function POS({ products, setProducts, onSale, metodosPago }) {
  const [cart, setCart] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [search, setSearch] = useState("");
  const [paid, setPaid] = useState("");
  const [editCard, setEditCard] = useState(null);
  const [editCardData, setEditCardData] = useState({});
  const [delCard, setDelCard] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [newProd, setNewProd] = useState({ name: "", qty: "", cost: "", price: "", cat: "" });
  const [addError, setAddError] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");

  const allFiltered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const addToCart = (p) => setCart(prev => { const ex = prev.find(c => c.id === p.id); if (ex) { if (ex.qty >= p.qty) return prev; return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c); } return [...prev, { ...p, qty: 1 }]; });
  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const changeQty = (id, delta) => setCart(prev => prev.map(c => { if (c.id !== id) return c; const nq = c.qty + delta; if (nq <= 0) return null; const stock = products.find(p => p.id === id)?.qty || 0; if (nq > stock) return c; return { ...c, qty: nq }; }).filter(Boolean));
  const total = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const profit = cart.reduce((a, c) => a + (c.price - c.cost) * c.qty, 0);
  const cambio = Number(paid) - total;
  const confirmar = () => {
    if (cart.length === 0) return;
    const qrSel = metodosPago?.find(m => m.id === metodoPago);
    const sale = { id: genId(), date: todayISO(), items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price, cost: c.cost })), total, profit, metodoPago: metodoPago === "efectivo" ? "Efectivo" : (qrSel?.nombre || "QR"), metodoPagoTipo: metodoPago === "efectivo" ? "efectivo" : "qr" };
    onSale(sale, cart);
    setReceipt({ ...sale, paid: Number(paid) || total, cambio: Math.max(0, cambio) });
    setCart([]); setPaid(""); setMetodoPago("efectivo");
  };
  const saveCard = () => { if (!editCardData.name?.trim()) return; setProducts(prev => prev.map(p => p.id === editCard.id ? { ...p, name: editCardData.name.trim(), qty: Number(editCardData.qty) || 0, cost: Number(editCardData.cost) || 0, price: Number(editCardData.price) || 0, cat: editCardData.cat?.trim() || "General" } : p)); setEditCard(null); setEditCardData({}); };
  const confirmDelCard = () => { setProducts(prev => prev.filter(p => p.id !== delCard.id)); setCart(prev => prev.filter(c => c.id !== delCard.id)); setDelCard(null); };
  const addNew = () => { if (!newProd.name.trim()) { setAddError("El nombre es obligatorio."); return; } if (!newProd.price || Number(newProd.price) <= 0) { setAddError("El precio es obligatorio."); return; } if (!newProd.qty || Number(newProd.qty) < 0) { setAddError("La cantidad es obligatoria."); return; } setProducts(prev => [...prev, { id: genId(), name: newProd.name.trim(), qty: Number(newProd.qty), cost: Number(newProd.cost) || 0, price: Number(newProd.price), cat: newProd.cat.trim() || "General", historialAjustes: [] }]); setNewProd({ name: "", qty: "", cost: "", price: "", cat: "" }); setAddError(""); setAddModal(false); };

  if (receipt) return <Receipt receipt={receipt} onClose={() => setReceipt(null)} />;
  return (
    <div className="pos-layout" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.25rem", alignItems: "start" }}>
      {editCard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "420px" }}>
            <div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "1.25rem" }}>✏️ Editar producto</div>
            {[{ key: "name", label: "Nombre", type: "text" }, { key: "cat", label: "Categoría", type: "text" }, { key: "qty", label: "Stock", type: "number" }, { key: "cost", label: "Costo $", type: "number" }, { key: "price", label: "Precio venta $", type: "number" }].map(f => (
              <div key={f.key} style={{ marginBottom: "10px" }}><label style={s.label}>{f.label}</label><input type={f.type} value={editCardData[f.key] ?? ""} onChange={e => setEditCardData(p => ({ ...p, [f.key]: e.target.value }))} style={s.input} onKeyDown={e => e.key === "Enter" && saveCard()} /></div>
            ))}
            {editCardData.price > 0 && <div style={{ padding: "8px 12px", background: C.input, borderRadius: "8px", fontSize: "12px", color: C.muted, marginBottom: "14px" }}>Margen: <span style={{ color: C.green, fontWeight: "700" }}>{Math.round(((editCardData.price - editCardData.cost) / editCardData.price) * 100)}%</span></div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setEditCard(null); setEditCardData({}); }} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={saveCard} style={{ flex: 1, padding: "11px", background: C.blue, color: C.bg, border: "none", borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>✓ Guardar</button>
            </div>
          </div>
        </div>
      )}
      {delCard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "360px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>🗑️</div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "6px" }}>¿Eliminar producto?</div>
            <div style={{ fontSize: "14px", color: C.muted, marginBottom: "1.5rem" }}>"{delCard.name}"</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDelCard(null)} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={confirmDelCard} style={{ flex: 1, padding: "11px", background: C.redBg, color: C.red, border: `1px solid #4a1a1a`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
      {addModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "420px" }}>
            <div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "1.25rem" }}>➕ Nuevo producto</div>
            <div style={{ marginBottom: "10px" }}><label style={s.label}>Nombre *</label><input type="text" value={newProd.name} onChange={e => setNewProd(p => ({ ...p, name: e.target.value }))} placeholder="Hamburguesa clásica" style={s.input} onKeyDown={e => e.key === "Enter" && addNew()} /></div>
            <div style={{ marginBottom: "10px" }}><label style={s.label}>Categoría</label><input type="text" value={newProd.cat} onChange={e => setNewProd(p => ({ ...p, cat: e.target.value }))} placeholder="Comida" style={s.input} onKeyDown={e => e.key === "Enter" && addNew()} /></div>
            <div style={{ marginBottom: "10px" }}><label style={s.label}>Stock *</label><input type="number" value={newProd.qty} onChange={e => setNewProd(p => ({ ...p, qty: e.target.value }))} placeholder="0" style={s.input} onKeyDown={e => e.key === "Enter" && addNew()} /></div>
            <div style={{ marginBottom: "10px" }}><label style={s.label}>Costo $</label><input type="number" value={newProd.cost} onChange={e => setNewProd(p => ({ ...p, cost: e.target.value }))} placeholder="8000" style={s.input} onKeyDown={e => e.key === "Enter" && addNew()} />{newProd.cost && <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>= {COP(Number(newProd.cost))}</div>}</div>
            <div style={{ marginBottom: "14px" }}><label style={s.label}>Precio venta $ *</label><input type="number" value={newProd.price} onChange={e => setNewProd(p => ({ ...p, price: e.target.value }))} placeholder="15000" style={s.input} onKeyDown={e => e.key === "Enter" && addNew()} />{newProd.price && <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>= {COP(Number(newProd.price))}{newProd.price > 0 && newProd.cost > 0 && <span style={{ color: C.green, marginLeft: "8px" }}>Ganancia: {COP(Number(newProd.price) - Number(newProd.cost))}</span>}</div>}</div>
            {addError && <div style={{ color: C.red, fontSize: "12px", marginBottom: "10px", background: C.redBg, padding: "7px 10px", borderRadius: "7px" }}>{addError}</div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => { setAddModal(false); setAddError(""); setNewProd({ name: "", qty: "", cost: "", price: "", cat: "" }); }} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={addNew} style={{ flex: 1, padding: "11px", background: C.blue, color: C.bg, border: "none", borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>+ Agregar</button>
            </div>
          </div>
        </div>
      )}
      <div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "1rem" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar producto..." style={{ ...s.input, fontSize: "14px", padding: "11px 14px", flex: 1 }} />
          <button onClick={() => setAddModal(true)} style={{ ...s.btnGold, whiteSpace: "nowrap", padding: "11px 18px" }}>+ Nuevo</button>
        </div>
        <div className="pos-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
          {allFiltered.map(p => {
            const agotado = p.qty === 0; return (
              <div key={p.id} className="card-anim" style={{ background: C.card, border: `1px solid ${agotado ? C.redBg : C.border}`, borderRadius: "12px", padding: "1rem", opacity: agotado ? .6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginBottom: "6px" }}>
                  <button onClick={() => { setEditCard(p); setEditCardData({ name: p.name, qty: p.qty, cost: p.cost, price: p.price, cat: p.cat }); }} style={{ padding: "3px 9px", background: `${C.blue}20`, color: C.blue, border: `1px solid ${C.blue}40`, borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>✏️</button>
                  <button onClick={() => setDelCard(p)} style={{ padding: "3px 8px", background: C.redBg, color: C.red, border: `1px solid #3d1212`, borderRadius: "5px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>🗑️</button>
                </div>
                <div onClick={() => !agotado && addToCart(p)} style={{ cursor: agotado ? "not-allowed" : "pointer" }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: C.text, marginBottom: "4px" }}>{p.name}</div>
                  <div style={{ fontSize: "11px", color: agotado ? C.red : C.muted, marginBottom: "8px" }}>{p.cat} · {agotado ? "⚠️ Agotado" : `${p.qty} en stock`}</div>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: C.blue }}>{COP(p.price)}</div>
                  <div style={{ fontSize: "10px", color: C.green, marginTop: "2px" }}>Ganancia: {COP(p.price - p.cost)}</div>
                </div>
              </div>
            );
          })}
          {allFiltered.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "2rem", color: C.muted, fontSize: "13px" }}>Sin productos.</div>}
        </div>
      </div>
      <div style={{ ...s.card, position: "sticky", top: "1rem" }}>
        <div style={{ ...s.sectionTitle, borderBottom: `1px solid ${C.border}`, paddingBottom: "10px", marginBottom: "10px" }}>🛒 Carrito · {cart.length} ítem(s)</div>
        {cart.length === 0 ? <div style={{ color: C.muted, fontSize: "13px", textAlign: "center", padding: "1.5rem 0" }}>Toca un producto para agregarlo</div> : <>
          {cart.map(c => (
            <div key={c.id} style={{ marginBottom: "10px", padding: "10px", background: C.input, borderRadius: "9px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}><span style={{ fontSize: "13px", fontWeight: "600", color: C.text }}>{c.name}</span><button onClick={() => removeFromCart(c.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: "14px" }}>✕</button></div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button onClick={() => changeQty(c.id, -1)} style={{ width: "24px", height: "24px", background: C.border, border: "none", borderRadius: "5px", color: C.text, cursor: "pointer", fontSize: "14px" }}>−</button>
                  <span style={{ color: C.text, fontWeight: "700", fontSize: "14px", minWidth: "20px", textAlign: "center" }}>{c.qty}</span>
                  <button onClick={() => changeQty(c.id, 1)} style={{ width: "24px", height: "24px", background: C.border, border: "none", borderRadius: "5px", color: C.text, cursor: "pointer", fontSize: "14px" }}>+</button>
                </div>
                <span style={{ fontSize: "13px", fontWeight: "700", color: C.blue }}>{COP(c.price * c.qty)}</span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "12px", marginTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}><span style={{ fontSize: "13px", color: C.muted }}>Subtotal</span><span style={{ fontSize: "13px", color: C.text }}>{COP(total)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}><span style={{ fontSize: "13px", color: C.muted }}>Ganancia estimada</span><span style={{ fontSize: "13px", color: C.green, fontWeight: "600" }}>{COP(profit)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}><span style={{ fontSize: "16px", fontWeight: "700", color: C.text }}>TOTAL</span><span style={{ fontSize: "18px", fontWeight: "800", color: C.blue }}>{COP(total)}</span></div>
            <div style={{ marginBottom: "12px" }}>
              <label style={s.label}>Método de pago</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <button onClick={() => setMetodoPago("efectivo")} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: metodoPago === "efectivo" ? `${C.green}18` : C.input, border: `1.5px solid ${metodoPago === "efectivo" ? C.green : C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ fontSize: "18px" }}>💵</span>
                  <div><div style={{ fontSize: "13px", fontWeight: "600", color: metodoPago === "efectivo" ? C.green : C.text }}>Efectivo</div><div style={{ fontSize: "11px", color: C.muted }}>Pago en mano</div></div>
                  {metodoPago === "efectivo" && <span style={{ marginLeft: "auto", fontSize: "16px", color: C.green }}>✓</span>}
                </button>
                {(metodosPago || []).map(m => (
                  <button key={m.id} onClick={() => setMetodoPago(m.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: metodoPago === m.id ? `${C.purp}18` : C.input, border: `1.5px solid ${metodoPago === m.id ? C.purp : C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <img src={m.imagen} alt={m.nombre} style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "5px", border: `1px solid ${C.border}` }} />
                    <div><div style={{ fontSize: "13px", fontWeight: "600", color: metodoPago === m.id ? C.purp : C.text }}>{m.nombre}</div><div style={{ fontSize: "11px", color: C.muted }}>Pago por QR</div></div>
                    {metodoPago === m.id && <span style={{ marginLeft: "auto", fontSize: "16px", color: C.purp }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            {metodoPago === "efectivo" && (
              <div style={{ marginBottom: "10px" }}>
                <label style={s.label}>Efectivo recibido (opcional)</label>
                <input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder={String(total)} style={s.input} />
                {paid && Number(paid) >= total && <div style={{ fontSize: "12px", color: C.green, marginTop: "4px" }}>Cambio: {COP(cambio)}</div>}
                {paid && Number(paid) < total && <div style={{ fontSize: "12px", color: C.red, marginTop: "4px" }}>Falta: {COP(total - Number(paid))}</div>}
              </div>
            )}
            {metodoPago !== "efectivo" && (() => { const qr = (metodosPago || []).find(m => m.id === metodoPago); return qr ? (<div style={{ marginBottom: "12px", textAlign: "center", padding: "12px", background: C.input, borderRadius: "10px", border: `1px solid ${C.border}` }}><div style={{ fontSize: "12px", color: C.muted, marginBottom: "8px" }}>QR de pago — {qr.nombre}</div><img src={qr.imagen} alt={qr.nombre} style={{ width: "140px", height: "140px", objectFit: "contain", borderRadius: "8px", display: "block", margin: "0 auto", border: `1px solid ${C.border}` }} /></div>) : null; })()}
            <button onClick={confirmar} style={{ ...s.btnGold, width: "100%", padding: "13px", fontSize: "15px", background: metodoPago === "efectivo" ? C.blue : C.purp, color: C.bg }}>
              {metodoPago === "efectivo" ? "✓ Confirmar venta · Efectivo" : `✓ Pago recibido · ${(metodosPago || []).find(m => m.id === metodoPago)?.nombre || "QR"}`}
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── RECEIPT ─────────────────────────────────────────────────────────────────
function Receipt({ receipt, onClose }) {
  const imprimir = () => {
    const v = window.open("", "_blank", "width=420,height=600");
    v.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recibo</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;background:#fff;color:#111;padding:20px;width:380px}.center{text-align:center}.title{font-size:20px;font-weight:800;letter-spacing:3px}.divider{border:none;border-top:2px dashed #ccc;margin:12px 0}.item{display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px}.total-row{display:flex;justify-content:space-between;font-size:16px;font-weight:800;margin-bottom:4px}.meta-row{display:flex;justify-content:space-between;font-size:13px;color:#555;margin-bottom:3px}.footer{text-align:center;font-size:12px;color:#888;margin-top:12px;padding-top:12px;border-top:1px dashed #ccc}@media print{body{width:100%}}</style></head><body><div class="center"><div class="title">Inventario Will</div><div style="font-size:11px;color:#666;margin-top:2px">SISTEMA DE INVENTARIO</div><div style="font-size:12px;color:#444;margin-top:6px">${today()} · #${receipt.id.toUpperCase()}</div></div><hr class="divider"/>${receipt.items.map(it => `<div class="item"><span>${it.name} x${it.qty}</span><span><b>$${Number(it.price * it.qty).toLocaleString("es-CO")}</b></span></div>`).join("")}<hr class="divider"/><div class="total-row"><span>TOTAL</span><span>$${Number(receipt.total).toLocaleString("es-CO")}</span></div><div class="meta-row"><span>Método</span><span>${receipt.metodoPago || "Efectivo"}</span></div>${receipt.metodoPagoTipo === "efectivo" && receipt.paid > receipt.total ? `<div class="meta-row"><span>Recibido</span><span>$${Number(receipt.paid).toLocaleString("es-CO")}</span></div><div class="meta-row"><span>Cambio</span><span>$${Number(receipt.cambio).toLocaleString("es-CO")}</span></div>` : ""}<div class="footer">¡Gracias por su compra!<br/>Vuelva pronto</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script></body></html>`);
    v.document.close();
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem 0" }}>
      <div style={{ background: "#fff", color: "#111", borderRadius: "14px", padding: "2rem", width: "100%", maxWidth: "380px", fontFamily: "'Courier New',monospace" }}>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}><div style={{ fontSize: "22px", fontWeight: "800", letterSpacing: "3px" }}>Inventario Will</div><div style={{ fontSize: "11px", color: "#666" }}>SISTEMA DE INVENTARIO</div><div style={{ fontSize: "12px", color: "#444", marginTop: "6px" }}>{today()} · #{receipt.id.toUpperCase()}</div></div>
        <div style={{ borderTop: "2px dashed #ccc", borderBottom: "2px dashed #ccc", padding: "1rem 0", margin: "1rem 0" }}>{receipt.items.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}><span>{it.name} x{it.qty}</span><span style={{ fontWeight: "700" }}>{COP(it.price * it.qty)}</span></div>)}</div>
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: "800", marginBottom: "4px" }}><span>TOTAL</span><span>{COP(receipt.total)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#555" }}><span>Método de pago</span><span style={{ fontWeight: "700" }}>{receipt.metodoPago || "Efectivo"}</span></div>
          {receipt.metodoPagoTipo === "efectivo" && receipt.paid > receipt.total && <><div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#555" }}><span>Recibido</span><span>{COP(receipt.paid)}</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#555" }}><span>Cambio</span><span>{COP(receipt.cambio)}</span></div></>}
        </div>
        <div style={{ textAlign: "center", fontSize: "12px", color: "#888", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px dashed #ccc" }}>¡Gracias por su compra!<br />Vuelva pronto</div>
        <div style={{ display: "flex", gap: "10px", marginTop: "1.5rem" }}>
          <button onClick={imprimir} style={{ flex: 1, padding: "10px", background: "#111", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontFamily: "inherit" }}>🖨️ Imprimir</button>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "#f0f0f0", color: "#111", border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit" }}>Nueva venta</button>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCTS (con ajuste de inventario) ─────────────────────────────────────
function Products({ products, setProducts }) {
  const [form, setForm] = useState({ name: "", qty: "", cost: "", price: "", cat: "" });
  const [error, setError] = useState("");
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [delConfirm, setDelConfirm] = useState(null);
  const [exporting, setExporting] = useState(false);

  // ── Ajuste de inventario ──
  const [ajusteModal, setAjusteModal] = useState(null);
  const [ajusteCantidad, setAjusteCantidad] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState("entrada");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteCustom, setAjusteCustom] = useState("");
  const [ajusteError, setAjusteError] = useState("");
  const [historialModal, setHistorialModal] = useState(null);

  const MOTIVOS = {
    entrada: ["Compra a proveedor", "Devolución de cliente", "Producción propia", "Transferencia recibida", "Otro"],
    salida: ["Producto dañado", "Producto vencido", "Muestra / regalo", "Robo o pérdida", "Consumo interno", "Transferencia enviada", "Otro"],
    correccion: ["Conteo físico", "Error de registro", "Ajuste de apertura", "Otro"],
  };
  const tipoColor = { entrada: C.green, salida: C.red, correccion: C.orange };
  const tipoLabel = { entrada: "Entrada ↑", salida: "Salida ↓", correccion: "Corrección ⟳" };

  const abrirAjuste = (p) => { setAjusteModal(p); setAjusteCantidad(""); setAjusteTipo("entrada"); setAjusteMotivo(""); setAjusteCustom(""); setAjusteError(""); };

  const confirmarAjuste = () => {
    const cant = Number(ajusteCantidad);
    if (!ajusteCantidad || isNaN(cant) || cant <= 0) { setAjusteError("Ingresa una cantidad válida mayor a 0."); return; }
    const motivoFinal = ajusteMotivo === "Otro" ? (ajusteCustom.trim() || "Otro") : ajusteMotivo;
    if (!motivoFinal) { setAjusteError("Selecciona un motivo."); return; }
    const ahora = new Date();
    const mov = { id: genId(), fecha: ahora.toISOString(), fechaTexto: ahora.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }), hora: ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }), tipo: ajusteTipo, cantidad: cant, motivo: motivoFinal, stockAntes: ajusteModal.qty };
    let nuevoStock;
    if (ajusteTipo === "entrada") nuevoStock = ajusteModal.qty + cant;
    else if (ajusteTipo === "salida") nuevoStock = Math.max(0, ajusteModal.qty - cant);
    else nuevoStock = cant;
    mov.stockDespues = nuevoStock;
    setProducts(prev => prev.map(p => p.id === ajusteModal.id ? { ...p, qty: nuevoStock, historialAjustes: [...(p.historialAjustes || []), mov] } : p));
    setAjusteModal(null);
  };

  const add = () => {
  if (!sanitizar(form.name)) { setError("El nombre es obligatorio."); return; }
  if (!validarCantidad(form.qty)) { setError("La cantidad debe ser válida (0-99999)."); return; }
  if (!validarPrecio(form.price) || Number(form.price) <= 0) { 
    setError("El precio es obligatorio y debe ser válido."); return; 
  }
  setProducts(prev => [...prev, {
    id: genId(),
    name: sanitizar(form.name),
    qty: Number(form.qty),
    cost: Number(form.cost) || 0,
    price: Number(form.price),
    cat: sanitizar(form.cat) || "General",
    historialAjustes: []
  }]);
  setForm({ name: "", qty: "", cost: "", price: "", cat: "" });
  setError("");
};
  const startEdit = (p) => { setEditId(p.id); setEditData({ name: p.name, qty: p.qty, cost: p.cost, price: p.price, cat: p.cat }); };
  const saveEdit = () => { if (!editData.name?.trim()) return; setProducts(prev => prev.map(p => p.id === editId ? { ...p, name: editData.name.trim(), qty: Number(editData.qty) || 0, cost: Number(editData.cost) || 0, price: Number(editData.price) || 0, cat: editData.cat?.trim() || "General" } : p)); setEditId(null); setEditData({}); };
  const confirmDel = () => { setProducts(prev => prev.filter(p => p.id !== delConfirm.id)); setDelConfirm(null); };
  const totalInv = products.reduce((a, p) => a + p.qty * p.cost, 0);

  const handleExcelProducts = async () => { setExporting(true); const data = products.map(p => ({ "Producto": p.name, "Categoría": p.cat, "Stock": p.qty, "Costo ($)": p.cost, "Precio venta ($)": p.price, "Margen (%)": p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0, "Valor en inventario ($)": p.qty * p.cost })); await exportToExcel([{ name: "Inventario", data }], `Inventario_${todayISO()}`); setExporting(false); };
  const handlePDFProducts = async () => { setExporting(true); const headers = ["Producto", "Categoría", "Stock", "Costo", "Precio", "Margen", "Valor inv."]; const rows = products.map(p => [p.name, p.cat, p.qty, COP(p.cost), COP(p.price), (p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0) + "%", COP(p.qty * p.cost)]); await exportToPDF("Inventario de Productos", headers, rows, `Inventario_${todayISO()}`, `Generado el ${today()} · ${products.length} productos · Valor total: ${COP(totalInv)}`); setExporting(false); };

  const eI = (field, type = "text", ph = "") => { const val = editData[field] ?? ""; const showFmt = (field === "cost" || field === "price") && val && Number(val) > 0; return (<div><input type={type} value={val} onChange={e => setEditData(prev => ({ ...prev, [field]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }} placeholder={ph} style={{ ...s.input, padding: "6px 9px", fontSize: "12px", minWidth: "60px" }} />{showFmt && <div style={{ fontSize: "10px", color: field === "price" ? C.green : C.muted, marginTop: "2px" }}>{COP(Number(val))}</div>}</div>); };

  return (
    <div>
      {/* Modal eliminar */}
      {delConfirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "360px", textAlign: "center" }}><div style={{ fontSize: "36px", marginBottom: "10px" }}>🗑️</div><div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "6px" }}>¿Eliminar producto?</div><div style={{ fontSize: "14px", color: C.muted, marginBottom: "1.5rem" }}>"{delConfirm.name}"</div><div style={{ display: "flex", gap: "10px" }}><button onClick={() => setDelConfirm(null)} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={confirmDel} style={{ flex: 1, padding: "11px", background: C.redBg, color: C.red, border: `1px solid #4a1a1a`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>Sí, eliminar</button></div></div></div>}

      {/* Modal ajuste de inventario */}
      {ajusteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "460px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${C.blue}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🔧</div>
              <div><div style={{ fontSize: "15px", fontWeight: "700", color: C.text }}>Ajuste de inventario</div><div style={{ fontSize: "12px", color: C.muted }}>{ajusteModal.name} · Stock actual: <strong style={{ color: C.blue }}>{ajusteModal.qty}</strong></div></div>
            </div>
            {/* Tipo */}
            <div style={{ marginBottom: "14px" }}>
              <label style={s.label}>Tipo de ajuste *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {["entrada", "salida", "correccion"].map(t => (
                  <button key={t} onClick={() => { setAjusteTipo(t); setAjusteMotivo(""); setAjusteCustom(""); }}
                    style={{ padding: "10px 6px", background: ajusteTipo === t ? `${tipoColor[t]}18` : C.input, border: `1.5px solid ${ajusteTipo === t ? tipoColor[t] : C.border}`, borderRadius: "9px", color: ajusteTipo === t ? tipoColor[t] : C.muted, cursor: "pointer", fontSize: "12px", fontWeight: ajusteTipo === t ? "700" : "400", fontFamily: "inherit", textAlign: "center" }}>
                    {tipoLabel[t]}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: "8px", padding: "8px 12px", background: C.input, borderRadius: "8px", fontSize: "11px", color: C.muted }}>
                {ajusteTipo === "entrada" && "➕ Se sumará al stock actual."}
                {ajusteTipo === "salida" && "➖ Se restará del stock actual."}
                {ajusteTipo === "correccion" && "⟳ El stock quedará exactamente en la cantidad ingresada."}
              </div>
            </div>
            {/* Cantidad */}
            <div style={{ marginBottom: "14px" }}>
              <label style={s.label}>{ajusteTipo === "correccion" ? "Nuevo stock total *" : "Cantidad a ajustar *"}</label>
              <input type="number" min="0" value={ajusteCantidad} onChange={e => setAjusteCantidad(e.target.value)} onKeyDown={e => e.key === "Enter" && confirmarAjuste()} placeholder={ajusteTipo === "correccion" ? "Ej: 50" : "Ej: 10"} style={s.input} autoFocus />
              {ajusteCantidad && Number(ajusteCantidad) > 0 && (
                <div style={{ marginTop: "6px", padding: "8px 12px", background: ajusteTipo === "salida" ? C.redBg : C.greenBg, borderRadius: "8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px", border: `1px solid ${ajusteTipo === "salida" ? "#3d1212" : "#1a4a2a"}` }}>
                  <span>{ajusteTipo === "salida" ? "📉" : "📈"}</span>
                  <span style={{ color: C.muted }}>Stock resultante:</span>
                  <strong style={{ color: ajusteTipo === "salida" ? C.red : C.green, fontSize: "14px" }}>
                    {ajusteTipo === "entrada" ? ajusteModal.qty + Number(ajusteCantidad) : ajusteTipo === "salida" ? Math.max(0, ajusteModal.qty - Number(ajusteCantidad)) : Number(ajusteCantidad)}
                  </strong>
                  <span style={{ color: C.muted, fontSize: "11px" }}>unidades</span>
                </div>
              )}
            </div>
            {/* Motivo */}
            <div style={{ marginBottom: "14px" }}>
              <label style={s.label}>Motivo *</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                {MOTIVOS[ajusteTipo].map(m => (
                  <button key={m} onClick={() => setAjusteMotivo(m)}
                    style={{ padding: "5px 12px", background: ajusteMotivo === m ? `${C.blue}22` : C.input, color: ajusteMotivo === m ? C.blue : C.muted, border: `1px solid ${ajusteMotivo === m ? C.blue : C.border}`, borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>
                    {m}
                  </button>
                ))}
              </div>
              {ajusteMotivo === "Otro" && <input type="text" value={ajusteCustom} onChange={e => setAjusteCustom(e.target.value)} placeholder="Describe el motivo..." style={s.input} onKeyDown={e => e.key === "Enter" && confirmarAjuste()} />}
            </div>
            {ajusteError && <div style={{ color: C.red, fontSize: "12px", background: C.redBg, padding: "8px 12px", borderRadius: "8px", marginBottom: "12px" }}>{ajusteError}</div>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setAjusteModal(null)} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={confirmarAjuste} style={{ flex: 2, padding: "11px", background: tipoColor[ajusteTipo], color: "#fff", border: "none", borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>✓ Confirmar ajuste</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {historialModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "520px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div><div style={{ fontSize: "15px", fontWeight: "700", color: C.text }}>📋 Historial de ajustes</div><div style={{ fontSize: "12px", color: C.muted }}>{historialModal.name} · Stock actual: <strong style={{ color: C.blue }}>{historialModal.qty}</strong></div></div>
              <button onClick={() => setHistorialModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "20px", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {(!historialModal.historialAjustes || historialModal.historialAjustes.length === 0)
                ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>Sin ajustes registrados aún.</div>
                : [...historialModal.historialAjustes].reverse().map((mov, i) => (
                  <div key={mov.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 0", borderBottom: i < historialModal.historialAjustes.length - 1 ? `1px solid ${C.input}` : "none" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: `${tipoColor[mov.tipo]}18`, border: `1px solid ${tipoColor[mov.tipo]}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                      {mov.tipo === "entrada" ? "↑" : mov.tipo === "salida" ? "↓" : "⟳"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: tipoColor[mov.tipo] }}>{tipoLabel[mov.tipo]}</span>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: `${tipoColor[mov.tipo]}18`, color: tipoColor[mov.tipo] }}>{mov.tipo === "correccion" ? `→ ${mov.cantidad}` : `${mov.tipo === "entrada" ? "+" : "-"}${mov.cantidad}`}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: C.text, marginTop: "3px" }}>{mov.motivo}</div>
                      <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>{mov.fechaTexto} · {mov.hora} · {mov.stockAntes} → <strong style={{ color: tipoColor[mov.tipo] }}>{mov.stockDespues}</strong></div>
                    </div>
                  </div>
                ))
              }
            </div>
            {historialModal.historialAjustes?.length > 0 && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: C.input, borderRadius: "9px", fontSize: "12px", color: C.muted }}>
                {historialModal.historialAjustes.length} movimiento{historialModal.historialAjustes.length !== 1 ? "s" : ""} registrado{historialModal.historialAjustes.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
        {[{ label: "Total productos", val: products.length + " tipos", color: C.blue }, { label: "Unidades en stock", val: products.reduce((a, p) => a + p.qty, 0).toLocaleString("es-CO"), color: C.blue }, { label: "Valor del inventario", val: COP(totalInv), color: C.green }].map((st, i) => (
          <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "20px", fontWeight: "700", color: st.color }}>{st.val}</div></div>
        ))}
      </div>

      {/* Formulario agregar */}
      <div style={{ ...s.card, marginBottom: "1.25rem" }}>
        <div style={s.sectionTitle}>➕ Agregar nuevo producto</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: "10px", alignItems: "end" }}>
          <div><label style={s.label}>Nombre *</label><input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === "Enter" && add()} placeholder="Hamburguesa" style={s.input} /></div>
          <div><label style={s.label}>Stock *</label><input type="number" value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))} onKeyDown={e => e.key === "Enter" && add()} placeholder="0" style={s.input} /></div>
          <div><label style={s.label}>Costo $</label><input type="number" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} onKeyDown={e => e.key === "Enter" && add()} placeholder="0" style={s.input} />{form.cost && <div style={{ fontSize: "10px", color: C.muted, marginTop: "2px" }}>{COP(Number(form.cost))}</div>}</div>
          <div><label style={s.label}>Precio $ *</label><input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} onKeyDown={e => e.key === "Enter" && add()} placeholder="0" style={s.input} />{form.price && <div style={{ fontSize: "10px", color: C.green, marginTop: "2px" }}>{COP(Number(form.price))}</div>}</div>
          <div><label style={s.label}>Categoría</label><input type="text" value={form.cat} onChange={e => setForm(p => ({ ...p, cat: e.target.value }))} onKeyDown={e => e.key === "Enter" && add()} placeholder="Comida" style={s.input} /></div>
          <button onClick={add} style={{ ...s.btnGold, whiteSpace: "nowrap" }}>+ Agregar</button>
        </div>
        {error && <div style={{ color: C.red, fontSize: "12px", marginTop: "8px", background: C.redBg, padding: "7px 10px", borderRadius: "7px" }}>{error}</div>}
      </div>

      {/* Tabla */}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
          <div style={s.sectionTitle}>Inventario · {products.length} productos</div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: "11px", color: C.muted }}>🔧 Ajuste · 📋 Historial · ✏️ Editar</div>
            <ExportButtons onExcel={handleExcelProducts} onPDF={handlePDFProducts} loading={exporting} />
          </div>
        </div>
        {products.length === 0
          ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>Sin productos aún.</div>
          : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Producto", "Categoría", "Stock", "Costo $", "Precio $", "Margen", "Valor inv.", "Acciones"].map(h => <th key={h} style={{ textAlign: "left", padding: "9px 10px", color: C.muted, fontWeight: "500", fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>{products.map(p => {
              const ie = editId === p.id, mg = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0, emg = editData.price > 0 ? Math.round(((editData.price - editData.cost) / editData.price) * 100) : 0;
              const nAj = (p.historialAjustes || []).length;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.input}`, background: ie ? `${C.blue}08` : "transparent" }}>
                  <td style={{ padding: "10px", minWidth: "140px" }}>
                    {ie ? eI("name", "text", "Nombre") : <div><span style={{ color: C.text, fontWeight: "600" }}>{p.name}</span>{nAj > 0 && <span style={{ marginLeft: "6px", fontSize: "9px", padding: "1px 6px", borderRadius: "10px", background: `${C.orange}22`, color: C.orange, fontWeight: "600" }}>{nAj} mov.</span>}</div>}
                  </td>
                  <td style={{ padding: "10px", minWidth: "100px" }}>{ie ? eI("cat", "text", "Cat") : <span style={{ fontSize: "11px", padding: "3px 9px", borderRadius: "20px", background: C.input, color: C.muted, border: `1px solid ${C.border}` }}>{p.cat}</span>}</td>
                  <td style={{ padding: "10px", minWidth: "70px" }}>{ie ? eI("qty", "number", "0") : <span style={{ color: p.qty <= 5 ? C.red : C.text, fontWeight: p.qty <= 5 ? "700" : "400" }}>{p.qty}{p.qty <= 5 && <span style={{ fontSize: "10px", marginLeft: "4px" }}>⚠️</span>}</span>}</td>
                  <td style={{ padding: "10px", minWidth: "90px" }}>{ie ? eI("cost", "number", "0") : <span style={{ color: C.muted }}>{COP(p.cost)}</span>}</td>
                  <td style={{ padding: "10px", minWidth: "90px" }}>{ie ? eI("price", "number", "0") : <span style={{ color: C.blue, fontWeight: "600" }}>{COP(p.price)}</span>}</td>
                  <td style={{ padding: "10px" }}><span style={{ color: (ie ? emg : mg) >= 30 ? C.green : (ie ? emg : mg) >= 15 ? C.orange : C.red, fontWeight: "600" }}>{ie ? emg : mg}%</span></td>
                  <td style={{ padding: "10px" }}><span style={{ color: C.blue }}>{ie ? COP(editData.qty * editData.cost) : COP(p.qty * p.cost)}</span></td>
                  <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                    {ie
                      ? <div style={{ display: "flex", gap: "6px" }}><button onClick={saveEdit} style={{ padding: "5px 12px", background: C.greenBg, color: C.green, border: `1px solid #1a4a2a`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "700", fontFamily: "inherit" }}>✓ Guardar</button><button onClick={() => setEditId(null)} style={{ padding: "5px 10px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>✕</button></div>
                      : <div style={{ display: "flex", gap: "5px" }}>
                        <button onClick={() => abrirAjuste(p)} title="Ajuste de inventario" style={{ padding: "5px 9px", background: `${C.orange}18`, color: C.orange, border: `1px solid ${C.orange}44`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>🔧</button>
                        <button onClick={() => setHistorialModal(p)} title="Ver historial" style={{ padding: "5px 9px", background: `${C.purp}18`, color: C.purp, border: `1px solid ${C.purp}44`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>📋</button>
                        <button onClick={() => startEdit(p)} style={{ padding: "5px 10px", background: `${C.blue}18`, color: C.blue, border: `1px solid ${C.blue}40`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>✏️</button>
                        <button onClick={() => setDelConfirm(p)} style={{ padding: "5px 9px", background: C.redBg, color: C.red, border: `1px solid #3d1212`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>🗑️</button>
                      </div>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>}
        {editId && <div style={{ marginTop: "12px", padding: "10px 14px", background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: "8px", fontSize: "12px", color: C.muted }}>💡 <span style={{ color: C.blue }}>Modo edición</span> — Enter para guardar · Esc para cancelar</div>}
      </div>
    </div>
  );
}

// ─── SALES ───────────────────────────────────────────────────────────────────
function Sales({ sales, onDelete }) {
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    let r = [...sales].reverse();
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(s => s.id.toLowerCase().includes(q) || s.items.some(it => it.name.toLowerCase().includes(q)) || (s.metodoPago || "").toLowerCase().includes(q)); }
    if (dateFrom) r = r.filter(s => s.date >= dateFrom);
    if (dateTo) r = r.filter(s => s.date <= dateTo);
    return r;
  }, [sales, search, dateFrom, dateTo]);

  const hasFilters = search || dateFrom || dateTo;
  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); };
  const totalFiltrado = filtered.reduce((a, s) => a + s.total, 0);
  const gananciaFiltrada = filtered.reduce((a, s) => a + s.profit, 0);

  const handleExcelSales = async () => { setExporting(true); const data = filtered.map(s => ({ "ID": s.id.toUpperCase(), "Fecha": s.date, "Productos": s.items.map(it => `${it.name} x${it.qty}`).join(", "), "Método de pago": s.metodoPago || "Efectivo", "Total ($)": s.total, "Ganancia ($)": s.profit, "Margen (%)": s.total > 0 ? Math.round((s.profit / s.total) * 100) : 0, "Tipo": s.esLote ? "Lote" : "Normal" })); await exportToExcel([{ name: "Ventas", data }], `Ventas${hasFilters ? "_filtrado" : ""}_${todayISO()}`); setExporting(false); };
  const handlePDFSales = async () => { setExporting(true); const headers = ["ID", "Fecha", "Productos", "Pago", "Total", "Ganancia"]; const rows = filtered.map(s => [s.id.toUpperCase(), s.date, s.items.map(it => `${it.name} x${it.qty}`).join(", ").slice(0, 40), s.metodoPago || "Efectivo", COP(s.total), COP(s.profit)]); const subtitle = `${filtered.length} ventas · Total: ${COP(totalFiltrado)} · Ganancia: ${COP(gananciaFiltrada)}${dateFrom || dateTo ? ` · Período: ${dateFrom || "inicio"} al ${dateTo || "hoy"}` : ""}`; await exportToPDF("Historial de Ventas", headers, rows, `Ventas_${todayISO()}`, subtitle); setExporting(false); };
  const handleDelete = () => { onDelete(confirm); setConfirm(null); setOpen(null); };

  return (
    <div>
      {confirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "380px", textAlign: "center" }}><div style={{ fontSize: "38px", marginBottom: "12px" }}>🗑️</div><div style={{ fontSize: "17px", fontWeight: "700", color: C.text, marginBottom: "8px" }}>¿Anular esta venta?</div><div style={{ fontSize: "13px", color: C.muted, marginBottom: "6px" }}>Venta <span style={{ color: C.text, fontWeight: "600" }}>#{confirm.id.toUpperCase()}</span> del {confirm.date}</div><div style={{ fontSize: "13px", color: C.muted, marginBottom: "1.5rem" }}>El stock <span style={{ color: C.green }}>se restaurará automáticamente</span>.</div><div style={{ display: "flex", gap: "10px" }}><button onClick={() => setConfirm(null)} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={handleDelete} style={{ flex: 1, padding: "11px", background: C.redBg, color: C.red, border: `1px solid #4a1a1a`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>Sí, anular</button></div></div></div>}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
        {[{ label: hasFilters ? "Ventas (filtrado)" : "Total ventas", val: filtered.length, color: C.blue }, { label: hasFilters ? "Ingresos (filtrado)" : "Ingresos totales", val: COP(totalFiltrado), color: C.blue }, { label: hasFilters ? "Ganancias (filtrado)" : "Ganancias totales", val: COP(gananciaFiltrada), color: C.green }].map((st, i) => (
          <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "20px", fontWeight: "700", color: st.color }}>{st.val}</div></div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ ...s.card, marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: "180px" }}><label style={s.label}>🔍 Buscar por producto, ID o método</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ej: Hamburguesa, efectivo..." style={s.input} /></div>
          <div style={{ flex: 1, minWidth: "130px" }}><label style={s.label}>📅 Desde</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={s.input} /></div>
          <div style={{ flex: 1, minWidth: "130px" }}><label style={s.label}>📅 Hasta</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={s.input} /></div>
          {hasFilters && <button onClick={clearFilters} style={{ ...s.btnOut, whiteSpace: "nowrap", height: "38px", alignSelf: "flex-end" }}>✕ Limpiar</button>}
        </div>
        {hasFilters && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ fontSize: "12px", color: C.muted }}><span style={{ color: C.blue, fontWeight: "700" }}>{filtered.length}</span> resultados de {sales.length} ventas{(dateFrom || dateTo) && <span style={{ marginLeft: "8px" }}>· {dateFrom || "inicio"} → {dateTo || "hoy"}</span>}</div>
            <ExportButtons onExcel={handleExcelSales} onPDF={handlePDFSales} loading={exporting} />
          </div>
        )}
      </div>

      {/* Historial */}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "10px" }}>
          <div style={s.sectionTitle}>{hasFilters ? "Resultados filtrados" : "Historial de ventas"}{!hasFilters && <span style={{ fontSize: "12px", color: C.muted, fontWeight: "400", marginLeft: "8px" }}>· {sales.length} total</span>}</div>
          {!hasFilters && <ExportButtons onExcel={handleExcelSales} onPDF={handlePDFSales} loading={exporting} />}
        </div>
        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>{hasFilters ? "Sin resultados. Intenta con otros filtros." : "Sin ventas registradas."}</div>
          : filtered.map(sale => (
            <div key={sale.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.border}` }}>
                <div onClick={() => setOpen(open === sale.id ? null : sale.id)} style={{ flex: 1, cursor: "pointer" }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: C.text }}>#{sale.id.toUpperCase()} · {sale.date}<span style={{ marginLeft: "8px", fontSize: "11px", color: C.muted, fontWeight: "400" }}>{open === sale.id ? "▲" : "▼"}</span></div>
                  <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span>{sale.items.length} producto(s) · {sale.items.map(i => i.name).join(", ").slice(0, 40)}</span>
                    {sale.esLote && <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", background: `${C.orange}22`, color: C.orange, fontWeight: "600" }}>🏷️ Lote</span>}
                    {sale.metodoPago && <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", background: sale.metodoPagoTipo === "qr" ? `${C.purp}22` : C.greenBg, color: sale.metodoPagoTipo === "qr" ? C.purp : C.green, fontWeight: "600" }}>{sale.metodoPagoTipo === "qr" ? "📱" : "💵"} {sale.metodoPago}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: "14px", fontWeight: "700", color: C.blue }}>{COP(sale.total)}</div><div style={{ fontSize: "12px", color: C.green }}>+{COP(sale.profit)}</div></div>
                  <button onClick={e => { e.stopPropagation(); setConfirm(sale); }} style={{ padding: "6px 12px", background: C.redBg, color: C.red, border: `1px solid #3d1212`, borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}>🗑️ Anular</button>
                </div>
              </div>
              {open === sale.id && <div style={{ background: C.input, borderRadius: "9px", padding: "12px", margin: "8px 0" }}>{sale.items.map((it, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}><span style={{ color: C.muted }}>{it.name} × {it.qty}</span><span style={{ color: C.text }}>{COP(it.price * it.qty)}</span></div>)}<div style={{ borderTop: `1px solid ${C.border}`, marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted, fontSize: "12px" }}>Ganancia neta</span><span style={{ color: C.green, fontWeight: "700" }}>{COP(sale.profit)}</span></div></div>}
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
function Reports({ sales, products }) {
  const [vista, setVista] = useState("quincenal");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const hasCustomRange = dateFrom || dateTo;

  const salesFiltradas = useMemo(() => {
    if (!hasCustomRange) return sales;
    return sales.filter(s => { if (dateFrom && s.date < dateFrom) return false; if (dateTo && s.date > dateTo) return false; return true; });
  }, [sales, dateFrom, dateTo]);

  const clearDates = () => { setDateFrom(""); setDateTo(""); };
  const totalSales = salesFiltradas.reduce((a, s) => a + s.total, 0);
  const totalProfit = salesFiltradas.reduce((a, s) => a + s.profit, 0);
  const margin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  const topProds = useMemo(() => { const map = {}; salesFiltradas.forEach(s => s.items.forEach(it => { if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, revenue: 0, profit: 0 }; map[it.name].qty += it.qty; map[it.name].revenue += it.price * it.qty; map[it.name].profit += (it.price - it.cost) * it.qty; })); return Object.values(map).sort((a, b) => b.revenue - a.revenue); }, [salesFiltradas]);
  const maxRev = topProds.reduce((a, p) => Math.max(a, p.revenue), 0);

  const byDay = useMemo(() => {
    if (hasCustomRange) { const from = dateFrom ? new Date(dateFrom) : new Date(dateTo || todayISO()); const to = dateTo ? new Date(dateTo) : new Date(); const days = []; const cur = new Date(from); while (cur <= to && days.length < 60) { const iso = cur.toISOString().split("T")[0]; days.push({ label: cur.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }), val: salesFiltradas.filter(s => s.date === iso).reduce((a, s) => a + s.total, 0), prof: salesFiltradas.filter(s => s.date === iso).reduce((a, s) => a + s.profit, 0) }); cur.setDate(cur.getDate() + 1); } return days; }
    return Array.from({ length: 15 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (14 - i)); const iso = d.toISOString().split("T")[0]; return { label: d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }), val: sales.filter(s => s.date === iso).reduce((a, s) => a + s.total, 0), prof: sales.filter(s => s.date === iso).reduce((a, s) => a + s.profit, 0) }; });
  }, [salesFiltradas, hasCustomRange, dateFrom, dateTo]);

  const ingQ = salesFiltradas.reduce((a, s) => a + s.total, 0);
  const ganQ = salesFiltradas.reduce((a, s) => a + s.profit, 0);
  const marQ = ingQ > 0 ? Math.round((ganQ / ingQ) * 100) : 0;

  const mesesReales = useMemo(() => { const map = {}; salesFiltradas.forEach(s => { const d = new Date(s.date); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; const label = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" }); if (!map[key]) map[key] = { key, label, ventas: 0, ingresos: 0, ganancias: 0, efectivo: 0, qr: 0, lote: 0 }; map[key].ventas++; map[key].ingresos += s.total; map[key].ganancias += s.profit; if (s.metodoPagoTipo === "qr") map[key].qr += s.total; else map[key].efectivo += s.total; if (s.esLote) map[key].lote += s.total; }); return Object.values(map).sort((a, b) => b.key.localeCompare(a.key)); }, [salesFiltradas]);

  const mesesChart = useMemo(() => { if (hasCustomRange) return mesesReales.map(m => ({ label: m.label.slice(0, 3), val: m.ingresos, gan: m.ganancias })).reverse().slice(-12); return Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; const label = d.toLocaleDateString("es-CO", { month: "short" }); const found = mesesReales.find(m => m.key === key); return { label, val: found?.ingresos || 0, gan: found?.ganancias || 0 }; }).reverse(); }, [mesesReales, hasCustomRange]);

  const mejorMes = mesesReales.reduce((a, m) => m.ganancias > a.ganancias ? m : a, { ganancias: 0, label: "—" });
  const promedioMensual = mesesReales.length > 0 ? Math.round(totalSales / mesesReales.length) : 0;

  const aniosReales = useMemo(() => { const map = {}; salesFiltradas.forEach(s => { const d = new Date(s.date); const key = String(d.getFullYear()); if (!map[key]) map[key] = { key, ventas: 0, ingresos: 0, ganancias: 0, efectivo: 0, qr: 0, lote: 0 }; map[key].ventas++; map[key].ingresos += s.total; map[key].ganancias += s.profit; if (s.metodoPagoTipo === "qr") map[key].qr += s.total; else map[key].efectivo += s.total; if (s.esLote) map[key].lote += s.total; }); return Object.values(map).sort((a, b) => b.key.localeCompare(a.key)); }, [salesFiltradas]);

  const aniosChart = aniosReales.map(a => ({ label: a.key, val: a.ingresos, gan: a.ganancias })).reverse();
  const mejorAnio = aniosReales.reduce((a, m) => m.ganancias > a.ganancias ? m : a, { ganancias: 0, key: "—" });

  const topQ = useMemo(() => { const map = {}; salesFiltradas.forEach(s => s.items.forEach(it => { if (!map[it.name]) map[it.name] = { name: it.name, qty: 0, revenue: 0, profit: 0 }; map[it.name].qty += it.qty; map[it.name].revenue += it.price * it.qty; map[it.name].profit += (it.price - it.cost) * it.qty; })); return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5); }, [salesFiltradas]);
  const maxRevQ = topQ.reduce((a, p) => Math.max(a, p.revenue), 0);

  const handleExcelReport = async () => { setExporting(true); const periodo = hasCustomRange ? `${dateFrom || "inicio"}_${dateTo || "hoy"}` : vista; const sheets = [{ name: "Ventas", data: salesFiltradas.map(s => ({ "ID": s.id.toUpperCase(), "Fecha": s.date, "Productos": s.items.map(it => `${it.name} x${it.qty}`).join(", "), "Método": s.metodoPago || "Efectivo", "Total ($)": s.total, "Ganancia ($)": s.profit })) },]; if (mesesReales.length > 0) sheets.push({ name: "Por mes", data: mesesReales.map(m => ({ "Mes": m.label, "Ventas": m.ventas, "Ingresos ($)": m.ingresos, "Ganancias ($)": m.ganancias, "Margen (%)": m.ingresos > 0 ? Math.round((m.ganancias / m.ingresos) * 100) : 0, "Efectivo ($)": m.efectivo, "QR ($)": m.qr })) }); if (topProds.length > 0) sheets.push({ name: "Top productos", data: topProds.map((p, i) => ({ "Pos.": i + 1, "Producto": p.name, "Unidades": p.qty, "Ingresos ($)": p.revenue, "Ganancia ($)": p.profit, "Margen (%)": p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0 })) }); await exportToExcel(sheets, `Reporte_${periodo}`); setExporting(false); };
  const handlePDFReport = async () => { setExporting(true); const periodo = hasCustomRange ? `${dateFrom || "inicio"} al ${dateTo || "hoy"}` : vista; const subtitle = `${salesFiltradas.length} ventas · Total: ${COP(totalSales)} · Ganancia: ${COP(totalProfit)} · Margen: ${margin}% · Período: ${periodo}`; const headers = ["Pos.", "Producto", "Unidades", "Ingresos", "Ganancia", "Margen"]; const rows = topProds.slice(0, 20).map((p, i) => [i + 1, p.name, p.qty, COP(p.revenue), COP(p.profit), (p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0) + "%"]); await exportToPDF("Reporte de Ventas — Top Productos", headers, rows, `Reporte_${todayISO()}`, subtitle); setExporting(false); };

  const tabs = [{ id: "quincenal", label: "📅 Quincenal" }, { id: "meses", label: "🗓️ Mensual" }, { id: "anual", label: "📆 Anual" }, { id: "general", label: "🌐 General" }];

  const FiltroFechas = () => (
    <div style={{ ...s.card, marginBottom: "1.25rem", borderLeft: `3px solid ${hasCustomRange ? C.blue : C.border}` }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "130px" }}><label style={s.label}>📅 Desde</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={s.input} /></div>
        <div style={{ flex: 1, minWidth: "130px" }}><label style={s.label}>📅 Hasta</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={s.input} /></div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignSelf: "flex-end" }}>
          {[{ label: "Hoy", fn: () => { setDateFrom(todayISO()); setDateTo(todayISO()); } }, { label: "7 días", fn: () => { const d = new Date(); d.setDate(d.getDate() - 6); setDateFrom(d.toISOString().split("T")[0]); setDateTo(todayISO()); } }, { label: "Este mes", fn: () => { const d = new Date(); setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`); setDateTo(todayISO()); } }, { label: "Este año", fn: () => { setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(todayISO()); } }].map((a, i) => (
            <button key={i} onClick={a.fn} style={{ padding: "6px 12px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", height: "38px" }}>{a.label}</button>
          ))}
          {hasCustomRange && <button onClick={clearDates} style={{ padding: "6px 12px", background: C.redBg, color: C.red, border: `1px solid #3d1212`, borderRadius: "7px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", height: "38px" }}>✕ Todo</button>}
        </div>
        <div style={{ alignSelf: "flex-end" }}><ExportButtons onExcel={handleExcelReport} onPDF={handlePDFReport} loading={exporting} /></div>
      </div>
      {hasCustomRange && <div style={{ marginTop: "10px", fontSize: "12px", color: C.blue }}>📊 Mostrando <strong>{salesFiltradas.length}</strong> ventas del {dateFrom || "inicio"} al {dateTo || "hoy"} · {COP(totalSales)} en ingresos</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {tabs.map(t => <button key={t.id} onClick={() => setVista(t.id)} style={{ padding: "9px 18px", background: vista === t.id ? C.blue : C.card, color: vista === t.id ? C.bg : C.muted, border: `1px solid ${vista === t.id ? C.blue : C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: vista === t.id ? "700" : "400" }}>{t.label}</button>)}
      </div>
      <FiltroFechas />

      {vista === "quincenal" && <>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
          {[{ label: hasCustomRange ? "Ventas (rango)" : "Ventas (15 días)", val: salesFiltradas.length, color: C.blue }, { label: hasCustomRange ? "Ingresos (rango)" : "Ingresos (15 días)", val: COP(ingQ), color: C.blue }, { label: hasCustomRange ? "Ganancias (rango)" : "Ganancias (15 días)", val: COP(ganQ), color: C.green }, { label: "Margen promedio", val: marQ + "%", color: marQ >= 30 ? C.green : C.orange }].map((st, i) => (
            <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "20px", fontWeight: "700", color: st.color }}>{st.val}</div></div>
          ))}
        </div>
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "1.25rem" }}>
          <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>💵 Ingresos por día</div><div style={{ fontSize: "11px", color: C.muted, marginBottom: "10px" }}>{COP(ingQ)} total</div><BarChart data={byDay} color={C.blue} /></div>
          <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>💰 Ganancias por día</div><div style={{ fontSize: "11px", color: C.muted, marginBottom: "10px" }}>{COP(ganQ)} total</div><BarChart data={byDay.map(d => ({ label: d.label, val: d.prof }))} color={C.green} /></div>
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>🏆 Top 5 productos — período</div>
          {topQ.length === 0 ? <div style={{ textAlign: "center", padding: "2rem", color: C.muted, fontSize: "13px" }}>Sin ventas en el período.</div>
            : topQ.map((p, i) => (
              <div key={i} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "22px", height: "22px", background: i === 0 ? `${C.blue}33` : C.input, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: i === 0 ? C.blue : C.muted, fontWeight: "700" }}>{i + 1}</span><span style={{ fontSize: "13px", fontWeight: "600", color: C.text }}>{p.name}</span></div>
                  <div style={{ textAlign: "right" }}><span style={{ fontSize: "13px", fontWeight: "700", color: C.blue }}>{COP(p.revenue)}</span><span style={{ fontSize: "11px", color: C.green, marginLeft: "8px" }}>+{COP(p.profit)}</span></div>
                </div>
                <MiniBar value={p.revenue} max={maxRevQ} color={C.blue} />
                <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>{p.qty} unidades · margen {p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0}%</div>
              </div>
            ))}
        </div>
      </>}

      {vista === "meses" && <>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
          {[{ label: "Meses con ventas", val: mesesReales.length, color: C.blue }, { label: "Mejor mes", val: mejorMes.label === "—" ? "Sin datos" : mejorMes.label, color: C.purp }, { label: "Ganancia mejor mes", val: COP(mejorMes.ganancias), color: C.green }, { label: "Promedio mensual", val: COP(promedioMensual), color: C.blue }].map((st, i) => (
            <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: i === 1 ? "12px" : "20px", fontWeight: "700", color: st.color, lineHeight: 1.4, wordBreak: "break-word" }}>{st.val}</div></div>
          ))}
        </div>
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "1.25rem" }}>
          <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>💵 Ingresos por mes</div><BarChart data={mesesChart.length > 0 ? mesesChart : [{ label: "—", val: 0 }]} color={C.blue} /></div>
          <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>💰 Ganancias por mes</div><BarChart data={mesesChart.length > 0 ? mesesChart.map(m => ({ label: m.label, val: m.gan })) : [{ label: "—", val: 0 }]} color={C.green} /></div>
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>📋 Detalle por mes</div>
          {mesesReales.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>Sin ventas en el período.</div>
            : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Mes", "Ventas", "Ingresos", "Ganancias", "Margen", "💵 Efectivo", "📱 QR", "🏷️ Lote"].map(h => <th key={h} style={{ textAlign: "left", padding: "9px 10px", color: C.muted, fontWeight: "500", fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{mesesReales.map(m => { const mar = m.ingresos > 0 ? Math.round((m.ganancias / m.ingresos) * 100) : 0; const esMejor = m.key === mejorMes.key && mejorMes.ganancias > 0; return (<tr key={m.key} style={{ borderBottom: `1px solid ${C.input}`, background: esMejor ? `${C.blue}08` : "transparent" }}><td style={{ padding: "11px 10px" }}><div style={{ fontSize: "13px", fontWeight: "700", color: C.text, textTransform: "capitalize" }}>{esMejor && <span style={{ fontSize: "10px", marginRight: "5px" }}>⭐</span>}{m.label}</div>{esMejor && <div style={{ fontSize: "10px", color: C.blue }}>Mejor mes</div>}</td><td style={{ padding: "11px 10px", color: C.muted }}>{m.ventas}</td><td style={{ padding: "11px 10px", color: C.blue, fontWeight: "600" }}>{COP(m.ingresos)}</td><td style={{ padding: "11px 10px", color: C.green, fontWeight: "700" }}>{COP(m.ganancias)}</td><td style={{ padding: "11px 10px" }}><span style={{ fontSize: "12px", fontWeight: "600", color: mar >= 30 ? C.green : mar >= 15 ? C.orange : C.red }}>{mar}%</span></td><td style={{ padding: "11px 10px", color: C.muted, fontSize: "12px" }}>{COP(m.efectivo)}</td><td style={{ padding: "11px 10px", color: C.purp, fontSize: "12px" }}>{COP(m.qr)}</td><td style={{ padding: "11px 10px", color: C.orange, fontSize: "12px" }}>{COP(m.lote)}</td></tr>); })}</tbody>
              <tfoot><tr style={{ borderTop: `2px solid ${C.border}`, background: `${C.blue}06` }}><td style={{ padding: "11px 10px", color: C.muted, fontSize: "12px", fontWeight: "600" }}>TOTAL</td><td style={{ padding: "11px 10px", color: C.muted, fontSize: "12px" }}>{salesFiltradas.length}</td><td style={{ padding: "11px 10px", color: C.blue, fontWeight: "800", fontSize: "14px" }}>{COP(totalSales)}</td><td style={{ padding: "11px 10px", color: C.green, fontWeight: "800", fontSize: "14px" }}>{COP(totalProfit)}</td><td style={{ padding: "11px 10px", color: margin >= 30 ? C.green : C.orange, fontWeight: "700" }}>{margin}%</td><td style={{ padding: "11px 10px", color: C.muted, fontSize: "12px", fontWeight: "600" }}>{COP(mesesReales.reduce((a, m) => a + m.efectivo, 0))}</td><td style={{ padding: "11px 10px", color: C.purp, fontSize: "12px", fontWeight: "600" }}>{COP(mesesReales.reduce((a, m) => a + m.qr, 0))}</td><td style={{ padding: "11px 10px", color: C.orange, fontSize: "12px", fontWeight: "600" }}>{COP(mesesReales.reduce((a, m) => a + m.lote, 0))}</td></tr></tfoot>
            </table></div>}
        </div>
      </>}

      {vista === "anual" && <>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
          {[{ label: "Años registrados", val: aniosReales.length, color: C.blue }, { label: "Mejor año", val: mejorAnio.key === "—" ? "Sin datos" : mejorAnio.key, color: C.purp }, { label: "Ganancia mejor año", val: COP(mejorAnio.ganancias), color: C.green }, { label: "Promedio anual", val: aniosReales.length > 0 ? COP(Math.round(totalSales / aniosReales.length)) : "—", color: C.blue }].map((st, i) => (
            <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "20px", fontWeight: "700", color: st.color }}>{st.val}</div></div>
          ))}
        </div>
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "1.25rem" }}>
          <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>💵 Ingresos por año</div><BarChart data={aniosChart.length > 0 ? aniosChart : [{ label: "—", val: 0 }]} color={C.blue} /></div>
          <div style={s.card}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>💰 Ganancias por año</div><BarChart data={aniosChart.length > 0 ? aniosChart.map(a => ({ label: a.label, val: a.gan })) : [{ label: "—", val: 0 }]} color={C.green} /></div>
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>📋 Detalle por año</div>
          {aniosReales.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>Sin datos anuales.</div>
            : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Año", "Ventas", "Ingresos", "Ganancias", "Margen", "💵 Efectivo", "📱 QR", "🏷️ Lote"].map(h => <th key={h} style={{ textAlign: "left", padding: "9px 10px", color: C.muted, fontWeight: "500", fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>{aniosReales.map(a => { const mar = a.ingresos > 0 ? Math.round((a.ganancias / a.ingresos) * 100) : 0; const esMejor = a.key === mejorAnio.key && mejorAnio.ganancias > 0; return (<tr key={a.key} style={{ borderBottom: `1px solid ${C.input}`, background: esMejor ? `${C.blue}08` : "transparent" }}><td style={{ padding: "13px 10px" }}><div style={{ fontSize: "16px", fontWeight: "800", color: C.text }}>{esMejor && <span style={{ fontSize: "12px", marginRight: "5px" }}>⭐</span>}{a.key}</div>{esMejor && <div style={{ fontSize: "10px", color: C.blue }}>Mejor año</div>}</td><td style={{ padding: "13px 10px", color: C.muted }}>{a.ventas}</td><td style={{ padding: "13px 10px", color: C.blue, fontWeight: "700", fontSize: "14px" }}>{COP(a.ingresos)}</td><td style={{ padding: "13px 10px", color: C.green, fontWeight: "800", fontSize: "14px" }}>{COP(a.ganancias)}</td><td style={{ padding: "13px 10px" }}><span style={{ fontSize: "13px", fontWeight: "600", color: mar >= 30 ? C.green : mar >= 15 ? C.orange : C.red }}>{mar}%</span></td><td style={{ padding: "13px 10px", color: C.muted }}>{COP(a.efectivo)}</td><td style={{ padding: "13px 10px", color: C.purp }}>{COP(a.qr)}</td><td style={{ padding: "13px 10px", color: C.orange }}>{COP(a.lote)}</td></tr>); })}</tbody>
            </table></div>}
        </div>
      </>}

      {vista === "general" && <>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
          {[{ label: hasCustomRange ? "Ventas (rango)" : "Total ventas históricas", val: salesFiltradas.length, color: C.blue, icon: "🛒" }, { label: "Ingresos", val: COP(totalSales), color: C.blue, icon: "💵" }, { label: "Ganancias", val: COP(totalProfit), color: C.green, icon: "💰" }, { label: "Margen global", val: margin + "%", color: margin >= 30 ? C.green : C.orange, icon: "📊" }].map((st, i) => (
            <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "22px", fontWeight: "700", color: st.color }}>{st.val}</div></div><span style={{ fontSize: "22px" }}>{st.icon}</span></div></div>
          ))}
        </div>
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "1.25rem" }}>
          <div style={s.card}>
            <div style={s.sectionTitle}>💳 Desglose por método de pago</div>
            {[{ label: "💵 Efectivo", val: salesFiltradas.filter(s => s.metodoPagoTipo !== "qr").reduce((a, s) => a + s.total, 0), color: C.green }, { label: "📱 QR", val: salesFiltradas.filter(s => s.metodoPagoTipo === "qr").reduce((a, s) => a + s.total, 0), color: C.purp }, { label: "🏷️ Lote", val: salesFiltradas.filter(s => s.esLote).reduce((a, s) => a + s.total, 0), color: C.orange }].map((m, i) => (
              <div key={i} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}><span style={{ fontSize: "13px", color: C.text }}>{m.label}</span><span style={{ fontSize: "13px", fontWeight: "700", color: m.color }}>{COP(m.val)}</span></div>
                <MiniBar value={m.val} max={totalSales} color={m.color} />
                <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>{totalSales > 0 ? Math.round((m.val / totalSales) * 100) : 0}% del total</div>
              </div>
            ))}
          </div>
          <div style={s.card}>
            <div style={s.sectionTitle}>📈 Resumen temporal</div>
            {[{ label: "Total período", val: COP(totalSales), sub: `${salesFiltradas.length} ventas · ${margin}% margen`, color: C.blue }, { label: "Mejor mes", val: COP(mejorMes.ganancias), sub: mejorMes.label === "—" ? "Sin datos" : mejorMes.label, color: C.green }, { label: "Mejor año", val: COP(mejorAnio.ganancias), sub: mejorAnio.key === "—" ? "Sin datos" : mejorAnio.key, color: C.purp }, { label: "Promedio mensual", val: COP(promedioMensual), sub: `${mesesReales.length} mes(es)`, color: C.blue }].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? `1px solid ${C.border}` : "none" }}>
                <div><div style={{ fontSize: "12px", color: C.muted }}>{r.label}</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>{r.sub}</div></div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: r.color }}>{r.val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...s.card, marginBottom: "1.25rem" }}>
          <div style={s.sectionTitle}>🏆 Top productos — período</div>
          {topProds.length === 0 ? <div style={{ textAlign: "center", padding: "2rem", color: C.muted, fontSize: "13px" }}>Sin datos.</div>
            : topProds.slice(0, 8).map((p, i) => (
              <div key={i} style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "22px", height: "22px", background: i < 3 ? `${C.blue}33` : C.input, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: i < 3 ? C.blue : C.muted, fontWeight: "700" }}>{i + 1}</span><span style={{ fontSize: "13px", fontWeight: "600", color: C.text }}>{p.name}</span>{i === 0 && <span style={{ fontSize: "10px", padding: "2px 7px", background: `${C.blue}22`, color: C.blue, borderRadius: "20px", fontWeight: "600" }}>⭐ Top</span>}</div>
                  <div style={{ textAlign: "right" }}><span style={{ fontSize: "13px", fontWeight: "700", color: C.blue }}>{COP(p.revenue)}</span><span style={{ fontSize: "11px", color: C.green, marginLeft: "8px" }}>+{COP(p.profit)}</span></div>
                </div>
                <MiniBar value={p.revenue} max={maxRev} color={C.blue} />
                <div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>{p.qty} uds · margen {p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0}%</div>
              </div>
            ))}
        </div>
        {mesesReales.length >= 2 && (
          <div style={{ ...s.card, borderLeft: `3px solid ${C.purp}` }}>
            <div style={s.sectionTitle}>🔮 Proyección próximo mes</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              {(() => { const u3 = mesesReales.slice(0, 3); const pI = Math.round(u3.reduce((a, m) => a + m.ingresos, 0) / u3.length); const pG = Math.round(u3.reduce((a, m) => a + m.ganancias, 0) / u3.length); const pM = pI > 0 ? Math.round((pG / pI) * 100) : 0; return [{ label: "Ingresos estimados", val: COP(pI), color: C.blue, sub: "Últimos 3 meses" }, { label: "Ganancias estimadas", val: COP(pG), color: C.green, sub: "Promedio reciente" }, { label: "Margen esperado", val: pM + "%", color: pM >= 30 ? C.green : C.orange, sub: "Tendencia actual" }].map((p, i) => <div key={i} style={{ background: C.input, borderRadius: "10px", padding: "14px", border: `1px solid ${C.border}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{p.label}</div><div style={{ fontSize: "18px", fontWeight: "700", color: p.color }}>{p.val}</div><div style={{ fontSize: "10px", color: C.muted, marginTop: "3px" }}>{p.sub}</div></div>); })()}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

// ─── SEGURIDAD ADMIN ──────────────────────────────────────────────────────────
function SeguridadAdmin() {
  const [passActual, setPassActual] = useState(""); const [passNueva, setPassNueva] = useState(""); const [passNueva2, setPassNueva2] = useState(""); const [showPA, setShowPA] = useState(false); const [showPN, setShowPN] = useState(false); const [passMsg, setPassMsg] = useState(null); const [passLoading, setPassLoading] = useState(false);
  const [correoVerif, setCorreoVerif] = useState(""); const [codigoInput, setCodigoInput] = useState(""); const [codigoEnviado, setCodigoEnviado] = useState(false); const [codigoReal, setCodigoReal] = useState(""); const [verifMsg, setVerifMsg] = useState(null); const [enviando, setEnviando] = useState(false); const [verificando, setVerificando] = useState(false); const [verificado, setVerificado] = useState(false); const [countdown, setCountdown] = useState(0);
  useEffect(() => { if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c - 1), 1000); return () => clearTimeout(t); } }, [countdown]);
  const cambiarContrasena = async () => { setPassMsg(null); if (!passActual) { setPassMsg({ ok: false, text: "Ingresa tu contraseña actual." }); return; } if (passNueva.length < 8) { setPassMsg({ ok: false, text: "Mínimo 8 caracteres." }); return; } if (passNueva !== passNueva2) { setPassMsg({ ok: false, text: "Las contraseñas no coinciden." }); return; } if (passNueva === passActual) { setPassMsg({ ok: false, text: "Debe ser diferente a la actual." }); return; } setPassLoading(true); try { const user = auth.currentUser; const cred = EmailAuthProvider.credential(user.email, passActual); await reauthenticateWithCredential(user, cred); await updatePassword(user, passNueva); setPassMsg({ ok: true, text: "✅ Contraseña actualizada." }); setPassActual(""); setPassNueva(""); setPassNueva2(""); } catch (e) { if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") setPassMsg({ ok: false, text: "❌ Contraseña actual incorrecta." }); else setPassMsg({ ok: false, text: "❌ Error: " + e.message }); } setPassLoading(false); };
  const generarCodigo = () => Math.floor(100000 + Math.random() * 900000).toString();
  const enviarCodigo = async () => { setVerifMsg(null); if (!correoVerif || !/\S+@\S+\.\S+/.test(correoVerif)) { setVerifMsg({ ok: false, text: "Ingresa un correo válido." }); return; } setEnviando(true); const codigo = generarCodigo(); setCodigoReal(codigo); setCodigoEnviado(true); setCountdown(60); setVerifMsg({ ok: true, text: `📧 Código enviado a ${correoVerif}. Código de prueba: ${codigo}` }); setEnviando(false); };
  const verificarCodigo = () => { setVerificando(true); setTimeout(() => { if (codigoInput.trim() === codigoReal) { setVerificado(true); setVerifMsg({ ok: true, text: "✅ ¡Verificación exitosa!" }); } else setVerifMsg({ ok: false, text: "❌ Código incorrecto." }); setVerificando(false); }, 600); };
  const fortaleza = (p) => { if (!p) return { label: "", color: "transparent", w: 0 }; let sc = 0; if (p.length >= 8) sc++; if (p.length >= 12) sc++; if (/[A-Z]/.test(p)) sc++; if (/[0-9]/.test(p)) sc++; if (/[^A-Za-z0-9]/.test(p)) sc++; if (sc <= 1) return { label: "Muy débil", color: C.red, w: 20 }; if (sc === 2) return { label: "Débil", color: C.orange, w: 40 }; if (sc === 3) return { label: "Media", color: C.orange, w: 60 }; if (sc === 4) return { label: "Fuerte", color: C.green, w: 80 }; return { label: "Muy fuerte 🔥", color: C.green, w: 100 }; };
  const f = fortaleza(passNueva);
  return (
    <div>
      <div style={{ ...s.card, marginBottom: "1.25rem", borderLeft: `3px solid ${C.blue}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}><div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${C.blue}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🔑</div><div><div style={s.sectionTitle}>Cambiar contraseña del administrador</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "-8px" }}>Se requiere la contraseña actual</div></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "14px" }} className="g2">
          <div><label style={s.label}>Contraseña actual *</label><div style={{ position: "relative" }}><input type={showPA ? "text" : "password"} value={passActual} onChange={e => setPassActual(e.target.value)} style={{ ...s.input, paddingRight: "40px" }} /><button onClick={() => setShowPA(p => !p)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "15px" }}>{showPA ? "🙈" : "👁️"}</button></div></div>
          <div><label style={s.label}>Nueva contraseña *</label><div style={{ position: "relative" }}><input type={showPN ? "text" : "password"} value={passNueva} onChange={e => setPassNueva(e.target.value)} style={{ ...s.input, paddingRight: "40px" }} /><button onClick={() => setShowPN(p => !p)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "15px" }}>{showPN ? "🙈" : "👁️"}</button></div>{passNueva && <div style={{ marginTop: "6px" }}><div style={{ height: "4px", background: C.border, borderRadius: "4px", overflow: "hidden" }}><div style={{ height: "100%", width: `${f.w}%`, background: f.color, borderRadius: "4px" }} /></div><div style={{ fontSize: "10px", color: f.color, marginTop: "3px", fontWeight: "600" }}>{f.label}</div></div>}</div>
          <div><label style={s.label}>Confirmar nueva contraseña *</label><input type="password" value={passNueva2} onChange={e => setPassNueva2(e.target.value)} style={{ ...s.input, borderColor: passNueva2 && passNueva2 !== passNueva ? C.red : s.input.borderColor }} />{passNueva2 && passNueva2 !== passNueva && <div style={{ fontSize: "10px", color: C.red, marginTop: "3px" }}>No coinciden</div>}{passNueva2 && passNueva2 === passNueva && <div style={{ fontSize: "10px", color: C.green, marginTop: "3px" }}>✓ Coinciden</div>}</div>
        </div>
        {passMsg && <div style={{ padding: "9px 14px", background: passMsg.ok ? C.greenBg : C.redBg, border: `1px solid ${passMsg.ok ? C.green : C.red}44`, borderRadius: "8px", fontSize: "13px", color: passMsg.ok ? C.green : C.red, marginBottom: "12px" }}>{passMsg.text}</div>}
        <button onClick={cambiarContrasena} disabled={passLoading || !passActual || !passNueva || !passNueva2} style={{ ...s.btnGold, opacity: (passLoading || !passActual || !passNueva || !passNueva2) ? .5 : 1 }}>{passLoading ? "Actualizando..." : "🔑 Actualizar contraseña"}</button>
      </div>
      <div style={{ ...s.card, borderLeft: `3px solid ${verificado ? C.green : C.orange}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.25rem" }}><div style={{ width: "38px", height: "38px", borderRadius: "10px", background: verificado ? `${C.green}22` : `${C.orange}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>{verificado ? "✅" : "📧"}</div><div><div style={s.sectionTitle}>Verificación de segundo factor</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "-8px" }}>{verificado ? "Correo de respaldo verificado" : "Agrega un correo secundario"}</div></div></div>
        {!verificado ? (<><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "end", marginBottom: "12px" }}><div><label style={s.label}>Correo de respaldo</label><input type="email" value={correoVerif} onChange={e => setCorreoVerif(e.target.value)} placeholder="correo@gmail.com" disabled={codigoEnviado} style={{ ...s.input, opacity: codigoEnviado ? .7 : 1 }} /></div><button onClick={enviarCodigo} disabled={enviando || countdown > 0 || codigoEnviado} style={{ ...s.btnGold, whiteSpace: "nowrap", opacity: (enviando || countdown > 0) ? .6 : 1, height: "38px" }}>{enviando ? "Enviando..." : (countdown > 0 ? `Reenviar (${countdown}s)` : codigoEnviado ? "✓ Enviado" : "📤 Enviar código")}</button></div>{codigoEnviado && <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "end" }}><div><label style={s.label}>Código de 6 dígitos</label><input type="text" value={codigoInput} onChange={e => setCodigoInput(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} style={{ ...s.input, fontSize: "22px", letterSpacing: "8px", textAlign: "center", fontWeight: "700" }} onKeyDown={e => e.key === "Enter" && verificarCodigo()} /></div><button onClick={verificarCodigo} disabled={verificando || codigoInput.length !== 6} style={{ ...s.btnGold, whiteSpace: "nowrap", opacity: (verificando || codigoInput.length !== 6) ? .5 : 1, height: "38px" }}>{verificando ? "Verificando..." : "✓ Verificar"}</button></div>}</>)
          : (<div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", background: C.greenBg, borderRadius: "10px", border: `1px solid ${C.green}44` }}><div style={{ fontSize: "32px" }}>✅</div><div><div style={{ fontSize: "14px", fontWeight: "700", color: C.green }}>Correo verificado</div><div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>{correoVerif}</div><button onClick={() => { setVerificado(false); setCodigoEnviado(false); setCorreoVerif(""); setCodigoInput(""); setCodigoReal(""); setVerifMsg(null); }} style={{ marginTop: "6px", fontSize: "11px", color: C.muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", padding: 0 }}>Cambiar correo</button></div></div>)}
        {verifMsg && <div style={{ marginTop: "12px", padding: "9px 14px", background: verifMsg.ok ? C.greenBg : C.redBg, border: `1px solid ${verifMsg.ok ? C.green : C.red}44`, borderRadius: "8px", fontSize: "13px", color: verifMsg.ok ? C.green : C.red }}>{verifMsg.text}</div>}
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
function AdminPanel({ allUsers, setAllUsers }) {
  const empresas = allUsers.filter(u => u.role === "user");
  const [precios, setPrecios] = useState({ activacion: 50000, mensual: 30000 });
  const [editPrecios, setEditPrecios] = useState(false);
  const [preciosTemp, setPreciosTemp] = useState({ activacion: 50000, mensual: 30000 });
  const [form, setForm] = useState({ name: "", email: "", pass: "" });
  const [formErr, setFormErr] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [delUser, setDelUser] = useState(null);
  const [vistaAdmin, setVistaAdmin] = useState("empresas");
  const [createdOk, setCreatedOk] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", pass: "", precioActivacion: "", precioMensual: "" });
  const [editShowPass, setEditShowPass] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  const diasRestantes = (u) => { if (!u.vencimiento) return null; return Math.ceil((new Date(u.vencimiento) - new Date()) / (1000 * 60 * 60 * 24)); };
  const estadoSub = (u) => { const d = diasRestantes(u); if (d === null) return { label: "Sin fecha", color: C.muted, bg: C.input }; if (d < 0) return { label: "VENCIDA", color: C.red, bg: C.redBg }; if (d <= 5) return { label: `Vence en ${d}d`, color: C.orange, bg: `${C.orange}18` }; return { label: `${d} días`, color: C.green, bg: C.greenBg }; };
  const totalActivaciones = empresas.filter(u => u.fechaActivacion).length;
  const ingresosActivacion = totalActivaciones * precios.activacion;
  const ingresosMensual = empresas.filter(u => u.active && diasRestantes(u) > 0).length * precios.mensual;
  const totalIngresos = ingresosActivacion + ingresosMensual;
  const mesesData = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); const mes = d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" }); const activas = empresas.filter(u => { if (!u.fechaActivacion) return false; const fa = new Date(u.fechaActivacion); return fa.getFullYear() === d.getFullYear() && fa.getMonth() === d.getMonth(); }).length; return { label: mes, val: activas * (precios.activacion + precios.mensual) }; }).reverse();

 const crearEmpresa = async () => {
  setFormErr(""); setCreatedOk("");
  if (!form.name.trim()) { setFormErr("El nombre es obligatorio."); return; }
  if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) { setFormErr("Correo no válido."); return; }
  if (form.pass.length < 6) { setFormErr("Contraseña mínimo 6 caracteres."); return; }
  setCreating(true);

  const venc = new Date();
  venc.setDate(venc.getDate() + 30);
  let secondaryApp = null;

  try {
    // ✅ App secundaria para NO cerrar sesión del admin
    const config = getApp().options;
    secondaryApp = initializeApp(config, `sec-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    const { user } = await createUserWithEmailAndPassword(
      secondaryAuth,
      form.email.trim().toLowerCase(),
      form.pass
    );

    // Cerrar sesión del usuario recién creado en la app secundaria
    await signOut(secondaryAuth);

    const profile = {
      uid: user.uid,
      email: form.email.trim().toLowerCase(),
      name: form.name.trim(),
      role: "user",
      active: true,
      products: [],
      sales: [],
      createdAt: new Date().toISOString(),
      fechaActivacion: new Date().toISOString(),
      vencimiento: venc.toISOString(),
      precioActivacion: precios.activacion,
      precioMensual: precios.mensual,
    };

    await setDoc(doc(db, "users", user.uid), profile);
    setAllUsers(prev => [...prev, profile]);
    setForm({ name: "", email: "", pass: "" });
    setShowPass(false);
    setCreatedOk(`✅ Empresa "${profile.name}" creada.`);
    setTimeout(() => setCreatedOk(""), 6000);

  } catch (e) {
    if (e.code === "auth/email-already-in-use") setFormErr("Ese correo ya está registrado.");
    else setFormErr("Error: " + e.message);
  } finally {
    // ✅ Destruir la app secundaria siempre
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch {}
    }
  }
  setCreating(false);
};
  const renovar = (u) => async () => { const venc = new Date(Math.max(new Date(u.vencimiento || new Date()), new Date())); venc.setDate(venc.getDate() + 30); await updateDoc(doc(db, "users", u.uid), { vencimiento: venc.toISOString(), active: true }); setAllUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, vencimiento: venc.toISOString(), active: true } : x)); };
  const abrirEdicion = (u) => { setEditModal(u); setEditForm({ name: u.name, email: u.email, pass: "", precioActivacion: u.precioActivacion || precios.activacion, precioMensual: u.precioMensual || precios.mensual }); setEditErr(""); setEditShowPass(false); };
  const guardarEdicion = async () => { if (!editForm.name.trim()) { setEditErr("Nombre obligatorio."); return; } setEditSaving(true); setEditErr(""); try { const updates = { name: editForm.name.trim(), email: editForm.email.trim().toLowerCase(), precioActivacion: Number(editForm.precioActivacion) || precios.activacion, precioMensual: Number(editForm.precioMensual) || precios.mensual }; await updateDoc(doc(db, "users", editModal.uid), updates); setAllUsers(prev => prev.map(u => u.uid === editModal.uid ? { ...u, ...updates } : u)); setEditModal(null); } catch (e) { setEditErr("Error: " + e.message); } setEditSaving(false); };
  const toggleActivo = async (u) => { await updateDoc(doc(db, "users", u.uid), { active: !u.active }); setAllUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, active: !x.active } : x)); };
  const confirmarEliminar = async () => { await deleteDoc(doc(db, "users", delUser.uid)); setAllUsers(prev => prev.filter(u => u.uid !== delUser.uid)); setDelUser(null); };

  return (
    <div>
      {delUser && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "360px", textAlign: "center" }}><div style={{ fontSize: "36px", marginBottom: "10px" }}>🗑️</div><div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "6px" }}>¿Eliminar empresa?</div><div style={{ fontSize: "14px", color: C.muted, marginBottom: "1.5rem" }}>"{delUser.name}" — {delUser.email}</div><div style={{ display: "flex", gap: "10px" }}><button onClick={() => setDelUser(null)} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={confirmarEliminar} style={{ flex: 1, padding: "11px", background: C.redBg, color: C.red, border: `1px solid #4a1a1a`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>Sí, eliminar</button></div></div></div>}
      {editModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "480px" }}><div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "1.5rem" }}>✏️ Editar — {editModal.name}</div><div style={{ marginBottom: "12px" }}><label style={s.label}>Nombre</label><input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} style={s.input} /></div><div style={{ marginBottom: "12px" }}><label style={s.label}>Correo</label><input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} style={s.input} /></div><div style={{ padding: "12px", background: C.input, borderRadius: "10px", border: `1px solid ${C.border}`, marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: C.purp, marginBottom: "10px" }}>💎 Precios</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}><div><label style={s.label}>Activación $</label><input type="number" value={editForm.precioActivacion} onChange={e => setEditForm(p => ({ ...p, precioActivacion: e.target.value }))} style={s.input} /></div><div><label style={s.label}>Mensual $</label><input type="number" value={editForm.precioMensual} onChange={e => setEditForm(p => ({ ...p, precioMensual: e.target.value }))} style={s.input} /></div></div></div>{editErr && <div style={{ color: C.red, fontSize: "12px", background: C.redBg, padding: "8px 12px", borderRadius: "7px", marginBottom: "12px" }}>{editErr}</div>}<div style={{ display: "flex", gap: "10px" }}><button onClick={() => setEditModal(null)} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={guardarEdicion} disabled={editSaving} style={{ flex: 2, padding: "11px", background: C.blue, color: C.bg, border: "none", borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700", opacity: editSaving ? .7 : 1 }}>{editSaving ? "Guardando..." : "✓ Guardar"}</button></div></div></div>}

      <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[{ id: "empresas", label: "🏢 Empresas" }, { id: "ganancias", label: "💰 Mis ganancias" }, { id: "seguridad", label: "🔐 Seguridad" }].map(t => (
          <button key={t.id} onClick={() => setVistaAdmin(t.id)} style={{ padding: "9px 20px", background: vistaAdmin === t.id ? C.blue : C.card, color: vistaAdmin === t.id ? C.bg : C.muted, border: `1px solid ${vistaAdmin === t.id ? C.blue : C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: vistaAdmin === t.id ? "700" : "400" }}>{t.label}</button>
        ))}
      </div>

      {vistaAdmin === "empresas" && <>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
          {[{ label: "Registradas", val: empresas.length, color: C.blue }, { label: "Activas", val: empresas.filter(u => u.active && diasRestantes(u) > 0).length, color: C.green }, { label: "Vencidas", val: empresas.filter(u => !u.active || diasRestantes(u) < 0).length, color: C.red }, { label: "Vencen pronto", val: empresas.filter(u => { const d = diasRestantes(u); return d !== null && d >= 0 && d <= 5; }).length, color: C.orange }].map((st, i) => (
            <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "22px", fontWeight: "700", color: st.color }}>{st.val}</div></div>
          ))}
        </div>
        <div style={{ ...s.card, marginBottom: "1.25rem", borderLeft: `3px solid ${C.purp}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editPrecios ? "1rem" : "0" }}><div><div style={s.sectionTitle}>⚙️ Mis tarifas</div>{!editPrecios && <div style={{ fontSize: "12px", color: C.muted, marginTop: "-8px" }}>Activación: <span style={{ color: C.blue, fontWeight: "700" }}>{COP(precios.activacion)}</span> · Mensualidad: <span style={{ color: C.green, fontWeight: "700" }}>{COP(precios.mensual)}</span></div>}</div><button onClick={() => { if (editPrecios) { setPrecios(preciosTemp); setEditPrecios(false); } else { setPreciosTemp({ ...precios }); setEditPrecios(true); } }} style={{ padding: "7px 16px", background: editPrecios ? C.blue : C.input, color: editPrecios ? C.bg : C.muted, border: `1px solid ${editPrecios ? C.blue : C.border}`, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: "600" }}>{editPrecios ? "✓ Guardar" : "✏️ Editar"}</button></div>
          {editPrecios && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div><label style={s.label}>Activación $</label><input type="number" value={preciosTemp.activacion} onChange={e => setPreciosTemp(p => ({ ...p, activacion: Number(e.target.value) }))} style={s.input} /></div><div><label style={s.label}>Mensualidad $</label><input type="number" value={preciosTemp.mensual} onChange={e => setPreciosTemp(p => ({ ...p, mensual: Number(e.target.value) }))} style={s.input} /></div></div>}
        </div>
        <div style={{ ...s.card, marginBottom: "1.25rem", borderLeft: `3px solid ${C.blue}` }}>
          <div style={s.sectionTitle}>➕ Crear nueva empresa</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr auto", gap: "10px", alignItems: "end" }}>
            <div><label style={s.label}>Nombre *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Tienda El Sol" style={s.input} /></div>
            <div><label style={s.label}>Correo *</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="tienda@email.com" style={s.input} /></div>
            <div><label style={s.label}>Contraseña *</label><div style={{ position: "relative" }}><input type={showPass ? "text" : "password"} value={form.pass} onChange={e => setForm(p => ({ ...p, pass: e.target.value }))} placeholder="••••••" style={{ ...s.input, paddingRight: "36px" }} /><button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "14px" }}>{showPass ? "🙈" : "👁️"}</button></div></div>
            <button onClick={crearEmpresa} disabled={creating} style={{ ...s.btnGold, whiteSpace: "nowrap", opacity: creating ? .6 : 1 }}>{creating ? "Creando..." : "+ Crear"}</button>
          </div>
          {createdOk && <div style={{ color: C.green, fontSize: "12px", marginTop: "10px", background: C.greenBg, padding: "8px 12px", borderRadius: "7px" }}>{createdOk}</div>}
          {formErr && <div style={{ color: C.red, fontSize: "12px", marginTop: "10px", background: C.redBg, padding: "8px 12px", borderRadius: "7px" }}>{formErr}</div>}
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>Gestión de empresas</div>
          {empresas.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>Sin empresas aún.</div>
            : empresas.map(u => {
              const est = estadoSub(u); return (
                <div key={u.uid} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", gap: "10px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: "14px", fontWeight: "700", color: C.text }}>{u.name}</div><div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>📧 {u.email}</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "3px" }}>Vence: <span style={{ color: est.color, fontWeight: "600" }}>{u.vencimiento ? new Date(u.vencimiento).toLocaleDateString("es-CO") : "Sin fecha"}</span> · Act: <span style={{ color: C.blue }}>{COP(u.precioActivacion || precios.activacion)}</span> · Men: <span style={{ color: C.green }}>{COP(u.precioMensual || precios.mensual)}</span></div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: est.bg, color: est.color, fontWeight: "600" }}>{est.label}</span>
                      <button onClick={renovar(u)} style={{ padding: "6px 10px", background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}40`, borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>🔄 +30d</button>
                      <button onClick={() => abrirEdicion(u)} style={{ padding: "6px 10px", background: `${C.blue}18`, color: C.blue, border: `1px solid ${C.blue}40`, borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>✏️ Editar</button>
                      <button onClick={() => toggleActivo(u)} style={{ padding: "6px 10px", background: u.active ? C.redBg : C.greenBg, color: u.active ? C.red : C.green, border: `1px solid ${u.active ? "#3d1212" : "#1a4a2a"}`, borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "600", fontFamily: "inherit" }}>{u.active ? "Desactivar" : "Activar"}</button>
                      <button onClick={() => setDelUser(u)} style={{ padding: "6px 10px", background: C.redBg, color: C.red, border: `1px solid #3d1212`, borderRadius: "7px", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </>}

      {vistaAdmin === "ganancias" && <>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
          {[{ label: "Ing. activaciones", val: COP(ingresosActivacion), sub: `${totalActivaciones} × ${COP(precios.activacion)}`, color: C.blue }, { label: "Ing. mensuales", val: COP(ingresosMensual), sub: `${empresas.filter(u => u.active && diasRestantes(u) > 0).length} × ${COP(precios.mensual)}`, color: C.green }, { label: "Total estimado", val: COP(totalIngresos), sub: "Activaciones + mensualidades", color: C.blue }, { label: "Pagando ahora", val: empresas.filter(u => u.active && diasRestantes(u) > 0).length, sub: "Con suscripción vigente", color: C.purp }].map((st, i) => (
            <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "20px", fontWeight: "700", color: st.color }}>{st.val}</div><div style={{ fontSize: "10px", color: C.muted, marginTop: "4px" }}>{st.sub}</div></div>
          ))}
        </div>
        <div style={{ ...s.card, marginBottom: "1.25rem" }}><div style={{ ...s.sectionTitle, marginBottom: "4px" }}>📈 Ingresos estimados — últimos 6 meses</div><BarChart data={mesesData} color={C.blue} /></div>
        <div style={s.card}><div style={s.sectionTitle}>📋 Detalle por empresa</div>{empresas.length === 0 ? <div style={{ textAlign: "center", padding: "2rem", color: C.muted, fontSize: "13px" }}>Sin empresas.</div> : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}><thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Empresa", "Activación", "Mensual", "Vencimiento", "Estado", "Total cobrado"].map(h => <th key={h} style={{ textAlign: "left", padding: "9px 10px", color: C.muted, fontWeight: "500", fontSize: "11px" }}>{h}</th>)}</tr></thead><tbody>{empresas.map(u => { const est = estadoSub(u); const pA = u.precioActivacion || precios.activacion; const pM = u.precioMensual || precios.mensual; const mA = u.fechaActivacion ? Math.max(1, Math.ceil((new Date() - new Date(u.fechaActivacion)) / (1000 * 60 * 60 * 24 * 30))) : 0; return (<tr key={u.uid} style={{ borderBottom: `1px solid ${C.input}` }}><td style={{ padding: "11px 10px" }}><div style={{ fontWeight: "600", color: C.text }}>{u.name}</div><div style={{ fontSize: "11px", color: C.muted }}>{u.email}</div></td><td style={{ padding: "11px 10px", color: C.blue, fontWeight: "600" }}>{COP(pA)}</td><td style={{ padding: "11px 10px", color: C.green, fontWeight: "600" }}>{COP(pM)}/mes</td><td style={{ padding: "11px 10px", color: C.muted, fontSize: "12px" }}>{u.vencimiento ? new Date(u.vencimiento).toLocaleDateString("es-CO") : "—"}</td><td style={{ padding: "11px 10px" }}><span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: est.bg, color: est.color, fontWeight: "600" }}>{est.label}</span></td><td style={{ padding: "11px 10px", color: C.blue, fontWeight: "700" }}>{COP(pA + (mA * pM))}</td></tr>); })}</tbody><tfoot><tr style={{ borderTop: `2px solid ${C.border}` }}><td colSpan={5} style={{ padding: "11px 10px", color: C.muted, fontSize: "12px" }}>TOTAL COBRADO</td><td style={{ padding: "11px 10px", color: C.blue, fontWeight: "800", fontSize: "16px" }}>{COP(empresas.reduce((a, u) => { const pA = u.precioActivacion || precios.activacion; const pM = u.precioMensual || precios.mensual; const m = u.fechaActivacion ? Math.max(1, Math.ceil((new Date() - new Date(u.fechaActivacion)) / (1000 * 60 * 60 * 24 * 30))) : 0; return a + pA + (m * pM); }, 0))}</td></tr></tfoot></table>}</div>
      </>}
      {vistaAdmin === "seguridad" && <SeguridadAdmin />}
    </div>
  );
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
function Payments({ currentUser, setCurrentUser }) {
  const metodos = currentUser.metodosPago || [];
  const [nombre, setNombre] = useState(""); const [preview, setPreview] = useState(null); const [b64, setB64] = useState(null); const [saving, setSaving] = useState(false); const [addErr, setAddErr] = useState("");
  const [verQR, setVerQR] = useState(null);
  const [accionPendiente, setAccionPendiente] = useState(null); const [passInput, setPassInput] = useState(""); const [passErr, setPassErr] = useState(""); const [showPassInput, setShowPassInput] = useState(false);
  const [configurarPass, setConfigurarPass] = useState(false); const [nuevaPass, setNuevaPass] = useState(""); const [nuevaPass2, setNuevaPass2] = useState(""); const [passConfigErr, setPassConfigErr] = useState(""); const [showNuevaPass, setShowNuevaPass] = useState(false);
  const [editId, setEditId] = useState(null); const [editNombre, setEditNombre] = useState("");
  const [cambiarImgId, setCambiarImgId] = useState(null); const [newImgB64, setNewImgB64] = useState(null); const [newImgPreview, setNewImgPreview] = useState(null);
  const tienePass = !!currentUser.metodosPagoPass;

  const leerImagen = (file, onDone, setErr = setAddErr) => { if (!file) return; if (file.size > 500 * 1024) { setErr("La imagen debe ser menor a 500KB."); return; } const r = new FileReader(); r.onload = e => onDone(e.target.result); r.readAsDataURL(file); };
  // ✅ DESPUÉS — reemplaza con esto:
const hashPass = async (pass) => {
  const buf = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(pass)
  );
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, '0')).join('');
};

const guardarPassMaestra = async () => {
  if (nuevaPass.length < 4) { setPassConfigErr("Mínimo 4 caracteres."); return; }
  if (nuevaPass !== nuevaPass2) { setPassConfigErr("No coinciden."); return; }
  const hashed = await hashPass(nuevaPass);
  await updateDoc(doc(db, "users", currentUser.uid), { metodosPagoPass: hashed });
  setCurrentUser(prev => ({ ...prev, metodosPagoPass: hashed }));
  setConfigurarPass(false); setNuevaPass(""); setNuevaPass2(""); setPassConfigErr("");
};
  // ✅ DESPUÉS:
const verificarYEjecutar = async () => {
  const hashed = await hashPass(passInput);
  if (hashed !== currentUser.metodosPagoPass) { 
    setPassErr("Contraseña incorrecta."); return; 
  } setPassErr(""); const { tipo, payload } = accionPendiente; await ejecutar(tipo, payload); setAccionPendiente(null); setPassInput(""); setShowPassInput(false); };
  const ejecutar = async (tipo, payload) => { if (tipo === "eliminar") { const n = metodos.filter(m => m.id !== payload.id); await updateDoc(doc(db, "users", currentUser.uid), { metodosPago: n }); setCurrentUser(prev => ({ ...prev, metodosPago: n })); } else if (tipo === "editarNombre") { const n = metodos.map(m => m.id === payload.id ? { ...m, nombre: payload.nombre } : m); await updateDoc(doc(db, "users", currentUser.uid), { metodosPago: n }); setCurrentUser(prev => ({ ...prev, metodosPago: n })); setEditId(null); setEditNombre(""); } else if (tipo === "cambiarImg") { const n = metodos.map(m => m.id === payload.id ? { ...m, imagen: payload.imagen } : m); await updateDoc(doc(db, "users", currentUser.uid), { metodosPago: n }); setCurrentUser(prev => ({ ...prev, metodosPago: n })); setCambiarImgId(null); setNewImgB64(null); setNewImgPreview(null); } else if (tipo === "agregar") { const nv = { id: genId(), nombre: payload.nombre, imagen: payload.imagen, createdAt: new Date().toISOString() }; const n = [...metodos, nv]; await updateDoc(doc(db, "users", currentUser.uid), { metodosPago: n }); setCurrentUser(prev => ({ ...prev, metodosPago: n })); setNombre(""); setPreview(null); setB64(null); } };
  const pedirPass = (tipo, payload) => { if (!tienePass) { ejecutar(tipo, payload); return; } setAccionPendiente({ tipo, payload }); setPassInput(""); setPassErr(""); setShowPassInput(false); };
  const guardar = () => { if (!nombre.trim()) { setAddErr("Nombre obligatorio."); return; } if (!b64) { setAddErr("Sube una imagen del QR."); return; } setSaving(true); pedirPass("agregar", { nombre: nombre.trim(), imagen: b64 }); setSaving(false); };

  return (
    <div>
      {verQR && <div onClick={() => setVerQR(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><div className="modal-enter" style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", textAlign: "center", maxWidth: "320px", width: "90%" }} onClick={e => e.stopPropagation()}><div style={{ fontSize: "15px", fontWeight: "700", color: "#111", marginBottom: "12px" }}>{verQR.nombre}</div><img src={verQR.imagen} alt={verQR.nombre} style={{ width: "100%", borderRadius: "10px", display: "block" }} /><div style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>Toca fuera para cerrar</div></div></div>}
      {configurarPass && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "380px" }}><div style={{ fontSize: "22px", textAlign: "center", marginBottom: "6px" }}>🔐</div><div style={{ fontSize: "16px", fontWeight: "700", color: C.text, textAlign: "center", marginBottom: "1.5rem" }}>{tienePass ? "Cambiar contraseña" : "Configurar contraseña maestra"}</div><div style={{ marginBottom: "12px" }}><label style={s.label}>Nueva contraseña</label><div style={{ position: "relative" }}><input type={showNuevaPass ? "text" : "password"} value={nuevaPass} onChange={e => setNuevaPass(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...s.input, paddingRight: "40px" }} /><button onClick={() => setShowNuevaPass(p => !p)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "16px" }}>{showNuevaPass ? "🙈" : "👁️"}</button></div></div><div style={{ marginBottom: "14px" }}><label style={s.label}>Confirmar</label><input type="password" value={nuevaPass2} onChange={e => setNuevaPass2(e.target.value)} style={s.input} /></div>{passConfigErr && <div style={{ color: C.red, fontSize: "12px", background: C.redBg, padding: "7px 10px", borderRadius: "7px", marginBottom: "10px" }}>{passConfigErr}</div>}<div style={{ display: "flex", gap: "10px" }}><button onClick={() => { setConfigurarPass(false); setNuevaPass(""); setNuevaPass2(""); setPassConfigErr(""); }} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={guardarPassMaestra} style={{ flex: 1, padding: "11px", background: C.blue, color: C.bg, border: "none", borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>✓ Guardar</button></div></div></div>}
      {accionPendiente && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "360px", textAlign: "center" }}><div style={{ fontSize: "32px", marginBottom: "8px" }}>🔒</div><div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "4px" }}>Acción protegida</div><div style={{ fontSize: "13px", color: C.muted, marginBottom: "1.5rem" }}>{accionPendiente.tipo === "eliminar" ? `Eliminar "${accionPendiente.payload.nombre}"` : accionPendiente.tipo === "editarNombre" ? `Renombrar a "${accionPendiente.payload.nombre}"` : accionPendiente.tipo === "cambiarImg" ? "Cambiar imagen del QR" : `Agregar "${accionPendiente.payload.nombre}"`}<br /><span style={{ fontSize: "11px" }}>Ingresa la contraseña del dueño</span></div><div style={{ position: "relative", marginBottom: "12px", textAlign: "left" }}><input type={showPassInput ? "text" : "password"} value={passInput} onChange={e => setPassInput(e.target.value)} onKeyDown={e => e.key === "Enter" && verificarYEjecutar()} placeholder="Contraseña maestra" autoFocus style={{ ...s.input, paddingRight: "40px", textAlign: "center", letterSpacing: "4px", fontSize: "16px" }} /><button onClick={() => setShowPassInput(p => !p)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "16px" }}>{showPassInput ? "🙈" : "👁️"}</button></div>{passErr && <div style={{ color: C.red, fontSize: "12px", background: C.redBg, padding: "7px 10px", borderRadius: "7px", marginBottom: "12px" }}>{passErr}</div>}<div style={{ display: "flex", gap: "10px" }}><button onClick={() => { setAccionPendiente(null); setPassInput(""); setPassErr(""); setCambiarImgId(null); setNewImgB64(null); setNewImgPreview(null); }} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={verificarYEjecutar} style={{ flex: 1, padding: "11px", background: accionPendiente.tipo === "eliminar" ? C.red : C.blue, color: "#fff", border: "none", borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>{accionPendiente.tipo === "eliminar" ? "🗑️ Eliminar" : "✓ Confirmar"}</button></div></div></div>}
      {cambiarImgId && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "380px", textAlign: "center" }}><div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "1rem" }}>🔄 Cambiar imagen del QR</div><label style={{ display: "block", padding: "14px", background: C.input, border: `2px dashed ${C.border}`, borderRadius: "10px", cursor: "pointer", marginBottom: "12px" }}><input type="file" accept="image/*" onChange={e => leerImagen(e.target.files[0], data => { setNewImgPreview(data); setNewImgB64(data); })} style={{ display: "none" }} />{newImgPreview ? <img src={newImgPreview} alt="nueva" style={{ width: "160px", height: "160px", objectFit: "contain", borderRadius: "8px", display: "block", margin: "0 auto" }} /> : <div style={{ color: C.muted, fontSize: "13px" }}>📷 Selecciona imagen<br /><span style={{ fontSize: "11px" }}>Máx. 500KB</span></div>}</label><div style={{ display: "flex", gap: "10px" }}><button onClick={() => { setCambiarImgId(null); setNewImgB64(null); setNewImgPreview(null); }} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={() => newImgB64 && pedirPass("cambiarImg", { id: cambiarImgId, imagen: newImgB64 })} disabled={!newImgB64} style={{ flex: 1, padding: "11px", background: newImgB64 ? C.blue : C.border, color: newImgB64 ? C.bg : C.muted, border: "none", borderRadius: "9px", cursor: newImgB64 ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: "700" }}>✓ Continuar</button></div></div></div>}

      <div style={{ ...s.card, marginBottom: "1.25rem", borderLeft: `3px solid ${tienePass ? C.green : C.orange}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: "13px", fontWeight: "600", color: tienePass ? C.green : C.orange }}>{tienePass ? "🔐 Contraseña maestra activada" : "⚠️ Sin contraseña maestra"}</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>{tienePass ? "Tus métodos de pago están protegidos" : "Configura una contraseña para proteger tus QR"}</div></div>
        <button onClick={() => { setConfigurarPass(true); setPassInput(""); setNuevaPass(""); setNuevaPass2(""); setPassConfigErr(""); }} style={{ padding: "8px 16px", background: tienePass ? `${C.green}18` : C.orange, color: tienePass ? C.green : "#fff", border: `1px solid ${tienePass ? C.green : C.orange}`, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>{tienePass ? "🔑 Cambiar" : "🔐 Configurar"}</button>
      </div>
      <div style={{ ...s.card, marginBottom: "1.25rem", borderLeft: `3px solid ${C.blue}` }}>
        <div style={s.sectionTitle}>➕ Agregar método de pago</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}>
          <div><label style={s.label}>Nombre *</label><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nequi, Bancolombia..." style={{ ...s.input, marginBottom: "10px" }} onKeyDown={e => e.key === "Enter" && guardar()} />{addErr && <div style={{ color: C.red, fontSize: "12px", background: C.redBg, padding: "7px 10px", borderRadius: "7px", marginBottom: "8px" }}>{addErr}</div>}<button onClick={guardar} disabled={saving || !b64 || !nombre.trim()} style={{ ...s.btnGold, opacity: (saving || !b64 || !nombre.trim()) ? .5 : 1 }}>{saving ? "Guardando..." : "✓ Guardar"}</button></div>
          <div><label style={s.label}>Imagen del QR *</label><label style={{ display: "block", padding: "16px", background: C.input, border: `2px dashed ${preview ? C.blue : C.border}`, borderRadius: "12px", cursor: "pointer", textAlign: "center" }}><input type="file" accept="image/*" onChange={e => leerImagen(e.target.files[0], data => { setPreview(data); setB64(data); })} style={{ display: "none" }} />{preview ? <div><img src={preview} alt="preview" style={{ width: "140px", height: "140px", objectFit: "contain", borderRadius: "8px", display: "block", margin: "0 auto 8px" }} /><div style={{ fontSize: "11px", color: C.green }}>✓ Lista</div></div> : <div><div style={{ fontSize: "32px", marginBottom: "8px" }}>📷</div><div style={{ fontSize: "13px", color: C.muted }}>Subir QR</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}>JPG, PNG · Máx. 500KB</div></div>}</label></div>
        </div>
      </div>
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}><div style={s.sectionTitle}>💳 Métodos de pago · {metodos.length}</div></div>
        {metodos.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>Sin métodos aún.</div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "14px" }}>
            {metodos.map(m => (
              <div key={m.id} className="card-anim" style={{ background: C.input, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "1rem", textAlign: "center" }}>
                <div onClick={() => setVerQR(m)} style={{ cursor: "pointer", marginBottom: "10px" }}><img src={m.imagen} alt={m.nombre} style={{ width: "130px", height: "130px", objectFit: "contain", borderRadius: "8px", display: "block", margin: "0 auto", border: `1px solid ${C.border}` }} /></div>
                {editId === m.id ? <div style={{ marginBottom: "10px" }}><input value={editNombre} onChange={e => setEditNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pedirPass("editarNombre", { id: m.id, nombre: editNombre.trim() }); if (e.key === "Escape") setEditId(null); }} style={{ ...s.input, textAlign: "center", fontSize: "13px", marginBottom: "6px" }} autoFocus /><div style={{ display: "flex", gap: "6px", justifyContent: "center" }}><button onClick={() => pedirPass("editarNombre", { id: m.id, nombre: editNombre.trim() })} style={{ padding: "5px 12px", background: C.greenBg, color: C.green, border: `1px solid #1a4a2a`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "700", fontFamily: "inherit" }}>✓</button><button onClick={() => setEditId(null)} style={{ padding: "5px 10px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>✕</button></div></div> : <div style={{ fontSize: "14px", fontWeight: "700", color: C.text, marginBottom: "10px" }}>{m.nombre}</div>}
                <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setVerQR(m)} style={{ padding: "5px 10px", background: `${C.blue}18`, color: C.blue, border: `1px solid ${C.blue}40`, borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>🔍</button>
                  <button onClick={() => { setEditId(m.id); setEditNombre(m.nombre); }} style={{ padding: "5px 10px", background: `${C.blue}18`, color: C.blue, border: `1px solid ${C.blue}40`, borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>✏️</button>
                  <button onClick={() => setCambiarImgId(m.id)} style={{ padding: "5px 10px", background: `${C.purp}18`, color: C.purp, border: `1px solid ${C.purp}40`, borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>🔄</button>
                  <button onClick={() => pedirPass("eliminar", m)} style={{ padding: "5px 10px", background: C.redBg, color: C.red, border: `1px solid #3d1212`, borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}

// ─── VENTAS POR LOTE ─────────────────────────────────────────────────────────
function VentasLote({ currentUser, setCurrentUser }) {
  const lotes = currentUser.ventasLote || [];
  const [form, setForm] = useState({ categoria: "", cantidad: "", precio: "", nota: "" });
  const [error, setError] = useState("");
  const [delId, setDelId] = useState(null);
  const cats = ["Productos de limpieza", "Accesorios pequeños", "Ropa", "Calzado", "Comida", "Bebidas", "Papelería", "Electrónica", "Juguetes", "Otros"];
  const totalIngresos = lotes.reduce((a, l) => a + l.total, 0);
  const totalUnidades = lotes.reduce((a, l) => a + l.cantidad, 0);
  const agregar = async () => { if (!form.categoria.trim()) { setError("El nombre es obligatorio."); return; } if (!form.cantidad || Number(form.cantidad) <= 0) { setError("La cantidad debe ser mayor a 0."); return; } if (!form.precio || Number(form.precio) <= 0) { setError("El precio es obligatorio."); return; } const id = genId(); const nuevo = { id, categoria: form.categoria.trim(), cantidad: Number(form.cantidad), precio: Number(form.precio), total: Number(form.cantidad) * Number(form.precio), nota: form.nota.trim(), fecha: todayISO(), fechaTexto: today() }; const vh = { id, date: todayISO(), items: [{ name: form.categoria.trim() + (form.nota.trim() ? ` (${form.nota.trim()})` : ""), qty: Number(form.cantidad), price: Number(form.precio), cost: 0 }], total: Number(form.cantidad) * Number(form.precio), profit: Number(form.cantidad) * Number(form.precio), metodoPago: "Efectivo", metodoPagoTipo: "efectivo", esLote: true }; const nL = [...lotes, nuevo]; const nV = [...(currentUser.sales || []), vh]; await updateDoc(doc(db, "users", currentUser.uid), { ventasLote: nL, sales: nV }); setCurrentUser(prev => ({ ...prev, ventasLote: nL, sales: nV })); setForm({ categoria: "", cantidad: "", precio: "", nota: "" }); setError(""); };
  const eliminar = async () => { const nL = lotes.filter(l => l.id !== delId); const nV = (currentUser.sales || []).filter(s => s.id !== delId); await updateDoc(doc(db, "users", currentUser.uid), { ventasLote: nL, sales: nV }); setCurrentUser(prev => ({ ...prev, ventasLote: nL, sales: nV })); setDelId(null); };
  const porCategoria = lotes.reduce((acc, l) => { if (!acc[l.categoria]) acc[l.categoria] = { categoria: l.categoria, cantidad: 0, total: 0, registros: 0 }; acc[l.categoria].cantidad += l.cantidad; acc[l.categoria].total += l.total; acc[l.categoria].registros++; return acc; }, {});
  return (
    <div>
      {delId && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}><div className="modal-enter" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "360px", textAlign: "center" }}><div style={{ fontSize: "36px", marginBottom: "10px" }}>🗑️</div><div style={{ fontSize: "16px", fontWeight: "700", color: C.text, marginBottom: "6px" }}>¿Eliminar registro?</div><div style={{ fontSize: "13px", color: C.muted, marginBottom: "1.5rem" }}>No se puede deshacer.</div><div style={{ display: "flex", gap: "10px" }}><button onClick={() => setDelId(null)} style={{ flex: 1, padding: "11px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button><button onClick={eliminar} style={{ flex: 1, padding: "11px", background: C.redBg, color: C.red, border: `1px solid #4a1a1a`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: "700" }}>Sí, eliminar</button></div></div></div>}
      <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "1.25rem" }}>
        {[{ label: "Total registros", val: lotes.length, color: C.blue }, { label: "Unidades vendidas", val: totalUnidades.toLocaleString("es-CO"), color: C.blueL }, { label: "Ingresos totales", val: COP(totalIngresos), color: C.green }, { label: "Categorías", val: Object.keys(porCategoria).length, color: C.muted }].map((st, i) => (
          <div key={i} style={{ ...s.card, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: "11px", color: C.muted, marginBottom: "5px" }}>{st.label}</div><div style={{ fontSize: "20px", fontWeight: "700", color: st.color }}>{st.val}</div></div>
        ))}
      </div>
      <div style={{ ...s.card, marginBottom: "1.25rem", borderLeft: `3px solid ${C.blue}` }}>
        <div style={s.sectionTitle}>➕ Registrar venta por lote</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>{cats.map(c => <button key={c} onClick={() => setForm(p => ({ ...p, categoria: c }))} style={{ padding: "4px 10px", background: form.categoria === c ? `${C.blue}22` : C.input, color: form.categoria === c ? C.blue : C.muted, border: `1px solid ${form.categoria === c ? C.blue : C.border}`, borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>{c}</button>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr auto", gap: "10px", alignItems: "end" }} className="g2">
          <div><label style={s.label}>Categoría *</label><input value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} placeholder="Productos de limpieza" style={s.input} onKeyDown={e => e.key === "Enter" && agregar()} /></div>
          <div><label style={s.label}>Cantidad *</label><input type="number" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: e.target.value }))} placeholder="0" style={s.input} onKeyDown={e => e.key === "Enter" && agregar()} /></div>
          <div><label style={s.label}>Precio unitario *</label><input type="number" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} placeholder="0" style={s.input} onKeyDown={e => e.key === "Enter" && agregar()} />{form.precio && Number(form.precio) > 0 && <div style={{ fontSize: "10px", color: C.green, marginTop: "2px" }}>{COP(Number(form.precio))}</div>}</div>
          <div><label style={s.label}>Nota</label><input value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))} placeholder="cliente mayorista..." style={s.input} onKeyDown={e => e.key === "Enter" && agregar()} /></div>
          <button onClick={agregar} style={{ ...s.btnGold, whiteSpace: "nowrap", height: "38px" }}>+ Añadir</button>
        </div>
        {form.cantidad > 0 && form.precio > 0 && <div style={{ marginTop: "10px", padding: "10px 14px", background: `${C.green}12`, border: `1px solid ${C.green}30`, borderRadius: "9px", display: "flex", alignItems: "center", gap: "10px" }}><span>💰</span><div><div style={{ fontSize: "13px", fontWeight: "700", color: C.green }}>Total: {COP(Number(form.cantidad) * Number(form.precio))}</div><div style={{ fontSize: "11px", color: C.muted }}>{Number(form.cantidad).toLocaleString("es-CO")} × {COP(Number(form.precio))}</div></div></div>}
        {error && <div style={{ color: C.red, fontSize: "12px", marginTop: "10px", background: C.redBg, padding: "7px 10px", borderRadius: "7px" }}>{error}</div>}
      </div>
      {Object.keys(porCategoria).length > 0 && <div style={{ ...s.card, marginBottom: "1.25rem" }}><div style={s.sectionTitle}>📊 Por categoría</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "10px" }}>{Object.values(porCategoria).map((c, i) => <div key={i} style={{ background: C.input, borderRadius: "10px", padding: "12px 14px", border: `1px solid ${C.border}` }}><div style={{ fontSize: "13px", fontWeight: "700", color: C.text, marginBottom: "6px" }}>{c.categoria}</div><div style={{ fontSize: "18px", fontWeight: "800", color: C.green, marginBottom: "2px" }}>{COP(c.total)}</div><div style={{ fontSize: "11px", color: C.muted }}>{c.cantidad.toLocaleString("es-CO")} uds · {c.registros} registro{c.registros > 1 ? "s" : ""}</div></div>)}</div></div>}
      <div style={s.card}>
        <div style={{ ...s.sectionTitle, marginBottom: "1rem" }}>📋 Registros · {lotes.length}</div>
        {lotes.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: C.muted, fontSize: "13px", border: `1px dashed ${C.border}`, borderRadius: "10px" }}>Sin registros aún.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{[...lotes].reverse().map(l => <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px", background: C.input, borderRadius: "10px", border: `1px solid ${C.border}`, gap: "10px", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "180px" }}><div style={{ width: "40px", height: "40px", borderRadius: "10px", background: `${C.blue}18`, border: `1px solid ${C.blue}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>📦</div><div><div style={{ fontSize: "14px", fontWeight: "700", color: C.text }}>{l.categoria}</div><div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>{l.cantidad.toLocaleString("es-CO")} × {COP(l.precio)}{l.nota && <span style={{ marginLeft: "8px" }}>· {l.nota}</span>}</div></div></div><div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}><div style={{ textAlign: "right" }}><div style={{ fontSize: "16px", fontWeight: "800", color: C.green }}>{COP(l.total)}</div><div style={{ fontSize: "10px", color: C.muted }}>{l.fechaTexto || l.fecha}</div></div><button onClick={() => setDelId(l.id)} style={{ padding: "6px 10px", background: C.redBg, color: C.red, border: `1px solid #4a1a1a`, borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>🗑️</button></div></div>)}</div>}
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginBackground = React.memo(() => {
  const css = `@keyframes gradBG{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}@keyframes floatDot{0%{transform:translateY(0) scale(1);opacity:0}10%{opacity:.8}90%{opacity:.2}100%{transform:translateY(-100vh) scale(.5);opacity:0}}@keyframes blobMorphBG{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}33%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}66%{border-radius:50% 60% 30% 40%/30% 40% 60% 50%}}.lg-scene{position:fixed;inset:0;background:linear-gradient(-45deg,#06040f,#0e0820,#060e1a,#110830);background-size:400% 400%;animation:gradBG 14s ease infinite;overflow:hidden;pointer-events:none;z-index:0;}.lg-dot{position:absolute;border-radius:50%;animation:floatDot linear infinite;}.lg-blob-bg{position:absolute;border-radius:60% 40% 30% 70%/60% 30% 70% 40%;animation:blobMorphBG ease-in-out infinite;}`;
  const dots = [{ s: 5, l: "7%", dur: "20s", del: "0s", c: "rgba(226,201,126,.6)" }, { s: 3, l: "18%", dur: "27s", del: "4s", c: "rgba(155,127,232,.5)" }, { s: 7, l: "33%", dur: "16s", del: "8s", c: "rgba(226,201,126,.35)" }, { s: 4, l: "50%", dur: "22s", del: "2s", c: "rgba(77,157,224,.5)" }, { s: 3, l: "64%", dur: "30s", del: "11s", c: "rgba(226,201,126,.7)" }, { s: 6, l: "76%", dur: "18s", del: "5s", c: "rgba(155,127,232,.4)" }, { s: 4, l: "87%", dur: "24s", del: "7s", c: "rgba(61,214,140,.45)" }, { s: 5, l: "94%", dur: "19s", del: "1s", c: "rgba(226,201,126,.4)" }, { s: 3, l: "42%", dur: "25s", del: "13s", c: "rgba(77,157,224,.35)" }, { s: 6, l: "12%", dur: "21s", del: "9s", c: "rgba(61,214,140,.4)" }];
  return (<><style>{css}</style><div className="lg-scene">{dots.map((d, i) => <div key={i} className="lg-dot" style={{ width: `${d.s}px`, height: `${d.s}px`, left: d.l, bottom: "-10px", background: d.c, boxShadow: `0 0 ${d.s * 5}px ${d.c}`, animationDuration: d.dur, animationDelay: d.del }} />)}<div className="lg-blob-bg" style={{ width: "400px", height: "400px", top: "-100px", right: "-100px", background: "rgba(84,131,179,.04)", animationDuration: "12s" }} /><div className="lg-blob-bg" style={{ width: "300px", height: "300px", bottom: "-80px", left: "-80px", background: "rgba(155,127,232,.04)", animationDuration: "15s", animationDelay: "3s" }} /></div></>);
});

function Login({ onLogin, loading }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [err, setErr] = useState(""); const [showPass, setShowPass] = useState(false); const [mounted, setMounted] = useState(false); const [focusedField, setFocusedField] = useState("");
  const go = () => { setErr(""); onLogin(email.trim(), pass, setErr); };
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);
  const css = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=DM+Sans:wght@300;400;500&display=swap');.btn-loader{position:relative;width:60px;height:36px;margin:0 auto}.btn-loader:before{content:"";position:absolute;bottom:8px;left:22px;height:14px;width:14px;border-radius:50%;background:#021024;animation:iw-bounce .5s ease-in-out infinite alternate}.btn-loader:after{content:"";position:absolute;right:0;top:2px;height:4px;width:22px;border-radius:4px;box-shadow:0 3px 0 #021024,-17px 24px 0 #021024,-34px 46px 0 #021024;animation:iw-step 1s ease-in-out infinite}@keyframes shimmerLine{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}.lp-root *{font-family:'DM Sans',sans-serif;box-sizing:border-box;}.lp-scene{min-height:100vh;display:flex;align-items:stretch;background:transparent;position:relative;overflow:hidden;}.lp-left{flex:1.1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 2.5rem;position:relative;opacity:0;transform:translateX(-40px);transition:opacity .7s ease,transform .7s ease;}.lp-left.in{opacity:1;transform:translateX(0);}.lp-blob{position:absolute;border-radius:60% 40% 30% 70%/60% 30% 70% 40%;animation:blobMorph 10s ease-in-out infinite;pointer-events:none;}.lp-right{width:420px;flex-shrink:0;display:flex;flex-direction:column;justify-content:center;padding:3.5rem 3rem;position:relative;background:rgba(2,16,36,.6);backdrop-filter:blur(20px);border-left:1px solid rgba(193,232,255,.08);opacity:0;transform:translateX(40px);transition:opacity .7s .15s ease,transform .7s .15s ease;}.lp-right.in{opacity:1;transform:translateX(0);}.lp-inp{width:100%;padding:13px 16px;background:rgba(193,232,255,.05);border:1.5px solid rgba(125,160,202,.25);border-radius:12px;color:#c1e8ff;font-size:14px;outline:none;font-family:'DM Sans',sans-serif;transition:all .25s;}.lp-inp:focus{background:rgba(84,131,179,.12);border-color:rgba(125,160,202,.7);box-shadow:0 0 0 4px rgba(125,160,202,.1);}.lp-inp::placeholder{color:rgba(193,232,255,.25);}.lp-btn{width:100%;padding:14px;background:linear-gradient(135deg,#5483b3,#7da0ca,#5483b3);background-size:200% auto;color:#021024;font-weight:800;font-size:14px;letter-spacing:2px;border:none;border-radius:12px;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;display:flex;align-items:center;justify-content:center;min-height:50px;transition:all .3s;position:relative;overflow:hidden;}.lp-btn:hover:not(:disabled){background-position:right center;transform:translateY(-2px);box-shadow:0 10px 30px rgba(84,131,179,.4);color:#fff;}.lp-btn::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent);background-size:200%;animation:shimmerLine 2.5s linear infinite;}.lp-row{opacity:0;transform:translateY(18px);transition:opacity .45s ease,transform .45s ease;}.lp-row.in{opacity:1;transform:translateY(0);}@keyframes blobMorph{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}33%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}66%{border-radius:50% 60% 30% 40%/30% 40% 60% 50%}}@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}@keyframes floatY2{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@keyframes spinSlow{to{transform:rotate(360deg)}}@media(max-width:767px){.lp-left{display:none;}.lp-right{width:100%;border-left:none;padding:2.5rem 1.5rem;}}`;
  const shapes = [{ w: 180, h: 180, t: "10%", l: "5%", dur: "7s", del: "0s", op: .06 }, { w: 120, h: 120, t: "60%", l: "20%", dur: "9s", del: "1s", op: .04 }, { w: 80, h: 80, t: "30%", l: "70%", dur: "6s", del: "2s", op: .07 }, { w: 60, h: 60, t: "75%", l: "80%", dur: "8s", del: ".5s", op: .05 }];
  const Illustration = () => (<svg viewBox="0 0 320 280" style={{ width: "100%", maxWidth: "340px", filter: "drop-shadow(0 20px 40px rgba(84,131,179,.3))" }}><rect x="30" y="200" width="260" height="12" rx="6" fill="#5483b3" opacity=".4" /><rect x="50" y="212" width="10" height="50" rx="5" fill="#5483b3" opacity=".3" /><rect x="260" y="212" width="10" height="50" rx="5" fill="#5483b3" opacity=".3" /><g style={{ animation: "floatY 3.5s ease-in-out infinite" }}><rect x="70" y="140" width="70" height="62" rx="8" fill="#052659" stroke="#5483b3" strokeWidth="1.5" opacity=".9" /><rect x="70" y="140" width="70" height="20" rx="8" fill="#5483b3" opacity=".5" /><text x="105" y="190" textAnchor="middle" fontSize="18" opacity=".7">📦</text></g><g style={{ animation: "floatY2 4s ease-in-out infinite", animationDelay: ".8s" }}><rect x="160" y="158" width="50" height="44" rx="7" fill="#052659" stroke="#5483b3" strokeWidth="1.5" opacity=".85" /><text x="185" y="193" textAnchor="middle" fontSize="14" opacity=".7">🛒</text></g><g style={{ animation: "floatY 5s ease-in-out infinite", animationDelay: "1.2s" }}><rect x="230" y="170" width="14" height="32" rx="4" fill="#7da0ca" opacity=".5" /><rect x="248" y="155" width="14" height="47" rx="4" fill="#5483b3" opacity=".7" /><rect x="266" y="162" width="14" height="40" rx="4" fill="#7da0ca" opacity=".5" /><polyline points="230,168 248,153 266,160 276,152" stroke="#c1e8ff" strokeWidth="1.8" fill="none" opacity=".6" strokeLinecap="round" /><circle cx="276" cy="152" r="3" fill="#c1e8ff" opacity=".7" /></g><circle cx="160" cy="110" r="90" fill="none" stroke="#5483b3" strokeWidth=".8" strokeDasharray="4 6" opacity=".2" /><circle cx="160" cy="110" r="120" fill="none" stroke="#5483b3" strokeWidth=".5" strokeDasharray="2 8" opacity=".12" style={{ animation: "spinSlow 30s linear infinite", transformOrigin: "160px 110px" }} /></svg>);
  return (
    <div className="lp-root"><style>{css}</style><LoginBackground />
      <div className="lp-scene" style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", alignItems: "stretch" }}>
        {shapes.map((sh, i) => <div key={i} className="lp-blob" style={{ width: sh.w, height: sh.h, top: sh.t, left: sh.l, background: `rgba(84,131,179,${sh.op})`, animationDelay: `${i * 1.5}s`, animationDuration: `${8 + i * 2}s` }} />)}
        <div className={`lp-left${mounted ? " in" : ""}`}>
          <div style={{ position: "absolute", top: "2rem", left: "2.5rem", display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#5483b3,#7da0ca)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>📦</div><div><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "14px", fontWeight: "800", color: "#c1e8ff", letterSpacing: "1px" }}>INVENTARIO WILL</div><div style={{ fontSize: "9px", color: "rgba(193,232,255,.4)", letterSpacing: "2px" }}>GESTIÓN INTELIGENTE</div></div></div>
          <Illustration />
          <div style={{ marginTop: "2rem", textAlign: "center", maxWidth: "300px" }}><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "22px", fontWeight: "800", color: "#c1e8ff", lineHeight: 1.3, marginBottom: "10px" }}>Controla tu negocio<br /><span style={{ background: "linear-gradient(135deg,#7da0ca,#c1e8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>en tiempo real</span></div><div style={{ fontSize: "13px", color: "rgba(193,232,255,.45)", lineHeight: 1.7 }}>Inventario · Ventas · Reportes · QR</div></div>
        </div>
        <div className={`lp-right${mounted ? " in" : ""}`}>
          {[
            <div key="t" className={`lp-row${mounted ? " in" : ""}`} style={{ transitionDelay: ".3s", marginBottom: "2rem" }}><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "28px", fontWeight: "900", color: "#c1e8ff", marginBottom: "6px" }}>Bienvenido 👋</div><div style={{ fontSize: "13px", color: "rgba(193,232,255,.4)" }}>Ingresa con tus credenciales para continuar</div></div>,
            <div key="e" className={`lp-row${mounted ? " in" : ""}`} style={{ transitionDelay: ".4s", marginBottom: "14px" }}><label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "rgba(125,160,202,.8)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "8px" }}>Correo electrónico</label><div style={{ position: "relative" }}><input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="tu@correo.com" className="lp-inp" onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField("")} /><span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", opacity: focusedField === "email" ? .8 : .3 }}>✉️</span></div></div>,
            <div key="p" className={`lp-row${mounted ? " in" : ""}`} style={{ transitionDelay: ".5s", marginBottom: "22px" }}><label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "rgba(125,160,202,.8)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "8px" }}>Contraseña</label><div style={{ position: "relative" }}><input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} placeholder="••••••••" className="lp-inp" style={{ paddingRight: "48px" }} onFocus={() => setFocusedField("pass")} onBlur={() => setFocusedField("")} /><button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: "13px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: showPass ? "#7da0ca" : "rgba(193,232,255,.3)", fontSize: "16px", lineHeight: 1, padding: 0 }}>{showPass ? "🙈" : "👁️"}</button></div></div>,
            err ? <div key="err" className={`lp-row${mounted ? " in" : ""}`} style={{ transitionDelay: ".55s", marginBottom: "14px", padding: "11px 14px", background: "rgba(241,108,108,.1)", border: "1px solid rgba(241,108,108,.3)", borderRadius: "11px", fontSize: "13px", color: "#f89090", display: "flex", alignItems: "center", gap: "8px" }}><span>⚠️</span>{err}</div> : null,
            <div key="btn" className={`lp-row${mounted ? " in" : ""}`} style={{ transitionDelay: ".6s", marginBottom: "1.5rem" }}><button onClick={go} disabled={loading} className="lp-btn">{loading ? <div className="btn-loader" /> : "INGRESAR →"}</button></div>,
            <div key="sec" className={`lp-row${mounted ? " in" : ""}`} style={{ transitionDelay: ".65s" }}><div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}><div style={{ flex: 1, height: "1px", background: "rgba(193,232,255,.1)" }} /><span style={{ fontSize: "11px", color: "rgba(193,232,255,.25)", letterSpacing: "1px" }}>SEGURO Y CIFRADO</span><div style={{ flex: 1, height: "1px", background: "rgba(193,232,255,.1)" }} /></div><div style={{ display: "flex", justifyContent: "center", gap: "1.5rem" }}>{[["🔒", "SSL"], ["☁️", "Cloud"], ["⚡", "Rápido"]].map(([icon, label], i) => <div key={i} style={{ textAlign: "center" }}><div style={{ fontSize: "18px", marginBottom: "3px" }}>{icon}</div><div style={{ fontSize: "10px", color: "rgba(193,232,255,.3)", letterSpacing: "1px" }}>{label}</div></div>)}</div></div>,
            <div key="ft" className={`lp-row${mounted ? " in" : ""}`} style={{ transitionDelay: ".7s", marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(193,232,255,.07)" }}><div style={{ fontSize: "11px", color: "rgba(193,232,255,.2)", textAlign: "center" }}>Contacta al administrador para obtener acceso</div></div>,
          ]}
        </div>
      </div>
    </div>
  );
}

// ─── ASISTENTE IA ─────────────────────────────────────────────────────────────
function AsistenteIA({ currentUser }) {
  const [abierto, setAbierto] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "¡Hola! 👋 Soy tu asesor de precios. Puedo calcular precios, analizar márgenes y darte estrategias. ¿En qué te ayudo?" }]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(() => { if (abierto && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" }); }, [msgs, abierto]);
  const productos = currentUser?.products || [];
  const ventas = currentUser?.sales || [];
  const responder = (txt) => {
    const q = txt.toLowerCase();
    const nums = q.match(/\d[\d.,]*/g) || [];
    const n0 = nums.length > 0 ? Number(nums[0].replace(/[.,]/g, "")) : 0;
    const mM = q.match(/(\d+)\s*(%|por\s*ciento)/);
    const margen = mM ? Number(mM[1]) : 40;
    if (n0 > 0 && (q.includes("cuesta") || q.includes("costo") || q.includes("vale") || q.includes("cuanto vendo") || q.includes("precio") && q.includes("vender"))) {
      const p = Math.ceil(n0 / (1 - margen / 100) / 100) * 100;
      return `💡 Con costo ${COP(n0)} y margen ${margen}%:\n\n📌 Precio: ${COP(p)}\n💰 Ganancia: ${COP(p - n0)}\n\nOtras opciones:\n• 30% → ${COP(Math.ceil(n0 / 0.7 / 100) * 100)}\n• 40% → ${COP(Math.ceil(n0 / 0.6 / 100) * 100)}\n• 50% → ${COP(Math.ceil(n0 / 0.5 / 100) * 100)}`;
    }
    if (q.includes("margen") || q.includes("analiz") || q.includes("recomend")) {
      if (!productos.length) return "📦 Sin productos aún.";
      const prods = productos.map(p => { const mg = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0; return { ...p, mg, e: mg >= 40 ? "🟢" : mg >= 30 ? "🟡" : mg >= 20 ? "🟠" : "🔴" }; });
      const lista = prods.map(p => `${p.e} ${p.name}: ${p.mg}%`).join("\n");
      const mgP = Math.round(prods.reduce((a, p) => a + p.mg, 0) / prods.length);
      const bajos = prods.filter(p => p.mg < 30);
      let r = ""; if (bajos.length) r = "\n\n🔧 Subir:\n" + bajos.map(p => `• ${p.name} → ${COP(Math.ceil(p.cost / 0.6 / 100) * 100)}`).join("\n");
      return `📊 ${productos.length} productos:\n${lista}\n\nMargen prom: ${mgP}%${r}`;
    }
    if (q.includes("mejor") || q.includes("rentable")) {
      if (!productos.length) return "📦 Sin productos.";
      const s = [...productos].sort((a, b) => (b.price - b.cost) - (a.price - a.cost));
      return `🏆 Más rentable: ${s[0].name} — ${COP(s[0].price - s[0].cost)}\n⚠️ Menos rentable: ${s[s.length - 1].name} — ${COP(s[s.length - 1].price - s[s.length - 1].cost)}`;
    }
    if (q.includes("ventas") || q.includes("gané") || q.includes("resumen")) {
      const tv = ventas.reduce((a, s) => a + s.total, 0), tg = ventas.reduce((a, s) => a + s.profit, 0);
      return `📈 Resumen:\n🛒 ${ventas.length} ventas\n💵 ${COP(tv)}\n💰 ${COP(tg)} ganancia\n📊 Margen: ${tv > 0 ? Math.round((tg / tv) * 100) : 0}%`;
    }
    const tips = ["💡 Regla: nunca vendas con menos del 30% de margen. Lo ideal es 40-50%.\n\nPregúntame:\n• \"Me cuesta $8.000 ¿a cuánto vendo?\"\n• \"Analiza mis márgenes\"", "📌 Truco: multiplica el costo × 1.7 para ~40% de margen.", "🎯 El producto más vendido no siempre es el más rentable. Di \"analiza mis márgenes\"."];
    return tips[Math.floor(Math.random() * tips.length)];
  };
  const enviar = () => { const t = input.trim(); if (!t) return; setMsgs(p => [...p, { role: "user", content: t }, { role: "assistant", content: responder(t) }]); setInput(""); };
  const sug = ["Me cuesta $8.000 ¿a cuánto vendo?", "Analiza mis márgenes", "¿Qué producto da más ganancia?", "Resumen de ventas"];
  return (
    <>
      
      {abierto && (
        <div className="modal-enter" style={{ position: "fixed", bottom: "90px", right: "24px", width: "360px", height: "520px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "18px", boxShadow: "0 8px 40px rgba(0,0,0,.4)", display: "flex", flexDirection: "column", zIndex: 999, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "10px", background: C.sidebar }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: `${C.blue}22`, border: `1px solid ${C.blue}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>💰</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "700", color: C.text }}>Asesor de Precios</div>
              <div style={{ fontSize: "10px", color: C.green }}>● Gratis · Sin internet · Instantáneo</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "88%", padding: "10px 13px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: m.role === "user" ? C.blue : C.input, color: m.role === "user" ? C.bg : C.text, fontSize: "12.5px", lineHeight: "1.6", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          {msgs.length <= 1 && (
            <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {sugerencias.map((sg, i) => (
                <button key={i} onClick={() => setInput(sg)} style={{ padding: "5px 10px", background: C.input, color: C.muted, border: `1px solid ${C.border}`, borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>{sg}</button>
              ))}
            </div>
          )}
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Ej: me cuesta $5.000 ¿a cuánto vendo?" rows={1}
              style={{ flex: 1, padding: "9px 12px", background: C.input, border: `1px solid ${C.border}`, borderRadius: "10px", color: C.text, fontSize: "12.5px", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: "1.4", maxHeight: "80px", overflowY: "auto" }} />
            <button onClick={enviar} disabled={!input.trim()} style={{ width: "36px", height: "36px", borderRadius: "10px", background: input.trim() ? C.blue : C.border, color: input.trim() ? C.bg : C.muted, border: "none", cursor: input.trim() ? "pointer" : "not-allowed", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);

  Object.assign(C, darkMode ? DARK : LIGHT);
  s = mkS();

  useEffect(() => {
    if (!document.getElementById("iw-global")) { const el = document.createElement("style"); el.id = "iw-global"; el.textContent = GLOBAL_CSS; document.head.appendChild(el); }
  }, []);
  useEffect(() => { document.body.style.background = C.bg; }, [darkMode]);

  // ✅ REEMPLAZA el useEffect de onAuthStateChanged:
const SESSION_DURACION = 8 * 60 * 60 * 1000; // 8 horas

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      // Verificar expiración de sesión
      const loginTime = localStorage.getItem('loginTime');
      if (loginTime && Date.now() - Number(loginTime) > SESSION_DURACION) {
        await signOut(auth);
        localStorage.removeItem('loginTime');
        setCurrentUser(null);
        setAuthLoading(false);
        return;
      }
      if (!loginTime) localStorage.setItem('loginTime', String(Date.now()));

      const snap = await getDoc(doc(db, "users", fbUser.uid));
      if (snap.exists()) {
        const profile = snap.data();
        if (!profile.active) {
          await signOut(auth);
          setCurrentUser(null);
          setAuthLoading(false);
          return;
        }
        setCurrentUser(profile);
        if (profile.role === "admin") {
          const q = await getDocs(collection(db, "users"));
          setAllUsers(q.docs.map(d => d.data()));
        }
      } else {
        await signOut(auth);
      }
    } else {
      setCurrentUser(null);
    }
    setAuthLoading(false);
  });
  return () => unsub();
}, []);

useEffect(() => {
  if (currentUser?.role !== "admin") return;
  const unsub = onSnapshot(collection(db, "users"), (snap) => {
    setAllUsers(snap.docs.map(d => d.data()));
  });
  return () => unsub();
}, [currentUser?.role]);
 // ✅ REEMPLAZA handleLogin con esto:
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

const checkBloqueado = () => {
  try {
    const datos = JSON.parse(localStorage.getItem('loginBlock') || '{}');
    if (datos.intentos >= MAX_INTENTOS) {
      const restante = datos.tiempo + BLOQUEO_MS - Date.now();
      if (restante > 0) {
        const mins = Math.ceil(restante / 60000);
        throw new Error(`Demasiados intentos. Espera ${mins} minuto(s).`);
      } else {
        localStorage.removeItem('loginBlock');
      }
    }
  } catch (e) {
    if (e.message.includes('Demasiados')) throw e;
  }
};

const registrarIntento = () => {
  const datos = JSON.parse(localStorage.getItem('loginBlock') || '{}');
  const intentos = (datos.intentos || 0) + 1;
  localStorage.setItem('loginBlock', JSON.stringify({
    intentos,
    tiempo: Date.now()
  }));
};

const limpiarIntentos = () => localStorage.removeItem('loginBlock');

const handleLogin = async (email, pass, setErr) => {
  setLoginLoading(true);
  try {
    checkBloqueado();
    await signInWithEmailAndPassword(auth, email, pass);
    limpiarIntentos();
  } catch (e) {
    if (e.message.includes('Demasiados')) {
      setErr(e.message);
    } else if (["auth/user-not-found", "auth/wrong-password", 
                 "auth/invalid-credential"].includes(e.code)) {
      registrarIntento();
      const datos = JSON.parse(localStorage.getItem('loginBlock') || '{}');
      const restantes = MAX_INTENTOS - (datos.intentos || 0);
      setErr(restantes > 0 
        ? `Correo o contraseña incorrectos. ${restantes} intento(s) restante(s).`
        : `Cuenta bloqueada 15 minutos.`
      );
    } else {
      setErr("Error al iniciar sesión: " + e.message);
    }
  }
  setLoginLoading(false);
};
  // ✅ REEMPLAZA handleLogout:
const handleLogout = async () => {
  await signOut(auth);
  localStorage.removeItem('loginTime');
  localStorage.removeItem('loginBlock');
  setCurrentUser(null);
  setPage("dashboard");
};

  const setProducts = async (fn) => {
    const newProds = typeof fn === "function" ? fn(currentUser.products || []) : fn;
    await updateDoc(doc(db, "users", currentUser.uid), { products: newProds });
  };
  const setSalesData = async (fn) => {
    const newSales = typeof fn === "function" ? fn(currentUser.sales || []) : fn;
    await updateDoc(doc(db, "users", currentUser.uid), { sales: newSales });
  };
  const handleSale = async (sale, cart) => {
    const newSales = [...(currentUser.sales || []), sale];
    const newProducts = (currentUser.products || []).map(p => { const ci = cart.find(c => c.id === p.id); return ci ? { ...p, qty: p.qty - ci.qty } : p; });
    await updateDoc(doc(db, "users", currentUser.uid), { sales: newSales, products: newProducts });
  };
  const handleDeleteSale = async (sale) => {
    const newSales = (currentUser.sales || []).filter(s => s.id !== sale.id);
    const newProducts = (currentUser.products || []).map(p => { const item = sale.items.find(it => it.name === p.name); return item ? { ...p, qty: p.qty + item.qty } : p; });
    await updateDoc(doc(db, "users", currentUser.uid), { sales: newSales, products: newProducts });
  };

  const titles = { dashboard: "Inicio", pos: "Punto de Venta", products: "Productos", sales: "Ventas", ventaslote: "Ventas por Lote", reports: "Reportes", payments: "Métodos de Pago", admin: "Administrador" };

  if (authLoading) return <Spinner text="Iniciando Inventario Will..." />;
  if (!currentUser) return <div className={darkMode ? "" : "theme-all"}><Login onLogin={handleLogin} loading={loginLoading} /></div>;

  const products = currentUser.products || [];
  const sales = currentUser.sales || [];

  return (
    <div className={darkMode ? "" : "theme-all"} style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        /* Desktop */
        @media(min-width:768px){
          .iw-topbar { display: flex !important; }
          .iw-main { padding: 1.75rem !important; padding-top: 74px !important; }
        }
        /* Mobile */
        @media(max-width:767px){
          .iw-main { margin-left: 0 !important; padding: 0.9rem !important; padding-top: 66px !important; padding-bottom: 1.5rem !important; }
        }
      `}</style>

      <Sidebar page={page} setPage={handleSetPage} user={currentUser} onLogout={handleLogout} darkMode={darkMode} toggleTheme={toggleTheme} open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* ── Topbar (visible en TODOS los tamaños) ── */}
      <div className="iw-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "58px", background: C.sidebar, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1rem", zIndex: 15, gap: "10px" }}>

        {/* Hamburguesa — abre/cierra en PC y móvil */}
        <button onClick={() => setSidebarOpen(o => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex", flexDirection: "column", gap: "5px", flexShrink: 0, width: "36px", height: "36px", alignItems: "center", justifyContent: "center" }}>
          {sidebarOpen ? (
            <>
              <span style={{ display: "block", width: "22px", height: "2.5px", background: C.blue, borderRadius: "2px", transform: "rotate(45deg) translate(5px,5px)", transition: "all .25s" }} />
              <span style={{ display: "block", width: "0", height: "2.5px", background: "transparent", transition: "all .25s" }} />
              <span style={{ display: "block", width: "22px", height: "2.5px", background: C.blue, borderRadius: "2px", transform: "rotate(-45deg) translate(5px,-5px)", transition: "all .25s" }} />
            </>
          ) : (
            <>
              <span style={{ display: "block", width: "22px", height: "2.5px", background: C.blue, borderRadius: "2px", transition: "all .25s" }} />
              <span style={{ display: "block", width: "15px", height: "2.5px", background: C.blue, borderRadius: "2px", transition: "all .25s", alignSelf: "flex-start" }} />
              <span style={{ display: "block", width: "22px", height: "2.5px", background: C.blue, borderRadius: "2px", transition: "all .25s" }} />
            </>
          )}
        </button>

        {/* Logo / Título */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: C.text }}>{titles[page]}</div>
          <div style={{ fontSize: "10px", color: C.muted }}>{currentUser.name}</div>
        </div>

        {/* Botón acción rápida */}
        {page !== "pos" && currentUser.role !== "admin"
          ? <button onClick={() => handleSetPage("pos")} style={{ background: `${C.blue}22`, border: `1px solid ${C.blue}55`, borderRadius: "8px", padding: "7px 12px", color: C.blue, fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>🛒</button>
          : <div style={{ width: "36px" }} />
        }
      </div>

      {/* ── Contenido principal ── */}
      <main className="iw-main" style={{ marginLeft: sidebarOpen ? "240px" : "0", padding: "1.75rem", paddingTop: "74px", minHeight: "100vh", background: C.bg, transition: "margin-left .3s cubic-bezier(.4,0,.2,1)" }}>
        <div style={{ maxWidth: "1200px" }}>
          {/* Header desktop */}
          <div className="hide-mobile" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: C.text }}>{titles[page]}</div>
              <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>{today()} · {currentUser.name}</div>
            </div>
            {page !== "pos" && currentUser.role !== "admin" && (
              <button onClick={() => handleSetPage("pos")} style={{ ...s.btnGold, display: "flex", alignItems: "center", gap: "6px" }}>🛒 Nueva venta</button>
            )}
          </div>

          <div key={animKey} className="page-enter">
            {page === "dashboard" && <Dashboard products={products} sales={sales} setPage={handleSetPage} isAdmin={currentUser.role === "admin"} allUsers={allUsers} />}
            {page === "pos" && <POS products={products} setProducts={setProducts} onSale={handleSale} metodosPago={currentUser.metodosPago || []} />}
            {page === "products" && <Products products={products} setProducts={setProducts} />}
            {page === "sales" && <Sales sales={sales} onDelete={handleDeleteSale} />}
            {page === "ventaslote" && currentUser.role !== "admin" && <VentasLote currentUser={currentUser} setCurrentUser={setCurrentUser} />}
            {page === "reports" && <Reports sales={sales} products={products} />}
            {page === "payments" && currentUser.role !== "admin" && <Payments currentUser={currentUser} setCurrentUser={setCurrentUser} />}
            {page === "admin" && currentUser.role === "admin" && <AdminPanel allUsers={allUsers} setAllUsers={setAllUsers} />}
          </div>
        </div>
      </main>
      {currentUser.role !== "admin" && <AsistenteIA currentUser={currentUser} />}
    </div>
  );
}
