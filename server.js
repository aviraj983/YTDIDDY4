const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

try { require('dotenv').config(); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;

// Path to binaries
const YTDLP_PATH = path.join(__dirname, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
let FFMPEG_PATH = '';
try {
  FFMPEG_PATH = require('ffmpeg-static') || '';
} catch (e) {}
if (!FFMPEG_PATH || !fs.existsSync(FFMPEG_PATH)) {
  const localFfmpeg = path.join(__dirname, 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(localFfmpeg)) {
    FFMPEG_PATH = localFfmpeg;
  }
}

// External APIs (Optional fallbacks & integrations)
const COBALT_API_URL = process.env.COBALT_API_URL || '';
const COBALT_API_KEY = process.env.COBALT_API_KEY || '';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'youtube-video-and-audio-downloader-api.p.rapidapi.com';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──

function formatDuration(seconds) {
  const sec = parseInt(seconds, 10);
  if (isNaN(sec) || sec <= 0) return '0:00';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return 'Variable';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function isValidYouTubeUrl(url) {
  try {
    const u = new URL(url);
    const validHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be', 'music.youtube.com'];
    return validHosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be' || u.hostname === 'www.youtu.be') {
      return u.pathname.slice(1).split(/[?#&]/)[0];
    }
    if (u.pathname.includes('/shorts/')) {
      return u.pathname.split('/shorts/')[1]?.split(/[?#&]/)[0];
    }
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

function sanitizeFilename(name) {
  return (name || 'video')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .slice(0, 150);
}

// ── API: Get Video Info ──

const handleInfo = async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
      return res.status(400).json({ error: 'Please provide a valid YouTube URL' });
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: 'Could not extract video ID from the URL' });
    }

    // 1. Primary Engine: yt-dlp binary with IPv4 enforcement and Node.js JS challenge solver
    if (fs.existsSync(YTDLP_PATH)) {
      try {
        const { stdout } = await execFileAsync(YTDLP_PATH, [
          '--force-ipv4',
          '--no-warnings',
          '--js-runtimes', 'node',
          '-J',
          '--no-playlist',
          `https://www.youtube.com/watch?v=${videoId}`
        ], { maxBuffer: 25 * 1024 * 1024, timeout: 20000 });

        const info = JSON.parse(stdout);
        const title = info.title || 'Untitled Video';
        const duration = formatDuration(info.duration || 0);
        const views = (info.view_count || 0).toLocaleString();
        const author = info.uploader || info.channel || 'Unknown Channel';
        const thumbnail = info.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

        // Extract available video formats
        const videoFormats = [];
        const seenQuality = new Set();

        if (info.formats && Array.isArray(info.formats)) {
          const sortedFormats = info.formats
            .filter(f => f.height && (f.vcodec !== 'none'))
            .sort((a, b) => b.height - a.height);

          for (const f of sortedFormats) {
            const qLabel = `${f.height}p`;
            if (!seenQuality.has(qLabel)) {
              seenQuality.add(qLabel);
              const approxSize = f.filesize || f.filesize_approx || 0;
              videoFormats.push({
                qualityLabel: qLabel,
                container: 'mp4',
                hasAudio: true,
                contentLength: approxSize > 0 ? formatBytes(approxSize) : 'High Speed',
                formatId: f.format_id
              });
            }
          }
        }

        // Ensure common quality tiers if none parsed
        if (videoFormats.length === 0) {
          videoFormats.push(
            { qualityLabel: '1080p', container: 'mp4', hasAudio: true, contentLength: 'Full HD', formatId: 'best' },
            { qualityLabel: '720p', container: 'mp4', hasAudio: true, contentLength: 'HD', formatId: 'best[height<=720]' },
            { qualityLabel: '480p', container: 'mp4', hasAudio: true, contentLength: 'SD', formatId: 'best[height<=480]' },
            { qualityLabel: '360p', container: 'mp4', hasAudio: true, contentLength: 'Mobile', formatId: 'best[height<=360]' }
          );
        }

        const audioFormats = [
          { audioBitrate: '320 kbps', container: 'mp3', contentLength: 'Studio Quality', formatId: 'bestaudio' },
          { audioBitrate: '192 kbps', container: 'mp3', contentLength: 'High Quality', formatId: 'bestaudio' },
          { audioBitrate: '128 kbps', container: 'mp3', contentLength: 'Standard Quality', formatId: 'bestaudio' }
        ];

        return res.json({
          videoId,
          title,
          duration,
          views,
          author,
          thumbnail,
          videoFormats,
          audioFormats,
          source: 'yt-dlp Engine (Ultra Fast)'
        });
      } catch (ytdlpErr) {
        console.warn('yt-dlp info failed, falling back to cloud engine:', ytdlpErr.message);
      }
    }

    // 2. Serverless / Cloud Fallback: YouTube oEmbed + High-Res Thumbnails
    let videoTitle = 'YouTube Video';
    let authorName = 'YouTube Creator';
    let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        if (oembed.title) videoTitle = oembed.title;
        if (oembed.author_name) authorName = oembed.author_name;
        if (oembed.thumbnail_url) thumbnail = oembed.thumbnail_url;
      }
    } catch (oembedErr) {
      console.warn('oEmbed fetch warning:', oembedErr.message);
    }

    const videoFormats = [
      { qualityLabel: '1080p', container: 'mp4', hasAudio: true, contentLength: 'Full HD', formatId: '1080p' },
      { qualityLabel: '720p', container: 'mp4', hasAudio: true, contentLength: 'HD', formatId: '720p' },
      { qualityLabel: '480p', container: 'mp4', hasAudio: true, contentLength: 'SD', formatId: '480p' },
      { qualityLabel: '360p', container: 'mp4', hasAudio: true, contentLength: 'Mobile', formatId: '360p' }
    ];

    const audioFormats = [
      { audioBitrate: '320 kbps', container: 'mp3', contentLength: 'Studio Quality', formatId: '320' },
      { audioBitrate: '192 kbps', container: 'mp3', contentLength: 'High Quality', formatId: '192' },
      { audioBitrate: '128 kbps', container: 'mp3', contentLength: 'Standard Quality', formatId: '128' }
    ];

    return res.json({
      videoId,
      title: videoTitle,
      duration: 'HD',
      views: 'Popular',
      author: authorName,
      thumbnail,
      videoFormats,
      audioFormats,
      source: 'YouTube Cloud Engine'
    });
  } catch (error) {
    console.error('Error fetching video info:', error.message);
    res.status(500).json({ error: 'Failed to fetch video info. Please verify the URL is correct.' });
  }
};

app.get('/api/info', handleInfo);
app.get('/info', handleInfo);

// ── API: Download Handler ──

const handleDownload = async (req, res) => {
  const { url, quality, format: fmt, token } = req.query;

  if (!url || !isValidYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL provided.' });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Could not extract valid video ID.' });
  }

  const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const isAudio = (fmt === 'mp3' || quality?.includes('kbps'));
  const ext = isAudio ? 'mp3' : 'mp4';
  const mime = isAudio ? 'audio/mpeg' : 'video/mp4';

  // 1. Primary Engine: Direct stream with yt-dlp & FFmpeg
  if (fs.existsSync(YTDLP_PATH)) {
    try {
      // Fetch title for clean download filename
      let videoTitle = `video_${videoId}`;
      try {
        const { stdout: titleOut } = await execFileAsync(YTDLP_PATH, [
          '--force-ipv4',
          '--no-warnings',
          '--print', 'title',
          '--no-playlist',
          targetUrl
        ], { timeout: 8000 });
        const cleanT = sanitizeFilename(titleOut);
        if (cleanT) videoTitle = cleanT;
      } catch (e) {}

      const qualityTag = isAudio ? (quality || 'audio') : (quality || '720p');
      const safeName = `${videoTitle} [${qualityTag}].${ext}`;

      const ytdlpArgs = [
        '--force-ipv4',
        '--no-warnings',
        '--js-runtimes', 'node',
        '--no-playlist'
      ];

      if (FFMPEG_PATH && fs.existsSync(FFMPEG_PATH)) {
        ytdlpArgs.push('--ffmpeg-location', FFMPEG_PATH);
      }

      if (isAudio) {
        let audioQuality = '2'; // ~192 kbps
        if (quality?.includes('320')) audioQuality = '0';
        else if (quality?.includes('128')) audioQuality = '4';

        ytdlpArgs.push(
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', audioQuality,
          '-o', '-',
          targetUrl
        );
      } else {
        const numHeight = (quality || '720').replace(/[^0-9]/g, '') || '720';
        // Select best compatible MP4 stream or merge AVC1 + M4A natively
        const formatSpec = `bestvideo[height<=${numHeight}][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=${numHeight}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${numHeight}][ext=mp4]/best[height<=${numHeight}]/best`;
        
        ytdlpArgs.push(
          '-f', formatSpec,
          '--downloader-args', 'ffmpeg_o:-movflags frag_keyframe+empty_moov',
          '-o', '-',
          targetUrl
        );
      }

      const ytdlp = spawn(YTDLP_PATH, ytdlpArgs);

      let headersSent = false;
      const sendHeaders = () => {
        if (!headersSent && !res.headersSent) {
          headersSent = true;
          if (token) {
            res.setHeader('Set-Cookie', `downloadToken=${encodeURIComponent(token)}; Path=/; Max-Age=30`);
          }
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
          res.setHeader('Content-Type', mime);
        }
      };

      ytdlp.stdout.on('data', (chunk) => {
        sendHeaders();
        res.write(chunk);
      });

      ytdlp.stdout.on('end', () => {
        res.end();
      });

      let stderrOutput = '';
      ytdlp.stderr.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      ytdlp.on('error', (err) => {
        console.error('yt-dlp spawn error:', err);
        if (!headersSent && !res.headersSent) {
          res.status(500).json({ error: 'Download engine error: ' + err.message });
        }
      });

      ytdlp.on('close', (code) => {
        if (code !== 0 && !headersSent && !res.headersSent) {
          console.error('yt-dlp exited with error code', code, stderrOutput);
          res.status(500).json({ error: 'Download failed. Please try a different resolution or format.' });
        }
      });

      req.on('close', () => {
        try { ytdlp.kill('SIGTERM'); } catch (e) {}
      });

      return;
    } catch (engineErr) {
      console.error('Primary download engine error:', engineErr.message);
    }
  }

  // 2. Secondary Engine: Cobalt API (if configured)
  if (COBALT_API_URL) {
    try {
      console.log('Using Cobalt API instance for download...');
      const cobaltPayload = {
        url: targetUrl,
        videoQuality: (quality || '720').replace(/[^0-9]/g, '') || '720',
        downloadMode: isAudio ? 'audio' : 'auto',
        audioFormat: isAudio ? 'mp3' : undefined
      };

      const cobaltHeaders = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'YT4Downloader/1.0'
      };
      if (COBALT_API_KEY) {
        cobaltHeaders['Authorization'] = `Api-Key ${COBALT_API_KEY}`;
      }

      const cobaltRes = await fetch(COBALT_API_URL, {
        method: 'POST',
        headers: cobaltHeaders,
        body: JSON.stringify(cobaltPayload)
      });

      if (cobaltRes.ok) {
        const data = await cobaltRes.json();
        const streamUrl = data.url;
        if (streamUrl) {
          if (token) {
            res.setHeader('Set-Cookie', `downloadToken=${encodeURIComponent(token)}; Path=/; Max-Age=30`);
          }
          return res.redirect(streamUrl);
        }
      }
    } catch (cobaltErr) {
      console.error('Cobalt API error:', cobaltErr.message);
    }
  }

  // 3. Tertiary Engine: RapidAPI YouTube Downloader (if configured)
  if (RAPIDAPI_KEY) {
    try {
      console.log('Using RapidAPI for download...');
      const rapidUrl = `https://${RAPIDAPI_HOST}/download?url=${encodeURIComponent(targetUrl)}`;
      const rapidRes = await fetch(rapidUrl, {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST
        }
      });
      if (rapidRes.ok) {
        const rapidData = await rapidRes.json();
        const downloadLink = rapidData.link || rapidData.url || rapidData.downloadUrl;
        if (downloadLink) {
          if (token) {
            res.setHeader('Set-Cookie', `downloadToken=${encodeURIComponent(token)}; Path=/; Max-Age=30`);
          }
          return res.redirect(downloadLink);
        }
      }
    } catch (rapidErr) {
      console.error('RapidAPI error:', rapidErr.message);
    }
  }

  // If on serverless/cloud without backend binaries:
  if (token) {
    res.setHeader('Set-Cookie', `downloadToken=${encodeURIComponent(token)}; Path=/; Max-Age=30`);
  }

  return res.status(503).json({
    error: 'Direct downloads on Vercel Serverless require RAPIDAPI_KEY or COBALT_API_URL in Environment Variables, or hosting on a VPS (Hostinger / Render / Railway) where yt-dlp runs natively.'
  });
};

app.get('/api/download', handleDownload);
app.get('/download', handleDownload);

// ── Health Check ──

const handleHealth = (req, res) => {
  res.json({
    status: 'ok',
    ytdlpConfigured: fs.existsSync(YTDLP_PATH),
    ffmpegConfigured: !!(FFMPEG_PATH && fs.existsSync(FFMPEG_PATH)),
    cobaltConfigured: !!COBALT_API_URL,
    rapidApiConfigured: !!RAPIDAPI_KEY,
    environment: process.env.VERCEL ? 'vercel-serverless' : 'persistent-server',
    timestamp: new Date().toISOString()
  });
};

app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// ── Blog Routes ──

app.get('/blog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

app.get('/blog/how-to-download-youtube-videos-in-4k', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog-4k-download.html'));
});

// ── Catch-all Route for SEO Landers & SPA ──

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  🚀 YT4DOWN server running at http://localhost:${PORT}`);
    console.log(`  ⚡ yt-dlp Engine: ${fs.existsSync(YTDLP_PATH) ? 'Active ✅' : 'not found ❌'}`);
    console.log(`  🎬 FFmpeg Engine: ${FFMPEG_PATH && fs.existsSync(FFMPEG_PATH) ? 'Active ✅' : 'not found ❌'}`);
    console.log(`  🌐 Cobalt API: ${COBALT_API_URL ? 'Configured ✅' : 'disabled (optional)'}`);
    console.log(`  🔑 RapidAPI: ${RAPIDAPI_KEY ? 'Configured ✅' : 'disabled (optional)'}\n`);
  });
}

module.exports = app;
