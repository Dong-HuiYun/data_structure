import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════
//  資料結構：GPS 點 → 雙向鏈結串列 → AVL 樹節點 → AVL 樹
// ═══════════════════════════════════════════════════════
class GPSPoint {
  constructor(lat, lng, speed, heading, timestamp) {
    this.lat = lat; this.lng = lng; this.speed = speed;
    this.heading = heading; this.timestamp = timestamp;
    this.prev = null; this.next = null;
  }
}

class DoublyLinkedList {
  constructor(maxSize = 40) {
    this.head = null; this.tail = null; this.size = 0; this.maxSize = maxSize;
  }
  append(lat, lng, speed, heading, timestamp) {
    const node = new GPSPoint(lat, lng, speed, heading, timestamp);
    if (!this.tail) { this.head = this.tail = node; }
    else { node.prev = this.tail; this.tail.next = node; this.tail = node; }
    this.size++;
    if (this.size > this.maxSize) { this.head = this.head.next; if (this.head) this.head.prev = null; this.size--; }
    return node;
  }
  toArray() {
    const a = []; let c = this.head;
    while (c) { a.push(c); c = c.next; }
    return a;
  }
  getLastK(k) { const a = this.toArray(); return a.slice(Math.max(0, a.length - k)); }
}

class AVLNode {
  constructor(vehicleId, color, routeIdx) {
    this.vehicleId = vehicleId; this.color = color; this.routeIdx = routeIdx;
    this.trajectory = new DoublyLinkedList(40);
    this.height = 1; this.left = null; this.right = null;
    this.alerts = []; this.status = "normal"; this.totalAlerts = 0;
    this.maxSpeed = 0; this.avgSpeed = 0; this.speedSamples = 0;
  }
}

class AVLTree {
  constructor() { this.root = null; this.size = 0; this.rotations = 0; }
  _h(n) { return n ? n.height : 0; }
  _bf(n) { return n ? this._h(n.left) - this._h(n.right) : 0; }
  _upd(n) { n.height = 1 + Math.max(this._h(n.left), this._h(n.right)); }
  _rotR(y) { const x = y.left, T = x.right; x.right = y; y.left = T; this._upd(y); this._upd(x); this.rotations++; return x; }
  _rotL(x) { const y = x.right, T = y.left; y.left = x; x.right = T; this._upd(x); this._upd(y); this.rotations++; return y; }
  _bal(n) {
    this._upd(n); const bf = this._bf(n);
    if (bf > 1) { if (this._bf(n.left) < 0) n.left = this._rotL(n.left); return this._rotR(n); }
    if (bf < -1) { if (this._bf(n.right) > 0) n.right = this._rotR(n.right); return this._rotL(n); }
    return n;
  }
  _ins(node, id, color, ri) {
    if (!node) { this.size++; return new AVLNode(id, color, ri); }
    if (id < node.vehicleId) node.left = this._ins(node.left, id, color, ri);
    else if (id > node.vehicleId) node.right = this._ins(node.right, id, color, ri);
    return this._bal(node);
  }
  insert(id, color, ri) { this.root = this._ins(this.root, id, color, ri); }
  _minNode(n) { while (n.left) n = n.left; return n; }
  _del(node, id) {
    if (!node) return null;
    if (id < node.vehicleId) node.left = this._del(node.left, id);
    else if (id > node.vehicleId) node.right = this._del(node.right, id);
    else {
      if (!node.left || !node.right) { this.size--; return node.left || node.right; }
      const succ = this._minNode(node.right);
      node.vehicleId = succ.vehicleId; node.color = succ.color;
      node.trajectory = succ.trajectory; node.alerts = succ.alerts;
      node.status = succ.status; node.routeIdx = succ.routeIdx;
      node.totalAlerts = succ.totalAlerts; node.maxSpeed = succ.maxSpeed;
      node.avgSpeed = succ.avgSpeed; node.speedSamples = succ.speedSamples;
      node.right = this._del(node.right, succ.vehicleId); this.size++;
    }
    return this._bal(node);
  }
  delete(id) { this.root = this._del(this.root, id); }
  search(id) { let c = this.root; while (c) { if (id === c.vehicleId) return c; c = id < c.vehicleId ? c.left : c.right; } return null; }
  _col(n, a) { if (!n) return; this._col(n.left, a); a.push(n); this._col(n.right, a); }
  getAll() { const a = []; this._col(this.root, a); return a; }
  getTree() {
    const nodes = [], edges = [];
    const trav = (n, x, y, sp) => {
      if (!n) return;
      nodes.push({ id: n.vehicleId, x, y, h: n.height, bf: this._bf(n), color: n.color, status: n.status, alerts: n.totalAlerts });
      if (n.left) { const lx = x - sp, ly = y + 72; edges.push({ x1: x, y1: y, x2: lx, y2: ly }); trav(n.left, lx, ly, sp / 2); }
      if (n.right) { const rx = x + sp, ry = y + 72; edges.push({ x1: x, y1: y, x2: rx, y2: ry }); trav(n.right, rx, ry, sp / 2); }
    };
    trav(this.root, 340, 44, 150);
    return { nodes, edges };
  }
  detectAnomaly(id) {
    const n = this.search(id); if (!n) return null;
    const last = n.trajectory.getLastK(6);
    if (last.length < 3) return null;
    for (let i = 1; i < last.length; i++) {
      const dv = Math.abs(last[i].speed - last[i-1].speed);
      const dt = Math.max(0.001, (last[i].timestamp - last[i-1].timestamp) / 1000);
      const acc = dv / dt;
      if (acc > 16) return { type: last[i].speed < last[i-1].speed ? "急煞車" : "急加速", acc: acc.toFixed(1), speed: last[i].speed, severity: acc > 25 ? "high" : "mid" };
      if (last[i].speed > 120) return { type: "超速", speed: last[i].speed, severity: last[i].speed > 140 ? "high" : "mid" };
    }
    if (last.length >= 4) {
      const b = [];
      for (let i = 1; i < last.length; i++) b.push(Math.atan2(last[i].lng - last[i-1].lng, last[i].lat - last[i-1].lat) * 180 / Math.PI);
      let zz = 0;
      for (let i = 1; i < b.length; i++) { let d = Math.abs(b[i]-b[i-1]); if (d>180) d=360-d; if (d>55) zz++; }
      if (zz >= 2) return { type: "蛇行", severity: "mid", speed: last[last.length-1].speed };
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════
//  常數 & 路網
// ═══════════════════════════════════════════════════════
const COLORS = ["#38bdf8","#4ade80","#fb923c","#f472b6","#c084fc","#34d399","#fbbf24","#60a5fa","#f87171","#a78bfa","#2dd4bf","#e879f9"];
let _ci = 0; const nextColor = () => COLORS[_ci++ % COLORS.length];

const MAP_W = 600, MAP_H = 420;
const LAT_MIN = 24.96, LAT_MAX = 25.09, LNG_MIN = 121.49, LNG_MAX = 121.64;
const toX = lng => ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W;
const toY = lat => MAP_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_H;

const ROUTES = [
  [[25.04,121.51],[25.043,121.526],[25.048,121.543],[25.053,121.558],[25.058,121.573],[25.062,121.59]],
  [[24.975,121.535],[24.988,121.541],[25.002,121.547],[25.016,121.551],[25.030,121.556],[25.042,121.560]],
  [[25.022,121.500],[25.027,121.516],[25.032,121.531],[25.037,121.546],[25.042,121.561],[25.047,121.576]],
  [[25.065,121.510],[25.058,121.524],[25.051,121.539],[25.044,121.554],[25.037,121.569],[25.030,121.584]],
  [[24.982,121.558],[24.993,121.552],[25.004,121.547],[25.015,121.542],[25.026,121.537],[25.037,121.532]],
  [[25.010,121.505],[25.018,121.518],[25.026,121.531],[25.034,121.544],[25.042,121.557],[25.050,121.570]],
  [[25.070,121.540],[25.063,121.548],[25.056,121.556],[25.049,121.564],[25.042,121.572],[25.035,121.580]],
];

function lerp(route, t) {
  const n = route.length - 1;
  const s = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - s;
  const a = route[s], b = route[s+1];
  return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
}

const SEVERITY_COLOR = { high: "#ef4444", mid: "#f97316", low: "#eab308" };
const TYPE_ICON = { "超速": "⚡", "急煞車": "🛑", "急加速": "🚀", "蛇行": "〰️" };

// ═══════════════════════════════════════════════════════
//  子元件
// ═══════════════════════════════════════════════════════

function Speedometer({ speed, color, maxSpeed }) {
  const radius = 44, cx = 56, cy = 56;
  const startAngle = -220, endAngle = 40;
  const range = endAngle - startAngle;
  const pct = Math.min(speed / (maxSpeed || 160), 1);
  const angle = startAngle + pct * range;
  const toRad = d => d * Math.PI / 180;
  const nx = cx + radius * Math.cos(toRad(angle));
  const ny = cy + radius * Math.sin(toRad(angle));
  // arc path
  const arcStart = cx + radius * Math.cos(toRad(startAngle));
  const arcStartY = cy + radius * Math.sin(toRad(startAngle));
  const arcEnd = cx + radius * Math.cos(toRad(endAngle));
  const arcEndY = cy + radius * Math.sin(toRad(endAngle));
  const fillEnd = cx + radius * Math.cos(toRad(angle));
  const fillEndY = cy + radius * Math.sin(toRad(angle));
  const largeArc = (angle - startAngle) > 180 ? 1 : 0;
  return (
    <svg width="112" height="80" viewBox="0 0 112 80">
      <path d={`M${arcStart},${arcStartY} A${radius},${radius} 0 1,1 ${arcEnd},${arcEndY}`} fill="none" stroke="#1e293b" strokeWidth="6" strokeLinecap="round"/>
      <path d={`M${arcStart},${arcStartY} A${radius},${radius} 0 ${largeArc},1 ${fillEnd},${fillEndY}`} fill="none" stroke={speed > 120 ? "#ef4444" : color} strokeWidth="6" strokeLinecap="round"/>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="4" fill={color}/>
      <text x={cx} y={cy+18} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{Math.round(speed)}</text>
      <text x={cx} y={cy+27} textAnchor="middle" fill="#64748b" fontSize="6">km/h</text>
    </svg>
  );
}

function DLLVisualizer({ points, color }) {
  if (!points || points.length === 0) return <div style={{ color: "#334155", fontSize: 10, padding: "8px 0" }}>暫無資料</div>;
  const show = points.slice(-6);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", padding: "4px 0" }}>
      {show.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ background: "#0f172a", border: `1px solid ${color}55`, borderRadius: 6, padding: "4px 6px", minWidth: 70, position: "relative" }}>
            {i === show.length - 1 && <div style={{ position: "absolute", top: -4, right: -4, width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }}/>}
            <div style={{ fontSize: 7, color: "#475569", marginBottom: 1 }}>GPS #{show.length - 1 - i === 0 ? "最新" : `t-${show.length-1-i}`}</div>
            <div style={{ fontSize: 8, color: "#94a3b8" }}>{p.lat.toFixed(3)}</div>
            <div style={{ fontSize: 8, color: "#94a3b8" }}>{p.lng.toFixed(3)}</div>
            <div style={{ fontSize: 9, color: p.speed > 120 ? "#ef4444" : color, fontWeight: "bold" }}>{Math.round(p.speed)} km/h</div>
          </div>
          {i < show.length - 1 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
              <div style={{ fontSize: 8, color: "#334155" }}>⇄</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ data, color, w = 200, h = 32 }) {
  if (data.length < 2) return null;
  const maxV = Math.max(...data, 140);
  const pts = data.map((v, i) => `${(i/(data.length-1))*(w-4)+2},${h-2-(v/maxV)*(h-4)}`).join(" ");
  const fillPts = `2,${h-2} ${pts} ${(w-2)},${h-2}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`sg${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <line x1="2" y1={h-2-(120/maxV)*(h-4)} x2={w-2} y2={h-2-(120/maxV)*(h-4)} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3"/>
      <polygon points={fillPts} fill={`url(#sg${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StatCard({ label, value, unit, accent, sub }) {
  return (
    <div style={{ background: "#0f172a", border: `1px solid ${accent}22`, borderRadius: 8, padding: "8px 12px", flex: 1 }}>
      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: "bold", color: accent, lineHeight: 1 }}>{value}<span style={{ fontSize: 10, color: "#64748b", marginLeft: 3 }}>{unit}</span></div>
      {sub && <div style={{ fontSize: 8, color: "#334155", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  主元件
// ═══════════════════════════════════════════════════════
export default function App() {
  const treeRef = useRef(new AVLTree());
  const simRef = useRef({});
  const alertIdRef = useRef(0);
  const totalAlertCountRef = useRef(0);
  const [vehicles, setVehicles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [treeData, setTreeData] = useState({ nodes: [], edges: [] });
  const [tab, setTab] = useState("map");
  const [rightTab, setRightTab] = useState("detail");
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ total: 0, alerts: 0, avgSpeed: 0, maxSpeed: 0, rotations: 0, treeHeight: 0 });
  const [heatPoints, setHeatPoints] = useState([]);
  const [newAlertId, setNewAlertId] = useState(null);
  const animRef = useRef(null);

  const buildSnapshot = useCallback(() => {
    const tree = treeRef.current;
    const all = tree.getAll();
    const snap = all.map(v => ({
      id: v.vehicleId, color: v.color, status: v.status,
      traj: v.trajectory.toArray().map(p => ({ lat: p.lat, lng: p.lng, speed: p.speed, heading: p.heading, ts: p.timestamp })),
      alerts: [...v.alerts], totalAlerts: v.totalAlerts,
      maxSpeed: v.maxSpeed, avgSpeed: v.avgSpeed,
    }));
    setVehicles(snap);
    setTreeData(tree.getTree());
    const speeds = all.filter(v => v.speedSamples > 0).map(v => v.avgSpeed);
    setStats({
      total: all.length,
      alerts: all.filter(v => v.status === "alert").length,
      avgSpeed: speeds.length ? Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length) : 0,
      maxSpeed: Math.round(Math.max(0, ...all.map(v => v.maxSpeed))),
      rotations: tree.rotations,
      treeHeight: tree.root?.height ?? 0,
    });
    // heatmap: collect recent positions
    const pts = [];
    all.forEach(v => { v.trajectory.getLastK(5).forEach(p => pts.push({ x: toX(p.lng), y: toY(p.lat), s: p.speed })); });
    setHeatPoints(pts);
  }, []);

  const addVehicle = useCallback(() => {
    const tree = treeRef.current;
    const id = "V" + String(Math.floor(Math.random() * 9000) + 100);
    if (tree.search(id) || tree.size >= 16) return;
    const color = nextColor();
    const ri = Math.floor(Math.random() * ROUTES.length);
    tree.insert(id, color, ri);
    simRef.current[id] = { t: Math.random(), dir: Math.random() > 0.5 ? 1 : -1, speed: 40 + Math.random() * 60 };
    buildSnapshot();
  }, [buildSnapshot]);

  const removeVehicle = useCallback((id) => {
    treeRef.current.delete(id);
    delete simRef.current[id];
    setSelectedId(s => s === id ? null : s);
    buildSnapshot();
  }, [buildSnapshot]);

  const step = useCallback(() => {
    const tree = treeRef.current; const sim = simRef.current; const now = Date.now();
    Object.entries(sim).forEach(([id, s]) => {
      const node = tree.search(id); if (!node) return;
      s.t += s.dir * 0.011 * (0.6 + Math.random() * 0.8);
      if (s.t > 1) { s.t = 1; s.dir = -1; }
      if (s.t < 0) { s.t = 0; s.dir = 1; }
      const route = ROUTES[node.routeIdx];
      const [lat, lng] = lerp(route, s.t);
      s.speed = Math.max(8, Math.min(155, s.speed + (Math.random() - 0.47) * 14));
      if (Math.random() < 0.035) s.speed = Math.random() > 0.5 ? 125 + Math.random() * 30 : Math.max(5, s.speed - 45);
      const prev = node.trajectory.tail;
      const heading = prev ? Math.atan2(lng - prev.lng, lat - prev.lat) * 180 / Math.PI : 0;
      node.trajectory.append(lat, lng, s.speed, heading, now);
      node.maxSpeed = Math.max(node.maxSpeed, s.speed);
      node.speedSamples++; node.avgSpeed += (s.speed - node.avgSpeed) / node.speedSamples;
      const anomaly = tree.detectAnomaly(id);
      if (anomaly) {
        node.status = "alert"; node.totalAlerts++;
        totalAlertCountRef.current++;
        const msg = { id: alertIdRef.current++, vehicleId: id, ...anomaly, time: new Date().toLocaleTimeString("zh-TW"), color: node.color };
        node.alerts.unshift(msg); if (node.alerts.length > 8) node.alerts.pop();
        setAlerts(prev => [msg, ...prev].slice(0, 20));
        setNewAlertId(msg.id);
        setTimeout(() => setNewAlertId(null), 800);
      } else { node.status = "normal"; }
    });
    buildSnapshot();
    setTick(t => t + 1);
  }, [buildSnapshot]);

  useEffect(() => {
    if (running) { animRef.current = setInterval(step, 550); }
    else { clearInterval(animRef.current); }
    return () => clearInterval(animRef.current);
  }, [running, step]);

  useEffect(() => { for (let i = 0; i < 5; i++) addVehicle(); setRunning(true); }, []);

  const selectedVehicle = selectedId ? vehicles.find(v => v.id === selectedId) : null;
  const filteredVehicles = searchQuery ? vehicles.filter(v => v.id.toLowerCase().includes(searchQuery.toLowerCase())) : vehicles;

  // search highlight in AVL
  const searchPath = useCallback((id) => {
    if (!id) return [];
    const path = []; let c = treeRef.current.root;
    while (c) {
      path.push(c.vehicleId);
      if (id === c.vehicleId) break;
      c = id < c.vehicleId ? c.left : c.right;
    }
    return path;
  }, []);
  const highlightPath = searchQuery ? searchPath(searchQuery.toUpperCase()) : [];

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", background: "#020817", minHeight: "100vh", color: "#cbd5e1", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes pulse2 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        @keyframes ping { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes slideIn { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes flash { 0%,100%{background:#0f172a} 50%{background:#1e1010} }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: #020817; } ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        .vcard:hover { background: #0f172a !important; }
        .tab-btn { transition: all 0.2s; } .tab-btn:hover { color: #e2e8f0 !important; }
        .ctrl-btn { transition: all 0.15s; } .ctrl-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
        .node-g { transition: all 0.3s; } .node-g:hover { opacity: 0.85; }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ background: "#070f1f", borderBottom: "1px solid #1e3a5f", padding: "0 20px", height: 48, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: running ? "#22c55e" : "#475569", boxShadow: running ? "0 0 10px #22c55e" : "none", animation: running ? "pulse2 1.5s infinite" : "none" }}/>
          <span style={{ color: "#38bdf8", fontSize: 12, letterSpacing: "0.2em", fontWeight: "bold" }}>AVL TRAFFIC MONITOR</span>
          <span style={{ color: "#1e3a5f", fontSize: 10 }}>v2.0</span>
        </div>
        <span style={{ color: "#1e3a5f" }}>|</span>
        <span style={{ color: "#475569", fontSize: 10 }}>台北市區智慧車輛監控系統</span>

        {/* search */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid #1e3a5f", borderRadius: 6, padding: "3px 10px", marginLeft: 8 }}>
          <span style={{ color: "#475569", fontSize: 10 }}>🔍</span>
          <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setSelectedId(e.target.value.toUpperCase()); }}
            placeholder="查詢車輛 ID…" style={{ background: "none", border: "none", outline: "none", color: "#94a3b8", fontSize: 10, width: 100 }}/>
          {searchQuery && <span onClick={() => setSearchQuery("")} style={{ color: "#475569", cursor: "pointer", fontSize: 10 }}>✕</span>}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="ctrl-btn" onClick={() => setRunning(r => !r)} style={{ background: running ? "#0c1a2e" : "#0d2a1a", border: `1px solid ${running ? "#334155" : "#22c55e"}`, color: running ? "#64748b" : "#22c55e", padding: "5px 16px", borderRadius: 6, cursor: "pointer", fontSize: 10, letterSpacing: "0.1em" }}>
            {running ? "⏸  暫停" : "▶  啟動"}
          </button>
          <button className="ctrl-btn" onClick={addVehicle} disabled={vehicles.length >= 16} style={{ background: "#070f1f", border: "1px solid #1e3a5f", color: vehicles.length >= 16 ? "#334155" : "#38bdf8", padding: "5px 16px", borderRadius: 6, cursor: vehicles.length >= 16 ? "not-allowed" : "pointer", fontSize: 10, letterSpacing: "0.1em" }}>
            ＋ 新增車輛
          </button>
        </div>

        {/* stat pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            ["車輛", stats.total, "#38bdf8"],
            ["警報", stats.alerts, stats.alerts > 0 ? "#ef4444" : "#475569"],
            ["樹高", stats.treeHeight, "#a78bfa"],
            ["旋轉", stats.rotations, "#fb923c"],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: "#0f172a", border: `1px solid ${c}33`, borderRadius: 4, padding: "2px 8px", display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 8, color: "#475569" }}>{l}</span>
              <span style={{ fontSize: 11, color: c, fontWeight: "bold" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT ── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* tabs */}
          <div style={{ display: "flex", background: "#070f1f", borderBottom: "1px solid #1e3a5f", paddingLeft: 16 }}>
            {[["map","🗺  GPS 地圖"],["tree","🌲  AVL 樹"],["stats","📊  統計"]].map(([k,l]) => (
              <button key={k} className="tab-btn" onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: tab===k ? "2px solid #38bdf8" : "2px solid transparent", color: tab===k ? "#38bdf8" : "#475569", padding: "8px 18px", cursor: "pointer", fontSize: 10, letterSpacing: "0.1em" }}>{l}</button>
            ))}
          </div>

          {/* MAP TAB */}
          {tab === "map" && (
            <div style={{ flex: 1, overflow: "hidden", padding: 12 }}>
              <svg width="100%" viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ background: "#070f1f", borderRadius: 10, border: "1px solid #1e3a5f", display: "block" }}>
                <defs>
                  <radialGradient id="heatGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
                  </radialGradient>
                </defs>

                {/* grid */}
                {Array.from({length: 7}, (_,i) => <line key={"v"+i} x1={(i/6)*MAP_W} y1={0} x2={(i/6)*MAP_W} y2={MAP_H} stroke="#0d1f36" strokeWidth="1"/>)}
                {Array.from({length: 6}, (_,i) => <line key={"h"+i} x1={0} y1={(i/5)*MAP_H} x2={MAP_W} y2={(i/5)*MAP_H} stroke="#0d1f36" strokeWidth="1"/>)}

                {/* roads */}
                {ROUTES.map((r, ri) => (
                  <polyline key={ri} points={r.map(([la,ln])=>`${toX(ln)},${toY(la)}`).join(" ")} fill="none" stroke="#162035" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                ))}
                {ROUTES.map((r, ri) => (
                  <polyline key={"r2"+ri} points={r.map(([la,ln])=>`${toX(ln)},${toY(la)}`).join(" ")} fill="none" stroke="#1e3356" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4"/>
                ))}

                {/* heatmap spots */}
                {heatPoints.filter(p => p.s > 100).map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={18} fill="url(#heatGrad)" opacity="0.5"/>
                ))}

                {/* trails */}
                {vehicles.map(v => {
                  const pts = v.traj; if (pts.length < 2) return null;
                  return (
                    <g key={v.id+"t"}>
                      <polyline points={pts.map(p=>`${toX(p.lng)},${toY(p.lat)}`).join(" ")} fill="none" stroke={v.color} strokeWidth="1.5" strokeOpacity="0.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points={pts.slice(-8).map(p=>`${toX(p.lng)},${toY(p.lat)}`).join(" ")} fill="none" stroke={v.color} strokeWidth="2" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                  );
                })}

                {/* vehicles */}
                {vehicles.map(v => {
                  const last = v.traj[v.traj.length - 1]; if (!last) return null;
                  const cx = toX(last.lng), cy = toY(last.lat);
                  const isAlert = v.status === "alert", isSel = v.id === selectedId;
                  const heading = last.heading || 0;
                  return (
                    <g key={v.id} onClick={() => setSelectedId(s => s === v.id ? null : v.id)} style={{ cursor: "pointer" }} className="node-g">
                      {isSel && <circle cx={cx} cy={cy} r={15} fill="none" stroke={v.color} strokeWidth="1.5" strokeDasharray="4 2"/>}
                      {/* car body */}
                      <g transform={`translate(${cx},${cy}) rotate(${heading})`}>
                        <rect x={-5} y={-8} width={10} height={16} rx={3} fill={isAlert ? "#ef4444" : v.color} opacity="0.9"/>
                        <polygon points="0,-10 -3,-7 3,-7" fill={v.color}/>
                      </g>
                      <text x={cx} y={cy - 13} fill={v.color} fontSize="8" textAnchor="middle" fontFamily="monospace" opacity="0.9">{v.id}</text>
                      {isAlert && <text x={cx+8} y={cy-8} fill="#ef4444" fontSize="11">⚠</text>}
                    </g>
                  );
                })}

                {/* legend */}
                <rect x="8" y="8" width="130" height="52" rx="6" fill="#020817" opacity="0.9" stroke="#1e3a5f" strokeWidth="0.5"/>
                <text x="16" y="23" fill="#475569" fontSize="8" fontFamily="monospace">LEGEND</text>
                <rect x="16" y="30" width="8" height="5" rx="1" fill="#38bdf8"/>
                <text x="28" y="36" fill="#94a3b8" fontSize="8" fontFamily="monospace">正常行駛</text>
                <rect x="16" y="44" width="8" height="5" rx="1" fill="#ef4444"/>
                <text x="28" y="50" fill="#94a3b8" fontSize="8" fontFamily="monospace">異常警報</text>
                <circle cx="95" cy="33" r="5" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.7"/>
                <text x="104" y="36" fill="#94a3b8" fontSize="8" fontFamily="monospace">熱區</text>
              </svg>
            </div>
          )}

          {/* AVL TREE TAB */}
          {tab === "tree" && (
            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 9, color: "#475569" }}>
                <span>節點數: <b style={{ color: "#38bdf8" }}>{stats.total}</b></span>
                <span>樹高: <b style={{ color: "#a78bfa" }}>{stats.treeHeight}</b></span>
                <span>總旋轉: <b style={{ color: "#fb923c" }}>{stats.rotations}</b></span>
                <span>查詢複雜度: <b style={{ color: "#4ade80" }}>O(log₂ {stats.total} ≈ {Math.ceil(Math.log2(Math.max(stats.total,1)))})</b></span>
              </div>
              <svg width="100%" viewBox="0 0 680 340" style={{ background: "#070f1f", borderRadius: 10, border: "1px solid #1e3a5f", display: "block" }}>
                {/* edges */}
                {treeData.edges.map((e, i) => {
                  const inPath = highlightPath.includes(treeData.nodes.find(n => n.x === e.x2 && n.y === e.y2)?.id);
                  return <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={inPath ? "#38bdf8" : "#1e3a5f"} strokeWidth={inPath ? 2 : 1}/>;
                })}
                {/* nodes */}
                {treeData.nodes.map(n => {
                  const isSel = n.id === selectedId, inPath = highlightPath.includes(n.id), isFound = searchQuery && n.id === searchQuery.toUpperCase();
                  return (
                    <g key={n.id} className="node-g" onClick={() => setSelectedId(s => s === n.id ? null : n.id)} style={{ cursor: "pointer" }}>
                      {isFound && <circle cx={n.x} cy={n.y} r={26} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" opacity="0.8"/>}
                      {n.status === "alert" && <circle cx={n.x} cy={n.y} r={22} fill="#ef444422"/>}
                      <circle cx={n.x} cy={n.y} r={20} fill={isSel ? "#162035" : inPath ? "#0d1f36" : "#0d1525"} stroke={n.status==="alert" ? "#ef4444" : inPath ? "#38bdf8" : n.color} strokeWidth={isSel || inPath ? 2 : 1}/>
                      <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fill={n.color} fontSize="8" fontWeight="bold">{n.id}</text>
                      <text x={n.x} y={n.y + 12} textAnchor="middle" fill="#334155" fontSize="6">h:{n.h} bf:{n.bf}</text>
                      {n.alerts > 0 && <text x={n.x + 14} y={n.y - 14} fill="#ef4444" fontSize="8">⚠{n.alerts}</text>}
                    </g>
                  );
                })}
                {treeData.nodes.length === 0 && <text x="340" y="170" textAnchor="middle" fill="#1e3a5f" fontSize="13" fontFamily="monospace">尚無車輛，請按「新增車輛」</text>}
              </svg>
              <div style={{ marginTop: 6, fontSize: 9, color: "#334155", display: "flex", gap: 16 }}>
                <span>h = 節點高度</span><span>bf = 平衡因子（|bf| ≤ 1）</span><span style={{ color: "#38bdf8" }}>藍色路徑 = 搜尋軌跡</span>
              </div>
            </div>
          )}

          {/* STATS TAB */}
          {tab === "stats" && (
            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <StatCard label="車輛總數" value={stats.total} unit="輛" accent="#38bdf8" sub={`AVL 高度 ${stats.treeHeight}`}/>
                <StatCard label="異常車輛" value={stats.alerts} unit="輛" accent={stats.alerts > 0 ? "#ef4444" : "#475569"} sub="即時警報"/>
                <StatCard label="平均速度" value={stats.avgSpeed} unit="km/h" accent="#4ade80" sub="所有車輛"/>
                <StatCard label="最高速度" value={stats.maxSpeed} unit="km/h" accent="#fb923c" sub="歷史紀錄"/>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <StatCard label="AVL 旋轉次數" value={stats.rotations} unit="次" accent="#a78bfa" sub="平衡維護操作"/>
                <StatCard label="警報總計" value={totalAlertCountRef.current} unit="筆" accent="#f472b6" sub={`最新: ${alerts[0]?.type ?? "—"}`}/>
                <StatCard label="O(log n) 查詢" value={`≤${stats.treeHeight}`} unit="步" accent="#2dd4bf" sub="最壞情況比較次數"/>
              </div>

              {/* per-vehicle table */}
              <div style={{ background: "#070f1f", border: "1px solid #1e3a5f", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 80px 80px 60px", padding: "6px 12px", borderBottom: "1px solid #1e3a5f", fontSize: 8, color: "#475569", letterSpacing: "0.1em" }}>
                  <span>車輛 ID</span><span>速度歷史</span><span>均速</span><span>最高速</span><span>警報次數</span><span>狀態</span>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {vehicles.map(v => (
                    <div key={v.id} className="vcard" onClick={() => { setSelectedId(v.id); setTab("map"); }} style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 80px 80px 60px", padding: "6px 12px", borderBottom: "1px solid #0d1525", cursor: "pointer", alignItems: "center" }}>
                      <span style={{ color: v.color, fontSize: 10, fontWeight: "bold" }}>{v.id}</span>
                      <MiniSparkline data={v.traj.map(p=>p.speed)} color={v.color} w={160} h={28}/>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{Math.round(v.avgSpeed)} <span style={{ color: "#475569", fontSize: 8 }}>km/h</span></span>
                      <span style={{ fontSize: 10, color: v.maxSpeed > 120 ? "#ef4444" : "#94a3b8" }}>{Math.round(v.maxSpeed)}</span>
                      <span style={{ fontSize: 10, color: v.totalAlerts > 0 ? "#f97316" : "#475569" }}>{v.totalAlerts}</span>
                      <span style={{ fontSize: 9, color: v.status === "alert" ? "#ef4444" : "#22c55e" }}>{v.status === "alert" ? "⚠ 異常" : "● 正常"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ width: 320, display: "flex", flexDirection: "column", background: "#070f1f", borderLeft: "1px solid #1e3a5f", flexShrink: 0 }}>
          {/* right tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e3a5f" }}>
            {[["detail","車輛詳情"],["log","警報記錄"],["list","車輛列表"]].map(([k,l]) => (
              <button key={k} className="tab-btn" onClick={() => setRightTab(k)} style={{ background: "none", border: "none", borderBottom: rightTab===k ? "2px solid #38bdf8" : "2px solid transparent", color: rightTab===k ? "#38bdf8" : "#475569", padding: "7px 0", flex: 1, cursor: "pointer", fontSize: 9, letterSpacing: "0.08em" }}>{l}</button>
            ))}
          </div>

          {/* DETAIL */}
          {rightTab === "detail" && (
            <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
              {selectedVehicle ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: selectedVehicle.color, boxShadow: `0 0 8px ${selectedVehicle.color}` }}/>
                    <span style={{ color: selectedVehicle.color, fontSize: 16, fontWeight: "bold", letterSpacing: "0.1em" }}>{selectedVehicle.id}</span>
                    {selectedVehicle.status === "alert" && <span style={{ color: "#ef4444", fontSize: 8, border: "1px solid #ef4444", padding: "2px 7px", borderRadius: 4, letterSpacing: "0.1em" }}>⚠ 異常</span>}
                    <button onClick={() => removeVehicle(selectedVehicle.id)} style={{ marginLeft: "auto", background: "#1a0a0a", border: "1px solid #4a1a1a", color: "#ef4444", fontSize: 9, padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>🗑 移除</button>
                  </div>

                  {/* speedometer */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, background: "#0d1525", borderRadius: 10, padding: "10px 0" }}>
                    <Speedometer speed={selectedVehicle.traj[selectedVehicle.traj.length-1]?.speed ?? 0} color={selectedVehicle.color} maxSpeed={160}/>
                  </div>

                  {/* mini stats */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <div style={{ flex: 1, background: "#0d1525", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 8, color: "#475569" }}>均速</div>
                      <div style={{ fontSize: 14, color: "#4ade80", fontWeight: "bold" }}>{Math.round(selectedVehicle.avgSpeed)}<span style={{ fontSize: 8, color: "#475569" }}>km/h</span></div>
                    </div>
                    <div style={{ flex: 1, background: "#0d1525", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 8, color: "#475569" }}>最高速</div>
                      <div style={{ fontSize: 14, color: "#fb923c", fontWeight: "bold" }}>{Math.round(selectedVehicle.maxSpeed)}<span style={{ fontSize: 8, color: "#475569" }}>km/h</span></div>
                    </div>
                    <div style={{ flex: 1, background: "#0d1525", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 8, color: "#475569" }}>警報次數</div>
                      <div style={{ fontSize: 14, color: "#ef4444", fontWeight: "bold" }}>{selectedVehicle.totalAlerts}</div>
                    </div>
                  </div>

                  {/* speed chart */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#475569", marginBottom: 4, letterSpacing: "0.08em" }}>速度折線圖（最近 20 筆）</div>
                    <div style={{ background: "#0d1525", borderRadius: 8, padding: "8px", border: "1px solid #1e3a5f" }}>
                      {(() => {
                        const pts = selectedVehicle.traj.slice(-20);
                        if (pts.length < 2) return <div style={{ color: "#334155", fontSize: 10, padding: "10px", textAlign: "center" }}>資料累積中…</div>;
                        const maxS = Math.max(...pts.map(p=>p.speed), 140), W=270, H=60;
                        const toXP = (i) => (i/(pts.length-1))*(W-4)+2;
                        const toYP = (s) => H-2-(s/maxS)*(H-6);
                        const polyPts = pts.map((p,i)=>`${toXP(i)},${toYP(p.speed)}`).join(" ");
                        const fillPts = `2,${H-2} ${polyPts} ${toXP(pts.length-1)},${H-2}`;
                        return (
                          <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                            <defs>
                              <linearGradient id={`fill${selectedVehicle.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={selectedVehicle.color} stopOpacity="0.3"/>
                                <stop offset="100%" stopColor={selectedVehicle.color} stopOpacity="0"/>
                              </linearGradient>
                            </defs>
                            <line x1="2" y1={toYP(120)} x2={W-2} y2={toYP(120)} stroke="#ef444466" strokeWidth="0.8" strokeDasharray="4 3"/>
                            <text x="4" y={toYP(120)-3} fill="#ef4444" fontSize="6">120</text>
                            <polygon points={fillPts} fill={`url(#fill${selectedVehicle.id})`}/>
                            <polyline points={polyPts} fill="none" stroke={selectedVehicle.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            {pts.map((p,i) => <circle key={i} cx={toXP(i)} cy={toYP(p.speed)} r="2" fill={p.speed > 120 ? "#ef4444" : selectedVehicle.color}/>)}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>

                  {/* DLL visualizer */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: "#475569", marginBottom: 4, letterSpacing: "0.08em" }}>雙向鏈結串列（DLL）末端節點</div>
                    <div style={{ background: "#0d1525", borderRadius: 8, padding: "8px", border: "1px solid #1e3a5f", overflowX: "auto" }}>
                      <DLLVisualizer points={selectedVehicle.traj} color={selectedVehicle.color}/>
                    </div>
                  </div>

                  {/* this vehicle alerts */}
                  {selectedVehicle.alerts.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: "#475569", marginBottom: 4, letterSpacing: "0.08em" }}>此車異常記錄</div>
                      {selectedVehicle.alerts.slice(0, 4).map((a, i) => (
                        <div key={i} style={{ background: "#120a0a", border: "1px solid #ef444433", borderLeft: "2px solid #ef4444", borderRadius: 6, padding: "5px 8px", marginBottom: 4, fontSize: 9 }}>
                          <div style={{ color: "#ef4444" }}>{TYPE_ICON[a.type] ?? "⚠"} {a.type}</div>
                          <div style={{ color: "#475569", display: "flex", gap: 8, marginTop: 2 }}>
                            <span>{a.time}</span>
                            {a.speed && <span style={{ color: "#fb923c" }}>{Math.round(a.speed)} km/h</span>}
                            {a.acc && <span>{a.acc} m/s²</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "#334155" }}>
                  <div style={{ fontSize: 32 }}>🚗</div>
                  <div style={{ fontSize: 11 }}>點擊地圖車輛查看詳情</div>
                  <div style={{ fontSize: 9 }}>或在 AVL 樹中選取節點</div>
                </div>
              )}
            </div>
          )}

          {/* ALERT LOG */}
          {rightTab === "log" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #1e3a5f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em" }}>ANOMALY LOG</span>
                <span style={{ color: "#ef4444", fontSize: 10, fontWeight: "bold" }}>{alerts.length} 筆</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                {alerts.length === 0 ? (
                  <div style={{ color: "#334155", fontSize: 10, textAlign: "center", marginTop: 30 }}>尚無異常偵測紀錄</div>
                ) : alerts.map(a => (
                  <div key={a.id} onClick={() => { setSelectedId(a.vehicleId); setRightTab("detail"); }}
                    style={{ padding: "7px 10px", marginBottom: 5, background: newAlertId === a.id ? "#1a0d0d" : "#0d1525", border: `1px solid ${SEVERITY_COLOR[a.severity ?? "mid"]}44`, borderLeft: `3px solid ${SEVERITY_COLOR[a.severity ?? "mid"]}`, borderRadius: 6, cursor: "pointer", animation: newAlertId === a.id ? "slideIn 0.4s ease" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: a.color, flexShrink: 0 }}/>
                      <span style={{ color: a.color, fontSize: 10, fontWeight: "bold" }}>{a.vehicleId}</span>
                      <span style={{ color: SEVERITY_COLOR[a.severity ?? "mid"], fontSize: 9, marginLeft: "auto" }}>{TYPE_ICON[a.type] ?? "⚠"} {a.type}</span>
                    </div>
                    <div style={{ fontSize: 8, color: "#475569", display: "flex", gap: 8 }}>
                      <span>{a.time}</span>
                      {a.speed && <span style={{ color: "#fb923c" }}>{Math.round(a.speed)} km/h</span>}
                      {a.acc && <span>{a.acc} m/s²</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VEHICLE LIST */}
          {rightTab === "list" && (
            <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 8, padding: "0 4px" }}>
                {filteredVehicles.length} / {vehicles.length} 輛 · O(log n) AVL 查詢
              </div>
              {filteredVehicles.map(v => (
                <div key={v.id} className="vcard" onClick={() => { setSelectedId(v.id); setRightTab("detail"); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 4, background: v.id === selectedId ? "#162035" : "#0d1525", border: `1px solid ${v.id === selectedId ? v.color+"55" : "#1e3a5f"}`, borderRadius: 8, cursor: "pointer" }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: v.color, flexShrink: 0, boxShadow: v.status==="alert" ? `0 0 8px ${v.color}` : "none" }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: v.color, fontSize: 11, fontWeight: "bold" }}>{v.id}</span>
                      <span style={{ fontSize: 9, color: v.status==="alert" ? "#ef4444" : "#22c55e" }}>{v.status==="alert" ? "⚠ 異常" : "● 正常"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 8, color: "#475569" }}>
                      <span>均速 <b style={{ color: "#94a3b8" }}>{Math.round(v.avgSpeed)}</b></span>
                      <span>最高 <b style={{ color: v.maxSpeed>120?"#ef4444":"#94a3b8" }}>{Math.round(v.maxSpeed)}</b></span>
                      <span>警報 <b style={{ color: v.totalAlerts>0?"#f97316":"#475569" }}>{v.totalAlerts}</b></span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeVehicle(v.id); }} style={{ background: "#1a0a0a", border: "1px solid #4a1a1a", color: "#ef4444", fontSize: 9, padding: "2px 6px", borderRadius: 4, cursor: "pointer", flexShrink: 0 }}>✕</button>
                </div>
              ))}
              {filteredVehicles.length === 0 && <div style={{ color: "#334155", textAlign: "center", fontSize: 10, marginTop: 30 }}>查無車輛</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}