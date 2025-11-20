const collectedData = [];
let lastClickTime = 0;

window.addEventListener("mousemove", (e) => {
  collectedData.push({
    type: "mousemove",
    x: e.clientX,
    y: e.clientY,
    time: Date.now(),
  });
});

window.addEventListener("click", () => {
  const now = Date.now();
  const delay = lastClickTime ? now - lastClickTime : 0;
  lastClickTime = now;
  collectedData.push({
    type: "click",
    delay,
    time: now,
  });
});

window.addEventListener("keydown", (e) => {
  collectedData.push({
    type: "keydown",
    key: e.key,
    time: Date.now(),
  });
});

window.addEventListener("beforeunload", async () => {
  try {
    await fetch("/api/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events: collectedData }),
    });
  } catch (err) {
    console.error("Failed to send data:", err);
  }
});