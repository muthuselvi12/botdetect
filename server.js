const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const basicAuth = require("express-basic-auth");
const { Parser } = require("json2csv");

const UserSession = require("./models/UserSession");
const User = require("./models/User");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

mongoose.connect("mongodb://localhost:27017/botdetect", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function isLikelyHuman(events) {
  const totalEvents = events.length;
  const moves = events.filter((e) => e.type === "mousemove");
  const clicks = events.filter((e) => e.type === "click");
  const keys = events.filter((e) => e.type === "keydown");

  const variedMouse = new Set(moves.map((e) => `${e.x}-${e.y}`)).size;
  const keyVariety = new Set(keys.map((e) => e.key)).size;

  const clickDelays = clicks.map((e) => e.delay || 0);
  const avgClickDelay = clickDelays.length
    ? clickDelays.reduce((a, b) => a + b, 0) / clickDelays.length
    : 0;

  const moveSpeeds = [];
  for (let i = 1; i < moves.length; i++) {
    const dx = moves[i].x - moves[i - 1].x;
    const dy = moves[i].y - moves[i - 1].y;
    const dt = moves[i].time - moves[i - 1].time;
    if (dt > 0) {
      moveSpeeds.push(Math.sqrt(dx * dx + dy * dy) / dt);
    }
  }
  const avgSpeed = moveSpeeds.length
    ? moveSpeeds.reduce((a, b) => a + b, 0) / moveSpeeds.length
    : 0;

  console.log("EVENT STATS:", {
    totalEvents,
    variedMouse,
    keyVariety,
    avgClickDelay: avgClickDelay.toFixed(2),
    avgSpeed: avgSpeed.toFixed(4),
    clickCount: clicks.length,
  });

  // const isHuman =
  //   totalEvents >= 70 &&
  //   variedMouse >= 10 &&
  //   keyVariety >= 3 &&
  //   avgClickDelay >= 50 &&
  //   avgSpeed <= 0.5 &&
  //   clicks.length >= 1;
  const isHuman =
  totalEvents >= 30 &&
  variedMouse >= 5 &&
  keyVariety >= 2 &&
  avgClickDelay >= 30 &&
  avgSpeed <= 1.5 &&
  clicks.length >= 1;


  if (isHuman) {
    console.log("✅ Human Verified: Natural behavior + 70+ events");
  } else {
    console.log("🚨 Bot Detected: Failed behavior or event threshold");
  }

  return isHuman;
}

// ========== Auth Routes ==========
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ error: "User already exists" });
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed });
  res.json({ message: "User registered" });
});

app.post("/api/login", async (req, res) => {
  const { username, password, events } = req.body;
  const isHuman = isLikelyHuman(events);
  await UserSession.create({ userId: username, events, isHuman });

  if (!isHuman) return res.status(403).json({ status: "Bot Detected" });
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ error: "Invalid password" });
  res.json({ status: "Human Verified", redirect: "/home" });
});

app.use("/dashboard", basicAuth({ users: { admin: "password123" }, challenge: true }));


app.get("/dashboard", async (req, res) => {
  const sessions = await UserSession.find().sort({ createdAt: -1 }).limit(50);
  let html = `
  <nav style='padding:10px; background:#007bff; color:white;'>
    <a href='/home' style='color:white; text-decoration:none; margin-right:20px;'>🏠 Home</a>
    <a href='/dashboard' style='color:white; text-decoration:none;'>📊 Dashboard</a>
  </nav>
  <h2>User Sessions Dashboard</h2>
  <table border='1' cellpadding='10'>
    <tr><th>Time</th><th>User ID</th><th>Result</th><th>Events</th></tr>`;
  sessions.forEach((s) => {
    html += `<tr><td>${s.createdAt.toLocaleString()}</td><td>${s.userId || "N/A"}</td><td>${s.isHuman ? "✅ Human" : "❌ Bot"}</td><td>${s.events.length}</td></tr>`;
  });
  html += `</table><br><a href='/export' class='btn'>Download CSV</a>`;

  // ✅ Add the Clear Sessions Button Here
  html += `
    <form method="POST" action="/clear-sessions" onsubmit="return confirm('Are you sure you want to delete all recorded data?');">
      <button style="margin-top:20px; padding:10px; background:#dc3545; color:white; border:none; border-radius:5px; cursor:pointer;">
        🧹 Clear Recorded Data
      </button>
    </form>
  `;

  res.send(html);
});



app.get("/export", async (req, res) => {
  const sessions = await UserSession.find();
  const flat = sessions.map((s) => ({
    time: s.createdAt.toISOString(),
    userId: s.userId,
    isHuman: s.isHuman,
    eventCount: s.events.length,
  }));
  const parser = new Parser({ fields: ["time", "userId", "isHuman", "eventCount"] });
  const csv = parser.parse(flat);
  res.header("Content-Type", "text/csv");
  res.attachment("sessions.csv");
  res.send(csv);
});

app.get("/login", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});


app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/home", (req, res) => {
  res.send(`
    <nav style='padding:10px; background:#007bff; color:white;'>
      <a href='/home' style='color:white; text-decoration:none; margin-right:20px;'>🏠 Home</a>
      <a href='/dashboard' style='color:white; text-decoration:none;'>📊 Dashboard</a>
    </nav>
    <div style='text-align:center; font-family:sans-serif; margin-top:50px;'>
      <h2>✅ Welcome, Human! You are now logged in.</h2>
      <p>This is your home page.</p>
      <a href='https://www.wikipedia.org' target='_blank'>
        <button style="padding:10px 20px; font-size:16px; background:#28a745; color:white; border:none; border-radius:5px; cursor:pointer;">Go to External Website</button>
      </a>
    </div>
  `);
});

app.post("/clear-sessions", basicAuth({ users: { admin: "password123" }, challenge: true }), async (req, res) => {
  await UserSession.deleteMany({});
  res.send(`
    <div style='font-family:sans-serif; text-align:center; margin-top:50px;'>
      <h2>✅ All recorded session data has been cleared.</h2>
      <a href="/dashboard">🔙 Back to Dashboard</a>
    </div>
  `);
});



app.get("/", (req, res) => {
  res.redirect("/login");
});





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
