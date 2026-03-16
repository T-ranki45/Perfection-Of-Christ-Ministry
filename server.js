require("dotenv").config();
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const https = require("https");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

// Replace 'YOUR_PASSWORD_HERE' with your actual MongoDB password
const DATABASE_URL =
  "mongodb+srv://perfection:Password123@churchwebsite.sv9kfnh.mongodb.net/?appName=ChurchWebsite";
const DB_NAME = process.env.DB_NAME || "pocm-db";

// --- CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

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

// --- LOCAL DATABASE FOLDER SETUP ---
const DATA_DIR = path.join(__dirname, "storage", "data"); // Keep JSON data separate

// Ensure storage directories exist
[path.join(__dirname, "storage"), DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// --- MULTER SETUP (Memory Storage for Cloudinary) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 500 }, // 500MB limit for local videos
});

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", (error) => reject(error));
  });
}

function normalizeLyrics(input) {
  if (Array.isArray(input)) {
    return input.join("\n").trim();
  }
  if (typeof input === "string") {
    return input.trim();
  }
  return "";
}

function normalizeHymnInput(raw) {
  if (!raw) return null;
  const title = String(raw.title || raw.name || "").trim();
  const number =
    raw.number !== undefined && raw.number !== null
      ? String(raw.number).trim()
      : "";
  const lyrics = normalizeLyrics(raw.lyrics || raw.lines || raw.text);
  const source = String(raw.source || raw.book || "").trim();
  if (!title && !lyrics) return null;
  return { title, number, lyrics, source };
}

function buildHymnRecord(raw) {
  const base = normalizeHymnInput(raw);
  if (!base) return null;
  return {
    _id:
      raw && raw._id
        ? raw._id
        : db
          ? new ObjectId()
          : new ObjectId().toString(),
    title: base.title,
    number: base.number,
    lyrics: base.lyrics,
    source: base.source,
    createdAt: raw && raw.createdAt ? raw.createdAt : new Date().toISOString(),
  };
}

function mapHymnOutput(hymn) {
  if (!hymn) return null;
  return {
    id: hymn._id ? hymn._id.toString() : hymn.id || "",
    title: hymn.title || "",
    number: hymn.number || "",
    lyrics: hymn.lyrics || "",
    source: hymn.source || "",
  };
}

async function loadHymnsRaw() {
  if (db) {
    return await db.collection("hymns").find({}).toArray();
  }
  return getLocalData("hymns", []);
}

async function saveHymnsRaw(hymns) {
  if (db) {
    await db.collection("hymns").deleteMany({});
    if (hymns.length) {
      await db.collection("hymns").insertMany(hymns);
    }
    return;
  }
  saveLocalData("hymns", hymns);
}

// Helper: Upload a file buffer to Cloudinary
async function uploadToCloudinary(fileBuffer, folder, resourceType = "auto") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
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
  const cConfig = cloudinary.config();
  const cloudinaryConnected = !!(
    cConfig.cloud_name &&
    cConfig.api_key &&
    cConfig.api_secret
  );
  res.json({ connected: !!db, cloudinary: cloudinaryConnected });
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
app.post("/api/flyers", upload.array("flyers", 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No flyer images uploaded." });
    }

    // Upload all files to Cloudinary in parallel
    const uploadPromises = files.map((file) =>
      uploadToCloudinary(file.buffer, "flyers", "image"),
    );
    const uploadResults = await Promise.all(uploadPromises);

    const flyersToInsert = uploadResults.map((result) => ({
      image_url: result.secure_url,
      public_id: result.public_id,
      _id: new ObjectId(),
      createdAt: new Date(),
    }));

    if (db) {
      await db.collection("flyers").insertMany(flyersToInsert);
    } else {
      // Local Storage Logic
      const localFlyers = getLocalData("flyers");
      localFlyers.push(...flyersToInsert);
      saveLocalData("flyers", localFlyers);
    }

    res.status(201).json({
      message: "Flyers added successfully",
      count: flyersToInsert.length,
    });
  } catch (error) {
    console.error("Error adding flyers:", error);
    res.status(500).json({ error: "Internal Server Error: " + error.message });
  }
});

// Delete a flyer
app.delete("/api/flyers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let flyerToDelete;

    if (db) {
      flyerToDelete = await db
        .collection("flyers")
        .findOne({ _id: new ObjectId(id) });
    } else {
      const localFlyers = getLocalData("flyers");
      flyerToDelete = localFlyers.find((f) => f._id.toString() === id);
    }

    if (!flyerToDelete) {
      return res.status(404).json({ error: "Flyer not found" });
    }

    // Delete from Cloudinary
    if (flyerToDelete.public_id) {
      await cloudinary.uploader.destroy(flyerToDelete.public_id);
    }

    // Delete from DB or local storage
    if (db) {
      await db.collection("flyers").deleteOne({ _id: new ObjectId(id) });
    } else {
      const localFlyers = getLocalData("flyers");
      saveLocalData(
        "flyers",
        localFlyers.filter((f) => f._id.toString() !== id),
      );
    }

    res.json({ message: "Flyer deleted successfully" });
  } catch (error) {
    console.error("Error deleting flyer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
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
app.post(
  "/api/sermons",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, preacher, date } = req.body;
      const imageFile = req.files["image"] ? req.files["image"][0] : null;
      const videoFile = req.files["video"] ? req.files["video"][0] : null;

      if (!title || !date || !videoFile || !imageFile) {
        return res
          .status(400)
          .json({ error: "All fields and files are required" });
      }

      // Upload to Cloudinary
      const imageUploadPromise = uploadToCloudinary(
        imageFile.buffer,
        "sermons",
        "image",
      );
      const videoUploadPromise = uploadToCloudinary(
        videoFile.buffer,
        "sermons",
        "video",
      );

      const [imageResult, videoResult] = await Promise.all([
        imageUploadPromise,
        videoUploadPromise,
      ]);

      const newSermon = {
        title,
        preacher: preacher || "Pastor John Jeremiah",
        date,
        video: {
          url: videoResult.secure_url,
          public_id: videoResult.public_id,
        },
        image: {
          url: imageResult.secure_url,
          public_id: imageResult.public_id,
        },
        _id: new ObjectId(),
      };

      if (db) {
        await db.collection("sermons").insertOne(newSermon);
      } else {
        const localSermons = getLocalData("sermons");
        localSermons.push(newSermon);
        saveLocalData("sermons", localSermons);
      }

      res
        .status(201)
        .json({ message: "Message added successfully", sermon: newSermon });
    } catch (error) {
      console.error("Error adding sermon:", error);
      res.status(500).json({
        error:
          "An internal server error occurred. Please check the server logs.",
      });
    }
  },
);

// Delete sermon
app.delete("/api/sermons/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let sermonToDelete;

    if (db) {
      sermonToDelete = await db
        .collection("sermons")
        .findOne({ _id: new ObjectId(id) });
    } else {
      const localSermons = getLocalData("sermons");
      sermonToDelete = localSermons.find((s) => s._id.toString() === id);
    }

    if (!sermonToDelete) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Delete files from Cloudinary
    const deletePromises = [];
    if (sermonToDelete.image && sermonToDelete.image.public_id) {
      deletePromises.push(
        cloudinary.uploader.destroy(sermonToDelete.image.public_id),
      );
    }
    if (sermonToDelete.video && sermonToDelete.video.public_id) {
      deletePromises.push(
        cloudinary.uploader.destroy(sermonToDelete.video.public_id, {
          resource_type: "video",
        }),
      );
    }
    await Promise.all(deletePromises);

    // Delete from DB
    if (db) {
      await db.collection("sermons").deleteOne({ _id: new ObjectId(id) });
    } else {
      const localSermons = getLocalData("sermons");
      saveLocalData(
        "sermons",
        localSermons.filter((s) => s._id.toString() !== id),
      );
    }
    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting sermon:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- BLOG ROUTES ---
// Get all blog posts
app.get("/api/blog", async (req, res) => {
  if (db) {
    const posts = await db
      .collection("blog")
      .find({})
      .sort({ date: -1 })
      .toArray();
    res.json(posts);
  } else {
    const localBlog = getLocalData("blog");
    res.json(localBlog.sort((a, b) => new Date(b.date) - new Date(a.date)));
  }
});

// Add new blog post
app.post(
  "/api/blog",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "galleryImages", maxCount: 20 }, // Increased limit
  ]),
  async (req, res) => {
    try {
      const { title, author, date, category, content, postType } = req.body;

      const imageFile = req.files["image"] ? req.files["image"][0] : null;
      const videoFile = req.files["video"] ? req.files["video"][0] : null;
      const galleryFiles = req.files["galleryImages"] || [];

      if (!title || !date || !content || !imageFile) {
        return res.status(400).json({
          error: "Title, Date, Content, and Thumbnail Image are required",
        });
      }

      // Upload files to Cloudinary
      const uploadPromises = [];
      uploadPromises.push(
        uploadToCloudinary(imageFile.buffer, "blog", "image"),
      );

      if (videoFile) {
        uploadPromises.push(
          uploadToCloudinary(videoFile.buffer, "blog", "video"),
        );
      }

      galleryFiles.forEach((file) => {
        uploadPromises.push(uploadToCloudinary(file.buffer, "blog", "image"));
      });

      const [imageResult, ...otherResults] = await Promise.all(uploadPromises);

      let videoResult = null;
      let galleryResults = [];

      if (videoFile) {
        videoResult = otherResults.shift();
        galleryResults = otherResults;
      } else {
        galleryResults = otherResults;
      }

      const newPost = {
        title,
        author: author || "Admin",
        postType: postType || "Announcement",
        date,
        category,
        video: videoResult
          ? { url: videoResult.secure_url, public_id: videoResult.public_id }
          : null,
        content,
        image: {
          url: imageResult.secure_url,
          public_id: imageResult.public_id,
        },
        galleryImages: galleryResults.map((r) => ({
          url: r.secure_url,
          public_id: r.public_id,
        })),
        _id: new ObjectId(),
        createdAt: new Date(),
      };

      if (db) {
        await db.collection("blog").insertOne(newPost);
      } else {
        const localBlog = getLocalData("blog");
        localBlog.push(newPost);
        saveLocalData("blog", localBlog);
      }

      res
        .status(201)
        .json({ message: "Blog post published successfully", post: newPost });
    } catch (error) {
      console.error("Error adding blog post:", error);
      res.status(500).json({
        error:
          "An internal server error occurred. Please check the server logs.",
      });
    }
  },
);

// Delete blog post
app.delete("/api/blog/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let postToDelete;

    if (db) {
      postToDelete = await db
        .collection("blog")
        .findOne({ _id: new ObjectId(id) });
    } else {
      const localBlog = getLocalData("blog");
      postToDelete = localBlog.find((p) => p._id.toString() === id);
    }

    if (!postToDelete) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    // Delete all associated files from Cloudinary
    const deletePromises = [];
    if (postToDelete.image && postToDelete.image.public_id) {
      deletePromises.push(
        cloudinary.uploader.destroy(postToDelete.image.public_id),
      );
    }
    if (postToDelete.video && postToDelete.video.public_id) {
      deletePromises.push(
        cloudinary.uploader.destroy(postToDelete.video.public_id, {
          resource_type: "video",
        }),
      );
    }
    if (postToDelete.galleryImages && postToDelete.galleryImages.length > 0) {
      postToDelete.galleryImages.forEach((img) => {
        if (img.public_id)
          deletePromises.push(cloudinary.uploader.destroy(img.public_id));
      });
    }
    await Promise.all(deletePromises);

    // Delete from DB
    if (db) {
      await db.collection("blog").deleteOne({ _id: new ObjectId(id) });
    } else {
      const localBlog = getLocalData("blog");
      saveLocalData(
        "blog",
        localBlog.filter((p) => p._id.toString() !== id),
      );
    }
    res.json({ message: "Blog post deleted successfully" });
  } catch (error) {
    console.error("Error deleting blog post:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
  try {
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
  } catch (error) {
    console.error("Error planning visit:", error);
    res.status(500).json({
      error: "An internal server error occurred. Please check the server logs.",
    });
  }
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
      localVisits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
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
    const visitIndex = localVisits.findIndex((v) => v._id.toString() === id);
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

// --- Screen State Routes ---
const defaultScreenState = {
  mode: "verse",
  verseText:
    '"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future." - Jeremiah 29:11',
  verseRef: "",
  giveScripture:
    '"Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver." - 2 Corinthians 9:7',
  announcementTitle: "",
  announcementBody: "",
  lyricsTitle: "",
  lyricsLines: "",
  orderTitle: "Order of Service",
  orderItems: "",
  countdownStatus: "stopped",
  countdownDurationSeconds: 600,
  countdownStartedAt: null,
  countdownRemainingSeconds: null,
  lowerThirdName: "",
  lowerThirdRole: "",
  lowerThirdFooter: "",
  updatedAt: null,
};

async function getConfigData(name) {
  if (db) {
    const config = await db.collection("config").findOne({ name });
    return config ? config.data : null;
  }
  return getLocalData(name, null);
}

async function saveConfigData(name, data) {
  if (db) {
    await db
      .collection("config")
      .updateOne({ name }, { $set: { data } }, { upsert: true });
  } else {
    saveLocalData(name, data);
  }
}

async function loadScreenState() {
  let state = await getConfigData("screenState");
  if (!state) {
    const legacy = await getConfigData("screenContent");
    if (legacy) {
      state = {
        ...defaultScreenState,
        verseText: legacy.verseText || defaultScreenState.verseText,
        giveScripture: legacy.giveScripture || defaultScreenState.giveScripture,
        announcementTitle: legacy.announcementTitle || "",
        announcementBody: legacy.announcementBody || "",
        updatedAt: legacy.updatedAt || null,
      };
    }
  }
  return { ...defaultScreenState, ...(state || {}) };
}

async function saveScreenState(state) {
  const normalized = {
    ...defaultScreenState,
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await saveConfigData("screenState", normalized);
  return normalized;
}

app.get("/api/screen-state", async (req, res) => {
  const state = await loadScreenState();
  return res.json(state);
});

app.post("/api/screen-state", async (req, res) => {
  const saved = await saveScreenState(req.body || {});
  return res.json({ message: "Screen state updated", data: saved });
});

// Legacy alias for screen content (kept for compatibility)
app.get("/api/screen-content", async (req, res) => {
  const state = await loadScreenState();
  return res.json({
    verseText: state.verseText,
    giveScripture: state.giveScripture,
    announcementTitle: state.announcementTitle,
    announcementBody: state.announcementBody,
    updatedAt: state.updatedAt,
  });
});

app.post("/api/screen-content", async (req, res) => {
  const state = await loadScreenState();
  const { verseText, giveScripture, announcementTitle, announcementBody } =
    req.body || {};
  const saved = await saveScreenState({
    ...state,
    verseText: verseText ?? state.verseText,
    giveScripture: giveScripture ?? state.giveScripture,
    announcementTitle: announcementTitle ?? state.announcementTitle,
    announcementBody: announcementBody ?? state.announcementBody,
  });
  return res.json({ message: "Screen content updated", data: saved });
});

// --- Bible Lookup & Hymn Library ---
app.get("/api/bible", async (req, res) => {
  const reference = String(req.query.reference || "").trim();
  const translation = String(req.query.translation || "web").trim();
  if (!reference) {
    return res.status(400).json({ error: "Reference is required." });
  }
  const encodedReference = encodeURIComponent(reference).replace(/%20/g, "+");
  const endpoint = `https://bible-api.com/${encodedReference}?translation=${encodeURIComponent(
    translation,
  )}`;
  try {
    const data = await fetchJson(endpoint);
    if (data.error) {
      return res.status(404).json({ error: data.error });
    }
    return res.json({
      reference: data.reference || reference,
      text: data.text || "",
      translation_id: data.translation_id || translation,
      translation_name: data.translation_name || "",
    });
  } catch (error) {
    console.error("Bible API error:", error);
    return res
      .status(500)
      .json({ error: "Unable to reach Bible lookup service." });
  }
});

app.get("/api/hymns", async (req, res) => {
  const query = String(req.query.q || req.query.query || "")
    .trim()
    .toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const hymns = await loadHymnsRaw();
    let results = hymns.map(mapHymnOutput).filter(Boolean);
    if (query) {
      results = results.filter((hymn) => {
        const inTitle = hymn.title.toLowerCase().includes(query);
        const inNumber = hymn.number.toLowerCase().includes(query);
        return inTitle || inNumber;
      });
    }
    results.sort((a, b) => {
      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }
      return a.title.localeCompare(b.title);
    });
    return res.json(results.slice(0, limit));
  } catch (error) {
    console.error("Hymn load error:", error);
    return res.status(500).json({ error: "Unable to load hymns." });
  }
});

app.post("/api/hymns/import", upload.single("file"), async (req, res) => {
  const mode = String(req.query.mode || req.body.mode || "merge").toLowerCase();
  let payload = null;
  try {
    if (req.file && req.file.buffer) {
      payload = JSON.parse(req.file.buffer.toString("utf8"));
    } else if (req.body && req.body.hymns) {
      if (Array.isArray(req.body.hymns)) {
        payload = req.body.hymns;
      } else if (typeof req.body.hymns === "string") {
        payload = JSON.parse(req.body.hymns);
      }
    }
  } catch (error) {
    return res.status(400).json({ error: "Invalid JSON format." });
  }

  if (!payload || !Array.isArray(payload)) {
    return res.status(400).json({
      error: "Upload a JSON array of hymns.",
    });
  }

  const cleaned = payload.map(buildHymnRecord).filter(Boolean);
  if (!cleaned.length) {
    return res.status(400).json({ error: "No valid hymns found." });
  }

  try {
    const existing = mode === "replace" ? [] : await loadHymnsRaw();
    const existingKeys = new Map();
    existing.forEach((hymn) => {
      const key = `${hymn.number || ""}|${(hymn.title || "").toLowerCase()}`;
      existingKeys.set(key, hymn);
    });

    const merged = [...existing];
    cleaned.forEach((hymn) => {
      const key = `${hymn.number || ""}|${(hymn.title || "").toLowerCase()}`;
      if (!existingKeys.has(key)) {
        merged.push(hymn);
        existingKeys.set(key, hymn);
      }
    });

    await saveHymnsRaw(merged);

    return res.json({
      message:
        mode === "replace"
          ? "Hymn book replaced successfully."
          : "Hymn book imported successfully.",
      count: cleaned.length,
      total: merged.length,
      mode,
    });
  } catch (error) {
    console.error("Hymn import error:", error);
    return res.status(500).json({ error: "Unable to import hymns." });
  }
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
