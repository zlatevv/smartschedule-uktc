document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedClass = urlParams.get('class');

    const titleDisplay = document.getElementById('class-title-display');

    if (!selectedClass) {
        titleDisplay.textContent = "Не е избран клас";
        titleDisplay.style.color = "red";
        return;
    }

    titleDisplay.textContent = `${selectedClass} клас`;

    fetchScheduleForClass(selectedClass);
});

function generateDistinctColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash * 137.5) % 360;
    const saturation = 75 + (Math.abs(hash) % 15);
    const lightness = 82 + (Math.abs(hash) % 8);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

async function fetchScheduleForClass(className) {
    const gridContainer = document.getElementById('schedule-grid-container');
    
    try {
        const response = await fetch(`http://localhost:8080/api/schedule/class/${className}`);
        
        if (!response.ok) {
            throw new Error('Програмата за този клас не е намерена.');
        }

        const scheduleData = await response.json();
        
        // ===== ДОБАВИ ТОЗИ РЕД =====
        console.log("Данни от сървъра за клас", className, ":", scheduleData);
        // ===========================

        renderScheduleGrid(scheduleData);

    } catch (error) {
        console.error("Грешка:", error);
        gridContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: red;">${error.message}</div>`;
    }
}

function renderScheduleGrid(scheduleData) {
    const gridContainer = document.getElementById('schedule-grid-container');
    gridContainer.innerHTML = ''; // Изчистваме контейнера

    gridContainer.innerHTML += `
        <div></div> 
        <div class="grid-head">Понеделник</div>
        <div class="grid-head">Вторник</div>
        <div class="grid-head">Сряда</div>
        <div class="grid-head">Четвъртък</div>
        <div class="grid-head">Петък</div>
    `;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const classTimes = ["08:00-08:45", "09:05-09:50", "10:00-10:45", "10:55-11:40", "11:50-12:35", "12:45-13:30", "13:50-14:35", "14:40-15:25"];

    for (let period = 0; period < 8; period++) {
        
        const timeSlotHTML = `
            <div class="time-slot mt-2">
                <span>${period + 1}. Час</span>
                <span class="slot-time">(${classTimes[period] || ''})</span>
            </div>
        `;
        gridContainer.innerHTML += timeSlotHTML;

        days.forEach(day => {
            const lesson = scheduleData[day] ? scheduleData[day][period] : null;

            if (lesson && lesson.subject) {
                
                const subjectName = lesson.subject.subjectName;
                const roomInfo = lesson.room ? lesson.room.roomId : '';
                const teacherName = lesson.teacher ? lesson.teacher.name : '';

                const cardColor = generateDistinctColor(subjectName);
                const cardHTML = `
                    <div class="subject-card" style="background-color: ${cardColor};">
                        <div class="subject-name" title="${subjectName}">${subjectName}</div>
                        <div class="subject-details" style="display: flex; flex-direction: column; gap: 2px;">
                            <span>${roomInfo ? `стая ${roomInfo}` : ''}</span>
                            <span style="font-size: 0.8em; opacity: 0.85;"> '${teacherName}</span>
                        </div>
                    </div>
                `;
                if (lesson && lesson.subject) {
                    gridContainer.innerHTML += cardHTML;
                } else {
                    gridContainer.innerHTML += `<div class="empty-slot"></div>`; 
                }
                } else {
                    gridContainer.innerHTML += `<div></div>`; 
            }
        });
    }
}