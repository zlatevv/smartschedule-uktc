document.addEventListener('DOMContentLoaded', () => {
    loadClassesFromDatabase();
});

async function loadClassesFromDatabase() {
    const select = document.getElementById('class-select-index');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>⏳ Зареждане на класове...</option>';

    try {
        const response = await fetch('http://localhost:8080/api/classes');
        
        if (!response.ok) {
            throw new Error('Грешка при връзката със сървъра');
        }

        let classesData = await response.json();
        
        classesData.sort((a, b) => {
            const nameA = String(a.classCode || a);
            const nameB = String(b.classCode || b);
            return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        });

        select.innerHTML = '<option value="" disabled selected>-- Избери клас --</option>';

        // 2. Пълним менюто
        classesData.forEach(cls => {
            const option = document.createElement('option');
            const className = cls.classCode || cls; 
            
            option.value = className; 
            option.textContent = className;
            
            select.appendChild(option);
        });

        select.addEventListener('change', (event) => {
            if (event.target.value) {
                event.target.closest('form').submit();
            }
        });

    } catch (error) {
        console.error("Грешка при зареждане на класовете:", error);
        select.innerHTML = '<option value="" disabled selected> Грешка при зареждане</option>';
    }
}