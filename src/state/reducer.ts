import type { AppState, PresetId, VideoMeta, TrimMode } from '../types';

export type AppAction =
  | { type: 'SET_VIDEO'; payload: VideoMeta | null }
  | { type: 'SET_IN_POINT'; payload: number }
  | { type: 'SET_OUT_POINT'; payload: number }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_TRIM_MODE'; payload: TrimMode }
  | { type: 'SET_PRESET'; payload: PresetId }
  | { type: 'SET_CUSTOM_SIZE'; payload: number }
  | { type: 'SET_EXPORT_STATUS'; payload: AppState['exportStatus'] }
  | { type: 'SET_FFMPEG_READY'; payload: boolean }
  | { type: 'SET_FFMPEG_PROGRESS'; payload: number }
  | { type: 'SET_VOLUME_DB'; payload: number }
  | { type: 'SET_GPU_ACCELERATION'; payload: boolean };

const storedPreset = localStorage.getItem('clipit-preset') as PresetId | null;
const storedCustomSize = localStorage.getItem('clipit-custom-size');
const isWebCodecsSupported = typeof window !== 'undefined' && 'VideoEncoder' in window;
const storedGpu = localStorage.getItem('clipit-gpu');
const defaultGpu = storedGpu !== null ? storedGpu === 'true' : isWebCodecsSupported;

export const initialState: AppState = {
  video: null,
  inPoint: 0,
  outPoint: 0,
  currentTime: 0,
  isPlaying: false,
  trimMode: 'copy',
  preset: storedPreset || 'balanced',
  customSizeMB: storedCustomSize ? parseFloat(storedCustomSize) : 15,
  exportStatus: 'idle',
  ffmpegReady: false,
  ffmpegProgress: 0,
  volumeDb: 0,
  gpuAcceleration: defaultGpu,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIDEO': {
      const video = action.payload;
      return {
        ...state,
        video,
        inPoint: 0,
        outPoint: video ? video.duration : 0,
        currentTime: 0,
        isPlaying: false,
        exportStatus: 'idle',
        ffmpegProgress: 0,
      };
    }
    case 'SET_IN_POINT': {
      const minGap = 0.2; // minimum selection duration
      let val = Math.max(0, action.payload);
      val = Math.min(val, state.outPoint - minGap);
      return {
        ...state,
        inPoint: val,
        // Make sure currentTime is kept inside the selection if it goes out of bounds
        currentTime: state.currentTime < val ? val : state.currentTime,
      };
    }
    case 'SET_OUT_POINT': {
      const minGap = 0.2;
      const duration = state.video ? state.video.duration : 0;
      let val = Math.min(duration, action.payload);
      val = Math.max(val, state.inPoint + minGap);
      return {
        ...state,
        outPoint: val,
        // Make sure currentTime is kept inside the selection if it goes out of bounds
        currentTime: state.currentTime > val ? val : state.currentTime,
      };
    }
    case 'SET_CURRENT_TIME': {
      return {
        ...state,
        currentTime: action.payload,
      };
    }
    case 'SET_PLAYING': {
      return {
        ...state,
        isPlaying: action.payload,
      };
    }
    case 'SET_TRIM_MODE': {
      return {
        ...state,
        trimMode: action.payload,
      };
    }
    case 'SET_PRESET': {
      localStorage.setItem('clipit-preset', action.payload);
      return {
        ...state,
        preset: action.payload,
      };
    }
    case 'SET_CUSTOM_SIZE': {
      localStorage.setItem('clipit-custom-size', action.payload.toString());
      return {
        ...state,
        customSizeMB: action.payload,
      };
    }
    case 'SET_EXPORT_STATUS': {
      return {
        ...state,
        exportStatus: action.payload,
      };
    }
    case 'SET_FFMPEG_READY': {
      return {
        ...state,
        ffmpegReady: action.payload,
      };
    }
    case 'SET_FFMPEG_PROGRESS': {
      return {
        ...state,
        ffmpegProgress: action.payload,
      };
    }
    case 'SET_VOLUME_DB': {
      return {
        ...state,
        volumeDb: Math.max(-60, Math.min(6, action.payload)),
      };
    }
    case 'SET_GPU_ACCELERATION': {
      localStorage.setItem('clipit-gpu', action.payload ? 'true' : 'false');
      return {
        ...state,
        gpuAcceleration: action.payload,
      };
    }
    default:
      return state;
  }
}
