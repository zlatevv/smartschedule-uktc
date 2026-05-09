// ==========================================
// ВРЪЗКА СЪС СЪРВЪРА (API)
// ==========================================
async function loadAllData() {
    await Promise.all([
        loadSubjectsFromDatabase(),
        loadClassesFromDatabase(),
        loadTeachersFromDatabase(),
        loadRoomsFromDatabase()
    ]);
    console.log("Данните са заредени. Рендериране на таблицата...");
    renderScheduleTable();
}

async function loadSubjectsFromDatabase() {
    try {
        const response = await fetch('http://127.0.0.1:8080/api/subjects');
        const data = await response.json();
        
        db.subjects = data.map(sub => ({
            id: sub.subjectId,
            name: sub.name,
            color: generateDistinctColor(sub.name)
        }));
        renderSubjectsSidebar();
    } catch (e) { console.error("Грешка предмети:", e); }
}

async function loadClassesFromDatabase() {
    try {
        const response = await fetch('http://127.0.0.1:8080/api/classes');
        const data = await response.json();
        console.log(data);
        
        allSavedClasses = data;
        db.classes = data
        renderClasses();
    } catch (e) { console.error("Грешка класове:", e); }
}

async function loadTeachersFromDatabase() {
    try {
        const response = await fetch('http://127.0.0.1:8080/api/teachers');
        const data = await response.json();
        db.teachers = data.map(t => ({
            id: t.id || t.teacherId || t.teacher_id, 
            name: t.name,
            subjects: t.subjects ? t.subjects.map(s => s.name || s.name) : []
        }));
    } catch (e) { console.error("Грешка учители:", e); }
}

async function loadRoomsFromDatabase() {
    try {
        const response = await fetch('http://127.0.0.1:8080/api/rooms');
        const data = await response.json();
        db.rooms = data.map(r => r.roomId || r.name);
    } catch (e) { console.error("Грешка стаи:", e); }
}