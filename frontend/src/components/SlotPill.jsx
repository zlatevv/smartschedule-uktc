import { C } from "../constants";
import { subjectColor } from "../utils/colors";

export default function SlotPill({ slot }) {
    if (!slot?.subject) return null;

    const col = subjectColor(slot.subject.name);

    const shortSubject =
        slot.subject.name.length > 15
            ? slot.subject.name
                .split(/\s+/)
                .map((w) => (w === "-" ? "-" : w.charAt(0).toUpperCase()))
                .join("")
            : slot.subject.name;

    return (
        <div
            title={`${slot.subject.name}\n${slot.teacher?.name || ""}`}
            style={{
                padding: "6px 9px",
                borderRadius: 7,
                background: col.bg,
                border: `1px solid ${col.border}`,
                transition: "filter .12s",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
        >
            <div
                style={{
                    fontWeight: 700,
                    fontSize: 12,
                    color: col.text,
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                }}
            >
                {shortSubject}
            </div>

            {slot.room && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    {slot.room.roomId}
                </div>
            )}

            {slot.teacher && (
                <div
                    style={{
                        fontSize: 10,
                        color: col.text,
                        opacity: 0.72,
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {slot.teacher.name}
                </div>
            )}

            <div style={{ marginTop: "auto", paddingTop: 4 }}>
                {slot.groupId && (
                    <span
                        style={{
                            display: "inline-block",
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: ".06em",
                            fontFamily: "Fira Code, monospace",
                            textTransform: "uppercase",
                            background: col.border,
                            color: col.text,
                        }}
                    >
            гр.{slot.groupId}
          </span>
                )}
            </div>
        </div>
    );
}
