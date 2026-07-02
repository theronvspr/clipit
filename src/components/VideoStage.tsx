import React, { useRef, useEffect, useCallback } from 'react';
import { useAppState } from '../state/AppContext';
import { formatTime } from '../utils/format';
import './VideoStage.css';

/** Convert dB to linear gain (0 dB = 1.0, +6 dB ≈ 2.0, -60 dB ≈ 0) */
function dbToLinear(db: number): number {
  if (db <= -60) return 0;
  return Math.pow(10, db / 20);
}

export const VideoStage: React.FC = () => {
  const { state, dispatch } = useAppState();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isSelfUpdatingRef = useRef(false);

  // Web Audio API refs for gain control (allows boost beyond 100%)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const { video, isPlaying, currentTime, inPoint, outPoint, volumeDb } = state;

  // Set up Web Audio API gain chain once when the <video> element mounts
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    // Guard against duplicate connections on the same HTMLMediaElement (causes InvalidStateError)
    if ((element as any).__audioConnected) {
      // Re-link existing context refs if they got cleared
      if (!audioCtxRef.current && (element as any).__audioCtx) {
        audioCtxRef.current = (element as any).__audioCtx;
        gainNodeRef.current = (element as any).__gainNode;
      }
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(element);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);

    audioCtxRef.current = ctx;
    gainNodeRef.current = gain;

    // Cache on the DOM node to survive React state resets and HMR
    (element as any).__audioConnected = true;
    (element as any).__audioCtx = ctx;
    (element as any).__gainNode = gain;

    // The native volume is now bypassed — GainNode controls everything
    element.volume = 1;
    element.muted = false;

    return () => {
      // Keep context alive to prevent breaking the reuse of the HTMLMediaElement
    };
  }, []);

  // Apply volume dB changes to the GainNode
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = dbToLinear(volumeDb);
    }
  }, [volumeDb]);

  // Resume AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    const resume = () => {
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    return () => {
      document.removeEventListener('click', resume);
      document.removeEventListener('keydown', resume);
    };
  }, []);

  // Toggle video play state when playing status changes in state
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    if (isPlaying) {
      element.play().catch((err) => {
        console.error('Video autoplay interrupted:', err);
        dispatch({ type: 'SET_PLAYING', payload: false });
      });
    } else {
      element.pause();
    }
  }, [isPlaying, dispatch]);

  // Sync state currentTime to video currentTime if updated externally (like scrubbing)
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    if (isSelfUpdatingRef.current) {
      isSelfUpdatingRef.current = false;
      return;
    }

    if (Math.abs(element.currentTime - currentTime) > 0.05) {
      element.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    const element = videoRef.current;
    if (!element) return;

    // Looping Logic: Seek back to in-point if we exceed out-point
    if (element.currentTime >= outPoint) {
      isSelfUpdatingRef.current = true;
      element.currentTime = inPoint;
      dispatch({ type: 'SET_CURRENT_TIME', payload: inPoint });
    } else if (element.currentTime < inPoint) {
      isSelfUpdatingRef.current = true;
      element.currentTime = inPoint;
      dispatch({ type: 'SET_CURRENT_TIME', payload: inPoint });
    } else {
      isSelfUpdatingRef.current = true;
      dispatch({ type: 'SET_CURRENT_TIME', payload: element.currentTime });
    }
  };

  const togglePlay = useCallback(() => {
    dispatch({ type: 'SET_PLAYING', payload: !isPlaying });
  }, [isPlaying, dispatch]);

  // Keyboard Shortcuts Listener: Space (play), I (set in), O (set out)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        return; // Don't trigger when typing in fields
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        dispatch({ type: 'SET_IN_POINT', payload: currentTime });
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        dispatch({ type: 'SET_OUT_POINT', payload: currentTime });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, dispatch, togglePlay]);

  if (!video) return null;

  return (
    <div className="stage">
      <video
        ref={videoRef}
        src={video.objectUrl}
        className="video-element"
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        playsInline
        crossOrigin="anonymous"
      />
      
      <button 
        className="play-toggle" 
        onClick={togglePlay} 
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <div className={`play-btn ${isPlaying ? 'playing' : ''}`}>
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="white" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M8 5v14l11-7z" fill="white" />
            </svg>
          )}
        </div>
      </button>

      <div className="time-badge">
        {formatTime(currentTime)} / {formatTime(video.duration)}
      </div>
    </div>
  );
};

export default VideoStage;
