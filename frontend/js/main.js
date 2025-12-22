document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".signup").addEventListener("click", () => {
        document.getElementById("signupModal").style.display = "block";
    });

    document.querySelector(".signin").addEventListener("click", () => {
        document.getElementById("loginModal").style.display = "block";
    });
});

function closeSignup() { document.getElementById("signupModal").style.display = "none"; }
function closeLogin() { document.getElementById("loginModal").style.display = "none"; }

async function signup() {
    const username = document.getElementById("signupUsername").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;

    const res = await fetch("http://localhost:8080/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
    });

    if (res.ok) alert("Signed up successfully!");
    else alert("Error signing up");
}

async function login() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const res = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    if (res.ok) alert("Logged in successfully!");
    else alert("Login failed");
}
