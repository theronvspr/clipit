export interface VideoMeta {
  file: File;
  name: string;
  duration: number;      // duration in seconds
  width: number;
  height: number;
  objectUrl: string;     // URL for previewing in HTML5 video
}

export type TrimMode = 'copy' | 'precise';
export type PresetId = 'small' | 'balanced' | 'high' | 'discord' | 'custom';

export interface AppState {
  video: VideoMeta | null;
  inPoint: number;       // trim start time (seconds)
  outPoint: number;      // trim end time (seconds)
  currentTime: number;   // playhead position (seconds)
  isPlaying: boolean;
  trimMode: TrimMode;
  preset: PresetId;
  customSizeMB: number;
  exportStatus: 'idle' | 'working' | 'done' | 'error';
  ffmpegReady: boolean;
  ffmpegProgress: number; // 0 to 1 progress ratio
  volumeDb: number;       // gain in dB (0 = original, range -60 to +6)
  gpuAcceleration: boolean;
}
