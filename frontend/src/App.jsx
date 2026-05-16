import { useState } from "react";
import { C, GLOBAL_CSS } from "./constants";
import { userName, clearAuth } from "./utils";
import LoginForm from "./components/LoginForm";
import ScheduleViewer from "./panels/ScheduleViewer";
import DataPanel from "./panels/DataPanel";
import GeneratorPanel from "./panels/GeneratorPanel";

const TEACHER_TABS = [
  { key: "schedule", label: "Разписание" },
  { key: "data",     label: "Данни" },
  { key: "generate", label: "⚡ Генерирай" },
];

export default function App() {
  const [teacher,   setTeacher]   = useState(() => userName());
  const [view,      setView]      = useState("schedule");
  const [showLogin, setShowLogin] = useState(false);

  const logout  = () => { clearAuth(); setTeacher(null); setView("schedule"); };
  const onLogin = (u) => { setTeacher(u); setShowLogin(false); setView("schedule"); };

  // ── Login screen ──────────────────────────────────────────────────────────
  if (showLogin && !teacher) {
    return (
        <>
          <style>{GLOBAL_CSS}</style>
          <LoginForm onLogin={onLogin} />
          <div style={{ position: "fixed", top: 16, left: 16 }}>
            <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "6px 14px" }}
                onClick={() => setShowLogin(false)}
            >
              ← Назад
            </button>
          </div>
        </>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
      <>
        <style>{GLOBAL_CSS}</style>

        {/* Header */}
        <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: C.surface,
              borderBottom: `1px solid ${C.border}`,
            }}
        >
          <div
              style={{
                maxWidth: 1100,
                margin: "0 auto",
                padding: "0 24px",
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
          >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: C.accentSoft,
                    border: `1px solid rgba(91,141,238,.2)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                  }}
              >
                📅
              </div>
              <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-.01em" }}>
              SmartSchedule
            </span>
            </div>

            {/* Nav tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {teacher ? (
                  TEACHER_TABS.map((t) => (
                      <button
                          key={t.key}
                          className={`tab${view === t.key ? " on" : ""}`}
                          onClick={() => setView(t.key)}
                      >
                        {t.label}
                      </button>
                  ))
              ) : (
                  <button className="tab on">Разписание</button>
              )}
            </div>

            {/* Auth area */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {teacher ? (
                  <>
                    <div
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          background: C.card,
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          padding: "4px 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                    >
                      <span style={{ color: C.success, fontSize: 9 }}>●</span>
                      <span className="mono">{teacher}</span>
                    </div>
                    <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: "5px 12px" }}
                        onClick={logout}
                    >
                      Изход
                    </button>
                  </>
              ) : (
                  <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "6px 14px" }}
                      onClick={() => setShowLogin(true)}
                  >
                    🔑 Учители
                  </button>
              )}
            </div>
          </div>
        </header>

        {/* Auth banner */}
        {teacher && (
            <div
                style={{
                  background: "rgba(91,141,238,0.05)",
                  borderBottom: `1px solid rgba(91,141,238,0.12)`,
                  padding: "6px 0",
                }}
            >
              <div
                  style={{
                    maxWidth: 1100,
                    margin: "0 auto",
                    padding: "0 24px",
                    fontSize: 11,
                    color: C.muted,
                  }}
              >
                Влязохте като{" "}
                <span style={{ color: C.accent, fontWeight: 600 }}>{teacher}</span> ·
                Токенът е валиден 8 часа · Само вие виждате учителския панел
              </div>
            </div>
        )}

        {/* Main content */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 24px" }}>
          {(view === "schedule" || !teacher) && <ScheduleViewer teacher={teacher} />}
          {view === "data"     && teacher && <DataPanel />}
          {view === "generate" && teacher && <GeneratorPanel />}
        </main>
      </>
  );
}
