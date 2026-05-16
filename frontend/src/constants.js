export const C = {
    bg:         "#0b0d12",
    surface:    "#11141c",
    card:       "#181c27",
    border:     "#222840",
    accent:     "#5b8dee",
    accentSoft: "rgba(91,141,238,0.12)",
    text:       "#dde2f0",
    muted:      "#5a6180",
    faint:      "#2a2f44",
    success:    "#3ecf8e",
    warning:    "#f0a500",
    danger:     "#e05c5c",
};

export const DAYS     = ["Понеделник","Вторник","Сряда","Четвъртък","Петък"];
export const DAY_KEYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];

export const PALETTE = [
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

export const GLOBAL_CSS = `
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
  width:100%;border-collapse:separate;border-spacing:0;
  font-size:12px;table-layout:fixed;
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
  border-bottom:1px solid ${C.faint};min-width:120px;max-width:200px
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
  cursor:grab;transition:transform 0.1s;width:100%;display:block;
}
.drag-subject:active{cursor:grabbing;transform:scale(0.97);}
.drop-zone{transition:background 0.2s;height:100%;min-height:50px;}
.drop-zone.drag-over{background:${C.accentSoft};outline:2px dashed ${C.accent};border-radius:6px;}
`;
