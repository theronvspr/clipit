import React, { useRef, useState, useCallback } from 'react';
import { useAppState } from '../state/AppContext';
import { useVideoMeta } from '../hooks/useVideoMeta';
import './DropZone.css';

export const DropZone: React.FC = () => {
  const { dispatch } = useAppState();
  const { probeVideo } = useVideoMeta();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const meta = await probeVideo(file);
      const objectUrl = URL.createObjectURL(file);
      
      dispatch({
        type: 'SET_VIDEO',
        payload: {
          file,
          name: file.name,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          objectUrl,
        },
      });
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Unsupported video format.');
    } finally {
      setLoading(false);
    }
  }, [probeVideo, dispatch]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const onButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      className={`dropzone ${isDragActive ? 'drag-active' : ''} ${loading ? 'loading' : ''}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={onButtonClick}
      role="button"
      tabIndex={0}
      aria-label="Upload video file"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onButtonClick(); }}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="file-input"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={handleFileChange}
      />
      <div className="stage-placeholder">
        {loading ? (
          <div className="spinner-text">Analyzing file metadata...</div>
        ) : (
          <>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" strokeWidth="1.5" />
              <path d="M10 9L15 12L10 15V9Z" fill="white" />
            </svg>
            <span>drop a video, or click to browse</span>
            {errorMsg && <span className="error-text">{errorMsg}</span>}
          </>
        )}
      </div>
    </div>
  );
};

export default DropZone;
