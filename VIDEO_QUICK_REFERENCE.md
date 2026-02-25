# 🎬 VIDEO COMPRESSION QUICK REFERENCE

## STEP 1: Download HandBrake

👉 https://handbrake.fr/download2.php

---

## STEP 2A: DESKTOP VIDEO (3-4 MB)

### Input

- File: `Another.mp4`

### HandBrake Settings

| Setting     | Value        |
| ----------- | ------------ |
| Preset      | Fast 1080p30 |
| Video Codec | H.264        |
| Bitrate     | 2500 kbps    |
| Resolution  | 1920 x 1080  |
| Framerate   | 30 fps       |

### Output

- Filename: **`hero-bg-desktop.mp4`**
- Expected Size: **3-4 MB**
- Encode Time: ~2-5 minutes

---

## STEP 2B: MOBILE VIDEO (1-1.5 MB)

### Input

- File: `Another.mp4` (same source)

### HandBrake Settings

| Setting     | Value       |
| ----------- | ----------- |
| Preset      | Fast 720p30 |
| Video Codec | H.264       |
| Bitrate     | 1200 kbps   |
| Resolution  | 1280 x 720  |
| Framerate   | 30 fps      |

### Output

- Filename: **`hero-bg-mobile.mp4`**
- Expected Size: **1-1.5 MB**
- Encode Time: ~1-2 minutes

---

## STEP 3: File Placement

```
image/
├── About.jpg ✓
├── Another.mp4 ✓ (keep old one)
├── hero-bg-desktop.mp4 ← NEW!
└── hero-bg-mobile.mp4 ← NEW!
```

---

## STEP 4: Verify Sizes

Open `image/` folder and check:

- ✓ `hero-bg-desktop.mp4` is 3-4 MB
- ✓ `hero-bg-mobile.mp4` is 1-1.5 MB
- ✓ Both files play in Windows Media Player

---

## TROUBLESHOOTING

### "HandBrake says unsupported codec"

→ Make sure you're using the current version from handbrake.fr

### "Video plays too fast/slow"

→ Set Framerate to exactly **30 fps** in HandBrake

### "File is too big after encoding"

→ Reduce bitrate:

- Desktop: Try 2000 kbps instead of 2500
- Mobile: Try 1000 kbps instead of 1200

### "Encode keeps failing"

→ See VIDEO_OPTIMIZATION_GUIDE.md for alternative tools

---

## TIME ESTIMATE

- Download HandBrake: 5 min
- Compress Desktop: 5 min
- Compress Mobile: 2 min
- Copy Files: 1 min
- **Total: ~13 minutes**

---

## ✅ Ready? Reply with:

### "Videos ready!"

Then I'll update your website automatically!
