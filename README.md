# YT4DOWN - Modern YouTube Video & Audio Downloader

A blazing fast, responsive YouTube Downloader web application supporting HD (1080p, 720p, 480p, 360p), 4K Ultra HD, and high-quality MP3 conversion (320kbps, 192kbps, 128kbps) with Adsterra banner monetization and custom modern UI.

![YT4DOWN Preview](public/favicon-original.png)

## 🚀 Features

- **Multi-Format Downloads**: MP4 Video (1080p, 720p, 480p, 360p) & MP3 Audio (320 kbps, 192 kbps, 128 kbps).
- **Fast Metadata Fetcher**: Uses `yt-dlp` with automated YouTube oEmbed fallback.
- **Dynamic SPA Routing**: Dedicated SEO landing pages for `/youtube-video-downloader`, `/youtube-to-mp3`, `/youtube-to-mp4`, `/youtube-shorts-downloader`, and `/youtube-audio-downloader`.
- **Integrated Adsterra Banner Ads**: 300x250 responsive ad slots optimized for both mobile and desktop screens.
- **Vercel Serverless Ready**: Configured with `api/index.js` and `vercel.json` for seamless 1-click deployment.

---

## 🛠️ Deploy to Vercel

1. Fork or clone this repository to your GitHub account.
2. Go to [Vercel](https://vercel.com/) and click **Add New... -> Project**.
3. Import the `YTDIDDY4` repository.
4. (Optional) Set the following environment variables in Vercel Project Settings:
   - `RAPIDAPI_KEY`: *(Optional)* Your RapidAPI key for YouTube Downloader APIs.
   - `COBALT_API_URL`: *(Optional)* URL of a self-hosted or community Cobalt instance.
   - `COBALT_API_KEY`: *(Optional)* If your Cobalt instance requires authorization.
5. Click **Deploy**. Vercel will build the project and serve it globally on its edge CDN!

---

## 💻 Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aviraj983/YTDIDDY4.git
   cd YTDIDDY4
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *(On local machines, this will also automatically download the latest `yt-dlp` executable into `bin/`)*

3. **Start the server:**
   ```bash
   npm start
   # or
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
├── api/
│   └── index.js              # Vercel Serverless entry point
├── public/
│   ├── index.html            # Main SPA interface
│   ├── app.js                # Frontend client script & routing
│   ├── style.css             # Custom animations & glassmorphism
│   ├── blog.html             # Blog landing page
│   ├── blog-4k-download.html # Blog guide article
│   ├── favicon-*.png         # Website favicons
│   └── *-logo.png            # Feature & tool custom badge logos
├── scripts/
│   └── download-binaries.js  # Automated binary downloader for local dev
├── server.js                 # Express server & API routes
├── vercel.json               # Vercel deployment configuration
├── package.json
└── README.md
```

## 📜 License

MIT License. Educational and personal use only.
