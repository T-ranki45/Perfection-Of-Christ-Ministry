const mongoose = require("mongoose");

const slideSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, "Slide label is required."],
      trim: true,
      maxlength: 120,
    },
    lyrics: {
      type: String,
      required: [true, "Slide lyrics are required."],
      trim: true,
      maxlength: 12000,
    },
  },
  { _id: false },
);

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Song title is required."],
      trim: true,
      maxlength: 200,
      index: true,
    },
    artist: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
    slides: {
      type: [slideSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one slide is required.",
      },
    },
  },
  {
    timestamps: true,
    collection: "ictSongs",
  },
);

module.exports = mongoose.models.Song || mongoose.model("Song", songSchema);
