import React, { useRef, useState, useEffect } from 'react';
import { useAppState } from '../state/AppContext';
import { useDrag } from '../hooks/useDrag';
import { useFrameExtractor } from '../hooks/useFrameExtractor';
import { formatTime } from '../utils/format';
import './Timeline.css';

/** Format dB for display: −∞ for silent, +X or -X otherwise */
function formatDb(db: number): string {
  if (db <= -60) return '−∞';
  if (db === 0) return '0 dB';
  return `${db > 0 ? '+' : ''}${db} dB`;
}

export const Timeline: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { startDrag } = useDrag();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const preMuteDbRef = useRef(0);

  const { video, inPoint, outPoint, currentTime, volumeDb } = state;

  const duration = video ? video.duration : 1;
  const inPct = (inPoint / duration) * 100;
  const outPct = (outPoint / duration) * 100;
  const currentPct = (currentTime / duration) * 100;

  // Extract thumbnails from the video objectUrl for the strip preview
  const frames = useFrameExtractor(video?.objectUrl ?? null, duration);

  // Auto-scroll scroll container to keep playhead in view when playing and zoomed in
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || zoom === 1) return;

    const trackWidth = scrollContainer.scrollWidth;
    const playheadX = (currentTime / duration) * trackWidth;

    const scrollLeft = scrollContainer.scrollLeft;
    const clientWidth = scrollContainer.clientWidth;
    const padding = 60; // padding boundary in pixels

    if (playheadX < scrollLeft + padding || playheadX > scrollLeft + clientWidth - padding) {
      scrollContainer.scrollTo({
        left: playheadX - clientWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [currentTime, duration, zoom]);

  if (!video) return null;

  const handleInDrag = (pct: number) => {
    const targetTime = (pct / 100) * duration;
    dispatch({ type: 'SET_IN_POINT', payload: targetTime });
  };

  const handleOutDrag = (pct: number) => {
    const targetTime = (pct / 100) * duration;
    dispatch({ type: 'SET_OUT_POINT', payload: targetTime });
  };

  const handleTrackDrag = (pct: number) => {
    const targetTime = (pct / 100) * duration;
    dispatch({ type: 'SET_CURRENT_TIME', payload: targetTime });
  };

  const handleHandlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    onDrag: (pct: number) => void
  ) => {
    e.stopPropagation(); // Prevent track pointerdown from triggering seek
    startDrag(e, { containerRef, onDrag });
  };

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    startDrag(e, { containerRef, onDrag: handleTrackDrag });
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      // Unmute: restore previous dB
      setIsMuted(false);
      dispatch({ type: 'SET_VOLUME_DB', payload: preMuteDbRef.current });
    } else {
      // Mute: store current dB, set to -60
      preMuteDbRef.current = volumeDb;
      setIsMuted(true);
      dispatch({ type: 'SET_VOLUME_DB', payload: -60 });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    dispatch({ type: 'SET_VOLUME_DB', payload: val });
    if (val > -60 && isMuted) setIsMuted(false);
  };

  return (
    <div className="timeline-wrap">
      {/* Scrollable Track Container */}
      <div className="timeline-scroll-container" ref={scrollContainerRef}>
        <div
          ref={containerRef}
          className="timeline-row"
          style={{ width: `${zoom * 100}%` }}
          onPointerDown={handleTrackPointerDown}
        >
          {/* Thumbnail strip */}
          {frames.length > 0 && (
            <div className="timeline-thumbnails">
              {frames.map((src, i) => (
                <img key={i} src={src} className="timeline-thumb" alt="" draggable={false} />
              ))}
            </div>
          )}

          {/* Highlighted selection block */}
          <div
            className="selection"
            style={{
              left: `${inPct}%`,
              right: `${100 - outPct}%`,
            }}
          />

          {/* Playhead marker */}
          <div
            className="playhead"
            style={{ left: `${currentPct}%` }}
          />

          {/* Left trim limit handle */}
          <div
            className="handle in"
            style={{ left: `calc(${inPct}% - 6px)` }}
            onPointerDown={(e) => handleHandlePointerDown(e, handleInDrag)}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={outPoint}
            aria-valuenow={inPoint}
            aria-label="Set trim start point"
            tabIndex={0}
            onKeyDown={(e) => {
              const step = 0.5; // step size in seconds
              if (e.key === 'ArrowLeft') {
                dispatch({ type: 'SET_IN_POINT', payload: inPoint - step });
              } else if (e.key === 'ArrowRight') {
                dispatch({ type: 'SET_IN_POINT', payload: inPoint + step });
              }
            }}
          />

          {/* Right trim limit handle */}
          <div
            className="handle out"
            style={{ left: `calc(${outPct}% - 6px)` }}
            onPointerDown={(e) => handleHandlePointerDown(e, handleOutDrag)}
            role="slider"
            aria-valuemin={inPoint}
            aria-valuemax={duration}
            aria-valuenow={outPoint}
            aria-label="Set trim end point"
            tabIndex={0}
            onKeyDown={(e) => {
              const step = 0.5;
              if (e.key === 'ArrowLeft') {
                dispatch({ type: 'SET_OUT_POINT', payload: outPoint - step });
              } else if (e.key === 'ArrowRight') {
                dispatch({ type: 'SET_OUT_POINT', payload: outPoint + step });
              }
            }}
          />
        </div>
      </div>

      <div className="time-labels">
        <span>00:00</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Timeline controls row: Zoom + Volume */}
      <div className="timeline-controls-row">
        {/* Zoom slider */}
        <div className="timeline-zoom-controls">
          <label htmlFor="zoomInput" className="ctrl-label">Zoom</label>
          <input
            type="range"
            id="zoomInput"
            className="ctrl-slider"
            min="1"
            max="5"
            step="0.5"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
          <span className="ctrl-value">{zoom.toFixed(1)}x</span>
        </div>

        {/* Volume slider (dB) */}
        <div className="timeline-volume-controls">
          <button
            className="volume-mute-btn"
            onClick={handleMuteToggle}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volumeDb <= -60 ? (
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" opacity="0.5" />
                <line x1="18" y1="9" x2="24" y2="15" stroke="currentColor" strokeWidth="2" />
                <line x1="24" y1="9" x2="18" y2="15" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77z" fill="currentColor" />
              </svg>
            )}
          </button>
          <input
            type="range"
            id="volumeInput"
            className="ctrl-slider volume-slider-db"
            min="-30"
            max="6"
            step="1"
            value={isMuted ? -60 : volumeDb}
            onChange={handleVolumeChange}
            aria-label="Volume level"
          />
          <span className="ctrl-value volume-db-label">{isMuted ? '−∞' : formatDb(volumeDb)}</span>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
