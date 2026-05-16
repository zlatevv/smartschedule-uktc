import { useState, useRef } from "react";
import { C } from "../constants";
import { apiFetch, saveAuth } from "../utils";
import Spinner from "./Spinner";

export default function LoginForm({ onLogin }) {
    const [username, setUser] = useState("");
    const [password, setPass] = useState("");
    const [loading, setLoad]  = useState(false);
    const [err, setErr]       = useState("");
    const [shake, setShake]   = useState(false);
    const cardRef = useRef(null);

    const submit = async () => {
        if (!username || !password) return;
        setLoad(true);
        setErr("");
        try {
            const data = await apiFetch("/api/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });
            saveAuth(data.access_token, data.username);
            onLogin(data.username);
        } catch {
            setErr("Невалидно потребителско име или парола.");
            setShake(true);
            setTimeout(() => setShake(false), 500);
        } finally {
            setLoad(false);
        }
    };

    const onKey = (e) => e.key === "Enter" && submit();

    return (
        <div className="login-wrap">
            <div className={`login-card${shake ? " shake" : ""}`} ref={cardRef}>
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 9,
                            background: C.accentSoft,
                            border: `1px solid rgba(91,141,238,.25)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                        }}
                    >
                        📅
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.01em" }}>
                            SmartSchedule
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                color: C.muted,
                                letterSpacing: ".07em",
                                textTransform: "uppercase",
                            }}
                        >
                            Учителски вход
                        </div>
                    </div>
                </div>

                {/* Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                        <label
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: C.muted,
                                letterSpacing: ".07em",
                                textTransform: "uppercase",
                                display: "block",
                                marginBottom: 6,
                            }}
                        >
                            Потребителско име
                        </label>
                        <input
                            className="text-input"
                            type="text"
                            autoFocus
                            autoComplete="username"
                            value={username}
                            onChange={(e) => setUser(e.target.value)}
                            onKeyDown={onKey}
                            placeholder="admin"
                        />
                    </div>
                    <div>
                        <label
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: C.muted,
                                letterSpacing: ".07em",
                                textTransform: "uppercase",
                                display: "block",
                                marginBottom: 6,
                            }}
                        >
                            Парола
                        </label>
                        <input
                            className="text-input"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPass(e.target.value)}
                            onKeyDown={onKey}
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {/* Error */}
                {err && (
                    <div
                        style={{
                            marginTop: 14,
                            background: "rgba(224,92,92,.08)",
                            border: `1px solid rgba(224,92,92,.25)`,
                            borderRadius: 8,
                            padding: "9px 14px",
                            fontSize: 12,
                            color: C.danger,
                        }}
                    >
                        {err}
                    </div>
                )}

                {/* Submit */}
                <button
                    className="btn btn-primary"
                    style={{
                        width: "100%",
                        marginTop: 22,
                        justifyContent: "center",
                        padding: "12px 20px",
                        fontSize: 13,
                    }}
                    onClick={submit}
                    disabled={loading || !username || !password}
                >
                    {loading ? <><Spinner /> Влизане…</> : "Влез"}
                </button>

                <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: C.muted }}>
                    Нямате достъп? Свържете се с администратора.
                </div>
            </div>
        </div>
    );
}
