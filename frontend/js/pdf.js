// ==========================================
// ЕКСПОРТ КЪМ PDF
// ==========================================
async function exportAllClassesToPDF(btnElement) {
    if (!db.classes || db.classes.length === 0) {
        alert("Няма добавени класове за експортиране!");
        return;
    }

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳ Генериране на PDF...";
    btnElement.disabled = true;

    try {
        const sortedClasses = [...db.classes].sort((a, b) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );

        let allPagesHTML = `<div style="width: 1122px; background-color: #ffffff;">`;

        for (let i = 0; i < sortedClasses.length; i++) {
            const classCode = sortedClasses[i];
            const res = await fetch(`http://localhost:8080/api/schedule/class/${classCode}`);
            let scheduleData = null;
            if (res.ok) scheduleData = await res.json();

            const pageHTML = buildStaticTableForPDF(classCode, scheduleData);
            
            allPagesHTML += `
                <div style="padding: 20px 40px; box-sizing: border-box; width: 100%;">
                    ${pageHTML}
                </div>
            `;

            if (i < sortedClasses.length - 1) {
                allPagesHTML += `<div class="html2pdf__page-break"></div>`;
            }
        }
        allPagesHTML += `</div>`;

        const opt = {
            margin:       10, 
            filename:     `All_Classes_Schedules.pdf`,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 1122 }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: 'legacy' } 
        };

        await html2pdf().set(opt).from(allPagesHTML).save();

    } catch (err) {
        console.error("Грешка при PDF:", err);
        alert("Грешка при генерирането на PDF.");
    } finally {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

function buildStaticTableForPDF(classCode, scheduleData) {
    const foundClass = allSavedClasses.find(c => c.classCode === classCode);
    const teacherName = foundClass && foundClass.classTeacher ? foundClass.classTeacher.name : "Не е зададен";

    // ВНИМАНИЕ: Тук върнахме липсващия <thead> таг, който чупеше всичко!
    let html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333;">
            <div style="text-align: center; margin-bottom: 15px;">
                <h2 style="margin: 0; padding-bottom: 5px;">Седмична програма - Клас: ${classCode}</h2>
                <h4 style="margin: 0; color: #555; font-weight: normal;">Класен ръководител: <strong>${teacherName}</strong></h4>
            </div>
            <table style="width: 100%; margin: 0 auto; border-collapse: collapse; table-layout: fixed; font-size: 14px; word-wrap: break-word; overflow-wrap: break-word;">
                <thead> 
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 10px; width: 80px; background: #f3f4f6;">Час</th>
                        <th style="border: 1px solid #ddd; padding: 10px; background: #f3f4f6;">Понеделник</th>
                        <th style="border: 1px solid #ddd; padding: 10px; background: #f3f4f6;">Вторник</th>
                        <th style="border: 1px solid #ddd; padding: 10px; background: #f3f4f6;">Сряда</th>
                        <th style="border: 1px solid #ddd; padding: 10px; background: #f3f4f6;">Четвъртък</th>
                        <th style="border: 1px solid #ddd; padding: 10px; background: #f3f4f6;">Петък</th>
                    </tr>
                </thead>
                <tbody>
    `;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    for (let period = 1; period <= 7; period++) {
        html += `<tr>`;
        html += `
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #fafafa;">
                <div style="font-weight: bold; color: #4F46E5;">${period} час</div>
                <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">${classTimes[period-1]}</div>
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
                
                let localSubject = db.subjects.find(s => s.name === subjName);
                let bgColor = localSubject ? localSubject.color : generateDistinctColor(subjName);

                html += `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: ${bgColor};">
                        <div style="font-weight: bold; margin-bottom: 4px;">${subjName}</div>
                        <div style="font-size: 12px; color: #222;">${tName}</div>
                        <div style="font-size: 12px; font-weight: bold; color: #111; margin-top: 2px;">${rName}</div>
                    </td>
                `;
            } else {
                html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #aaa; background-color: #fff;">Празно</td>`;
            }
        }
        html += `</tr>`;
    }

    html += `</tbody></table></div>`;
    return html;
}