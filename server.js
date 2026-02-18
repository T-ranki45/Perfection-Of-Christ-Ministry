const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const DATABASE_URL = process.env.DATABASE_URL;
const DB_NAME = process.env.DB_NAME || "pocm-db";

// Middleware
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json({ limit: "50mb" })); // Parse JSON bodies (increased limit for images)

// Security: Prevent access to server code and config
app.use((req, res, next) => {
  if (
    req.path === "/server.js" ||
    req.path === "/package.json" ||
    req.path === "/.env"
  ) {
    return res.status(403).send("Forbidden");
  }
  next();
});

app.use(express.static(".")); // Serve static files from current directory

// --- DATABASE CONNECTION ---
let db;

async function connectToDb() {
  try {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    const client = new MongoClient(DATABASE_URL);
    await client.connect();
    db = client.db(DB_NAME);
    console.log("Successfully connected to MongoDB Atlas.");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  }
}

// --- AUTHENTICATION ---
const ADMIN_PASSWORD = "admin123"; // CHANGE THIS PASSWORD!

// --- ROUTES ---

// Get all flyers
app.get("/api/flyers", async (req, res) => {
  const flyers = await db
    .collection("flyers")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();
  res.json(flyers);
});

// Add new flyers (Bulk)
app.post("/api/flyers", async (req, res) => {
  const newFlyers = req.body; // Expecting array of { image }
  if (!Array.isArray(newFlyers)) {
    return res.status(400).json({ error: "Expected an array of flyers" });
  }

  const flyersWithTimestamp = newFlyers.map((f) => ({
    ...f,
    createdAt: new Date(),
  }));

  await db.collection("flyers").insertMany(flyersWithTimestamp);
  res
    .status(201)
    .json({ message: "Flyers added successfully", count: newFlyers.length });
});

// Delete a flyer
app.delete("/api/flyers/:id", async (req, res) => {
  const { id } = req.params;
  const result = await db
    .collection("flyers")
    .deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 1) {
    res.json({ message: "Flyer deleted successfully" });
  } else {
    res.status(404).json({ error: "Flyer not found" });
  }
});

// Get all sermons
app.get("/api/sermons", async (req, res) => {
  // Sort sermons by date descending
  const sortedSermons = await db
    .collection("sermons")
    .find({})
    .sort({ date: -1 })
    .toArray();
  res.json(sortedSermons);
});

// Add new sermon/message
app.post("/api/sermons", async (req, res) => {
  const { title, preacher, date, videoUrl, image } = req.body;
  if (!title || !date || !videoUrl) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const newSermon = {
    title,
    preacher: preacher || "Pastor John Jeremiah",
    date,
    videoUrl,
    image: image || "https://via.placeholder.com/300x200?text=No+Image",
  };
  await db.collection("sermons").insertOne(newSermon);
  res
    .status(201)
    .json({ message: "Message added successfully", sermon: newSermon });
});

// Delete sermon
app.delete("/api/sermons/:id", async (req, res) => {
  const { id } = req.params;
  const result = await db
    .collection("sermons")
    .deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 1) {
    res.json({ message: "Message deleted successfully" });
  } else {
    res.status(404).json({ error: "Message not found" });
  }
});

// Submit prayer request
app.post("/api/prayer-requests", async (req, res) => {
  const { name, email, request } = req.body;

  if (!name || !email || !request) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const newRequest = {
    name,
    email,
    request,
    timestamp: new Date(),
  };

  await db.collection("prayerRequests").insertOne(newRequest);
  console.log("New Prayer Request Received:", newRequest);

  res.status(201).json({ message: "Prayer request saved successfully" });
});

// Get all prayer requests (Admin)
app.get("/api/prayer-requests", async (req, res) => {
  // Return most recent first
  const requests = await db
    .collection("prayerRequests")
    .find({})
    .sort({ timestamp: -1 })
    .toArray();
  res.json(requests);
});

// Live Stream Routes
app.get("/api/livestream", async (req, res) => {
  const config = await db.collection("config").findOne({ name: "liveStream" });
  res.json(config ? config.data : { videoId: "", isLive: false });
});

app.post("/api/livestream", async (req, res) => {
  const { videoId, isLive } = req.body;
  const newConfig = { videoId, isLive };
  await db
    .collection("config")
    .updateOne(
      { name: "liveStream" },
      { $set: { data: newConfig } },
      { upsert: true },
    );
  res.json({ message: "Live stream updated", config: newConfig });
});

// Login Route
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: "secure-token-" + Date.now() });
  } else {
    res.status(401).json({ success: false, message: "Invalid password" });
  }
});

// Start Server
async function startServer() {
  await connectToDb();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
