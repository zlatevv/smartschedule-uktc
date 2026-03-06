// ==========================================
// ГЛОБАЛНИ ДАННИ И КОНФИГУРАЦИЯ
// ==========================================
const db = {
    classes: [],
    subjects: [],
    teachers: [],
    rooms: []
};

let allSavedClasses = [];
let activeCell = null;

const classTimes = [
    "08:00 - 08:45", // 1 час
    "09:05 - 09:50", // 2 час
    "10:00 - 10:45", // 3 час
    "10:55 - 11:40", // 4 час
    "11:50 - 12:35", // 5 час
    "12:45 - 13:30", // 6 час
    "13:50 - 14:35",  // 7 час
    "14:45 - 15:30"
];

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