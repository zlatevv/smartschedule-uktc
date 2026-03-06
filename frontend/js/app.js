// ==========================================
// ИНИЦИАЛИЗАЦИЯ И UI ЛОГИКА
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    initAddClass();
    initAddSubject();

    // Слушател за смяна на класа
    const classSelect = document.getElementById('class-select-admin');
    if (classSelect) {
        classSelect.addEventListener('change', async (e) => {
            const selectedClass = e.target.value;
            updateTeacherDisplay(selectedClass);
            if (selectedClass) {
                try {
                    const response = await fetch(`http://localhost:8080/api/schedule/class/${selectedClass}`);
                    if (response.ok) {
                        const classData = await response.json();
                        visualizeGeneratedSchedule(classData);
                    } else clearScheduleTable();
                } catch (error) { clearScheduleTable(); }
            } else clearScheduleTable();
        });
    }

    // Бутон Изход
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        if(confirm("Изход?")) window.location.href = "index.html";
    });

    // Бутон Генерирай
    const btnGenerate = document.getElementById('btn-generate');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', async (event) => {
            event.preventDefault(); 
            const selectedClass = document.getElementById('class-select-admin').value;
            if (!selectedClass) return alert("Моля, изберете клас първо!");

            const originalText = btnGenerate.innerHTML;
            btnGenerate.innerHTML = "⏳ Генериране...";
            btnGenerate.disabled = true;

            try {
                const genResponse = await fetch(`http://localhost:8080/api/schedule/generate/all`, { method: 'POST' });
                if (genResponse.ok) {
                    const dataResponse = await fetch(`http://localhost:8080/api/schedule/class/${selectedClass}`);
                    if (dataResponse.ok) {
                        visualizeGeneratedSchedule(await dataResponse.json()); 
                    }
                } else alert("Грешка при генериране!");
            } catch (error) { alert("Няма връзка със сървъра!"); } 
            finally { btnGenerate.innerHTML = originalText; btnGenerate.disabled = false; }
        });
    }

    // Бутон за PDF
    const saveBtn = document.querySelector('.save-btn-top');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => exportAllClassesToPDF(saveBtn));
    }
});

// Функциите за рендиране остават същите (renderClasses, renderScheduleTable и т.н.)
// Можеш да копираш останалата част от стария си код тук...
function renderClasses() {
    const select = document.getElementById('class-select-admin');
    if (!select) return;
    select.innerHTML = '';
    db.classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls; option.textContent = cls;
        select.appendChild(option);
    });
    if (select.value) updateTeacherDisplay(select.value);
}

function updateTeacherDisplay(classCode) {
    const teacherDisplay = document.getElementById('teacher-display');
    if (!teacherDisplay) return;
    const foundClass = allSavedClasses.find(c => c.classCode === classCode);
    teacherDisplay.textContent = (foundClass && foundClass.classTeacher && foundClass.classTeacher.name) 
        ? `Класен ръководител: ${foundClass.classTeacher.name}` : '';
}

// ... останалите функции (renderSubjectsSidebar, renderScheduleTable, fillSubjectInActiveField, applySubjectToCell, clearScheduleTable, visualizeGeneratedSchedule, openModal, closeModal, initAddClass, initAddSubject) 
// Тях можеш да ги копираш 1:1 от стария си файл в този app.js

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
    
    for (let i = 1; i <= 8; i++) {
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
