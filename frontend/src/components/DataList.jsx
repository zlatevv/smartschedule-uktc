import { C } from "../constants";
import Spinner from "./Spinner";

export default function DataList({ title, items, loading, renderItem }) {
    return (
        <div
            style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    padding: "10px 16px",
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.muted,
                    letterSpacing: ".09em",
                    textTransform: "uppercase",
                }}
            >
                {title}
            </div>

            <div style={{ maxHeight: 280, overflowY: "auto" }}>
                {loading ? (
                    <div style={{ padding: 20, textAlign: "center" }}>
                        <Spinner />
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: "14px 16px", fontSize: 12, color: C.muted }}>
                        Няма данни
                    </div>
                ) : (
                    items.map((item, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "8px 16px",
                                fontSize: 12,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                borderBottom: i < items.length - 1 ? `1px solid ${C.faint}` : "none",
                            }}
                        >
                            {renderItem(item)}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
