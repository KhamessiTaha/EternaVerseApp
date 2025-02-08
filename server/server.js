const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("EternaVerseApp API is running...");
});


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
