
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

            slots.forEach((lessonArray, index) => {
                const period = index + 1; 
                const cell = document.querySelector(`td[data-slot="${frontendDay}-${period}"]`);

                // We only proceed if we have a cell and the lessonArray has items inside it
                if (!cell || !Array.isArray(lessonArray) || lessonArray.length === 0) return;

                // Make the cell a flex container so multiple lessons sit perfectly side-by-side
                cell.style.display = 'flex';
                cell.style.gap = '4px';
                cell.style.padding = '2px'
                cell.style.alignItems = 'stretch';;

                // We grab your existing empty block inside the cell to use as a template
                const template = cell.querySelector('.cell-content');
                if (!template) return;
                
                // Hide the empty hint globally for this cell
                const emptyHint = cell.querySelector('.empty-hint');
                if (emptyHint) emptyHint.style.display = 'none';

                // Clone the base template so we have a fresh copy, then wipe the cell completely
                const baseTemplate = template.cloneNode(true);
                cell.innerHTML = ''; 

                // Loop through however many lessons are in this timeslot (1, 2, or more!)
                lessonArray.forEach(slot => {
                    if (slot && slot.subject && slot.subject.name) {
                        // Create a new block for this specific lesson
                        const newContent = baseTemplate.cloneNode(true);
                        newContent.classList.add('filled');
                        newContent.style.flex = '1 1 0px'; 
                        newContent.style.minWidth = '0'; 
                        newContent.style.overflow = 'hidden';
                        
                        const name = slot.subject.name;
                        
                        // Fallback logic for colors/subjects
                        let localSubject = typeof db !== 'undefined' && db.subjects ? db.subjects.find(s => s.name === name) : null;
                        if (!localSubject) {
                            localSubject = { name: name, color: generateDistinctColor(name) };
                        }

                        // Apply custom drawing (since we don't have applySubjectToCell's code here)
                        newContent.style.backgroundColor = localSubject.color;
                        const title = newContent.querySelector('.cell-subject-title');
                        if (title) {
                            title.style.display = 'block';
                            title.textContent = name;
                        }

                        const teacherSelect = newContent.querySelector('.teacher-select');
                        const roomSelect = newContent.querySelector('.room-select');

                        // Попълване на учителя
                        if (slot.teacher && slot.teacher.name && teacherSelect) {
                            if (!Array.from(teacherSelect.options).some(opt => opt.value === slot.teacher.name)) {
                                 const opt = document.createElement('option');
                                 opt.value = slot.teacher.name;
                                 opt.textContent = slot.teacher.name;
                                 teacherSelect.appendChild(opt);
                            }
                            teacherSelect.value = slot.teacher.name;
                        }

                        // Попълване на стаята
                        if (slot.room && roomSelect) {
                            const roomVal = slot.room.name || slot.room.roomId.toString();
                            if (!Array.from(roomSelect.options).some(opt => opt.value == roomVal)) {
                                 const opt = document.createElement('option');
                                 opt.value = roomVal;
                                 opt.textContent = roomVal;
                                 roomSelect.appendChild(opt);
                            }
                            roomSelect.value = roomVal;
                        }

                        // Append the finished lesson block to the table cell
                        cell.appendChild(newContent);
                    }
                });
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
