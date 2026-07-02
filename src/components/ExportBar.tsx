import React, { useState } from 'react';
import { useAppState } from '../state/AppContext';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { formatTimePrecise } from '../utils/format';
import { fetchFile } from '@ffmpeg/util';
import { encodeVideoWebCodecs } from '../utils/exportWebCodecs';
import './ExportBar.css';

export const ExportBar: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { loadFFmpeg, getFFmpeg } = useFFmpeg();

  const [readyBlob, setReadyBlob] = useState<Blob | null>(null);
  const [readyName, setReadyName] = useState<string>('');

  const { video, inPoint, outPoint, trimMode, preset, customSizeMB, exportStatus, ffmpegProgress, volumeDb, gpuAcceleration } = state;

  const handleExport = async () => {
    if (!video) return;
    
    dispatch({ type: 'SET_EXPORT_STATUS', payload: 'working' });
    dispatch({ type: 'SET_FFMPEG_PROGRESS', payload: 0 });

    try {
      // 1. Lazy load and initialize FFmpeg.wasm
      await loadFFmpeg();
      const ffmpeg = await getFFmpeg();

      const extension = video.name.split('.').pop() || 'mp4';
      const inputName = `input.${extension}`;
      const outputName = `trimmed_${video.name.split('.')[0]}.mp4`;

      // 2. Write file to ffmpeg virtual file system
      const fileData = await fetchFile(video.file);
      await ffmpeg.writeFile(inputName, fileData);

      // 3. Format precise timestamps
      const startStr = formatTimePrecise(inPoint);
      const endStr = formatTimePrecise(outPoint);
      const selectionDuration = Math.max(0.1, outPoint - inPoint);

      // 4. Construct Command Arguments
      let args: string[] = [];

      if (trimMode === 'copy') {
        // Fast lossless copy snapped to nearest keyframe
        args = [
          '-ss', startStr,
          '-to', endStr,
          '-i', inputName,
          '-c', 'copy',
          outputName
        ];
      } else {
        // Compression bitrate & resolution logic
        let videoBitrateBps = 2000000;
        let videoBitrateStr = '2000k';
        let audioBitrate = '128k';
        let heightLimit = 720;

        if (preset === 'small') {
          videoBitrateBps = 900000;
          videoBitrateStr = '900k';
          audioBitrate = '96k';
          heightLimit = 480;
        } else if (preset === 'balanced') {
          videoBitrateBps = 1850000;
          videoBitrateStr = '1850k';
          audioBitrate = '128k';
          heightLimit = 720;
        } else if (preset === 'high') {
          videoBitrateBps = 3800000;
          videoBitrateStr = '3800k';
          audioBitrate = '192k';
          heightLimit = 1080;
        } else if (preset === 'discord') {
          const targetBytes = 9.5 * 1024 * 1024; // strictly under 10MB
          const totalBitrateBps = (targetBytes * 8) / selectionDuration;
          const videoBps = Math.max(100 * 1000, Math.min(7000 * 1000, totalBitrateBps * 0.9));
          const audioBps = Math.max(64 * 1000, Math.min(192 * 1000, totalBitrateBps * 0.1));
          videoBitrateBps = Math.round(videoBps);
          videoBitrateStr = `${Math.round(videoBps / 1000)}k`;
          audioBitrate = `${Math.round(audioBps / 1000)}k`;
          heightLimit = 720;
        } else if (preset === 'custom') {
          const targetBytes = customSizeMB * 1024 * 1024;
          const totalBitrateBps = (targetBytes * 8) / selectionDuration;
          const videoBps = Math.max(100 * 1000, Math.min(18000 * 1000, totalBitrateBps * 0.9));
          const audioBps = Math.max(64 * 1000, Math.min(192 * 1000, totalBitrateBps * 0.1));
          videoBitrateBps = Math.round(videoBps);
          videoBitrateStr = `${Math.round(videoBps / 1000)}k`;
          audioBitrate = `${Math.round(audioBps / 1000)}k`;
          if (customSizeMB <= 15) {
            heightLimit = 480;
          } else if (customSizeMB <= 50) {
            heightLimit = 720;
          } else {
            heightLimit = 1080;
          }
        }

        const isWebCodecsSupported = typeof window !== 'undefined' && 'VideoEncoder' in window;
        let gpuSuccess = false;

        if (gpuAcceleration && isWebCodecsSupported) {
          try {
            // ─── GPU-Accelerated WebCodecs Path ───
            const inputHeight = video.height || 720;
            const inputWidth = video.width || 1280;
            const targetHeight = Math.min(heightLimit, inputHeight);
            const scaleFactor = targetHeight / inputHeight;
            let targetWidth = Math.round(inputWidth * scaleFactor);
            // H.264 demands even dimensions
            if (targetWidth % 2 !== 0) targetWidth++;
            const finalHeight = targetHeight % 2 !== 0 ? targetHeight + 1 : targetHeight;

            // Encode video-only on GPU
            const webcodecsData = await encodeVideoWebCodecs(
              video.file,
              inPoint,
              outPoint,
              targetWidth,
              finalHeight,
              videoBitrateBps,
              (progress) => {
                dispatch({ type: 'SET_FFMPEG_PROGRESS', payload: progress * 0.9 });
              }
            );

            await ffmpeg.writeFile('webcodecs_video.mp4', webcodecsData);

            // Merge audio and video via FFmpeg.wasm (fast stream copy for video)
            const mergeArgs = [
              '-i', 'webcodecs_video.mp4',
              '-ss', startStr,
              '-to', endStr,
              '-i', inputName,
              '-map', '0:v:0',
              '-map', '1:a:0',
              '-c:v', 'copy',
              '-bsf:v', 'extract_extradata', // rebuild global headers (avcC) for strict players
              '-c:a', 'aac',
              '-b:a', audioBitrate
            ];
            if (volumeDb !== 0 && volumeDb > -60) {
              mergeArgs.push('-af', `volume=${volumeDb}dB`);
            }
            mergeArgs.push(outputName);

            dispatch({ type: 'SET_FFMPEG_PROGRESS', payload: 0.92 });

            try {
              await ffmpeg.exec(mergeArgs);
            } catch (err) {
              console.warn('Merge with audio failed, copying video only:', err);
              const videoOnlyArgs = [
                '-i', 'webcodecs_video.mp4',
                '-c:v', 'copy',
                '-bsf:v', 'extract_extradata',
                outputName
              ];
              await ffmpeg.exec(videoOnlyArgs);
            }

            gpuSuccess = true;
          } catch (err) {
            console.warn('GPU encoding failed or unsupported on this device. Falling back to CPU...', err);
            // Automatically turn off GPU acceleration in state so the user sees it is disabled
            dispatch({ type: 'SET_GPU_ACCELERATION', payload: false });
          }
        }

        if (!gpuSuccess) {
          // ─── CPU Fallback Path (Two-Pass Precise Trim) ───
          const padSec = 30;
          const tempStart = Math.max(0, inPoint - padSec);
          const tempEnd = Math.min(video.duration, outPoint + padSec);

          const tempStartStr = formatTimePrecise(tempStart);
          const tempEndStr = formatTimePrecise(tempEnd);
          const tempName = 'temp_pretrim.mp4';

          const preTrimArgs = [
            '-ss', tempStartStr,
            '-to', tempEndStr,
            '-i', inputName,
            '-c', 'copy',
            tempName
          ];

          await ffmpeg.exec(preTrimArgs);

          const relativeStart = inPoint - tempStart;
          const relativeStartStr = formatTimePrecise(relativeStart);
          const relativeDurationStr = formatTimePrecise(selectionDuration);

          args = [
            '-ss', relativeStartStr,
            '-t', relativeDurationStr,
            '-i', tempName,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-b:v', videoBitrateStr,
            '-b:a', audioBitrate,
            '-vf', `scale=-2:'min(${heightLimit},ih)',fps=30`
          ];

          if (volumeDb !== 0 && volumeDb > -60) {
            args.push('-af', `volume=${volumeDb}dB`);
          }
          args.push('-preset', 'ultrafast');
          args.push(outputName);

          await ffmpeg.exec(args);
        }
      }

      // 6. Read Output File
      const outputData = await ffmpeg.readFile(outputName);
      const dataArray = typeof outputData === 'string' 
        ? new TextEncoder().encode(outputData) 
        : (outputData as Uint8Array);

      // 7. Store Blob and Name for manual Save trigger (re-acquires user gesture)
      const blob = new Blob([dataArray as any], { type: 'video/mp4' });
      setReadyBlob(blob);
      setReadyName(outputName);

      // 8. Clean up virtual memory FS
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
        try {
          await ffmpeg.deleteFile('temp_pretrim.mp4');
        } catch (_) {}
        try {
          await ffmpeg.deleteFile('webcodecs_video.mp4');
        } catch (_) {}
      } catch (err) {
        console.warn('Failed to clean up files in virtual FS:', err);
      }

      dispatch({ type: 'SET_EXPORT_STATUS', payload: 'done' });

    } catch (err) {
      console.error('Export failed:', err);
      dispatch({ type: 'SET_EXPORT_STATUS', payload: 'error' });
      setTimeout(() => {
        dispatch({ type: 'SET_EXPORT_STATUS', payload: 'idle' });
      }, 3000);
    }
  };

  // Synchronous download click handler (runs within direct user click event context)
  const handleSaveClick = async () => {
    if (!readyBlob || !readyName) return;

    // Use FileSystem Access API if supported (Chrome/Edge/Opera), now succeeds under user gesture!
    let savedViaPicker = false;
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: readyName,
          types: [{
            description: 'MPEG-4 Video',
            accept: {
              'video/mp4': ['.mp4']
            }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(readyBlob);
        await writable.close();
        savedViaPicker = true;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.log('User cancelled the save dialog.');
          return;
        }
        console.warn('showSaveFilePicker failed, falling back to link download:', err);
      }
    }

    // Fallback: standard anchor link method (Firefox/Safari or if picker fails)
    if (!savedViaPicker) {
      const url = URL.createObjectURL(readyBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = readyName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 2000);
    }

    // Reset export state after saving
    setReadyBlob(null);
    setReadyName('');
    dispatch({ type: 'SET_EXPORT_STATUS', payload: 'idle' });
    dispatch({ type: 'SET_FFMPEG_PROGRESS', payload: 0 });
  };

  const isExporting = exportStatus === 'working';
  const isDone = exportStatus === 'done';
  const isError = exportStatus === 'error';

  const getButtonText = () => {
    if (isExporting) {
      const progressPercent = Math.round(ffmpegProgress * 100);
      return `Working (${progressPercent}%)`;
    }
    if (isDone) return 'Save Video File';
    if (isError) return 'Export failed ✗';
    return 'Trim & download';
  };

  const handleButtonClick = () => {
    if (isDone) {
      handleSaveClick();
    } else {
      handleExport();
    }
  };

  return (
    <div className="export-bar">
      <div className="export-info">
        {trimMode === 'copy'
          ? 'Cut is snapped to the nearest keyframe. Export happens entirely in your browser (speed depends on your hardware).'
          : 'Video will be re-encoded to match your target settings. Export happens entirely in your browser (speed depends on your hardware).'}
      </div>
      
      <button
        className={`export-btn ${isDone ? 'done' : ''} ${isError ? 'error' : ''}`}
        onClick={handleButtonClick}
        disabled={isExporting || (!video && !isDone)}
        style={{
          background: isExporting
            ? `linear-gradient(90deg, var(--ok) ${ffmpegProgress * 100}%, var(--danger) ${ffmpegProgress * 100}%)`
            : undefined,
        }}
      >
        {getButtonText()}
      </button>
    </div>
  );
};

export default ExportBar;
