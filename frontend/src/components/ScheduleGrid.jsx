import { useState } from "react";
import { C, DAYS, DAY_KEYS } from "../constants";
import Spinner from "./Spinner";
import Empty from "./Empty";
import SlotPill from "./SlotPill";

export default function ScheduleGrid({ schedule, loading, isEditing, onSlotDrop }) {
    const [dragOverCell, setDragOverCell] = useState(null);

    if (loading) {
        return (
            <div
                style={{
                    padding: "60px 0",
                    textAlign: "center",
                    color: C.muted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                }}
            >
                <Spinner /> зарежда се…
            </div>
        );
    }

    return (
        <div
            style={{
                overflowX: "auto",
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                flex: 1,
            }}
        >
            <table className="sched-table" style={{ minWidth: 600 }}>
                <thead>
                <tr>
                    <th style={{ minWidth: 32, width: 32 }}></th>
                    {DAYS.map((d) => (
                        <th key={d}>{d}</th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                        <td className="p-col">{i + 1}</td>
                        {DAY_KEYS.map((dayKey) => {
                            const slots = schedule?.[dayKey]?.[i] ?? [];
                            const cellKey = `${dayKey}-${i}`;
                            return (
                                <td
                                    key={dayKey}
                                    className={`drop-zone ${dragOverCell === cellKey ? "drag-over" : ""}`}
                                    onDragOver={
                                        isEditing
                                            ? (e) => {
                                                e.preventDefault();
                                                setDragOverCell(cellKey);
                                            }
                                            : undefined
                                    }
                                    onDragLeave={() => setDragOverCell(null)}
                                    onDrop={
                                        isEditing
                                            ? (e) => {
                                                e.preventDefault();
                                                setDragOverCell(null);
                                                const subjectData = e.dataTransfer.getData("application/json");
                                                if (subjectData && onSlotDrop) {
                                                    onSlotDrop(dayKey, i, JSON.parse(subjectData));
                                                }
                                            }
                                            : undefined
                                    }
                                >
                                    {slots.length === 0 ? (
                                        <Empty />
                                    ) : (
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "6px",
                                                alignItems: "stretch",
                                                height: "100%",
                                            }}
                                        >
                                            {slots.map((s, j) => (
                                                <div key={j} style={{ flex: 1, minWidth: 0 }}>
                                                    <SlotPill slot={s} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
