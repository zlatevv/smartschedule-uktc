import { useState, useEffect, useCallback } from "react";
import { C, DAYS, DAY_KEYS } from "../constants";
import { apiFetch } from "../utils";
import Spinner from "../components/Spinner";

// ─── PDF export ───────────────────────────────────────────────────────────────
// The original bug: html2pdf uses html2canvas to snapshot the DOM. When the
// container was placed off-screen (z-index:-9999) the browser skipped painting
// it, so canvas captured a blank page. Even with position:absolute top:0 left:0
// the dark background of the app bled through.
//
// Fix: build the full HTML as a self-contained string and write it into a hidden
// <iframe>, then call iframe.contentWindow.print(). The browser prints the
// iframe document directly — no canvas snapshotting needed, crisp vector text,
// works at any scale, and no third-party dependency.

function buildPdfHtml(schedules) {
  const pagesHtml = schedules
    .map(({ name, headTeacher, data }) => {
      const tableRows = Array.from({ length: 8 }, (_, i) => {
        const cells = DAY_KEYS.map((dk) => {
          const slots = data?.[dk]?.[i] ?? [];
          if (slots.length === 0) return `<td class="empty">—</td>`;
          const pills = slots
            .map((s) => {
              const subj    = s.subject?.name  || "";
              const teacher = s.teacher?.name  || "";
              const room    = s.room?.roomId   || "";
              const group   = s.groupId ? `<span class="grp">гр.${s.groupId}</span>` : "";
              const meta    = [room, teacher].filter(Boolean).join(" · ");
              return `<div class="pill">
                <div class="pill-subj">${subj}</div>
                <div class="pill-meta">${meta}</div>
                ${group}
              </div>`;
            })
            .join("");
          return `<td>${pills}</td>`;
        }).join("");
        return `<tr><td class="period">${i + 1}</td>${cells}</tr>`;
      }).join("");

      const headTeacherHtml = headTeacher
        ? `<div class="head-teacher-block">
             <div class="head-teacher-label">Класен ръководител</div>
             <div class="head-teacher-name">${headTeacher}</div>
             <div class="date">${new Date().toLocaleDateString("bg-BG")}</div>
           </div>`
        : `<div class="date">${new Date().toLocaleDateString("bg-BG")}</div>`;

      return `
        <div class="page">
          <div class="page-header">
            <div class="class-name">Клас ${name}</div>
            ${headTeacherHtml}
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:28px"></th>
                ${DAYS.map((d) => `<th>${d}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="footer">SmartSchedule</div>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Разписание</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Onest:wght@400;700;800&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Onest', sans-serif;
      background: #fff;
      color: #1a1f2e;
      font-size: 11px;
    }

    .page {
      width: 297mm;
      min-height: 210mm;
      padding: 14mm 12mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .page-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      border-bottom: 2.5px solid #1a1f2e;
      padding-bottom: 10px;
    }

    .class-name { font-size: 36px; font-weight: 800; letter-spacing: -.02em; line-height: 1; }
    .head-teacher-block { text-align: right; }
    .head-teacher-label { font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #8892aa; margin-bottom: 2px; }
    .head-teacher-name { font-size: 15px; font-weight: 700; color: #1a1f2e; }
    .date { font-size: 11px; color: #aab0c4; margin-top: 3px; }

    table {
      width: 100%;
      border-collapse: collapse;
      flex: 1;
    }

    th {
      background: #f0f2f8;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: #5a6180;
      padding: 7px 10px;
      text-align: left;
      border: 1px solid #dde2f0;
    }

    td {
      border: 1px solid #e8eaf2;
      padding: 5px 8px;
      vertical-align: top;
    }

    .period {
      text-align: center;
      width: 28px;
      background: #f8f9fc;
      font-weight: 700;
      color: #8892aa;
    }

    .empty { text-align: center; color: #d0d4e8; }

    .pill {
      background: #f0f4ff;
      border-left: 3px solid #5b8dee;
      border-radius: 4px;
      padding: 4px 6px;
      margin-bottom: 3px;
    }
    .pill:last-child { margin-bottom: 0; }
    .pill-subj { font-weight: 700; font-size: 10px; }
    .pill-meta { font-size: 9px; color: #7a82a0; margin-top: 2px; }
    .grp {
      display: inline-block;
      margin-top: 3px;
      font-size: 8px;
      font-weight: 700;
      background: #dce8ff;
      color: #5b8dee;
      padding: 1px 5px;
      border-radius: 3px;
    }

    .footer {
      font-size: 9px;
      color: #c0c4d8;
      text-align: right;
      margin-top: auto;
      padding-top: 6px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

async function exportToPdf(setErr, setExporting) {
  setExporting(true);
  setErr("");

  try {
    const classDetails  = await apiFetch("/api/classes/details");
    const allClassNames = classDetails.map((c) => c.name).filter(Boolean);

    // Build a lookup so we can attach headTeacher to each schedule
    const headTeacherByName = Object.fromEntries(
      classDetails.map((c) => [c.name, c.headTeacher || null])
    );

    const schedules = await Promise.all(
      allClassNames.map((name) =>
        apiFetch(`/api/schedule/class/${encodeURIComponent(name)}`)
          .then((data) => ({ name, headTeacher: headTeacherByName[name], data }))
          .catch(() => ({ name, headTeacher: headTeacherByName[name], data: null }))
      )
    );

    const html = buildPdfHtml(schedules);

    // Create a hidden iframe and write the document into it
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right    = "0";
    iframe.style.bottom   = "0";
    iframe.style.width    = "0";
    iframe.style.height   = "0";
    iframe.style.border   = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for fonts / images to load before printing
    await new Promise((resolve) => {
      iframe.contentWindow.onload = resolve;
      // Fallback in case onload already fired
      if (doc.readyState === "complete") setTimeout(resolve, 800);
    });

    // Extra breath for Google Fonts
    await new Promise((resolve) => setTimeout(resolve, 600));

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    // Clean up after the print dialog closes (slight delay)
    setTimeout(() => document.body.removeChild(iframe), 2000);
  } catch (e) {
    setErr("Грешка при създаване на PDF: " + e.message);
    console.error(e);
  } finally {
    setExporting(false);
  }
}

// ─── component ────────────────────────────────────────────────────────────────
export default function GeneratorPanel() {
  const [st, setSt]           = useState({ status: "idle", message: "", running: false });
  const [polling, setPoll]     = useState(false);
  const [genErr, setGenErr]    = useState("");
  const [exporting, setExport] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await apiFetch("/api/generate/status");
      setSt(s);
      return s;
    } catch {
      return null;
    }
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
    } catch (e) {
      setGenErr(e.message);
    }
  };

  const clearSchedule = async () => {
    if (!window.confirm("ВНИМАНИЕ: Това ще изтрие цялото разписание. Сигурни ли сте?")) return;
    setGenErr("");
    try {
      await apiFetch("/api/schedule/clear", { method: "POST" });
      fetchStatus();
      alert("Разписанието е изчистено успешно.");
    } catch (e) {
      setGenErr("Грешка при изчистване: " + e.message);
    }
  };

  const dotClass = st.running
    ? "dot-run"
    : st.status === "done"
    ? "dot-done"
    : st.status === "error"
    ? "dot-err"
    : "dot-idle";

  return (
    <div className="fade-up">
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxWidth: 500,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
          Генератор на разписание
        </div>

        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: C.muted }}>
          <span className={`status-dot ${dotClass}`} />
          <span>{st.message || "Няма активна задача"}</span>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={generate} disabled={st.running}>
            {st.running ? <><Spinner /> Генериране...</> : <>⚡ Генерирай разписание</>}
          </button>

          <button className="btn btn-ghost" onClick={clearSchedule}>
            🗑 Изчисти
          </button>

          <button
            className="btn btn-primary"
            onClick={() => exportToPdf(setGenErr, setExport)}
            disabled={exporting}
          >
            {exporting ? <><Spinner /> PDF...</> : <>📄 Export PDF</>}
          </button>
        </div>

        {genErr && (
          <div style={{ fontSize: 12, color: C.danger, marginTop: 4 }}>⚠ {genErr}</div>
        )}
      </div>
    </div>
  );
}
