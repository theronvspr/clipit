import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Encodes the video track using WebCodecs GPU acceleration and writes a video-only MP4.
 * This is up to 50x faster than WASM re-encoding because it leverages the system GPU.
 */
export async function encodeVideoWebCodecs(
  videoFile: File,
  inPoint: number,
  outPoint: number,
  width: number,
  height: number,
  bitrateBps: number,
  onProgress: (progress: number) => void
): Promise<Uint8Array> {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  
  const objectUrl = URL.createObjectURL(videoFile);
  video.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('WebCodecs: Failed to load video metadata'));
  });

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
      frameRate: 30
    },
    firstTimestampBehavior: 'offset',
    fastStart: 'in-memory'
  });

  let encodeError: Error | null = null;
  let frameCount = 0;
  const frameInterval = 1 / 30;
  const frameDurationUs = Math.round(frameInterval * 1e6); // exactly 33333 microseconds for 30fps

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      // Force perfectly uniform CFR timestamps to prevent any microsecond jitter or rounding duplicates
      const ts = frameCount * frameDurationUs;
      frameCount++;

      const dataBuffer = new Uint8Array(chunk.byteLength);
      chunk.copyTo(dataBuffer);

      const correctedChunk = new EncodedVideoChunk({
        type: chunk.type,
        timestamp: ts,
        duration: frameDurationUs,
        data: dataBuffer
      });

      muxer.addVideoChunk(correctedChunk, metadata);
    },
    error: (e) => {
      console.error('WebCodecs Encoder Error:', e);
      encodeError = e;
    }
  });

  encoder.configure({
    codec: 'avc1.42e02a', // H.264 Baseline Profile Level 4.2 (highly compatible with Firefox OpenH264 and Windows Media Player)
    width,
    height,
    bitrate: bitrateBps,
    framerate: 30,
    avc: { format: 'annexb' } // output in Annex-B format (in-band SPS/PPS) for FFmpeg remuxing
  });

  const duration = outPoint - inPoint;
  const totalFrames = Math.max(1, Math.round(duration * 30));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (encodeError) throw encodeError;

      const time = inPoint + (i * frameInterval);
      video.currentTime = Math.min(time, outPoint);

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      // Draw video frame onto canvas (works perfectly and safely in Firefox)
      ctx.drawImage(video, 0, 0, width, height);

      const timestampUs = Math.round((i * frameInterval) * 1e6);
      const frame = new VideoFrame(canvas, { 
        timestamp: timestampUs, 
        duration: Math.round(frameInterval * 1e6) 
      });

      // Encode frame, requesting a keyframe every 30 frames
      encoder.encode(frame, { keyFrame: i % 30 === 0 });
      frame.close();

      onProgress(i / totalFrames);
    }

    await encoder.flush();
  } finally {
    encoder.close();
    video.pause();
    URL.revokeObjectURL(objectUrl);
  }

  muxer.finalize();
  return new Uint8Array(muxer.target.buffer);
}
