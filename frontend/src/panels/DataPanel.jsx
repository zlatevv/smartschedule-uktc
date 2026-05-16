import { useState, useEffect } from "react";
import { C } from "../constants";
import { apiFetch } from "../utils";
import { subjectColor } from "../utils/colors";
import DataList from "../components/DataList.jsx";

export default function DataPanel() {
    const [data, setData]    = useState({ teachers: [], rooms: [], subjects: [], classes: [] });
    const [loading, setLoad] = useState(true);
    const [err, setErr]      = useState("");

    useEffect(() => {
        Promise.all([
            apiFetch("/api/teachers"),
            apiFetch("/api/rooms"),
            apiFetch("/api/subjects"),
            apiFetch("/api/classes"),
        ])
            .then(([teachers, rooms, subjects, classes]) => {
                setData({ teachers, rooms, subjects, classes: classes.map((c) => ({ name: c })) });
                setLoad(false);
            })
            .catch((e) => {
                setErr("Грешка при зареждане: " + e.message + ". Проверете сървъра.");
                setLoad(false);
            });
    }, []);

    return (
        <div className="fade-up">
            {err && (
                <div
                    style={{
                        background: "rgba(224,92,92,.08)",
                        border: `1px solid rgba(224,92,92,.25)`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: C.danger,
                        marginBottom: 16,
                        fontFamily: "Fira Code, monospace",
                    }}
                >
                    ⚠ {err}
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: 14,
                }}
            >
                <DataList
                    title="Учители"
                    items={data.teachers}
                    loading={loading}
                    renderItem={(t) => (
                        <>
                            <span>{t.name}</span>
                            <span className="mono" style={{ fontSize: 10, color: C.muted }}>#{t.id}</span>
                        </>
                    )}
                />

                <DataList
                    title="Стаи"
                    items={data.rooms}
                    loading={loading}
                    renderItem={(r) => (
                        <>
                            <span>{r.name}</span>
                            {r.hasComputers && <span className="badge b-blue">💻 PC</span>}
                        </>
                    )}
                />

                <DataList
                    title="Предмети"
                    items={data.subjects}
                    loading={loading}
                    renderItem={(s) => {
                        const col = subjectColor(s.name);
                        return (
                            <>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                      style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: col.text,
                          flexShrink: 0,
                      }}
                  />
                    {s.name}
                </span>
                                <span className="mono" style={{ fontSize: 10, color: C.muted }}>#{s.id}</span>
                            </>
                        );
                    }}
                />

                <DataList
                    title="Класове"
                    items={data.classes}
                    loading={loading}
                    renderItem={(c) => <span>{c.name}</span>}
                />
            </div>
        </div>
    );
}
