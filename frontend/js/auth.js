import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAUZLys67PZiX4f433BhLQQlEsqYPeHup0",
            authDomain: "smartschedule-5c998.firebaseapp.com",
            projectId: "smartschedule-5c998",
            storageBucket: "smartschedule-5c998.firebasestorage.app",
            messagingSenderId: "734382865189",
            appId: "1:734382865189:web:3af72174ddb0c30405b8cc",
            measurementId: "G-CEM6QMPRNY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginButton = document.querySelector('#loginForm button');
const emailInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// Застраховка: махаме стария onclick атрибут, ако е останал в HTML-а
if (loginButton.hasAttribute('onclick')) {
    loginButton.removeAttribute('onclick');
}

loginButton.addEventListener('click', (e) => {
    e.preventDefault(); 

    const email = emailInput.value; 
    const password = passwordInput.value;

    if (!email || !password) {
        alert("Моля, въведи имейл и парола!");
        return;
    }

    const originalText = loginButton.innerText;
    loginButton.innerText = "Зареждане...";

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            loginButton.innerText = "Успешно!";
            window.location.href = "admin.html"; 
        })
        .catch((error) => {
            loginButton.innerText = originalText;
            if (error.code === 'auth/invalid-credential') {
                alert("Грешен имейл или парола!");
            } else {
                alert("Възникна грешка: " + error.message);
            }
        });
});