import { useState, useEffect, useCallback, useRef } from "react";

// ─── config ───────────────────────────────────────────────────────────────────
const API = "http://localhost:8000";
const TOKEN_KEY = "ss_token";
const USER_KEY  = "ss_user";

// ─── theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#0b0d12",
  surface:     "#11141c",
  card:        "#181c27",
  border:      "#222840",
  accent:      "#5b8dee",
  accentSoft:  "rgba(91,141,238,0.12)",
  text:        "#dde2f0",
  muted:       "#5a6180",
  faint:       "#2a2f44",
  success:     "#3ecf8e",
  warning:     "#f0a500",
  danger:      "#e05c5c",
};

const DAYS     = ["Понеделник","Вторник","Сряда","Четвъртък","Петък"];
const DAY_KEYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

// ─── 12-color subject palette ─────────────────────────────────────────────────
const PALETTE = [
  { bg:"rgba(91,141,238,0.15)",  border:"rgba(91,141,238,0.40)",  text:"#7aaaff" },
  { bg:"rgba(54,197,197,0.14)",  border:"rgba(54,197,197,0.38)",  text:"#3ecfcf" },
  { bg:"rgba(167,107,230,0.14)", border:"rgba(167,107,230,0.38)", text:"#c47df5" },
  { bg:"rgba(240,120,80,0.14)",  border:"rgba(240,120,80,0.38)",  text:"#f5906a" },
  { bg:"rgba(52,199,120,0.13)",  border:"rgba(52,199,120,0.36)",  text:"#3ecf8e" },
  { bg:"rgba(240,165,0,0.13)",   border:"rgba(240,165,0,0.36)",   text:"#f0b429" },
  { bg:"rgba(236,72,153,0.13)",  border:"rgba(236,72,153,0.36)",  text:"#f472b6" },
  { bg:"rgba(99,179,88,0.14)",   border:"rgba(99,179,88,0.38)",   text:"#86e074" },
  { bg:"rgba(251,113,55,0.13)",  border:"rgba(251,113,55,0.36)",  text:"#fb8c55" },
  { bg:"rgba(56,189,248,0.14)",  border:"rgba(56,189,248,0.38)",  text:"#60ceff" },
  { bg:"rgba(190,75,75,0.14)",   border:"rgba(190,75,75,0.38)",   text:"#e87878" },
  { bg:"rgba(120,100,220,0.15)", border:"rgba(120,100,220,0.40)", text:"#9c88ee" },
];

function subjectColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ─── global styles ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Onest:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px;-webkit-font-smoothing:antialiased}
body{background:${C.bg};color:${C.text};font-family:'Onest',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px}
.mono{font-family:'Fira Code',monospace}

@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
@keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-9px)}30%{transform:translateX(8px)}45%{transform:translateX(-6px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}}

.fade-up{animation:fadeUp 0.35s cubic-bezier(.2,.8,.4,1) both}

.sched-table{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  font-size:12px;
  table-layout:fixed;
}
.sched-table th{
  background:${C.surface};color:${C.muted};
  font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  padding:10px 14px;text-align:left;
  border-bottom:1px solid ${C.border};
  position:sticky;top:0;z-index:3;
}
.sched-table td{
  padding:7px 10px;vertical-align:top;
  border-bottom:1px solid ${C.faint};min-width:120px;
  max-width:200px
}
.sched-table tr:last-child td{border-bottom:none}
.sched-table .p-col{
  font-family:'Fira Code',monospace;font-size:10px;color:${C.muted};
  background:${C.surface};border-right:1px solid ${C.border};
  text-align:center;min-width:32px;width:32px;padding:7px 8px;
  vertical-align:middle;position:sticky;left:0;z-index:2;
}
.sched-table tr:hover td:not(.p-col){background:rgba(255,255,255,0.018)}
.sched-table tr:hover .p-col{background:${C.surface}}

.tab{
  padding:7px 18px;border:none;border-radius:7px;
  font-size:12px;font-weight:600;letter-spacing:.03em;
  transition:all .15s;background:transparent;color:${C.muted};
  cursor:pointer;font-family:'Onest',sans-serif;
}
.tab.on{background:${C.accentSoft};color:${C.accent}}
.tab:hover:not(.on){background:${C.card};color:${C.text}}

.btn{
  display:inline-flex;align-items:center;gap:7px;
  padding:9px 20px;border-radius:8px;border:none;
  font-family:'Onest',sans-serif;font-size:13px;font-weight:600;
  cursor:pointer;transition:all .15s;
}
.btn-primary{background:${C.accent};color:#fff}
.btn-primary:hover{background:#7aaaff;transform:translateY(-1px)}
.btn-primary:active{transform:none}
.btn-primary:disabled{opacity:.35;cursor:not-allowed;transform:none}
.btn-ghost{background:transparent;border:1px solid ${C.border};color:${C.muted}}
.btn-ghost:hover{border-color:${C.accent};color:${C.accent}}
.btn-ghost:disabled{opacity:.35;cursor:not-allowed}

.select-ctrl{
  background:${C.card};color:${C.text};
  border:1px solid ${C.border};border-radius:8px;
  padding:8px 36px 8px 12px;font-size:13px;font-weight:500;
  outline:none;transition:border-color .15s;
  appearance:none;-webkit-appearance:none;font-family:'Onest',sans-serif;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%235a6180' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 10px center;
  cursor:pointer;
}
.select-ctrl:focus{border-color:${C.accent}}
.select-ctrl option{background:${C.card}}

.text-input{
  background:${C.card};color:${C.text};
  border:1px solid ${C.border};border-radius:8px;
  padding:10px 14px;font-size:13px;
  outline:none;font-family:'Onest',sans-serif;
  transition:border-color .15s, box-shadow .15s;width:100%;
}
.text-input:focus{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accentSoft}}
.text-input::placeholder{color:${C.muted}}

.badge{
  display:inline-block;padding:2px 7px;border-radius:4px;
  font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  font-family:'Fira Code',monospace;
}
.b-blue{background:${C.accentSoft};color:${C.accent}}

.spinner{
  display:inline-block;width:14px;height:14px;
  border:2px solid ${C.border};border-top-color:${C.accent};
  border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;
}
.status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.dot-idle{background:${C.muted}}
.dot-run{background:${C.warning};animation:pulse 1.1s infinite}
.dot-done{background:${C.success}}
.dot-err{background:${C.danger}}

.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:${C.bg};}
.login-card{
  background:${C.surface};border:1px solid ${C.border};
  border-radius:16px;padding:44px 48px;width:360px;
  animation:fadeUp .4s cubic-bezier(.2,.8,.4,1);
}
.login-card.shake{animation:shake .45s ease}

.builder-panel{
  background:${C.card};border:1px solid ${C.border};
  border-radius:12px;padding:16px;width:220px;flex-shrink:0;
  display:flex;flex-direction:column;gap:8px;
  max-height:600px;overflow-y:auto;overflow-x:hidden;
}
.drag-subject{
  cursor:grab;transition:transform 0.1s;
  width:100%;display:block;
}
.drag-subject:active{cursor:grabbing;transform:scale(0.97);}
.drop-zone{transition:background 0.2s;height:100%;min-height:50px;}
.drop-zone.drag-over{background:${C.accentSoft};outline:2px dashed ${C.accent};border-radius:6px;}
`;

// ─── utilities ────────────────────────────────────────────────────────────────

function token()    { return localStorage.getItem(TOKEN_KEY); }
function userName() { return localStorage.getItem(USER_KEY); }
function saveAuth(tok, user) { localStorage.setItem(TOKEN_KEY, tok); localStorage.setItem(USER_KEY, user); }
function clearAuth() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const res = await fetch(API + path, { ...opts, headers });
  if (res.status === 401) { clearAuth(); window.location.reload(); }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status}`);
  }
  return res.json();
}

// ─── components ───────────────────────────────────────────────────────────────

const Spinner = () => <span className="spinner" />;

const Empty = () => (
  <span style={{ color: C.faint, fontFamily: "Fira Code, monospace", fontSize: 11 }}>—</span>
);

function SlotPill({ slot }) {
  if (!slot?.subject) return null;
  const col = subjectColor(slot.subject.name);

  const shortSubject = slot.subject.name.length > 15
    ? slot.subject.name.split(/\s+/).map(w => w === "-" ? "-" : w.charAt(0).toUpperCase()).join("")
    : slot.subject.name;

  return (
    <div
      title={`${slot.subject.name}\n${slot.teacher?.name || ''}`}
      style={{
        padding: "6px 9px", borderRadius: 7,
        background: col.bg, border: `1px solid ${col.border}`,
        transition: "filter .12s",
        height: "100%",
        display: "flex", flexDirection: "column",
        overflow: "hidden"
      }}
      onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.2)"}
      onMouseLeave={e => e.currentTarget.style.filter = "none"}
    >
      <div style={{ fontWeight: 700, fontSize: 12, color: col.text, lineHeight: 1.3, wordBreak: "break-word" }}>
        {shortSubject}
      </div>
      {slot.room && (
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{slot.room.roomId}</div>
      )}
      {slot.teacher && (
        <div style={{ fontSize: 10, color: col.text, opacity: 0.72, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {slot.teacher.name}
        </div>
      )}
      <div style={{ marginTop: "auto", paddingTop: 4 }}>
        {slot.groupId && (
          <span style={{
            display: "inline-block", padding: "1px 6px", borderRadius: 4,
            fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
            fontFamily: "Fira Code, monospace", textTransform: "uppercase",
            background: col.border, color: col.text,
          }}>гр.{slot.groupId}</span>
        )}
      </div>
    </div>
  );
}

// ─── schedule grid ────────────────────────────────────────────────────────────
function ScheduleGrid({ schedule, loading, isEditing, onSlotDrop }) {
  const [dragOverCell, setDragOverCell] = useState(null);

  if (loading) return (
    <div style={{ padding: "60px 0", textAlign: "center", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <Spinner /> зарежда се…
    </div>
  );

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}`, flex: 1 }}>
      <table className="sched-table" style={{ minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ minWidth: 32, width: 32 }}></th>
            {DAYS.map(d => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i}>
              <td className="p-col">{i + 1}</td>
              {DAY_KEYS.map(dayKey => {
                const slots = schedule?.[dayKey]?.[i] ?? [];
                const cellKey = `${dayKey}-${i}`;
                return (
                  <td
                    key={dayKey}
                    className={`drop-zone ${dragOverCell === cellKey ? 'drag-over' : ''}`}
                    onDragOver={isEditing ? (e) => { e.preventDefault(); setDragOverCell(cellKey); } : undefined}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={isEditing ? (e) => {
                      e.preventDefault();
                      setDragOverCell(null);
                      const subjectData = e.dataTransfer.getData("application/json");
                      if (subjectData && onSlotDrop) onSlotDrop(dayKey, i, JSON.parse(subjectData));
                    } : undefined}
                  >
                    {slots.length === 0
                      ? <Empty />
                      : (
                        <div style={{ display: "flex", gap: "6px", alignItems: "stretch", height: "100%" }}>
                          {slots.map((s, j) => (
                            <div key={j} style={{ flex: 1, minWidth: 0 }}>
                              <SlotPill slot={s} />
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── schedule viewer ──────────────────────────────────────────────────────────
function ScheduleViewer({ teacher }) {
  const [classes,       setClasses]       = useState([]);
  const [subjects,      setSubjects]      = useState([]);
  const [selected,      setSelected]      = useState("");
  const [schedule,      setSchedule]      = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [err,           setErr]           = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    apiFetch("/api/classes")
      .then(d => { setClasses(d); if (d.length) setSelected(d[0]); })
      .catch(() => setErr("Неуспешно зареждане на класовете."));

    apiFetch("/api/subjects")
      .then(setSubjects)
      .catch(console.error);
  }, []);

  const loadSchedule = useCallback(() => {
    if (!selected) return;
    setLoading(true); setErr("");
    apiFetch(`/api/schedule/class/${encodeURIComponent(selected)}`)
      .then(d => { setSchedule(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [selected]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const handleSlotDrop = async (dayKey, periodIndex, subject) => {
    try {
      await apiFetch("/api/schedule/slot", {
        method: "POST",
        body: JSON.stringify({ classId: selected, subjectId: subject.id, day: dayKey, period: periodIndex })
      });
      loadSchedule();
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: ".08em", textTransform: "uppercase" }}>Клас</span>
        <select className="select-ctrl" value={selected} onChange={e => setSelected(e.target.value)}>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {loading && <Spinner />}
      </div>

      {err && <div style={{ fontSize: 12, color: C.danger, marginBottom: 14, fontFamily: "Fira Code, monospace" }}>⚠ {err}</div>}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <ScheduleGrid
          schedule={schedule}
          loading={loading && !schedule}
          isEditing={!!teacher}
          onSlotDrop={handleSlotDrop}
        />

        {teacher && (
          <div className="builder-panel" style={{ display: "flex", flexDirection: "column", gap: 8, width: 220, flexShrink: 0, maxHeight: 600, overflowY: "auto" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
              Предмети
            </div>
            <input
              className="text-input"
              placeholder="Търси предмет…"
              style={{ marginBottom: 10, fontSize: 11, padding: "6px 10px" }}
              onChange={e => setSubjectFilter(e.target.value.toLowerCase())}
            />
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
              Плъзнете предмет в таблицата, за да го добавите.
            </div>
            {subjects
              .filter(subj => subj.name.toLowerCase().includes(subjectFilter))
              .map(subj => {
                const col = subjectColor(subj.name);
                return (
                  <div
                    key={subj.id}
                    className="drag-subject"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(subj));
                    }}
                    style={{
                      padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: col.bg, border: `1px solid ${col.border}`, color: col.text
                    }}
                  >
                    {subj.name}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── data panel ───────────────────────────────────────────────────────────────
function DataList({ title, items, loading, renderItem }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${C.border}`,
        fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: ".09em", textTransform: "uppercase",
      }}>{title}</div>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {loading
          ? <div style={{ padding: 20, textAlign: "center" }}><Spinner /></div>
          : items.length === 0
            ? <div style={{ padding: "14px 16px", fontSize: 12, color: C.muted }}>Няма данни</div>
            : items.map((item, i) => (
                <div key={i} style={{
                  padding: "8px 16px", fontSize: 12,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderBottom: i < items.length - 1 ? `1px solid ${C.faint}` : "none",
                }}>
                  {renderItem(item)}
                </div>
              ))
        }
      </div>
    </div>
  );
}

function DataPanel() {
  const [data, setData]    = useState({ teachers: [], rooms: [], subjects: [], classes: [] });
  const [loading, setLoad] = useState(true);
  const [err, setErr]      = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/teachers"),
      apiFetch("/api/rooms"),
      apiFetch("/api/subjects"),
      apiFetch("/api/classes"),
    ]).then(([teachers, rooms, subjects, classes]) => {
      setData({ teachers, rooms, subjects, classes: classes.map(c => ({ name: c })) });
      setLoad(false);
    }).catch((e) => {
      setErr("Грешка при зареждане: " + e.message + ". Проверете сървъра.");
      setLoad(false);
    });
  }, []);

  return (
    <div className="fade-up">
      {err && (
        <div style={{
          background: "rgba(224,92,92,.08)", border: `1px solid rgba(224,92,92,.25)`,
          borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.danger, marginBottom: 16,
          fontFamily: "Fira Code, monospace",
        }}>⚠ {err}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        <DataList title="Учители" items={data.teachers} loading={loading}
          renderItem={t => (
            <><span>{t.name}</span><span className="mono" style={{ fontSize: 10, color: C.muted }}>#{t.id}</span></>
          )} />
        <DataList title="Стаи" items={data.rooms} loading={loading}
          renderItem={r => (
            <><span>{r.name}</span>{r.hasComputers && <span className="badge b-blue">💻 PC</span>}</>
          )} />
        <DataList title="Предмети" items={data.subjects} loading={loading}
          renderItem={s => {
            const col = subjectColor(s.name);
            return (
              <>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.text, flexShrink: 0 }} />
                  {s.name}
                </span>
                <span className="mono" style={{ fontSize: 10, color: C.muted }}>#{s.id}</span>
              </>
            );
          }} />
        <DataList title="Класове" items={data.classes} loading={loading}
          renderItem={c => <span>{c.name}</span>} />
      </div>
    </div>
  );
}

// ─── generator panel ──────────────────────────────────────────────────────────
function GeneratorPanel() {
  const [st, setSt]           = useState({ status: "idle", message: "", running: false });
  const [polling, setPoll]    = useState(false);
  const [genErr, setGenErr]   = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try { const s = await apiFetch("/api/generate/status"); setSt(s); return s; }
    catch { return null; }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(async () => {
      const s = await fetchStatus();
      if (s && !s.running) setPoll(false);
    }, 2200);
    return () => clearInterval(id);
  }, [polling, fetchStatus]);

  const generate = async () => {
    if (!window.confirm("Сигурни ли сте? Това ще презапише текущото разписание.")) return;
    setGenErr("");
    try {
      await apiFetch("/api/schedule/generate/all", { method: "POST" });
      setPoll(true);
      fetchStatus();
    } catch (e) { setGenErr(e.message); }
  };

  const clearSchedule = async () => {
    if (!window.confirm("ВНИМАНИЕ: Това ще изтрие цялото разписание от базата данни. Сигурни ли сте?")) return;
    setGenErr("");
    try {
      await apiFetch("/api/schedule/clear", { method: "POST" });
      fetchStatus();
      alert("Разписанието е изчистено успешно.");
    } catch (e) { setGenErr("Грешка при изчистване: " + e.message); }
  };

  const exportAll = async () => {
    setExporting(true);
    setGenErr("");
    try {
      const [classDetails, allClasses] = await Promise.all([
        apiFetch("/api/classes/details"),
        apiFetch("/api/classes"),
      ]);

      const schedules = await Promise.all(
        allClasses.map(name =>
          apiFetch(`/api/schedule/class/${encodeURIComponent(name)}`)
            .then(data => ({ name, data }))
            .catch(() => ({ name, data: null }))
        )
      );

      const classMap = Object.fromEntries(classDetails.map(c => [c.name, c]));
      const days    = ["Понеделник","Вторник","Сряда","Четвъртък","Петък"];
      const dayKeys = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

      const html = `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8"/>
<title>Разписание – всички класове</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Onest:wght@400;600;700;800&family=Fira+Code:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Onest',sans-serif;background:#fff;color:#1a1f2e;font-size:11px}
  .page{
    width:297mm;min-height:210mm;padding:14mm 12mm;
    page-break-after:always;display:flex;flex-direction:column;gap:10px;
  }
  .page:last-child{page-break-after:avoid}
  .page-header{
    display:flex;align-items:flex-end;justify-content:space-between;
    border-bottom:2.5px solid #1a1f2e;padding-bottom:10px;margin-bottom:6px;
  }
  .class-name{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1;color:#1a1f2e}
  .head-block{text-align:right;line-height:1.6}
  .head-label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:#9aa0b8}
  .head-name{font-size:13px;font-weight:700;color:#3a4060}
  table{width:100%;border-collapse:collapse;flex:1}
  th{
    background:#f0f2f8;font-size:9px;font-weight:700;letter-spacing:.1em;
    text-transform:uppercase;color:#5a6180;padding:7px 10px;
    text-align:left;border:1px solid #dde2f0;
  }
  td{border:1px solid #e8eaf2;padding:5px 8px;vertical-align:top}
  td.period{
    font-family:'Fira Code',monospace;font-size:10px;color:#9aa0b8;
    background:#f8f9fc;text-align:center;width:28px;vertical-align:middle;
  }
  td.empty{color:#d0d4e8;font-family:'Fira Code',monospace;font-size:10px;text-align:center;vertical-align:middle}
  .pill{
    background:#f0f4ff;border-left:3px solid #5b8dee;
    border-radius:4px;padding:4px 6px;margin-bottom:3px;
  }
  .pill:last-child{margin-bottom:0}
  .pill-subj{font-weight:700;font-size:10px;color:#1a1f2e;line-height:1.3}
  .pill-meta{font-size:9px;color:#7a82a0;margin-top:1px;font-family:'Fira Code',monospace}
  .grp{
    display:inline-block;margin-top:3px;font-size:8px;font-weight:700;
    font-family:'Fira Code',monospace;background:#dce8ff;color:#5b8dee;
    padding:1px 5px;border-radius:3px;text-transform:uppercase;
  }
  .footer{
    margin-top:8px;font-size:9px;color:#c0c4d8;
    display:flex;justify-content:space-between;
    font-family:'Fira Code',monospace;
  }
  @media print{@page{size:A4 landscape;margin:0}}
</style>
</head>
<body>
${schedules.map(({ name, data }) => {
  const info = classMap[name] || {};
  const tableRows = Array.from({ length: 8 }, (_, i) => {
    const cells = dayKeys.map(dk => {
      const slots = data?.[dk]?.[i] ?? [];
      if (slots.length === 0) return `<td class="empty">—</td>`;
      const pills = slots.map(s => {
        const subj    = s.subject?.name || "";
        const teacher = s.teacher?.name || "";
        const room    = s.room?.roomId  || "";
        const group   = s.groupId ? `<span class="grp">гр.${s.groupId}</span>` : "";
        const meta    = [room, teacher].filter(Boolean).join(" · ");
        return `<div class="pill"><div class="pill-subj">${subj}</div><div class="pill-meta">${meta}</div>${group}</div>`;
      }).join("");
      return `<td>${pills}</td>`;
    }).join("");
    return `<tr><td class="period">${i + 1}</td>${cells}</tr>`;
  }).join("");

  return `<div class="page">
  <div class="page-header">
    <div class="class-name">Клас ${name}</div>
    <div class="head-block">
      <div class="head-label">Класен ръководител</div>
      <div class="head-name">${info.headTeacher || "—"}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:28px"></th>
        ${days.map(d => `<th>${d}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">
    <span>SmartSchedule</span>
    <span>${new Date().toLocaleDateString("bg-BG")}</span>
  </div>
</div>`;
}).join("")}
</body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `razpisanie-${new Date().toLocaleDateString("bg-BG").replace(/\./g, "-")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

    } catch (e) {
      setGenErr("Грешка при експорт: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const dotCls = st.status === "running" ? "dot-run" : st.status === "done" ? "dot-done" : st.status === "error" ? "dot-err" : "dot-idle";
  const statusLabel = { idle: "Изчакване", running: "Работи…", done: "Завършено", error: "Грешка" };

  return (
    <div className="fade-up" style={{ maxWidth: 540 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Генератор на разписание</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 22 }}>
          Стартира solver-а, който автоматично изгражда пълното разписание за всички класове. Процесът работи на фона — следи статуса по-долу.
        </div>
        {genErr && (
          <div style={{
            background: "rgba(224,92,92,.08)", border: `1px solid rgba(224,92,92,.25)`,
            borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.danger, marginBottom: 16,
            fontFamily: "Fira Code, monospace",
          }}>⚠ {genErr}</div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={generate} disabled={st.running}>
            {st.running ? <><Spinner /> Работи…</> : "▶  Генерирай"}
          </button>
          <button className="btn btn-ghost" onClick={fetchStatus}>↺  Обнови</button>
          <button
            className="btn btn-ghost"
            onClick={exportAll}
            disabled={st.running || exporting}
            style={{ color: C.success, borderColor: "rgba(62,207,142,.3)" }}
          >
            {exporting ? <><Spinner /> Експортира…</> : "📄  Експортирай PDF"}
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-ghost"
            style={{ color: C.danger, borderColor: "rgba(224,92,92,.3)" }}
            onClick={clearSchedule}
            disabled={st.running}
          >
            🗑 Изчисти
          </button>
        </div>
      </div>

      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {st.running ? <Spinner /> : <span className={`status-dot ${dotCls}`} />}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{statusLabel[st.status] ?? st.status}</div>
          {st.message && <div className="mono" style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{st.message}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── login form ───────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [loading, setLoad]  = useState(false);
  const [err, setErr]       = useState("");
  const [shake, setShake]   = useState(false);
  const cardRef = useRef(null);

  const submit = async () => {
    if (!username || !password) return;
    setLoad(true); setErr("");
    try {
      const data = await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      saveAuth(data.access_token, data.username);
      onLogin(data.username);
    } catch (e) {
      setErr("Невалидно потребителско име или парола.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoad(false);
    }
  };

  const onKey = e => e.key === "Enter" && submit();

  return (
    <div className="login-wrap">
      <div className={`login-card${shake ? " shake" : ""}`} ref={cardRef}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, background: C.accentSoft,
            border: `1px solid rgba(91,141,238,.25)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>📅</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.01em" }}>SmartSchedule</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: ".07em", textTransform: "uppercase" }}>Учителски вход</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: ".07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Потребителско име
            </label>
            <input className="text-input" type="text" autoFocus autoComplete="username"
              value={username} onChange={e => setUser(e.target.value)} onKeyDown={onKey} placeholder="admin" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: ".07em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Парола
            </label>
            <input className="text-input" type="password" autoComplete="current-password"
              value={password} onChange={e => setPass(e.target.value)} onKeyDown={onKey} placeholder="••••••••" />
          </div>
        </div>
        {err && (
          <div style={{
            marginTop: 14, background: "rgba(224,92,92,.08)", border: `1px solid rgba(224,92,92,.25)`,
            borderRadius: 8, padding: "9px 14px", fontSize: 12, color: C.danger,
          }}>{err}</div>
        )}
        <button className="btn btn-primary"
          style={{ width: "100%", marginTop: 22, justifyContent: "center", padding: "12px 20px", fontSize: 13 }}
          onClick={submit} disabled={loading || !username || !password}>
          {loading ? <><Spinner /> Влизане…</> : "Влез"}
        </button>
        <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: C.muted }}>
          Нямате достъп? Свържете се с администратора.
        </div>
      </div>
    </div>
  );
}

// ─── root app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [teacher, setTeacher] = useState(() => userName());
  const [view, setView]       = useState("schedule");
  const [showLogin, setLogin] = useState(false);

  const logout  = () => { clearAuth(); setTeacher(null); setView("schedule"); };
  const onLogin = (u) => { setTeacher(u); setLogin(false); setView("schedule"); };

  if (showLogin && !teacher) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <LoginForm onLogin={onLogin} />
        <div style={{ position: "fixed", top: 16, left: 16 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}
            onClick={() => setLogin(false)}>← Назад</button>
        </div>
      </>
    );
  }

  const teacherTabs = [
    { key: "schedule", label: "Разписание" },
    { key: "data",     label: "Данни" },
    { key: "generate", label: "⚡ Генерирай" },
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <header style={{ position: "sticky", top: 0, zIndex: 20, background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 24px",
          height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7, background: C.accentSoft,
              border: `1px solid rgba(91,141,238,.2)`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>📅</div>
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-.01em" }}>SmartSchedule</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {teacher
              ? teacherTabs.map(t => (
                  <button key={t.key} className={`tab${view === t.key ? " on" : ""}`}
                    onClick={() => setView(t.key)}>{t.label}</button>
                ))
              : <button className="tab on">Разписание</button>
            }
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {teacher ? (
              <>
                <div style={{
                  fontSize: 11, color: C.muted, background: C.card,
                  border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ color: C.success, fontSize: 9 }}>●</span>
                  <span className="mono">{teacher}</span>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={logout}>
                  Изход
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 14px" }}
                onClick={() => setLogin(true)}>
                🔑 Учители
              </button>
            )}
          </div>
        </div>
      </header>

      {teacher && (
        <div style={{ background: "rgba(91,141,238,0.05)", borderBottom: `1px solid rgba(91,141,238,0.12)`, padding: "6px 0" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", fontSize: 11, color: C.muted }}>
            Влязохте като <span style={{ color: C.accent, fontWeight: 600 }}>{teacher}</span> ·
            Токенът е валиден 8 часа · Само вие виждате учителския панел
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 24px" }}>
        {(view === "schedule" || !teacher) && <ScheduleViewer teacher={teacher} />}
        {view === "data"     && teacher && <DataPanel />}
        {view === "generate" && teacher && <GeneratorPanel />}
      </main>
    </>
  );
}