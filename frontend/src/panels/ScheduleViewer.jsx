import { useState, useEffect, useCallback } from "react";
import { C } from "../constants";
import { apiFetch } from "../utils";
import { subjectColor } from "../utils/colors";
import Spinner from "../components/Spinner";
import ScheduleGrid from "../components/ScheduleGrid";

export default function ScheduleViewer({ teacher }) {
  const [classes,         setClasses]         = useState([]);
  const [subjects,        setSubjects]        = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selected,        setSelected]        = useState("");
  const [schedule,        setSchedule]        = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [err,             setErr]             = useState("");
  const [subjectFilter,   setSubjectFilter]   = useState("");

  // Load class list once on mount
  useEffect(() => {
    apiFetch("/api/classes")
      .then((d) => { setClasses(d); if (d.length) setSelected(d[0]); })
      .catch(() => setErr("Неуспешно зареждане на класовете."));
  }, []);

  // Reload schedule whenever selected class changes
  const loadSchedule = useCallback(() => {
    if (!selected) return;
    setLoading(true);
    setErr("");
    apiFetch(`/api/schedule/class/${encodeURIComponent(selected)}`)
      .then((d) => { setSchedule(d); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [selected]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // Reload curriculum subjects whenever selected class changes (teacher sidebar only)
  useEffect(() => {
    if (!selected || !teacher) return;
    setSubjectsLoading(true);
    setSubjectFilter("");
    apiFetch(`/api/classes/${encodeURIComponent(selected)}/subjects`)
      .then((d) => { setSubjects(d); setSubjectsLoading(false); })
      .catch(() => setSubjectsLoading(false));
  }, [selected, teacher]);

  const handleSlotDrop = async (dayKey, periodIndex, subject) => {
    try {
      await apiFetch("/api/schedule/slot", {
        method: "POST",
        body: JSON.stringify({
          classId: selected,
          subjectId: subject.id,
          day: dayKey,
          period: periodIndex,
        }),
      });
      loadSchedule();
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div className="fade-up">
      {/* Class selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.muted,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Клас
        </span>
        <select
          className="select-ctrl"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {loading && <Spinner />}
      </div>

      {err && (
        <div
          style={{
            fontSize: 12,
            color: C.danger,
            marginBottom: 14,
            fontFamily: "Fira Code, monospace",
          }}
        >
          ⚠ {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <ScheduleGrid
          schedule={schedule}
          loading={loading && !schedule}
          isEditing={!!teacher}
          onSlotDrop={handleSlotDrop}
        />

        {/* Subject drag panel — only for logged-in teachers */}
        {teacher && (
          <div
            className="builder-panel"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: 220,
              flexShrink: 0,
              maxHeight: 600,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                marginBottom: 6,
              }}
            >
              Предмети
            </div>
            <input
              className="text-input"
              placeholder="Търси предмет…"
              style={{ marginBottom: 10, fontSize: 11, padding: "6px 10px" }}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value.toLowerCase())}
            />
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
              Плъзнете предмет в таблицата, за да го добавите.
            </div>

            {subjectsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
                <Spinner />
              </div>
            ) : subjects.length === 0 ? (
              <div style={{ fontSize: 11, color: C.muted }}>
                Няма предмети за този клас.
              </div>
            ) : (
              subjects
                .filter((subj) => subj.name.toLowerCase().includes(subjectFilter))
                .map((subj) => {
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
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        background: col.bg,
                        border: `1px solid ${col.border}`,
                        color: col.text,
                      }}
                    >
                      {subj.name}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
