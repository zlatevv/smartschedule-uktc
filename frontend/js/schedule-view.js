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
        const response = await fetch(`http://127.0.0.1:8080/api/schedule/class/${className}`);
        
        if (!response.ok) {
            throw new Error('Програмата за този клас не е намерена.');
        }

        const scheduleData = await response.json();
        console.log("Данни от сървъра за клас", className, ":", scheduleData);
        renderScheduleGrid(scheduleData);

    } catch (error) {
        console.error("Грешка:", error);
        gridContainer.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: red;">${error.message}</div>`;
    }
}

function renderScheduleGrid(scheduleData) {
    const gridContainer = document.getElementById('schedule-grid-container');
    gridContainer.innerHTML = '';

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
            // FIXED: lessons is now an ARRAY of items
            const lessons = scheduleData[day] ? scheduleData[day][period] : [];

            if (lessons && lessons.length > 0) {
                // We wrap multiple lessons in a flex container so they sit side-by-side
                let cellHTML = `<div style="display: flex; gap: 4px; width: 100%; height: 100%;">`;

                lessons.forEach(lesson => {
                    if (lesson.subject) {
                        const name = lesson.subject.name;
                        const roomInfo = lesson.room ? lesson.room.roomId : '';
                        const teacherName = lesson.teacher ? lesson.teacher.name : '';
                        const cardColor = generateDistinctColor(name);

                        // flex: 1 makes them divide the space equally!
                        cellHTML += `
                            <div class="subject-card" style="background-color: ${cardColor}; flex: 1; min-width: 0; padding: 5px; border-radius: 6px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: center;">
                                <div class="subject-name" title="${name}" style="font-weight: bold; text-align: center; font-size: 0.85em; white-space: normal; line-height: 1.1; margin-bottom: 4px;">
                                    ${name}
                                </div>
                                <div class="subject-details" style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                    <span style="font-size: 0.75em; font-weight: 600;">${roomInfo ? `${roomInfo}` : ''}</span>
                                    <span style="font-size: 0.7em; opacity: 0.85; text-align: center;">${teacherName}</span>
                                </div>
                            </div>
                        `;
                    }
                });

                cellHTML += `</div>`;
                gridContainer.innerHTML += cellHTML;
            } else {
                // Empty cell if nothing is scheduled
                gridContainer.innerHTML += `<div class="empty-slot" style="min-height: 80px;"></div>`;
            }
        });
    }
}