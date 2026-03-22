/**
 * Rasterize a DOM subtree (e.g. full-viewport gradient wrapper) for p5 capture compositing.
 * Use with `compositeDomCaptureExtension` and initCapture `extension`.
 */

export const domLayerToCanvas = (element, width, height) =>
  new Promise((resolve, reject) => {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("canvas").forEach((c) => c.remove());
    clone.style.position = "absolute";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.margin = "0";
    clone.style.padding = "0";
    clone.style.inset = "auto";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    const fo = document.createElementNS(svgNS, "foreignObject");
    fo.setAttribute("width", "100%");
    fo.setAttribute("height", "100%");
    fo.appendChild(clone);
    svg.appendChild(fo);

    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("domLayerCaptureBackground: failed to rasterize DOM"));
    };
    img.src = url;
  });

/** Returns `(p, width, height) => Promise<HTMLCanvasElement>` for `compositeDomCaptureExtension({ background })`. */
export const createDomLayerCaptureBackground = (rootElement) => (_p, width, height) =>
  domLayerToCanvas(rootElement, width, height);
