import { useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useAppState } from '../state/AppContext';

export const useFFmpeg = () => {
  const { state, dispatch } = useAppState();
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const getFFmpeg = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) {
      return ffmpegRef.current;
    }

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    // Listen to progress
    ffmpeg.on('progress', ({ progress }) => {
      // progress is a number from 0 to 1
      dispatch({ type: 'SET_FFMPEG_PROGRESS', payload: progress });
    });

    // Listen to log messages for debugging
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    return ffmpeg;
  }, [dispatch]);

  const loadFFmpeg = useCallback(async () => {
    if (state.ffmpegReady) return;

    try {
      const ffmpeg = await getFFmpeg();
      // Single-threaded core avoids 'indirect call signature mismatch' WASM crash
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      dispatch({ type: 'SET_FFMPEG_READY', payload: true });
    } catch (error) {
      console.error('Failed to load FFmpeg.wasm:', error);
      dispatch({ type: 'SET_EXPORT_STATUS', payload: 'error' });
      throw error;
    }
  }, [state.ffmpegReady, getFFmpeg, dispatch]);

  return {
    loadFFmpeg,
    getFFmpeg,
  };
};
