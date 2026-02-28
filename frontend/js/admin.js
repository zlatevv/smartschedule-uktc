// ==========================================
// 1. КОНФИГУРАЦИЯ И ДАННИ
// ==========================================

const db = {
    classes: [],
    subjects: [],
    teachers: [],
    rooms: []
};

let allSavedClasses = [];

const classTimes = [
    "08:00 - 08:45", // 1 час
    "09:05 - 09:50", // 2 час
    "10:00 - 10:45", // 3 час
    "10:55 - 11:40", // 4 час (Голямо междучасие)
    "11:50 - 12:35", // 5 час
    "12:45 - 13:30", // 6 час
    "13:50 - 14:35"  // 7 час
];

let activeCell = null; // Пази коя клетка е активна

// Умна функция за генериране на уникален пастелен цвят базиран на името
function generateDistinctColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash * 137.5) % 360; // Златно сечение за максимално различие
    const saturation = 75 + (Math.abs(hash) % 15);
    const lightness = 82 + (Math.abs(hash) % 8);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Скриптът е зареден и DOM е готов!");

    // Първоначално зареждане на всичко от сървъра
    loadAllData();
    
    // Инициализиране на бутоните за модални прозорци
    initAddClass();
    initAddSubject();

    // Закачане на събития за основните бутони и контроли
    const classSelect = document.getElementById('class-select-admin');
    if (classSelect) {
        classSelect.addEventListener('change', (e) => {
            updateTeacherDisplay(e.target.value);
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(confirm("Изход?")) window.location.href = "index.html";
        });
    }

    const btnGenerate = document.getElementById('btn-generate');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', async (event) => {
            event.preventDefault(); 
            
            console.log("Кликна 'Генерирай'!");
            
            const selectedClass = document.getElementById('class-select-admin').value;
            if (!selectedClass) {
                alert("Моля, изберете клас първо!");
                return;
            }

            const originalText = btnGenerate.innerHTML;
            btnGenerate.innerHTML = "⏳ Генериране...";
            btnGenerate.disabled = true;

            try {
                console.log("Изпращане на заявка към сървъра за клас:", selectedClass);
                const response = await fetch(`http://localhost:8080/api/schedule/generate/${selectedClass}`, {
                    method: 'POST' 
                });

                if (response.ok) {
                    const generatedData = await response.json();
                    visualizeGeneratedSchedule(generatedData);
                } else {
                    const errText = await response.text();
                    alert("Грешка при генериране от сървъра! " + errText);
                    console.error("Сървърът върна статус:", response.status);
                }
            } catch (error) {
                console.error("Мрежова грешка при генериране:", error);
                alert("Няма връзка със сървъра!");
            } finally {
                btnGenerate.innerHTML = originalText;
                btnGenerate.disabled = false;
            }
        });
    }
});

async function loadAllData() {
    // Извикваме всички заявки паралелно за по-добра скорост
    await Promise.all([
        loadSubjectsFromDatabase(),
        loadClassesFromDatabase(),
        loadTeachersFromDatabase(),
        loadRoomsFromDatabase()
    ]);
    // Рендерираме таблицата едва след като ВСИЧКО е заредено
    console.log("Всички данни от сървъра са заредени. Рендериране на таблицата...");
    renderScheduleTable();
}

// ==========================================
// 2. ВРЪЗКА СЪС СЪРВЪРА (API)
// ==========================================

async function loadSubjectsFromDatabase() {
    try {
        const response = await fetch('http://localhost:8080/api/subjects');
        const data = await response.json();
        db.subjects = data.map(sub => ({
            id: sub.subjectId,
            name: sub.subjectName,
            color: generateDistinctColor(sub.subjectName)
        }));
        renderSubjectsSidebar();
    } catch (e) { console.error("Грешка при предмети:", e); }
}

async function loadClassesFromDatabase() {
    try {
        const response = await fetch('http://localhost:8080/api/classes');
        const data = await response.json();
        
        allSavedClasses = data;

        db.classes = data.map(cls => cls.classCode);
        renderClasses();
    } catch (e) { console.error("Грешка при класове:", e); }
}

async function loadTeachersFromDatabase() {
    try {
        const response = await fetch('http://localhost:8080/api/teachers');
        const data = await response.json();
        
        db.teachers = data.map(t => ({
            id: t.id || t.teacherId || t.teacher_id, 
            name: t.name,
            subjects: t.subjects ? t.subjects.map(s => s.subjectName || s.name) : []
        }));
    } catch (e) { 
        console.error("Грешка при учители:", e); 
    }
}

async function loadRoomsFromDatabase() {
    try {
        const response = await fetch('http://localhost:8080/api/rooms');
        const data = await response.json();
        db.rooms = data.map(r => r.roomId || r.name);
    } catch (e) { console.error("Грешка при стаи:", e); }
}

// ==========================================
// 3. РЕНДЕРИРАНЕ (UI)
// ==========================================

function renderClasses() {
    const select = document.getElementById('class-select-admin');
    if (!select) return;
    
    select.innerHTML = '';
    db.classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
        select.appendChild(option);
    });

    // Автоматично показваме учителя на първия клас при зареждане
    if (select.value) {
        updateTeacherDisplay(select.value);
    }
}

function updateTeacherDisplay(classCode) {
    const teacherDisplay = document.getElementById('teacher-display');
    if (!teacherDisplay) return;

    const foundClass = allSavedClasses.find(c => c.classCode === classCode);

    if (foundClass && foundClass.classTeacher && foundClass.classTeacher.name) {
        teacherDisplay.textContent = `Класен ръководител: ${foundClass.classTeacher.name}`;
    } else {
        teacherDisplay.textContent = '';
    }
}

function renderSubjectsSidebar() {
    const list = document.getElementById('subjects-list');
    if (!list) return;
    list.innerHTML = '';
    
    db.subjects.forEach(subject => {
        const item = document.createElement('div');
        item.className = 'draggable-subject subject-item';
        item.draggable = true;
        item.textContent = subject.name;
        item.style.backgroundColor = subject.color;
        
        item.onclick = () => fillSubjectInActiveField(subject);
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData("application/json", JSON.stringify(subject));
            item.style.opacity = "0.5";
        });
        item.addEventListener('dragend', () => item.style.opacity = "1");
        
        list.appendChild(item);
    });
}

function renderScheduleTable() {
    const tbody = document.getElementById('schedule-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    
    for (let i = 1; i <= 7; i++) {
        const tr = document.createElement('tr');
        
        const tdHour = document.createElement('td');
        tdHour.className = 'hour-col';
        tdHour.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px; color: #4F46E5;">${i} час</div>
            <div style="font-size: 0.75rem; color: #6B7280; white-space: nowrap;">${classTimes[i-1]}</div>
        `;
        tr.appendChild(tdHour);
        
        days.forEach(day => {
            const td = document.createElement('td');
            td.className = 'drop-zone';
            td.dataset.slot = `${day}-${i}`;
            
            td.innerHTML = `
                <div class="cell-content">
                    <div class="empty-hint">Празно</div>
                    <div class="cell-subject-title" style="display:none;"></div>
                    <div class="dropdown-animator">
                        <div class="dropdown-animator-inner">
                            <select class="cell-select teacher-select"><option value="">Учител</option></select>
                            <select class="cell-select room-select"><option value="">Стая</option></select>
                        </div>
                    </div>
                </div>
            `;

            // Напълване на стаите
            const roomSelect = td.querySelector('.room-select');
            db.rooms.forEach(room => {
                const opt = document.createElement('option');
                opt.value = room; opt.textContent = room;
                roomSelect.appendChild(opt);
            });

            // Клик събитие
            td.addEventListener('click', (e) => {
                if(e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
                document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('active-cell'));
                td.classList.add('active-cell');
                activeCell = td;
            });

            // Drag & Drop събития
            td.addEventListener('dragover', (e) => { e.preventDefault(); td.classList.add('drag-over'); });
            td.addEventListener('dragleave', () => td.classList.remove('drag-over'));
            td.addEventListener('drop', (e) => {
                e.preventDefault();
                td.classList.remove('drag-over');
                const subjectData = JSON.parse(e.dataTransfer.getData("application/json"));
                applySubjectToCell(td, subjectData);
            });

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
}

// ==========================================
// 4. ЛОГИКА НА ТАБЛИЦАТА
// ==========================================

function fillSubjectInActiveField(subjectData) {
    if (activeCell) {
        applySubjectToCell(activeCell, subjectData);
    } else {
        alert("Първо кликни върху клетка от таблицата!");
    }
}

function applySubjectToCell(cell, subject) {
    const contentBox = cell.querySelector('.cell-content');
    const title = cell.querySelector('.cell-subject-title');
    const teacherSelect = cell.querySelector('.teacher-select');
    
    contentBox.classList.add('filled');
    contentBox.style.backgroundColor = subject.color;
    cell.querySelector('.empty-hint').style.display = 'none';
    title.style.display = 'block';
    title.textContent = subject.name;

    teacherSelect.innerHTML = '<option value="">Учител</option>';
    
    const eligibleTeachers = db.teachers.filter(t => {
        return t.subjects.includes(subject.name);
    });
    eligibleTeachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name; 
        opt.textContent = t.name;
        teacherSelect.appendChild(opt);
    });
}

// ==========================================
// 5. МОДАЛИ И ДОБАВЯНЕ
// ==========================================

function openModal(id) {
    const m = document.getElementById(id);
    m.classList.add('active');
    setTimeout(() => m.querySelector('input').focus(), 100);
}

function closeModal(id) {
    const m = document.getElementById(id);
    m.classList.remove('active');
    const firstInput = m.querySelector('input');
    if(firstInput) firstInput.value = '';
}

function initAddClass() {
    const btnConfirm = document.getElementById('confirm-add-class');
    const inputClassCode = document.getElementById('input-new-class');
    const selectTeacher = document.getElementById('select-class-teacher');
    
    document.querySelector('.btn-add-class')?.addEventListener('click', () => {
        selectTeacher.innerHTML = '<option value="">-- Изберете учител --</option>';
        
        db.teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            selectTeacher.appendChild(opt);
        });
        
        openModal('modal-add-class');
    });

    btnConfirm?.addEventListener('click', async () => {
        const classCodeVal = inputClassCode.value.trim();
        const teacherIdVal = selectTeacher.value;
        
        if (classCodeVal && teacherIdVal) {
            try {
                const response = await fetch('http://localhost:8080/api/classes', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        classCode: classCodeVal,
                        classTeacher: {
                            id: parseInt(teacherIdVal)
                        }
                    })
                });

                if (response.ok) {
                    db.classes.push(classCodeVal);
                    renderClasses();
                    closeModal('modal-add-class');
                    inputClassCode.value = '';
                    selectTeacher.value = '';
                } else {
                    const errorText = await response.text();
                    alert("Грешка от сървъра: " + errorText);
                }
            } catch (error) {
                console.error("Мрежова грешка:", error);
                alert("Няма връзка със сървъра!");
            }
        } else {
            alert("Моля, въведете име на класа и изберете класен ръководител.");
        }
    });
}

function initAddSubject() {
    const btnConfirm = document.getElementById('confirm-add-subject');
    const inputName = document.getElementById('input-new-subject');
    const inputDesc = document.getElementById('input-subject-desc');
    const selectType = document.getElementById('select-subject-type');

    document.getElementById('add-subject-btn')?.addEventListener('click', () => openModal('modal-add-subject'));

    btnConfirm?.addEventListener('click', async () => {
        const name = inputName.value.trim();
        const desc = inputDesc.value.trim();
        const type = selectType.value;

        if (name) {
            try {
                const response = await fetch('http://localhost:8080/api/subjects', {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        subjectName: name,
                        subjectDescription: desc,
                        subjectType: type
                    })
                });

                if (response.ok) {
                    const savedSubject = await response.json();
                    
                    db.subjects.push({ 
                        id: savedSubject.subjectId, 
                        name: savedSubject.subjectName, 
                        color: generateDistinctColor(savedSubject.subjectName) 
                    });

                    renderSubjectsSidebar();
                    closeModal('modal-add-subject');
                    
                    inputName.value = '';
                    inputDesc.value = '';
                    selectType.selectedIndex = 0;
                } else {
                    alert("Грешка при запис на сървъра.");
                }
            } catch (error) {
                console.error("Мрежова грешка:", error);
            }
        } else {
            alert("Моля, въведете име на предмета.");
        }
    });
}


// ==========================================
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