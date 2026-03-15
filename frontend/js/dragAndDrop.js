function allowDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.style.backgroundColor = "#f0fdf4"; // зелен ефект при задържане
}

function handleDragStart(ev) {
    ev.dataTransfer.setData("text/plain", ev.target.id);
    setTimeout(() => { ev.target.style.opacity = "0.5"; }, 0);
}

document.addEventListener("dragover", function(event) {
    if(event.target.tagName !== "TD") {
        document.querySelectorAll('td').forEach(td => td.style.backgroundColor = "");
    }
}, false);

async function handleDrop(ev, classCode) {
    ev.preventDefault();
    document.querySelectorAll('td').forEach(td => td.style.backgroundColor = "");

    const draggedElementId = ev.dataTransfer.getData("text/plain");
    const draggedElement = document.getElementById(draggedElementId);
    if (!draggedElement) return;
    
    draggedElement.style.opacity = "1";

    let targetCell = ev.target;
    if (targetCell.tagName !== "TD") {
        targetCell = targetCell.closest("td");
    }
    if (!targetCell) return;

    const newDay = targetCell.getAttribute("data-day");
    const newPeriod = parseInt(targetCell.getAttribute("data-period"));
    const teacherName = draggedElement.getAttribute("data-teacher");
    const roomName = draggedElement.getAttribute("data-room");

    // Проверка за конфликти
    const conflictMsg = await checkAvailability(newDay, newPeriod, teacherName, roomName, classCode);
    
    if (conflictMsg) {
        alert(`❌ Не може да преместите часа!\n\n${conflictMsg}`);
        return;
    }

    if (targetCell.querySelector("div[draggable='true']")) {
        const confirmSwap = confirm("В този час вече има предмет. Искате ли да ги размените?");
        if (!confirmSwap) return;
        const existingElement = targetCell.querySelector("div");
        const sourceCell = draggedElement.parentNode;
        sourceCell.appendChild(existingElement);
    }

    targetCell.appendChild(draggedElement);
}

async function checkAvailability(day, period, teacherName, roomName, currentClassCode) {
    try {
        if (typeof db !== 'undefined' && db.classesData) { 
            let allClasses = db.classesData || allSavedClasses;
            
            for (let cls of allClasses) {
                if (cls.classCode === currentClassCode) continue;

                const schedule = cls.scheduleData || cls.schedule; // Зависи как пазиш данните
                if (schedule && schedule[day] && schedule[day][period]) {
                    const slot = schedule[day][period];
                    
                    if (slot.teacher && slot.teacher.name === teacherName) {
                        return `Учителят ${teacherName} вече преподава на клас ${cls.classCode} в този час!`;
                    }
                    if (roomName && slot.room && (slot.room.name === roomName || slot.room.roomId === roomName)) {
                        return `Стая ${roomName} вече е заета от клас ${cls.classCode}!`;
                    }
                }
            }
        }
        return null; 
    } catch (err) {
        console.error("Грешка при проверка", err);
        return null;
    }
}