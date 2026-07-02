import type { TrimMode, PresetId } from '../types';

/**
 * Calculates estimated output file size in bytes based on duration, mode, and presets.
 */
export function estimateOutputSize(
  originalSize: number, // bytes
  totalDuration: number, // seconds
  selectionDuration: number, // seconds
  trimMode: TrimMode,
  preset: PresetId,
  customSizeMB: number
): number {
  if (selectionDuration <= 0) return 0;

  if (trimMode === 'copy') {
    if (totalDuration <= 0) return 0;
    // Lossless stream copy size is proportional to cut duration
    return (selectionDuration / totalDuration) * originalSize;
  } else {
    // Precise trim (re-encoding) size based on target bitrates
    let targetBitrateBps = 0;

    switch (preset) {
      case 'small':
        targetBitrateBps = 1000 * 1000; // 1 Mbps video + audio
        break;
      case 'balanced':
        targetBitrateBps = 2000 * 1000; // 2 Mbps video + audio
        break;
      case 'high':
        targetBitrateBps = 4000 * 1000; // 4 Mbps video + audio
        break;
      case 'discord': {
        // Target 9.5 MB to be safely under the 10 MB Discord limit
        const targetBytes = 9.5 * 1024 * 1024;
        targetBitrateBps = (targetBytes * 8) / selectionDuration;
        // Cap bitrate at 8 Mbps to avoid scaling it to infinity for very short clips
        targetBitrateBps = Math.min(targetBitrateBps, 8000 * 1000);
        break;
      }
      case 'custom': {
        const targetBytes = customSizeMB * 1024 * 1024;
        targetBitrateBps = (targetBytes * 8) / selectionDuration;
        targetBitrateBps = Math.min(targetBitrateBps, 20000 * 1000); // 20 Mbps cap
        break;
      }
      default:
        targetBitrateBps = 2000 * 1000;
    }

    const calculatedSize = (targetBitrateBps * selectionDuration) / 8;
    return calculatedSize;
  }
}

/**
 * Formats bytes to a readable string (e.g. ~12.4 MB or ~850 KB).
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `~${Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  return `~${mb.toFixed(1)} MB`;
}
