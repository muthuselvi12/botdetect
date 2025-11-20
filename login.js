let collectedData = [];
let lastClick = 0;

window.addEventListener("mousemove", (e) => {
  collectedData.push({ type: "mousemove", x: e.clientX, y: e.clientY, time: Date.now() });
});
window.addEventListener("keydown", (e) => {
  collectedData.push({ type: "keydown", key: e.key, time: Date.now() });
});
window.addEventListener("click", () => {
  const now = Date.now();
  const delay = lastClick ? now - lastClick : 0;
  lastClick = now;
  collectedData.push({ type: "click", delay, time: now });
});

async function handleLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("message");

  if (!username || !password) {
    msg.textContent = "Please enter username and password.";
    msg.style.color = "yellow";
    return;
  }

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, events: collectedData }),
    });

    const result = await res.json();

    if (res.ok && result.status === "Human Verified") {
      msg.textContent = "✅ Welcome, Human!";
      msg.style.color = "lightgreen";
      // Clear fields
      document.getElementById("username").value = "";
      document.getElementById("password").value = "";
      setTimeout(() => {
        window.location.href = result.redirect || "/home";
      }, 1000);
    } else {
      msg.textContent = result.error || "❌ Bot behavior detected. Access denied.";
      msg.style.color = "red";
    }
  } catch (err) {
    msg.textContent = "❌ Error during login.";
    msg.style.color = "red";
    console.error(err);
  }
}
