// ==========================================
// 1. КОНФИГУРАЦИЯ И ДАННИ
// ==========================================

const db = {
    classes: [],
    subjects: [],
    teachers: [],
    rooms: []
};

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
    // Първоначално зареждане на всичко от сървъра
    loadAllData();
    
    // Инициализиране на бутоните за модални прозорци
    initAddClass();
    initAddSubject();
});

async function loadAllData() {
    // Извикваме всички заявки паралелно за по-добра скорост
    await Promise.all([
        loadSubjectsFromDatabase(),
        loadClassesFromDatabase(),
        loadTeachersFromDatabase(),
        loadRoomsFromDatabase()
    ]);
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
        
        renderScheduleTable(); 
    } catch (e) { 
        console.error("Грешка при учители:", e); 
    }
}

async function loadRoomsFromDatabase() {
    try {
        const response = await fetch('http://localhost:8080/api/rooms');
        const data = await response.json();
        db.rooms = data.map(r => r.roomId || r.name);
        renderScheduleTable();
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
        // Използваме innerHTML, за да сложим часа и времето на два отделни реда за по-добър вид
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
    m.querySelector('input').value = '';
}

function initAddClass() {
    const btnConfirm = document.getElementById('confirm-add-class');
    const inputClassCode = document.getElementById('input-new-class');
    const selectTeacher = document.getElementById('select-class-teacher');
    
    document.querySelector('.btn-add-class')?.addEventListener('click', () => {
        selectTeacher.innerHTML = '<option value="">-- Изберете учител --</option>';
        
        // ВАЖНО: Използваме t.id за стойност на опцията
        db.teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id; // <--- Тук трябва да е ID-то от базата (напр. 2 за Ани Илиева)
            opt.textContent = t.name;
            selectTeacher.appendChild(opt);
        });
        
        openModal('modal-add-class');
    });

    btnConfirm?.addEventListener('click', async () => {
        const classCodeVal = inputClassCode.value.trim();
        const teacherIdVal = selectTeacher.value; // Трябва да е числото (ID)
        
        if (classCodeVal && teacherIdVal) {
            try {
                const response = await fetch('http://localhost:8080/api/classes', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        classCode: classCodeVal,
                        classTeacher: {
                            id: parseInt(teacherIdVal) // <--- Изпращаме само ID-то
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
                    
                    // Добавяме в локалния db обект
                    db.subjects.push({ 
                        id: savedSubject.subjectId, 
                        name: savedSubject.subjectName, 
                        color: generateDistinctColor(savedSubject.subjectName) 
                    });

                    renderSubjectsSidebar();
                    closeModal('modal-add-subject');
                    
                    // Изчистване на полетата
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

// Изход
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if(confirm("Изход?")) window.location.href = "index.html";
});