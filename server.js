const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const https = require("https");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

const DATABASE_URL = process.env.DATABASE_URL;
const DB_NAME = process.env.DB_NAME || "pocm-db";

// Middleware
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json({ limit: "200mb" })); // Increased limit for large image uploads
app.use(express.urlencoded({ limit: "200mb", extended: true }));

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

// Serve admin.html explicitly at /admin
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// --- DATABASE CONNECTION ---
let db;

// --- LOCAL FILE STORAGE SETUP (The "Storage Room") ---
const STORAGE_DIR = path.join(__dirname, "storage");
const DATA_DIR = path.join(STORAGE_DIR, "data");
const UPLOADS_DIR = path.join(STORAGE_DIR, "uploads");

// Ensure storage directories exist
[
  STORAGE_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  path.join(UPLOADS_DIR, "flyers"),
  path.join(UPLOADS_DIR, "sermons"),
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve uploaded files publicly
app.use("/uploads", express.static(UPLOADS_DIR));

// Helper: Read data from JSON file
function getLocalData(filename, defaultVal = []) {
  const filePath = path.join(DATA_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) return defaultVal;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return defaultVal;
  }
}

// Helper: Write data to JSON file
function saveLocalData(filename, data) {
  fs.writeFileSync(
    path.join(DATA_DIR, `${filename}.json`),
    JSON.stringify(data, null, 2),
  );
}

// Helper: Save Base64 Image to Disk
function saveImageToDisk(base64Data, folder) {
  try {
    // If it's not base64 (e.g. already a URL), return it as is
    if (!base64Data || !base64Data.startsWith("data:image")) return base64Data;

    const matches = base64Data.match(
      /^data:image\/([a-zA-Z0-9\+\-\.]+);base64,(.+)$/,
    );
    if (!matches || matches.length !== 3) return base64Data;

    const ext = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, folder, filename);

    fs.writeFileSync(filePath, buffer);
    return `/uploads/${folder}/${filename}`; // Return the public URL
  } catch (e) {
    console.error("Error saving image to disk:", e);
    return base64Data; // Fallback
  }
}

async function connectToDb() {
  try {
    if (!DATABASE_URL) {
      const err = new Error("DATABASE_URL environment variable is not set.");
      console.error("❌", err.message);
      return err; // Return the error
    }
    const client = new MongoClient(DATABASE_URL);
    await client.connect();
    db = client.db(DB_NAME);
    console.log("✅ Successfully connected to MongoDB Atlas.");
    return null; // Return null on success
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB", error);
    return error; // Return the error
  }
}

// --- AUTHENTICATION ---
const ADMIN_PASSWORD = "Admin123";

// --- ROUTES ---

// Middleware to check DB connection
app.use("/api", (req, res, next) => {
  // If DB is not connected, we just proceed and use local storage in the routes
  next();
});

// Check DB Status
app.get("/api/status", (req, res) => {
  res.json({ connected: !!db });
});

// Retry DB Connection
app.post("/api/connect-db", async (req, res) => {
  if (db) {
    return res.json({ connected: true, message: "Already connected" });
  }
  const error = await connectToDb();
  if (error) {
    return res.status(500).json({ connected: false, error: error.message });
  }
  return res.json({ connected: true, message: "Connected successfully" });
});

// Get all flyers
app.get("/api/flyers", async (req, res) => {
  if (db) {
    const flyers = await db
      .collection("flyers")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(flyers);
  } else {
    const localFlyers = getLocalData("flyers");
    // Return local flyers sorted by date
    res.json(
      localFlyers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    );
  }
});

// Add new flyers (Bulk)
app.post("/api/flyers", async (req, res) => {
  try {
    const newFlyers = req.body; // Expecting array of { image }
    if (!Array.isArray(newFlyers)) {
      return res.status(400).json({ error: "Expected an array of flyers" });
    }

    if (db) {
      const flyersWithTimestamp = newFlyers.map((f) => ({
        ...f,
        _id: new ObjectId(),
        createdAt: new Date(),
      }));
      await db.collection("flyers").insertMany(flyersWithTimestamp);
    } else {
      // Local Storage Logic
      const localFlyers = getLocalData("flyers");
      const flyersWithTimestamp = newFlyers.map((f) => ({
        image: saveImageToDisk(f.image, "flyers"), // Save image to folder
        _id: new ObjectId(),
        createdAt: new Date(),
      }));
      localFlyers.push(...flyersWithTimestamp);
      saveLocalData("flyers", localFlyers);
    }

    res
      .status(201)
      .json({ message: "Flyers added successfully", count: newFlyers.length });
  } catch (error) {
    console.error("Error adding flyers:", error);
    res.status(500).json({ error: "Internal Server Error: " + error.message });
  }
});

// Delete a flyer
app.delete("/api/flyers/:id", async (req, res) => {
  const { id } = req.params;

  if (db) {
    const result = await db
      .collection("flyers")
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      return res.json({ message: "Flyer deleted successfully" });
    }
  } else {
    let localFlyers = getLocalData("flyers");
    const initialLength = localFlyers.length;
    localFlyers = localFlyers.filter((f) => f._id.toString() !== id);
    saveLocalData("flyers", localFlyers);
    if (localFlyers.length < initialLength) {
      return res.json({ message: "Flyer deleted successfully" });
    }
  }
  return res.status(404).json({ error: "Flyer not found" });
});

// Get all sermons
app.get("/api/sermons", async (req, res) => {
  if (db) {
    const sortedSermons = await db
      .collection("sermons")
      .find({})
      .sort({ date: -1 })
      .toArray();
    res.json(sortedSermons);
  } else {
    const localSermons = getLocalData("sermons");
    res.json(localSermons.sort((a, b) => new Date(b.date) - new Date(a.date)));
  }
});

// Add new sermon/message
app.post("/api/sermons", async (req, res) => {
  try {
    const { title, preacher, date, videoUrl, image } = req.body;
    if (!title || !date || !videoUrl) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const newSermon = {
      title,
      preacher: preacher || "Pastor John Jeremiah",
      date,
      videoUrl,
      image: image, // Will be processed below
      _id: new ObjectId(),
    };

    if (db) {
      await db.collection("sermons").insertOne(newSermon);
    } else {
      const localSermons = getLocalData("sermons");
      newSermon.image = saveImageToDisk(image, "sermons"); // Save image to folder
      localSermons.push(newSermon);
      saveLocalData("sermons", localSermons);
    }

    res
      .status(201)
      .json({ message: "Message added successfully", sermon: newSermon });
  } catch (error) {
    console.error("Error adding sermon:", error);
    res.status(500).json({ error: "Internal Server Error: " + error.message });
  }
});

// Delete sermon
app.delete("/api/sermons/:id", async (req, res) => {
  const { id } = req.params;

  if (db) {
    const result = await db
      .collection("sermons")
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      return res.json({ message: "Message deleted successfully" });
    }
  } else {
    let localSermons = getLocalData("sermons");
    const initialLength = localSermons.length;
    localSermons = localSermons.filter((s) => s._id.toString() !== id);
    saveLocalData("sermons", localSermons);
    if (localSermons.length < initialLength) {
      return res.json({ message: "Message deleted successfully" });
    }
  }

  return res.status(404).json({ error: "Message not found" });
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
    isRead: false,
    _id: new ObjectId(),
  };

  if (db) {
    await db.collection("prayerRequests").insertOne(newRequest);
  } else {
    const localPrayerRequests = getLocalData("prayerRequests");
    localPrayerRequests.push(newRequest);
    saveLocalData("prayerRequests", localPrayerRequests);
  }

  console.log("New Prayer Request Received:", newRequest);

  res.status(201).json({ message: "Prayer request saved successfully" });
});

// Submit plan visit
app.post("/api/plan-visit", async (req, res) => {
  const { name, date, phone, guests } = req.body;

  if (!name || !date) {
    return res.status(400).json({ error: "Name and Date are required" });
  }

  const newVisit = {
    name,
    date,
    phone,
    guests,
    timestamp: new Date(),
    _id: new ObjectId(),
  };

  if (db) {
    await db.collection("plannedVisits").insertOne(newVisit);
  } else {
    const localVisits = getLocalData("plannedVisits");
    localVisits.push(newVisit);
    saveLocalData("plannedVisits", localVisits);
  }

  res.status(201).json({ message: "Visit planned successfully" });
});

// Get all planned visits
app.get("/api/plan-visit", async (req, res) => {
  if (db) {
    const visits = await db
      .collection("plannedVisits")
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    res.json(visits);
  } else {
    const localVisits = getLocalData("plannedVisits");
    res.json(
      localVisits.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
      ),
    );
  }
});

// Delete planned visit
app.delete("/api/plan-visit/:id", async (req, res) => {
  const { id } = req.params;

  if (db) {
    const result = await db
      .collection("plannedVisits")
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      return res.json({ message: "Visit deleted successfully" });
    }
  } else {
    let localVisits = getLocalData("plannedVisits");
    const initialLength = localVisits.length;
    localVisits = localVisits.filter((v) => v._id.toString() !== id);
    saveLocalData("plannedVisits", localVisits);
    if (localVisits.length < initialLength) {
      return res.json({ message: "Visit deleted successfully" });
    }
  }
  return res.status(404).json({ error: "Visit not found" });
});

// Toggle planned visit visited status
app.patch("/api/plan-visit/:id/visited", async (req, res) => {
  const { id } = req.params;
  const { visited } = req.body;

  if (db) {
    const result = await db
      .collection("plannedVisits")
      .updateOne({ _id: new ObjectId(id) }, { $set: { visited: visited } });
    if (result.matchedCount === 1) {
      return res.json({ message: "Visit updated successfully" });
    }
  } else {
    const localVisits = getLocalData("plannedVisits");
    const visitIndex = localVisits.findIndex(
      (v) => v._id.toString() === id,
    );
    if (visitIndex !== -1) {
      localVisits[visitIndex].visited = visited;
      saveLocalData("plannedVisits", localVisits);
      return res.json({ message: "Visit updated successfully" });
    }
  }
  return res.status(404).json({ error: "Visit not found" });
});

// Get all prayer requests (Admin)
app.get("/api/prayer-requests", async (req, res) => {
  if (db) {
    const requests = await db
      .collection("prayerRequests")
      .find({})
      .sort({ timestamp: -1 })
      .toArray();
    res.json(requests);
  } else {
    const localPrayerRequests = getLocalData("prayerRequests");
    res.json(
      localPrayerRequests.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
      ),
    );
  }
});

// Delete prayer request
app.delete("/api/prayer-requests/:id", async (req, res) => {
  const { id } = req.params;

  if (db) {
    const result = await db
      .collection("prayerRequests")
      .deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      return res.json({ message: "Request deleted successfully" });
    }
  } else {
    let localPrayerRequests = getLocalData("prayerRequests");
    const initialLength = localPrayerRequests.length;
    localPrayerRequests = localPrayerRequests.filter(
      (r) => r._id.toString() !== id,
    );
    saveLocalData("prayerRequests", localPrayerRequests);
    if (localPrayerRequests.length < initialLength) {
      return res.json({ message: "Request deleted successfully" });
    }
  }
  return res.status(404).json({ error: "Request not found" });
});

// Toggle prayer request read status
app.patch("/api/prayer-requests/:id/read", async (req, res) => {
  const { id } = req.params;
  const { isRead } = req.body;

  if (db) {
    const result = await db
      .collection("prayerRequests")
      .updateOne({ _id: new ObjectId(id) }, { $set: { isRead: isRead } });
    if (result.matchedCount === 1) {
      return res.json({ message: "Request updated successfully" });
    }
  } else {
    const localPrayerRequests = getLocalData("prayerRequests");
    const reqIndex = localPrayerRequests.findIndex(
      (r) => r._id.toString() === id,
    );
    if (reqIndex !== -1) {
      localPrayerRequests[reqIndex].isRead = isRead;
      saveLocalData("prayerRequests", localPrayerRequests);
      return res.json({ message: "Request updated successfully" });
    }
  }
  return res.status(404).json({ error: "Request not found" });
});

// Live Stream Routes
app.get("/api/livestream", async (req, res) => {
  if (db) {
    const config = await db
      .collection("config")
      .findOne({ name: "liveStream" });
    res.json(config ? config.data : { videoId: "", isLive: false });
  } else {
    const localLiveStreamConfig = getLocalData("liveStreamConfig", {
      videoId: "",
      isLive: false,
    });
    res.json(localLiveStreamConfig);
  }
});

app.post("/api/livestream", async (req, res) => {
  const { videoId, isLive } = req.body;
  const newConfig = { videoId, isLive };

  if (db) {
    await db
      .collection("config")
      .updateOne(
        { name: "liveStream" },
        { $set: { data: newConfig } },
        { upsert: true },
      );
  } else {
    saveLocalData("liveStreamConfig", newConfig);
  }

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
    console.log(`Server running on port ${port}`);

    // --- KEEP-ALIVE SCRIPT ---
    // Pings the server every 30 seconds to prevent Render free tier from sleeping
    setInterval(() => {
      const host =
        process.env.RENDER_EXTERNAL_HOSTNAME ||
        "perfection-of-christ-ministry.onrender.com";
      https
        .get(`https://${host}/api/flyers`, (res) => {
          res.on("data", () => {}); // Consume response
          console.log(`✅ Keep-alive ping to ${host}: ${res.statusCode}`);
        })
        .on("error", (err) => {
          console.error(`❌ Keep-alive ping failed: ${err.message}`);
        });
    }, 30 * 1000); // 30 seconds
  });
}

startServer();
