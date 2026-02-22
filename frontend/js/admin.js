// 1. Добавяне на нов предмет в списъка вдясно
document.getElementById('add-subject-btn').addEventListener('click', function() {
    const input = document.getElementById('new-subject-name');
    const subjectName = input.value.trim();
    
    if (subjectName) {
        const list = document.getElementById('subjects-list');
        const newItem = document.createElement('li');
        newItem.className = 'subject-item';
        newItem.style.cursor = 'pointer'; // Да се знае, че се клика
        newItem.textContent = subjectName;
        
        // Бонус: кликаш предмета и той се попълва в таблицата
        newItem.onclick = function() {
            fillSubjectInActiveField(subjectName);
        };
        
        list.appendChild(newItem);
        input.value = ''; 
    }
});

// 2. Логика за лесно попълване (кликни предмет -> отива в таблицата)
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
    } else {
        alert("Първо цъкни в някое поле от таблицата!");
    }
}

// 3. Бутон за изход
document.getElementById('logoutBtn').addEventListener('click', () => {
    if(confirm("Сигурни ли сте, че искате да излезете?")) {
        window.location.href = "index.html";
    }
});