import JSZip from 'jszip';

export default function initCapture(p, options = {}) {
  const isOptionsObject = options && typeof options === 'object' && !Array.isArray(options);
  const prefix = isOptionsObject ? options.prefix ?? options.captureFilePrefix : options;
  const enabled = isOptionsObject ? !!options.enabled : options !== undefined ? true : p.captureEnabled ?? false;

  p.captureFilePrefix = prefix || p.captureFilePrefix || 'capture';
  p.captureEnabled = enabled;

  p.capturedFrames = [];
  p.frameNumber = 0;
  p.captureInProgress = false;

  p.captureFrame = () => {
    const canvasElt = p.canvas?.elt ?? p.canvas;
    const frameNum = p.frameNumber++;

    return new Promise((resolve) => {
      canvasElt.toBlob((blob) => {
        if (blob) {
          p.capturedFrames.push({
            blob,
            frameNumber: frameNum,
            filename: `${p.captureFilePrefix}_${p.nf(frameNum, 5)}.png`
          });
        }
        resolve();
      }, 'image/png');
    });
  };

  p.startCapture = () => {
    if (p.captureInProgress || !p.captureEnabled) return;
    p.capture().catch((error) => {
      console.error('Capture failed:', error);
      p.captureInProgress = false;
    });
  };

  p.capture = async () => {
    p.captureInProgress = true;
    p.capturedFrames = [];
    p.frameNumber = 0;

    const cues = p.song._cues.slice().sort((a, b) => a.time - b.time);
    let cueIndex = 0;

    p.song._lastPos = 0;

    for (let frame = 0; frame < p.totalAnimationFrames; frame++) {
      console.log(`Capturing frame ${frame + 1} / ${p.totalAnimationFrames}`);
      const frameTime = frame / 60;

      if (cueIndex < cues.length && cues[cueIndex].time <= frameTime) {
        const cue = cues[cueIndex];
        cue.callback.call(cue.scope || p, cue.val);
        cueIndex++;
      }

      p.song._lastPos = Math.max(0, frameTime * p.audioSampleRate);

      if (p.currentLandscapes) {
        p.currentLandscapes.update();
        p.currentLandscapes.draw();
      }

      await p.captureFrame();
    }

    p.captureInProgress = false;

    console.log(`Capture complete. Captured ${p.capturedFrames.length} frames.`);
    await p.downloadFrames();
  };

  p.downloadFrames = async () => {
    if (p.capturedFrames.length === 0) {
      console.log('No frames to download');
      return;
    }

    console.log(`Creating ZIP with ${p.capturedFrames.length} frames...`);
    
    p.capturedFrames.sort((a, b) => a.frameNumber - b.frameNumber);
    
    const zip = new JSZip();
    
    for (let i = 0; i < p.capturedFrames.length; i++) {
      const frame = p.capturedFrames[i];
      zip.file(frame.filename, frame.blob, { binary: true });
      
      if ((i + 1) % 100 === 0) {
        console.log(`Added ${i + 1} / ${p.capturedFrames.length} frames...`);
      }
      frame.blob = null;
    }

    console.log('Generating ZIP file...');

    const ffmpegCommandLines = [
      `# ProRes 422 HQ (10-bit, Resolve-friendly)`,
      `ffmpeg -framerate 60 -i ${p.captureFilePrefix}_%05d.png -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le ${p.captureFilePrefix}_prores422hq.mov`,
      ``,
      `# ProRes 4444 (10-bit + alpha, very large)`,
      `ffmpeg -framerate 60 -i ${p.captureFilePrefix}_%05d.png -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le ${p.captureFilePrefix}_prores4444.mov`
    ].join('\n');
    zip.file('ffmpeg_command.txt', ffmpegCommandLines);

    const zipBlob = await zip.generateAsync({ 
      type: 'blob'
    });
    
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${p.captureFilePrefix}_frames_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log(`Downloaded ZIP with ${p.capturedFrames.length} frames`);
    
    p.capturedFrames = [];
    p.frameNumber = 0;
  };

  if (p.captureEnabled) {
    p.noLoop();
  }

  return p;
}
