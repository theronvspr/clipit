import React from 'react';
import { useAppState } from '../state/AppContext';
import type { PresetId } from '../types';
import { estimateOutputSize, formatBytes } from '../utils/estimateSize';
import './ControlsPanel.css';

export const ControlsPanel: React.FC = () => {
  const { state, dispatch } = useAppState();
  const { video, trimMode, preset, customSizeMB, inPoint, outPoint, gpuAcceleration } = state;
  const isWebCodecsSupported = typeof window !== 'undefined' && 'VideoEncoder' in window;

  if (!video) return null;

  const originalSize = video.file.size;
  const selectionDuration = Math.max(0, outPoint - inPoint);

  const calculatedSize = estimateOutputSize(
    originalSize,
    video.duration,
    selectionDuration,
    trimMode,
    preset,
    customSizeMB
  );

  const togglePreciseTrim = () => {
    dispatch({
      type: 'SET_TRIM_MODE',
      payload: trimMode === 'precise' ? 'copy' : 'precise',
    });
  };

  const handlePresetSelect = (selectedPreset: PresetId) => {
    dispatch({ type: 'SET_PRESET', payload: selectedPreset });
    // Selecting a compression preset automatically enables precise trim (since stream-copy cannot compress)
    if (trimMode !== 'precise') {
      dispatch({ type: 'SET_TRIM_MODE', payload: 'precise' });
    }
  };

  const handleCustomSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      dispatch({ type: 'SET_CUSTOM_SIZE', payload: value });
    }
  };

  return (
    <div className="panel">
      {/* Precise Trim Row */}
      <div className="panel-row">
        <div>
          <div className="panel-title">Precise trim</div>
          <div className="panel-sub">
            Re-encodes for frame-accurate cuts. Slower than stream copy.
          </div>
        </div>
        <button
          className={`switch ${trimMode === 'precise' ? 'on' : ''}`}
          onClick={togglePreciseTrim}
          role="switch"
          aria-checked={trimMode === 'precise'}
          aria-label="Toggle precise trim"
        />
      </div>

      {/* GPU Acceleration (WebCodecs) Toggle */}
      {trimMode === 'precise' && (
        <div className="panel-row">
          <div>
            <div className="panel-title">
              GPU Acceleration <span className="beta-badge">BETA</span>
            </div>
            <div className="panel-sub">
              {isWebCodecsSupported
                ? 'Uses WebCodecs API for 10x-50x faster GPU-accelerated exports.'
                : 'Not supported in your browser (e.g. Firefox). Falls back to CPU encoding.'}
            </div>
            {!isWebCodecsSupported && (
              <div className="firefox-note">
                Firefox users: Native WebCodecs encoding is currently unsupported by Mozilla. Switch to Chrome or Edge for GPU speeds.
              </div>
            )}
          </div>
          <button
            className={`switch ${isWebCodecsSupported && gpuAcceleration ? 'on' : ''} ${!isWebCodecsSupported ? 'disabled' : ''}`}
            onClick={() => {
              if (isWebCodecsSupported) {
                dispatch({ type: 'SET_GPU_ACCELERATION', payload: !gpuAcceleration });
              }
            }}
            role="switch"
            aria-checked={gpuAcceleration}
            disabled={!isWebCodecsSupported}
            aria-label="Toggle GPU acceleration"
          />
        </div>
      )}

      {/* Compress presets (Always visible) */}
      <div className="panel-row">
        <div>
          <div className="panel-title">Compress on export</div>
          <div className="panel-sub">Choose how aggressively to shrink the file. (Enables precise trim)</div>
        </div>
        <div className="presets" id="presets">
          <button
            className={`preset ${trimMode === 'precise' && preset === 'small' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('small')}
          >
            Small
          </button>
          <button
            className={`preset ${trimMode === 'precise' && preset === 'balanced' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('balanced')}
          >
            Balanced
          </button>
          <button
            className={`preset ${trimMode === 'precise' && preset === 'high' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('high')}
          >
            High quality
          </button>
          <button
            className={`preset discord ${trimMode === 'precise' && preset === 'discord' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('discord')}
          >
            &lt;10 MB (Discord)
          </button>
          <button
            className={`preset ${trimMode === 'precise' && preset === 'custom' ? 'active' : ''}`}
            onClick={() => handlePresetSelect('custom')}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom Size Target Input (Only when custom preset and precise trim are active) */}
      {trimMode === 'precise' && preset === 'custom' && (
        <div className="panel-row custom-row">
          <label className="panel-sub" htmlFor="customInput">
            Target file size
          </label>
          <div className="custom-input-wrap">
            <input
              type="number"
              id="customInput"
              min="1"
              max="500"
              value={customSizeMB}
              onChange={handleCustomSizeChange}
            />
            <span>MB</span>
          </div>
        </div>
      )}

      {/* Output size display */}
      <div className="panel-row size-row">
        <span className="size-estimate">
          Estimated output:{' '}
          <strong id="sizeEstimate">
            {formatBytes(calculatedSize)}
          </strong>
          <span className="mode-label">
            {trimMode === 'copy' ? ' (Lossless stream copy)' : ' (Precise encode)'}
          </span>
        </span>
      </div>
    </div>
  );
};

export default ControlsPanel;
