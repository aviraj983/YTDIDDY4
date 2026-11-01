const fs = require('fs');
const path = require('path');
const https = require('https');

// Skip binary download on Vercel / CI environments
if (process.env.VERCEL || process.env.CI || process.env.NOW_BUILDER) {
  console.log('Skipping yt-dlp binary download (serverless environment).');
  process.exit(0);
}

const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

function downloadFile(url, dest, callback) {
  https.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      return downloadFile(res.headers.location, dest, callback);
    }
    
    if (res.statusCode !== 200) {
      console.error(`Failed to download binary: HTTP status ${res.statusCode}`);
      return;
    }

    const file = fs.createWriteStream(dest);
    res.pipe(file);
    
    file.on('finish', () => {
      file.close(() => {
        if (process.platform !== 'win32') {
          try { fs.chmodSync(dest, '755'); } catch (e) {}
        }
        console.log(`yt-dlp binary saved to ${dest} successfully.`);
        if (callback) callback();
      });
    });
  }).on('error', (err) => {
    console.error('Error downloading yt-dlp:', err.message);
  });
}

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const binaryName = isWin ? 'yt-dlp.exe' : (isMac ? 'yt-dlp_macos' : 'yt-dlp');
const targetFile = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;

if (!fs.existsSync(targetFile)) {
  console.log(`Downloading yt-dlp binary for ${process.platform}...`);
  downloadFile(downloadUrl, targetFile);
} else {
  console.log(`yt-dlp binary already exists at ${targetFile}`);
}
