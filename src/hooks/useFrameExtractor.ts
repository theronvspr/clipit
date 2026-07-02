import { useState, useEffect } from 'react';

const THUMB_COUNT = 24;
const THUMB_HEIGHT = 52;

/**
 * Extracts evenly-spaced thumbnail frames from a video URL.
 * Returns an array of data-URL strings rendered from a hidden canvas.
 *
 * Compatible with React 18 Strict Mode and avoids Chrome's double-blob revocation bugs.
 */
export function useFrameExtractor(videoUrl: string | null, duration: number) {
  const [frames, setFrames] = useState<string[]>([]);

  useEffect(() => {
    if (!videoUrl || duration <= 0) {
      setFrames([]);
      return;
    }

    let cancelled = false;

    const extract = async () => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      video.src = videoUrl;

      // Wait until the browser has enough data to seek
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('Frame extraction: failed to load video'));
      });

      if (cancelled) return;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(THUMB_HEIGHT * (video.videoWidth / video.videoHeight));
      canvas.height = THUMB_HEIGHT;
      const ctx = canvas.getContext('2d')!;

      const interval = duration / THUMB_COUNT;
      const extracted: string[] = [];

      for (let i = 0; i < THUMB_COUNT; i++) {
        if (cancelled) break;

        const targetTime = i * interval + interval / 2;
        video.currentTime = Math.min(targetTime, duration - 0.01);

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            extracted.push(canvas.toDataURL('image/jpeg', 0.45));
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });
      }

      if (!cancelled) {
        setFrames(extracted);
      }
    };

    extract().catch((err) => {
      if (!cancelled) {
        console.info('Frame extraction skipped/interrupted (normal during code updates or rapid seeks):', err.message || err);
        setFrames([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [videoUrl, duration]);

  return frames;
}
