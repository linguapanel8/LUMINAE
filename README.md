# LUMINAE — Light Up Your Memories
### Event Face Recognition App · BIO_SCAN Edition

> 100% browser-based · No API key · No backend · GitHub Pages ready

---

## Features

- **Face Probe** — Upload your selfie, lock your face descriptor
- **Event Photo Scan** — Upload 1–200 event photos (wedding, conference, etc.)
- **AI Face Matching** — Powered by `face-api.js` (runs entirely in your browser)
- **Confidence Score** — Each match shows % similarity
- **Face Bounding Box** — Highlighted face detection with corner brackets
- **Face Count Per Photo** — Shows how many people are in each photo
- **Duplicate Detection** — Flags duplicate images automatically
- **Download ZIP** — Export all matched photos with metadata in filename
- **Adjustable Threshold** — Tune match sensitivity from 30%–90%
- **PWA** — Installable on Android as a home screen app
- **Responsive** — Works on Desktop + Android Mobile

---

## Quick Deploy to GitHub Pages

1. **Fork or clone** this repo
2. Go to **Settings → Pages**
3. Set source to **main branch / root**
4. Visit `https://yourusername.github.io/luminae`

That's it. No build step. No npm install. Pure static files.

---

## How to Use

1. **Upload Your Selfie** — Drag or click the probe zone (left panel)
2. **Upload Event Photos** — Click "UPLOAD EVENT PHOTOS" (up to 200 photos)
3. **Adjust Threshold** — Default 60% works well; lower = more matches, higher = stricter
4. **Run Face Scan** — Click "RUN FACE SCAN" and wait
5. **Browse Results** — Click any matched photo to view full size
6. **Download** — Click "DOWNLOAD MATCHES" to get a ZIP of all matched photos

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Face Detection | face-api.js SSD MobileNet v1 |
| Face Landmarks | face-api.js 68-point model |
| Face Recognition | face-api.js ArcFace descriptors |
| ZIP Export | JSZip |
| Hosting | GitHub Pages (static) |
| Fonts | Share Tech Mono + Rajdhani |
| Framework | Vanilla JS + HTML + CSS |

---

## Privacy

All processing happens **100% in your browser**.  
No images are uploaded to any server.  
No data is stored after you close the tab.

---

## Limitations

- Best performance with up to **~150 photos**
- Requires a **clear, well-lit selfie** for accurate matching
- Works best with **front-facing faces** in photos
- First load takes ~15–20 seconds to download AI models (~6MB)

---

## License

MIT — free for personal and commercial use.

---

*Built with face-api.js · Designed with BIO_SCAN aesthetic*
