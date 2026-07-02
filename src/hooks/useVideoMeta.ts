import { useCallback } from 'react';
import type { VideoMeta } from '../types';

export const useVideoMeta = () => {
  const probeVideo = useCallback((file: File): Promise<Omit<VideoMeta, 'file' | 'name' | 'objectUrl'>> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({
          duration: video.duration || 0,
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
        });
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load video metadata. The format may not be supported by your browser.'));
      };
    });
  }, []);

  return { probeVideo };
};
