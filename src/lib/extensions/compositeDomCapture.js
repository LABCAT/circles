/**
 * p5.capture extension: composite an async DOM/raster background under the WebGL canvas.
 * Snapshots WebGL before awaiting background so the GL buffer is not cleared mid-capture.
 */

export function compositeDomCaptureExtension({ background }) {
  if (typeof background !== "function") {
    throw new TypeError("compositeDomCaptureExtension: background must be async (p, width, height) => CanvasImageSource");
  }

  return {
    async captureFrameWithBackground(p, canvasElt, frameNum) {
      const width = canvasElt.width;
      const height = canvasElt.height;

      const webglSnap = document.createElement("canvas");
      webglSnap.width = width;
      webglSnap.height = height;
      webglSnap.getContext("2d").drawImage(canvasElt, 0, 0);

      let bgCanvas = null;
      try {
        bgCanvas = await background(p, width, height);
      } catch (err) {
        console.warn("compositeDomCapture: DOM background failed, using WebGL layer only", err);
      }

      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = width;
      compositeCanvas.height = height;
      const ctx = compositeCanvas.getContext("2d");
      if (bgCanvas) {
        try {
          ctx.drawImage(bgCanvas, 0, 0);
        } catch (err) {
          console.warn("compositeDomCapture: could not draw background canvas", err);
        }
      }
      ctx.drawImage(webglSnap, 0, 0);

      return new Promise((resolve) => {
        compositeCanvas.toBlob((blob) => {
          if (blob) {
            p.capturedFrames.push({
              blob,
              frameNumber: frameNum,
              filename: `${p.captureFilePrefix}_${p.nf(frameNum, 5)}.png`,
            });
          }
          resolve();
        }, "image/png");
      });
    },
  };
}
