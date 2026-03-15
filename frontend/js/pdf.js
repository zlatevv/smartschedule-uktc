
async function exportAllClassesToPDF(btnElement) {
    if (!db.classes || db.classes.length === 0) {
        alert("Няма добавени класове за експортиране!");
        return;
    }

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳ Подготовка за PDF...";
    btnElement.disabled = true;

    try {
        const sortedClasses = [...db.classes].sort((a, b) => {
            const strA = String(a);
            const strB = String(b);
            
            const cohortA = parseInt(strA.substring(0, strA.length - 1));
            const cohortB = parseInt(strB.substring(0, strB.length - 1));
            
            if (cohortA !== cohortB) {
                return cohortB - cohortA; // Низходящо по випуск
            }
            
            const numA = parseInt(strA.slice(-1));
            const numB = parseInt(strB.slice(-1));
            
            return numA - numB; // Възходящо по паралелка
        });

        let allPagesHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Училищна програма</title>
            <style>
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    box-sizing: border-box;
                }
                
                @page { 
                    size: A4 landscape; 
                    margin: 10mm; 
                }
                
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    color: #333; 
                    margin: 0; 
                    padding: 0;
                    background: #fff;
                }

                .class-page {
                    width: 100%;
                    page-break-inside: avoid; /* Гарантира, че няма да среже таблица по средата */
                    margin-bottom: 25px; /* Разстояние между таблиците на една и съща страница */
                }

                .header {
                    text-align: center;
                    margin-bottom: 8px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }

                th, td {
                    border: 1px solid #444; /* По-тънки рамки за по-прибран вид */
                    text-align: center;
                    padding: 4px 2px; /* Много по-малък padding, за да се свият редовете */
                    overflow: hidden;
                    word-wrap: break-word;
                }
            </style>
        </head>
        <body>
        `;

        for (let i = 0; i < sortedClasses.length; i++) {
            const classCode = sortedClasses[i];
            const res = await fetch(`http://localhost:8080/api/schedule/class/${classCode}`);
            let scheduleData = null;
            if (res.ok) scheduleData = await res.json();

            allPagesHTML += `
                <div class="class-page">
                    ${buildStaticTableForPrint(classCode, scheduleData)}
                </div>
            `;
        }

        allPagesHTML += `</body></html>`;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(allPagesHTML);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 2000);

        }, 500);

    } catch (err) {
        console.error("Грешка при подготовката за PDF:", err);
        alert("Възникна грешка при извличане на данните.");
    } finally {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

function buildStaticTableForPrint(classCode, scheduleData) {
    const foundClass = (typeof allSavedClasses !== 'undefined') 
        ? allSavedClasses.find(c => c.classCode === classCode) 
        : db.classes.find(c => c === classCode);
        
    const teacherName = foundClass && foundClass.classTeacher ? foundClass.classTeacher.name : "Не е зададен";

    let html = `
        <div class="header">
            <h2 style="margin: 0; padding-bottom: 2px; font-size: 18px;">Седмична програма - Клас: ${classCode}</h2>
            <h4 style="margin: 0; color: #555; font-weight: normal; font-size: 14px;">Класен ръководител: <strong>${teacherName}</strong></h4>
        </div>
        <table>
            <thead> 
                <tr>
                    <th style="width: 65px; background-color: #f3f4f6; font-size: 13px; padding: 6px;">Час</th>
                    <th style="background-color: #f3f4f6; font-size: 13px;">Понеделник</th>
                    <th style="background-color: #f3f4f6; font-size: 13px;">Вторник</th>
                    <th style="background-color: #f3f4f6; font-size: 13px;">Сряда</th>
                    <th style="background-color: #f3f4f6; font-size: 13px;">Четвъртък</th>
                    <th style="background-color: #f3f4f6; font-size: 13px;">Петък</th>
                </tr>
            </thead>
            <tbody>
    `;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const times = ["08:00 - 08:45", "08:55 - 09:40", "09:50 - 10:35", "10:55 - 11:40", "11:50 - 12:35", "12:45 - 13:30", "13:40 - 14:25"];
    
    for (let period = 1; period <= 7; period++) {
        html += `<tr>`;
        html += `
            <td style="background-color: #fafafa;">
                <div style="font-weight: bold; color: #4F46E5; font-size: 13px;">${period} час</div>
                <div style="font-size: 10px; color: #666; margin-top: 2px;">${times[period-1] || ""}</div>
            </td>
        `;
                 
        for (let day of days) {
            let slot = null;
            if (scheduleData && scheduleData[day] && scheduleData[day][period - 1]) {
                slot = scheduleData[day][period - 1];
            }

            if (slot && slot.subject && slot.subject.subjectName) {
                const subjName = slot.subject.subjectName;
                const tName = slot.teacher ? slot.teacher.name : "";
                const rName = slot.room ? (slot.room.name || slot.room.roomId) : "";
                
                let localSubject = db.subjects ? db.subjects.find(s => s.name === subjName) : null;
                let bgColor = localSubject ? localSubject.color : (typeof generateDistinctColor === "function" ? generateDistinctColor(subjName) : "#e0e7ff");

                // Намалени размери на шрифта вътре в клетките
                html += `
                    <td style="background-color: ${bgColor};">
                        <div style="font-weight: bold; font-size: 13px; margin-bottom: 2px; color: #000;">${subjName}</div>
                        <div style="font-size: 11px; color: #222; margin-bottom: 1px;">${tName}</div>
                        <div style="font-size: 11px; font-weight: bold; color: #111;">${rName}</div>
                    </td>
                `;
            } else {
                html += `<td style="color: #999; background-color: #fff; font-size: 12px;">-</td>`;
            }
        }
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    return html;
}