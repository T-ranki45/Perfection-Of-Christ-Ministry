const express = require("express");
const Song = require("../models/Song");
const { connectMongoose } = require("../config/mongoose");

const router = express.Router();

function normalizeSlide(slide = {}) {
  return {
    label: String(slide.label || "").trim(),
    lyrics: String(slide.lyrics || "").trim(),
  };
}

function buildSongPayload(body = {}) {
  return {
    title: String(body.title || "").trim(),
    artist: String(body.artist || "").trim(),
    slides: Array.isArray(body.slides)
      ? body.slides.map(normalizeSlide).filter((slide) => slide.label || slide.lyrics)
      : [],
  };
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

router.use(
  asyncHandler(async (req, res, next) => {
    await connectMongoose();
    next();
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const songs = await Song.find().sort({ title: 1, createdAt: -1 }).lean();
    return res.status(200).json(songs);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const song = await Song.findById(req.params.id).lean();
    if (!song) {
      return res.status(404).json({ error: "Song not found." });
    }
    return res.status(200).json(song);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = buildSongPayload(req.body);
    const song = await Song.create(payload);
    return res.status(201).json(song);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = buildSongPayload(req.body);
    const song = await Song.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!song) {
      return res.status(404).json({ error: "Song not found." });
    }

    return res.status(200).json(song);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const song = await Song.findByIdAndDelete(req.params.id);

    if (!song) {
      return res.status(404).json({ error: "Song not found." });
    }

    return res.status(200).json({ message: "Song deleted successfully." });
  }),
);

router.use((error, req, res, next) => {
  if (error.name === "CastError") {
    return res.status(400).json({ error: "Invalid song id." });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Song validation failed.",
      details: Object.values(error.errors).map((entry) => entry.message),
    });
  }

  console.error("Song controller error:", error);
  return res.status(500).json({ error: "Failed to process song request." });
});

module.exports = router;
