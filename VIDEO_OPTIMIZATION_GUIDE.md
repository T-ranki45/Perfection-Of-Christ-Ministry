# Video Optimization Guide for Perfection Of Christ Ministry Website

## Current Video Analysis

| Video File       | Current Size | Recommended Size | Compression Ratio    |
| ---------------- | ------------ | ---------------- | -------------------- |
| Another.mp4      | 22.11 MB     | 3-5 MB           | 78-86% reduction     |
| Backup-image.mp4 | 14.00 MB     | 2-3 MB           | 78-86% reduction     |
| Backup.mp4       | 12.58 MB     | 2-3 MB           | 76-84% reduction     |
| Front -image.mp4 | 12.58 MB     | 2-3 MB           | 76-84% reduction     |
| **TOTAL**        | **61.27 MB** | **9-14 MB**      | **78-85% reduction** |

## Why Optimization Matters

- **Desktop video**: 22.11 MB → 4 MB (web-optimized HD)
- **Mobile video**: 22.11 MB → 1.5 MB (mobile-safe version)
- **Load time improvement**: ~3-5x faster page loads
- **Mobile data saved**: 90% reduction for mobile users
- **Better SEO**: Faster sites rank higher

## Recommended Optimization Specifications

### Desktop Version (Hero Background Video)

- **Resolution**: 1920 x 1080 (Full HD)
- **Codec**: H.264 (best browser support)
- **Bitrate**: 2000-2500 kbps
- **Target Size**: 3-4 MB for 10-15 second video
- **Format**: MP4 (.mp4)
- **Filename**: `hero-bg-desktop.mp4`

### Mobile Version (Hybrid Approach)

- **Resolution**: 1280 x 720 (HD)
- **Codec**: H.264
- **Bitrate**: 1000-1200 kbps
- **Target Size**: 1-1.5 MB for 10-15 second video
- **Format**: MP4 (.mp4)
- **Filename**: `hero-bg-mobile.mp4`

## FREE Tools to Use

### Option 1: HandBrake (Recommended - User Friendly)

**Download**: https://handbrake.fr/

1. Download and install HandBrake
2. Click "Open Source" and select your video
3. Choose preset: "Fast 1080p30" for desktop, "Fast 720p30" for mobile
4. Set Video tab→Quality to 20 (H.264)
5. Click "Start Encode"
6. Save as `hero-bg-desktop.mp4` and `hero-bg-mobile.mp4`

### Option 2: Shotcut (Open Source Video Editor)

**Download**: https://shotcut.org/

1. Open video in Shotcut
2. File → Export (Ctrl+E)
3. Set resolution: 1920x1080 for desktop, 1280x720 for mobile
4. Choose H.264 profile
5. Set bitrate to 2500k (desktop) or 1200k (mobile)
6. Export

### Option 3: FFmpeg Command Line (Most Powerful)

Once FFmpeg is installed, use these commands:

**Desktop version:**

```bash
ffmpeg -i Another.mp4 -vcodec libx264 -preset slow -b:v 2500k -s 1920x1080 hero-bg-desktop.mp4
```

**Mobile version:**

```bash
ffmpeg -i Another.mp4 -vcodec libx264 -preset slow -b:v 1200k -s 1280x720 hero-bg-mobile.mp4
```

### Option 4: Online Tool (No Installation)

- **CloudConvert**: https://cloudconvert.com (free up to 25 conversions/day)
- **Convertio**: https://convertio.co (free up to 2 files/day)
- **Online-Convert**: https://online-convert.com

## File Placement

Once optimized, place files in:

```
image/
  ├── hero-bg-desktop.mp4    (3-4 MB)
  ├── hero-bg-mobile.mp4     (1-1.5 MB)
  ├── About.jpg              (fallback poster image)
  └── [original files can be archived]
```

## Next: Hybrid HTML Implementation

Once files are optimized, I'll update your HTML with:

```html
<video
  id="hero-video"
  autoplay
  muted
  loop
  playsinline
  poster="./image/About.jpg"
  class="hero-video"
>
  <!-- Desktop HD version -->
  <source
    media="(min-width: 768px)"
    src="./image/hero-bg-desktop.mp4"
    type="video/mp4"
  />
  <!-- Mobile SD version -->
  <source
    media="(max-width: 767px)"
    src="./image/hero-bg-mobile.mp4"
    type="video/mp4"
  />
  <!-- Fallback image for no video support -->
  <img src="./image/About.jpg" alt="Church background" />
</video>
```

## Performance Impact

### Before Optimization

- Page load: ~4-5 seconds (with video)
- Mobile data: ~22 MB
- Bounce rate: Higher due to slow loading

### After Optimization

- Page load: ~0.8-1.2 seconds
- Mobile data: ~2.5-3.5 MB (90% savings)
- Mobile bounce rate: Significantly reduced
- User experience: Much smoother

## Quick Checklist

- [ ] Download HandBrake or choose optimization tool
- [ ] Compress `Another.mp4` to desktop version (3-4 MB, 1920x1080)
- [ ] Create mobile version (1-1.5 MB, 1280x720)
- [ ] Rename to `hero-bg-desktop.mp4` and `hero-bg-mobile.mp4`
- [ ] Place in `image/` folder
- [ ] Let me know when ready, I'll update the HTML
- [ ] Test on mobile and desktop
- [ ] Archive original files

## Questions?

If you encounter any issues during compression, let me know and I can help troubleshoot!
