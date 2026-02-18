const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Allow frontend to communicate with backend
app.use(express.json({ limit: "50mb" })); // Parse JSON bodies (increased limit for images)
app.use(express.static(".")); // Serve static files from current directory

// --- MOCK DATABASE ---
// In a real app, this would be MongoDB or SQL
const events = [
  {
    title: "Special Worship Night",
    date: new Date().toISOString().split("T")[0], // Today
    description: "A night of soaking in His presence. Join us live!",
  },
  {
    title: "Community Potluck",
    date: "2024-02-28",
    description: "Join us after the service for food and fellowship.",
  },
  {
    title: "Youth Group Night",
    date: "2024-03-04",
    description: "Fun, games, and a message for students grades 6-12.",
  },
  {
    title: "Easter Sunday Service",
    date: "2024-03-31",
    description: "Celebrate the resurrection of our King!",
  },
];

const sermons = [
  {
    title: "The Book of John",
    preacher: "Pastor John Jeremiah",
    date: "2024-01-21",
    image:
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1220",
    videoUrl: "#",
  },
  {
    title: "Living with Purpose",
    preacher: "Pastor John Jeremiah",
    date: "2024-01-14",
    image:
      "https://images.unsplash.com/photo-1597739221543-9952f15543a4?q=80&w=1287",
    videoUrl: "#",
  },
  {
    title: "Foundations of Faith",
    preacher: "Pastor John Jeremiah",
    date: "2024-01-07",
    image:
      "https://images.unsplash.com/photo-1516528387632-607b518053c4?q=80&w=1287",
    videoUrl: "#",
  },
];

const prayerRequests = [];

const flyers = []; // Store flyer objects

let liveStreamConfig = {
  videoId: "dQw4w9WgXcQ", // Default placeholder ID
  isLive: false,
};

// --- AUTHENTICATION ---
const ADMIN_PASSWORD = "admin123"; // CHANGE THIS PASSWORD!

// --- ROUTES ---

// Get all events
app.get("/api/events", (req, res) => {
  // Sort events by date
  const sortedEvents = events.sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  res.json(sortedEvents);
});

// Add new event
app.post("/api/events", (req, res) => {
  const { title, date, description } = req.body;
  if (!title || !date || !description) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const newEvent = { title, date, description };
  events.push(newEvent);
  res
    .status(201)
    .json({ message: "Event added successfully", event: newEvent });
});

// Get all flyers
app.get("/api/flyers", (req, res) => {
  res.json(flyers);
});

// Add new flyers (Bulk)
app.post("/api/flyers", (req, res) => {
  const newFlyers = req.body; // Expecting array of { image }
  if (!Array.isArray(newFlyers)) {
    return res.status(400).json({ error: "Expected an array of flyers" });
  }

  // Assign unique IDs to new flyers
  const flyersWithIds = newFlyers.map((f, index) => ({
    ...f,
    id: Date.now().toString() + index,
  }));

  // Add to start of array so newest are first
  flyers.unshift(...flyersWithIds);
  res
    .status(201)
    .json({ message: "Flyers added successfully", count: newFlyers.length });
});

// Delete a flyer
app.delete("/api/flyers/:id", (req, res) => {
  const { id } = req.params;
  const index = flyers.findIndex((f) => f.id === id);
  if (index !== -1) {
    flyers.splice(index, 1);
    res.json({ message: "Flyer deleted successfully" });
  } else {
    res.status(404).json({ error: "Flyer not found" });
  }
});

// Get all sermons
app.get("/api/sermons", (req, res) => {
  // Sort sermons by date descending
  const sortedSermons = sermons.sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  res.json(sortedSermons);
});

// Submit prayer request
app.post("/api/prayer-requests", (req, res) => {
  const { name, email, request } = req.body;

  if (!name || !email || !request) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const newRequest = {
    id: prayerRequests.length + 1,
    name,
    email,
    request,
    timestamp: new Date(),
  };

  prayerRequests.push(newRequest);
  console.log("New Prayer Request Received:", newRequest);

  res.status(201).json({ message: "Prayer request saved successfully" });
});

// Get all prayer requests (Admin)
app.get("/api/prayer-requests", (req, res) => {
  // Return most recent first
  res.json(prayerRequests.reverse());
});

// Live Stream Routes
app.get("/api/livestream", (req, res) => {
  res.json(liveStreamConfig);
});

app.post("/api/livestream", (req, res) => {
  const { videoId, isLive } = req.body;
  if (videoId !== undefined) liveStreamConfig.videoId = videoId;
  if (isLive !== undefined) liveStreamConfig.isLive = isLive;
  res.json({ message: "Live stream updated", config: liveStreamConfig });
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
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
