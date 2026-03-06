
// 6. ВИЗУАЛИЗАЦИЯ НА ГЕНЕРИРАНАТА ПРОГРАМА
// ==========================================

function visualizeGeneratedSchedule(scheduleData) {
    console.log("Получени данни от сървъра за визуализация:", scheduleData);
    
    // 1. Изчистваме старата програма от таблицата
    clearScheduleTable();

    // 2. Речник за превод на дните 
    const dayMapping = {
        "monday": "mon",
        "tuesday": "tue",
        "wednesday": "wed",
        "thursday": "thu",
        "friday": "fri"
    };

    // 3. Обхождаме получения JSON
    if (typeof scheduleData === 'object' && !Array.isArray(scheduleData)) {
        for (const [backendDay, slots] of Object.entries(scheduleData)) {
            const frontendDay = dayMapping[backendDay.toLowerCase()];
            if (!frontendDay || !Array.isArray(slots)) continue;

            slots.forEach((slot, index) => {
                const period = index + 1; 
                const cell = document.querySelector(`td[data-slot="${frontendDay}-${period}"]`);

                if (cell && slot && slot.subject && slot.subject.subjectName) {
                    const subjectName = slot.subject.subjectName;
                    
                    let localSubject = db.subjects.find(s => s.name === subjectName);
                    if (!localSubject) {
                        localSubject = { name: subjectName, color: generateDistinctColor(subjectName) };
                    }

                    applySubjectToCell(cell, localSubject);

                    const teacherSelect = cell.querySelector('.teacher-select');
                    const roomSelect = cell.querySelector('.room-select');

                    // Попълване на учителя
                    if (slot.teacher && slot.teacher.name) {
                        if (!Array.from(teacherSelect.options).some(opt => opt.value === slot.teacher.name)) {
                             const opt = document.createElement('option');
                             opt.value = slot.teacher.name;
                             opt.textContent = slot.teacher.name;
                             teacherSelect.appendChild(opt);
                        }
                        teacherSelect.value = slot.teacher.name;
                    }

                    // Попълване на стаята
                    if (slot.room) {
                        const roomVal = slot.room.name || slot.room.roomId.toString();
                        if (!Array.from(roomSelect.options).some(opt => opt.value == roomVal)) {
                             const opt = document.createElement('option');
                             opt.value = roomVal;
                             opt.textContent = roomVal;
                             roomSelect.appendChild(opt);
                        }
                        roomSelect.value = roomVal;
                    }
                }
            });
        }
    } else if (Array.isArray(scheduleData)) {
        console.error("Сървърът върна масив, а не обект с дни! Проверете структурата в конзолата.");
        alert("Грешен формат на данните от сървъра. Отворете конзолата (F12) за повече инфо.");
    }
}

function clearScheduleTable() {
    document.querySelectorAll('.drop-zone').forEach(cell => {
        const contentBox = cell.querySelector('.cell-content');
        const title = cell.querySelector('.cell-subject-title');
        const emptyHint = cell.querySelector('.empty-hint');
        const teacherSelect = cell.querySelector('.teacher-select');
        const roomSelect = cell.querySelector('.room-select');

        contentBox.classList.remove('filled');
        contentBox.style.backgroundColor = '';
        title.style.display = 'none';
        title.textContent = '';
        emptyHint.style.display = 'block';
        
        teacherSelect.innerHTML = '<option value="">Учител</option>';
        roomSelect.innerHTML = '<option value="">Стая</option>';
        
        db.rooms.forEach(room => {
            const opt = document.createElement('option');
            opt.value = room; opt.textContent = room;
            roomSelect.appendChild(opt);
        });
    });
}
