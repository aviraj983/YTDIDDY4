const fs = require('fs');
const path = require('path');
const https = require('https');

const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

function downloadFile(url, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects while downloading binary.'));
    }

    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          return downloadFile(redirectUrl, dest, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
        }
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download binary: HTTP ${res.statusCode}`));
      }

      const file = fs.createWriteStream(dest);
      res.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          if (process.platform !== 'win32') {
            try { fs.chmodSync(dest, 0o755); } catch (e) {}
          }
          console.log(`yt-dlp binary saved to ${dest} successfully.`);
          resolve();
        });
      });

      file.on('error', (err) => {
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      });
    });

    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Binary download timed out'));
    });
  });
}

async function main() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const binaryName = isWin ? 'yt-dlp.exe' : (isMac ? 'yt-dlp_macos' : 'yt-dlp_linux');
  const targetFile = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;

  if (!fs.existsSync(targetFile)) {
    console.log(`Downloading yt-dlp binary (${binaryName}) for ${process.platform}...`);
    try {
      await downloadFile(downloadUrl, targetFile);
    } catch (err) {
      console.warn(`Warning: Could not pre-download yt-dlp binary (${err.message}). Runtime self-healing in /tmp will activate when needed.`);
    }
  } else {
    if (!isWin) {
      try { fs.chmodSync(targetFile, 0o755); } catch (e) {}
    }
    console.log(`yt-dlp binary already exists at ${targetFile}`);
  }
}

main().then(() => {
  console.log('Postinstall binary setup completed.');
}).catch((err) => {
  console.warn('Postinstall binary setup notice:', err.message);
});
