const mongoose = require("mongoose");
const eventSchema = new mongoose.Schema({
  type: String,
  x: Number,
  y: Number,
  key: String,
  delay: Number,
  time: Number,
});

const userSessionSchema = new mongoose.Schema({
  userId: String,
  events: [eventSchema],
  isHuman: Boolean,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserSession", userSessionSchema);