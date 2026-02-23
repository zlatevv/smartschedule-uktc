document.addEventListener('DOMContentLoaded', () => {
    initDragAndDrop();
    initAddClass();
});

// ==========================================
// 1. Логика за лесно попълване (Клик)
// ==========================================
let lastFocusedInput = null;

// Следим кое е последното цъкнато поле в таблицата
document.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('inp-sub')) {
        lastFocusedInput = e.target;
    }
});

function fillSubjectInActiveField(name) {
    if (lastFocusedInput) {
        lastFocusedInput.value = name;
        lastFocusedInput.focus();
        
        // Кратък визуален ефект за потвърждение
        lastFocusedInput.style.backgroundColor = '#dcfce7';
        setTimeout(() => lastFocusedInput.style.backgroundColor = '', 300);
    } else {
        alert("Първо цъкни в някое поле за предмет от таблицата!");
    }
}

// ==========================================
// 2. Добавяне на нов предмет в списъка
// ==========================================
const addSubjectBtn = document.getElementById('add-subject-btn');
if (addSubjectBtn) {
    addSubjectBtn.addEventListener('click', function() {
        const input = document.getElementById('new-subject-name');
        const subjectName = input ? input.value.trim() : prompt("Въведете име на новия предмет:");
        
        if (subjectName) {
            const list = document.getElementById('subjects-list') || document.querySelector('.subjects-list');
            const newItem = document.createElement('div'); // Използваме div, за да пасне на дизайна на картите
            
            // Добавяме нужните класове за стил и функционалност
            newItem.className = 'draggable-subject subject-item'; 
            newItem.draggable = true;
            newItem.textContent = subjectName;
            
            // Базов стил за новосъздадени предмети
            newItem.style.cursor = 'grab';
            newItem.style.background = "#F3F4F6";
            
            // 1. Добавяме логиката за клик
            newItem.onclick = function() {
                fillSubjectInActiveField(subjectName);
            };

            // 2. Добавяме логиката за влачене на новия елемент
            newItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData("text/plain", subjectName);
                newItem.style.opacity = "0.5";
            });
            newItem.addEventListener('dragend', () => {
                newItem.style.opacity = "1";
            });
            
            list.appendChild(newItem);
            if (input) input.value = ''; 
        }
    });
}

// ==========================================
// 3. Логика за Drag and Drop (Влачене)
// ==========================================
function initDragAndDrop() {
    // Взимаме всички предмети от списъка (съществуващите)
    const draggableItems = document.querySelectorAll('.draggable-subject, .subject-item');
    
    draggableItems.forEach(item => {
        item.draggable = true; // Подсигуряваме се, че могат да се влачат
        
        // Закачаме клик събитието за съществуващите предмети
        item.onclick = function() {
            fillSubjectInActiveField(item.innerText.trim());
        };

        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData("text/plain", item.innerText.trim());
            item.style.opacity = "0.5";
            item.style.cursor = "grabbing";
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = "1";
            item.style.cursor = "grab";
        });
    });

    // Настройваме клетките в таблицата да приемат пускане
    const dropZones = document.querySelectorAll('.drop-zone'); 
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault(); // Задължително, за да позволи drop
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const subjectName = e.dataTransfer.getData("text/plain");
            const inputSub = zone.querySelector('.inp-sub');
            
            if (inputSub && subjectName) {
                inputSub.value = subjectName;
                lastFocusedInput = inputSub; // Обновяваме последния фокус
                
                // Визуален ефект при успешно пускане
                inputSub.style.backgroundColor = '#dcfce7';
                setTimeout(() => inputSub.style.backgroundColor = '', 300);
            }
        });
    });
}

// ==========================================
// 4. Добавяне на нов клас
// ==========================================
function initAddClass() {
    const addClassBtn = document.querySelector('.btn-add-class'); // Бутонът до select-а
    if (addClassBtn) {
        addClassBtn.addEventListener('click', () => {
            const className = prompt("Въведете име на новия клас (напр. 11Б):");
            if (className && className.trim() !== "") {
                const select = document.getElementById('class-select-admin');
                const option = document.createElement('option');
                option.text = className.trim() + " Клас";
                option.value = className.trim().toLowerCase();
                
                // Добавяме го и автоматично го селектираме
                select.add(option);
                select.value = option.value; 
            }
        });
    }
}

// ==========================================
// 5. Бутон за изход
// ==========================================
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Сигурни ли сте, че искате да излезете?")) {
            window.location.href = "index.html";
        }
    });
}