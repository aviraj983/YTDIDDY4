document.addEventListener('DOMContentLoaded', () => {
  // ── DOM References ──
  const form = document.getElementById('download-form');
  const urlInput = document.getElementById('video-url');
  const clearBtn = document.getElementById('clear-btn');
  const fetchBtn = document.getElementById('fetch-btn');
  const btnText = document.getElementById('btn-text');
  const errorMsg = document.getElementById('error-msg');
  const resultSection = document.getElementById('result-section');
  const scrollTopBtn = document.getElementById('scroll-top');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');

  // ── Coming Soon Toast ──
  const toast = document.createElement('div');
  toast.id = 'coming-soon-toast';
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="material-symbols-outlined" style="font-size:22px;color:#f59e0b;">construction</span>
      <div>
        <div style="font-weight:700;font-size:14px;color:#1f2937;">Coming Soon!</div>
        <div style="font-size:13px;color:#6b7280;">This platform is under development. Stay tuned!</div>
      </div>
    </div>
  `;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '-100px', left: '50%', transform: 'translateX(-50%)',
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px',
    padding: '16px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
    zIndex: '9999', transition: 'bottom 0.4s cubic-bezier(0.34,1.56,0.64,1)', maxWidth: '380px', width: '90%'
  });
  document.body.appendChild(toast);

  let toastTimer = null;
  function showComingSoon() {
    toast.style.bottom = '28px';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
  }

  document.querySelectorAll('[data-coming-soon]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showComingSoon();
    });
  });

  // ── Mobile Menu Toggle ──
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.contains('open');
      if (isOpen) {
        mobileNav.classList.remove('open');
        mobileNav.classList.add('hidden');
      } else {
        mobileNav.classList.remove('hidden');
        // Force reflow for animation
        void mobileNav.offsetHeight;
        mobileNav.classList.add('open');
      }
      // Swap icon with rotation
      const icon = mobileMenuBtn.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.style.transition = 'transform 0.3s ease';
        icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        icon.textContent = isOpen ? 'menu' : 'close';
      }
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        mobileNav.classList.add('hidden');
        const icon = mobileMenuBtn.querySelector('.material-symbols-outlined');
        if (icon) {
          icon.textContent = 'menu';
          icon.style.transform = 'rotate(0deg)';
        }
      });
    });
  }

  // ── Scroll to Top ──
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('show', window.scrollY > 500);
    }, { passive: true });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Clear & Paste Buttons ──
  const pasteBtn = document.getElementById('paste-btn');

  // Also focus input if clicking anywhere on the wrapper div
  const inputWrapper = urlInput.parentElement;
  inputWrapper.addEventListener('click', (e) => {
    if (e.target !== pasteBtn && e.target !== clearBtn && !pasteBtn.contains(e.target) && !clearBtn.contains(e.target)) {
      urlInput.focus();
    }
  });

  urlInput.addEventListener('input', () => {
    const hasValue = !!urlInput.value;
    if (clearBtn) clearBtn.classList.toggle('hidden', !hasValue);
    if (pasteBtn) pasteBtn.classList.toggle('hidden', hasValue);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      urlInput.value = '';
      clearBtn.classList.add('hidden');
      if (pasteBtn) pasteBtn.classList.remove('hidden');
      resultSection.classList.add('hidden');
      errorMsg.classList.add('hidden');
      urlInput.focus();
    });
  }

  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        urlInput.value = text;
        pasteBtn.classList.add('hidden');
        if (clearBtn) clearBtn.classList.remove('hidden');
        urlInput.focus();
      } catch (err) {
        console.error('Failed to read clipboard', err);
        // Fallback for browsers denying clipboard read
        urlInput.focus();
      }
    });
  }

  // ── Format Tab Switching ──
  const tabBtns = document.querySelectorAll('.format-tab');
  const tabPanels = document.querySelectorAll('.format-panel');

  const activeClasses = ['active', 'bg-white/[0.12]', 'border-white/20', 'text-white', 'shadow-[0_4px_15px_rgba(0,0,0,0.2)]'];
  const inactiveClasses = ['bg-white/[0.04]', 'border-white/[0.05]', 'text-white/50'];

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;

      // Deactivate all tabs
      tabBtns.forEach(b => {
        b.classList.remove(...activeClasses);
        b.classList.add(...inactiveClasses);
      });
      tabPanels.forEach(p => p.classList.add('hidden'));

      // Activate clicked tab
      btn.classList.add(...activeClasses);
      btn.classList.remove(...inactiveClasses);

      const target = document.getElementById(targetId);
      if (target) target.classList.remove('hidden');
    });
  });

  // Initialize tab styles
  tabBtns.forEach((btn, i) => {
    btn.classList.add('border'); // ensure border base class
    if (i === 0) {
      btn.classList.add(...activeClasses);
      btn.classList.remove(...inactiveClasses);
    } else {
      btn.classList.add(...inactiveClasses);
      btn.classList.remove(...activeClasses);
    }
  });

  // ── Form Submission ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    // Reset
    errorMsg.classList.add('hidden');
    resultSection.classList.add('hidden');
    setLoading(true);

    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video information.');
      }

      // Populate result card
      document.getElementById('result-thumb').src = data.thumbnail;
      document.getElementById('result-thumb').alt = data.title || 'Video Thumbnail';
      document.getElementById('result-title').textContent = data.title;
      document.getElementById('result-duration').textContent = data.duration;
      document.getElementById('result-author').innerHTML = `
        <span class="material-symbols-outlined text-base">person</span> ${escapeHtml(data.author)}
      `;
      document.getElementById('result-views').innerHTML = `
        <span class="material-symbols-outlined text-base">visibility</span> ${data.views} views
      `;

      // Render video format rows
      const videoList = document.getElementById('video-formats');
      videoList.innerHTML = data.videoFormats.map(f => `
        <div class="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl gap-4 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center justify-center min-w-[70px] h-9 bg-white/[0.05] rounded-lg border border-white/[0.05] group-hover:bg-red-500/10 group-hover:border-red-500/20 group-hover:text-red-400 transition-colors">
              <span class="font-black text-sm text-white group-hover:text-red-400 transition-colors">${escapeHtml(f.qualityLabel)}</span>
            </div>
            <span class="text-[11px] font-bold text-white/50 px-2.5 py-1 bg-white/[0.03] rounded-md uppercase tracking-wider">MP4</span>
            <div class="flex items-center gap-1.5 px-2">
              <span class="w-1 h-1 rounded-full bg-white/20"></span>
              <span class="text-xs font-medium text-white/40">${f.contentLength}</span>
              <span class="w-1 h-1 rounded-full bg-white/20"></span>
            </div>
            <span class="flex items-center gap-1 text-xs text-emerald-400/90 font-medium bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
              <span class="material-symbols-outlined text-[14px]">volume_up</span> Audio
            </span>
          </div>
          <a href="/api/download?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(f.qualityLabel)}&format=mp4"
             class="download-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-all duration-300 border border-white/10 hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] group-hover:bg-white/10">
            <span class="material-symbols-outlined text-[18px]">download</span> <span>Download</span>
          </a>
        </div>
      `).join('');

      // Render audio format rows
      const audioList = document.getElementById('audio-formats');
      audioList.innerHTML = data.audioFormats.map(f => `
        <div class="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl gap-4 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center justify-center min-w-[90px] h-9 bg-white/[0.05] rounded-lg border border-white/[0.05] group-hover:bg-purple-500/10 group-hover:border-purple-500/20 group-hover:text-purple-400 transition-colors">
              <span class="font-black text-sm text-white group-hover:text-purple-400 transition-colors">${escapeHtml(f.audioBitrate)}</span>
            </div>
            <span class="text-[11px] font-bold text-white/50 px-2.5 py-1 bg-white/[0.03] rounded-md uppercase tracking-wider">MP3</span>
            <div class="flex items-center gap-1.5 px-2">
              <span class="w-1 h-1 rounded-full bg-white/20"></span>
              <span class="text-xs font-medium text-white/40">${f.contentLength}</span>
            </div>
          </div>
          <a href="/api/download?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(f.audioBitrate)}&format=mp3"
             class="download-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-purple-600 text-white rounded-xl font-bold text-sm transition-all duration-300 border border-white/10 hover:border-purple-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:bg-white/10">
            <span class="material-symbols-outlined text-[18px]">music_note</span> <span>Download</span>
          </a>
        </div>
      `).join('');

      // Show results & reset tabs to video
      resultSection.classList.remove('hidden');
      tabBtns.forEach((btn, i) => {
        btn.classList.add('border');
        if (i === 0) {
          btn.classList.add(...activeClasses);
          btn.classList.remove(...inactiveClasses);
        } else {
          btn.classList.remove(...activeClasses);
          btn.classList.add(...inactiveClasses);
        }
      });
      tabPanels.forEach((p, i) => p.classList.toggle('hidden', i !== 0));

      // Smooth scroll to results
      setTimeout(() => {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);

    } catch (err) {
      errorMsg.textContent = err.message || 'An error occurred. Please try again.';
      errorMsg.classList.remove('hidden');
    } finally {
      setLoading(false);
    }
  });

  // ── Download Button Loading State (cookie-based detection) ──
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.download-btn');
    if (!btn) return;
    if (btn.dataset.loading === "true") {
      e.preventDefault();
      return;
    }

    e.preventDefault(); // We'll trigger download ourselves with a token

    const originalHtml = btn.innerHTML;
    btn.dataset.loading = "true";
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> <span>Processing...</span>';
    btn.classList.add('opacity-80', 'cursor-not-allowed');

    // Generate unique token & append to download URL
    const token = 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const downloadUrl = btn.href + '&token=' + encodeURIComponent(token);

    // Create a hidden iframe to trigger the download
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = downloadUrl;
    document.body.appendChild(iframe);

    // If the server returns an HTML/JSON error document, iframe onload fires
    iframe.onload = () => {
      setTimeout(() => {
        const hasCookie = document.cookie.includes('downloadToken=' + token);
        if (!hasCookie && btn.dataset.loading === "true") {
          clearInterval(pollInterval);
          btn.innerHTML = '<span class="material-symbols-outlined text-[18px] text-amber-400">warning</span> <span>Retry</span>';
          if (errorMsg) {
            errorMsg.textContent = 'Direct downloads on Vercel Serverless require a free RAPIDAPI_KEY or COBALT_API_URL in Vercel Environment Variables, or hosting on a VPS (Hostinger) where yt-dlp runs natively.';
            errorMsg.classList.remove('hidden');
          }
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('opacity-80', 'cursor-not-allowed');
            btn.dataset.loading = "false";
          }, 4000);
          try { document.body.removeChild(iframe); } catch(e) {}
        }
      }, 600);
    };

    // Poll for the cookie that the server sets when streaming begins
    let attempts = 0;
    const maxAttempts = 50; // 25 seconds max
    const pollInterval = setInterval(() => {
      attempts++;
      const hasCookie = document.cookie.includes('downloadToken=' + token);
      if (hasCookie || attempts >= maxAttempts) {
        clearInterval(pollInterval);
        // Clear the cookie
        document.cookie = 'downloadToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        // Show brief success or reset
        if (hasCookie) {
          btn.innerHTML = '<span class="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span> <span class="text-emerald-400">Started!</span>';
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('opacity-80', 'cursor-not-allowed');
            btn.dataset.loading = "false";
          }, 1500);
        } else {
          // Timeout — reset button
          btn.innerHTML = originalHtml;
          btn.classList.remove('opacity-80', 'cursor-not-allowed');
          btn.dataset.loading = "false";
        }
        // Clean up iframe
        setTimeout(() => { try { document.body.removeChild(iframe); } catch(e) {} }, 5000);
      }
    }, 500);
  });

  // ── Helpers ──
  function setLoading(loading) {
    fetchBtn.disabled = loading;
    if (loading) {
      btnText.innerHTML = '<span class="spinner"></span> Fetching...';
      fetchBtn.classList.add('opacity-80', 'cursor-not-allowed');
    } else {
      btnText.textContent = 'Download';
      fetchBtn.classList.remove('opacity-80', 'cursor-not-allowed');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href').slice(1);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        // Close mobile nav if open
        if (mobileNav && !mobileNav.classList.contains('hidden')) {
          mobileNav.classList.add('hidden');
        }
      }
    });
  });

  // ── Dynamic SEO SPA Router ──
  const routeMap = {
    '/': {
      title: 'YT4DOWN - Download YouTube Videos Free in HD, 4K & MP3',
      h1: '<span class="text-white">Download YouTube</span><br><span class="gradient-text">Videos Instantly</span>',
      sub: 'Download YouTube Videos for Free in HD, 1080p, 4K and MP3',
      placeholder: 'Paste YouTube link here (e.g. https://www.youtube.com/watch?v=...)'
    },
    '/youtube-video-downloader': {
      title: 'Free YouTube Video Downloader - Download HD, 4K & MP3',
      h1: '<span class="text-white">YouTube Video</span> <span class="gradient-text">Downloader</span>',
      sub: 'Download YouTube Videos for Free in HD, 1080p, 4K and MP3',
      placeholder: 'Paste YouTube link here...'
    },
    '/youtube-to-mp3': {
      title: 'YouTube to MP3 Converter - Free MP3 Audio Downloader',
      h1: '<span class="text-white">YouTube to MP3</span> <span class="gradient-text">Converter</span>',
      sub: 'Convert YouTube Videos to High-Quality MP3 Audio Free',
      placeholder: 'Paste YouTube link to convert to MP3...'
    },
    '/youtube-to-mp4': {
      title: 'YouTube to MP4 Converter - Download HD & 4K MP4 Videos',
      h1: '<span class="text-white">YouTube to MP4</span> <span class="gradient-text">Converter</span>',
      sub: 'Download YouTube Videos in MP4 Format (1080p, 4K)',
      placeholder: 'Paste YouTube link to convert to MP4...'
    },
    '/youtube-shorts-downloader': {
      title: 'YouTube Shorts Downloader - Save Shorts Videos Free',
      h1: '<span class="text-white">YouTube Shorts</span> <span class="gradient-text">Downloader</span>',
      sub: 'Download YouTube Shorts Videos in HD Quality',
      placeholder: 'Paste YouTube Shorts link here...'
    },
    '/youtube-audio-downloader': {
      title: 'YouTube Audio Downloader - Extract Audio Free',
      h1: '<span class="text-white">YouTube Audio</span> <span class="gradient-text">Downloader</span>',
      sub: 'Download Audio Tracks & Songs from YouTube',
      placeholder: 'Paste YouTube link to extract audio...'
    },
    '/youtube-music-downloader': {
      title: 'YouTube Music Downloader - Save Free Songs & Audio',
      h1: '<span class="text-white">YouTube Music</span> <span class="gradient-text">Downloader</span>',
      sub: 'Download Music & Songs from YouTube Free',
      placeholder: 'Paste YouTube music video link...'
    },
    '/about-us': {
      title: 'About Us - YT4DOWN',
      h1: '<span class="text-white">About</span> <span class="gradient-text">YT4DOWN</span>',
      sub: 'Fastest, Safest & Free Tool to Download YouTube Media',
      placeholder: 'Paste YouTube link here...',
      scrollTo: 'about-us'
    },
    '/faq': {
      title: 'FAQ - YT4DOWN',
      h1: 'Frequently Asked Questions',
      sub: 'Everything You Need to Know About Downloading YouTube Videos',
      placeholder: 'Paste YouTube link here...',
      scrollTo: 'faq'
    }
  };

  function handleRoute(path, push = true) {
    const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
    const routeData = routeMap[cleanPath];
    if (routeData) {
      if (push && window.location.pathname !== cleanPath) {
        history.pushState(null, '', cleanPath);
      }
      document.title = routeData.title;
      const h1El = document.querySelector('h1');
      if (h1El) h1El.innerHTML = routeData.h1;
      const subEl = document.querySelector('h1 + p');
      if (subEl) subEl.textContent = routeData.sub;
      if (urlInput) urlInput.placeholder = routeData.placeholder;

      // Close mobile nav if open
      if (mobileNav && !mobileNav.classList.contains('hidden')) {
        mobileNav.classList.add('hidden');
      }

      // Scroll to specific section if defined, else top
      if (routeData.scrollTo) {
        const targetEl = document.getElementById(routeData.scrollTo);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Intercept clicks on internal routes
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="/"]');
    if (link && !link.hasAttribute('data-coming-soon')) {
      const href = link.getAttribute('href');
      if (routeMap[href]) {
        e.preventDefault();
        handleRoute(href, true);
      }
    }
  });

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    handleRoute(window.location.pathname, false);
  });

  // Initialize current route
  handleRoute(window.location.pathname, false);
});
