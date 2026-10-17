import { useEffect } from 'react';

/**
 * Tracks browser zoom (via window.devicePixelRatio and resize/matchMedia events)
 * and keeps the CSS custom property `--zoom-factor` synchronized on document.documentElement.
 *
 * This allows fixed OS chrome (.nb-menubar and .nb-dock) to apply inverse scaling
 * (scale(1 / zoom)), ensuring they remain the exact same visual size on the user's screen
 * across all zoom ranges (25% to 500%), while the desktop workspace zooms normally.
 */
export function useZoom() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect or retrieve baseline DPR (devicePixelRatio at 100% zoom)
    let baseDpr = 1;
    const stored = sessionStorage.getItem('course_weft_base_dpr');
    if (stored) {
      baseDpr = parseFloat(stored) || 1;
    } else {
      const ratio =
        window.outerWidth && window.innerWidth
          ? window.outerWidth / window.innerWidth
          : 1;
      if (Math.abs(ratio - 1) < 0.12) {
        baseDpr = window.devicePixelRatio || 1;
        sessionStorage.setItem('course_weft_base_dpr', String(baseDpr));
      } else {
        baseDpr = (window.devicePixelRatio || 1) / ratio;
        sessionStorage.setItem('course_weft_base_dpr', String(baseDpr));
      }
    }

    function update() {
      const dpr = window.devicePixelRatio || 1;
      const zoom = Math.max(0.2, Math.min(5, dpr / baseDpr));
      document.documentElement.style.setProperty('--zoom-factor', zoom.toFixed(4));
    }

    update();

    window.addEventListener('resize', update);

    let mediaQuery = null;
    function watchDpr() {
      if (mediaQuery) {
        try { mediaQuery.removeEventListener('change', watchDpr); } catch {}
      }
      mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      try {
        mediaQuery.addEventListener(
          'change',
          () => {
            update();
            watchDpr();
          },
          { once: true }
        );
      } catch {}
    }

    try {
      watchDpr();
    } catch {}

    return () => {
      window.removeEventListener('resize', update);
      if (mediaQuery) {
        try { mediaQuery.removeEventListener('change', watchDpr); } catch {}
      }
    };
  }, []);
}
