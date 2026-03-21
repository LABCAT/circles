import p5 from "p5";
import "p5/lib/addons/p5.sound";
import { Midi } from "@tonejs/midi";
import {
  Group,
  RADIUS_MINI,
  RADIUS_MAXI,
  DHUE,
  rac3s2,
  dneighbors,
  arrayShuffle,
} from "./classes/HexagonPattern.js";

const base = import.meta.env.BASE_URL || "./";
const audio = base + "audio/CirclesNo9.mp3";
const midi = base + "audio/CirclesNo9.mid";

const GROUPS_PER_CUE = 4;
const TORUS_SCALE = 0.68;
const RADIUS_SCALE = 2;
const SCENE_Z = 400;
/** Track 11 layers: start Z (more negative = further away). Tune for “from the distance” (e.g. -5000 to -8000). */
const TRACK11_Z_START = -3500;
const TRACK11_Z_STEP = 380;
/** Fade arc time curve: higher = slower to darken at first (smaller = reaches black sooner). */
const FADE_TOP_EASE_POW = 1.5;
const FADE_BOTTOM_EASE_POW = 0.38;
/** Peak strength into the arc stack (0–1). Bottom can go full black; top stays softer. */
const FADE_TOP_MAX_OPACITY = 0.82;
const FADE_BOTTOM_MAX_OPACITY = 1;
/** Extra multiplier on each ring’s alpha (bottom only) so it stacks to true black. */
const FADE_BOTTOM_RING_ALPHA_BOOST = 1.28;
const MATERIAL_OTHER_CHANCE = 0.3;
const MATERIAL_OTHER_TYPES = ["ambient", "specular", "normal"];

const sketch = (p) => {
  p.song = null;
  p.PPQ = 960;
  p.bpm = 102;
  p.blackFadeTop = { active: true, startTime: 0, duration: 0 };
  p.blackFadeBottom = { active: true, startTime: 0, duration: 0 };

  const chromaRgb = (h, sat, bri) => {
    p.push();
    p.colorMode(p.HSB, 360, 100, 100);
    const hh = ((h % 360) + 360) % 360;
    const c = p.color(hh, p.constrain(sat, 0, 100), p.constrain(bri, 0, 100));
    const out = { r: Math.round(p.red(c)), g: Math.round(p.green(c)), b: Math.round(p.blue(c)) };
    p.pop();
    return out;
  };

  /** Skews away from “all blue”: warms, magenta, violet, green; blue only ~8%. */
  const biasedHue = (variant, salt, driftDeg, hueSkew) => {
    const roll = p.random();
    let h;
    if (roll < 0.2) h = p.random(4, 46);
    else if (roll < 0.36) h = p.random(46, 88);
    else if (roll < 0.52) h = p.random(275, 348);
    else if (roll < 0.66) h = p.random(248, 275);
    else if (roll < 0.78) h = p.random(88, 148);
    else if (roll < 0.88) h = p.random(0, 18);
    else if (roll < 0.94) h = p.random(148, 172);
    else h = p.random(188, 218);
    h = (h + hueSkew + variant * driftDeg + salt * 17 + p.random(-22, 22) + 360) % 360;
    if (p.random() < 0.24) h = (h + 180) % 360;
    return h;
  };

  p.scheduleCueSet = (noteSet, callbackName, polyMode = false) => {
    let lastTicks = -1,
      currentCue = 1;
    for (let i = 0; i < noteSet.length; i++) {
      const note = noteSet[i],
        { ticks, time } = note;
      if (ticks !== lastTicks || polyMode) {
        note.currentCue = currentCue;
        p.song.addCue(time, p[callbackName], note);
        lastTicks = ticks;
        currentCue++;
      }
    }
  };

  p.loadMidi = () => {
    Midi.fromUrl(midi)
      .then((result) => {
        p.midiResult = result;
        p.PPQ = result.header.ppq;
        p.bpm = result.header.tempos[0]?.bpm ?? p.bpm;
        console.log("CirclesNo9 MIDI loaded:", result);
        p.scheduleCueSet(result.tracks[11]?.notes ?? [], "executeTrack13");   // Mimic - Single Sample Roads
        p.scheduleCueSet(result.tracks[8]?.notes ?? [], "executeTrack8");     // Mimic - Vintage Multi Voice (top-half gradient)
        const track13Notes = result.tracks[13]?.notes ?? [];
        p.scheduleCueSet(track13Notes, "executeTrack11");   // Monotone Bass - Classic Saw
        document.getElementById("loader")?.classList.add("loading--complete");
      })
      .catch((err) => console.error("Failed to load CirclesNo9 MIDI:", err));
  };

  p.preload = () => {
    p.song = p.loadSound(audio, () => p.loadMidi());
  };

  p.resetPattern = () => {
    p.drawnGroups = [];
    p.visitedGroups = new Set();
    p.reachable = [new Group(p, 15, 0, p.radiush, p.radius)];
    p.track11Z = TRACK11_Z_START;
  };

  p.generateBottomGradient = (variant = 0) => {
    const angleShift = variant * 107 + p.random(-22, 22);
    const radialX = variant === 0 ? p.random(6, 38) : p.random(62, 94);
    const radialY = variant === 0 ? p.random(18, 52) : p.random(48, 88);
    const radialX2 = variant === 0 ? p.random(10, 42) : p.random(58, 90);
    const radialY2 = variant === 0 ? p.random(22, 58) : p.random(42, 78);
    const spineDeg = 165 + variant * 50 + p.random(-14, 14);
    const hueSkew = variant === 0 ? 0 : 58;
    const drift = 47;
    const generateDarkColor = () => {
      if (p.random() < 0.08) return chromaRgb(biasedHue(variant, 9, drift, hueSkew), p.random(10, 32), p.random(38, 62));
      return chromaRgb(biasedHue(variant, 1, drift, hueSkew), p.random(48, 92), p.random(32, 58));
    };
    const generateMediumColor = () =>
      chromaRgb(biasedHue(variant, 2, drift, hueSkew), p.random(50, 92), p.random(48, 82));
    const generateBrightColor = () =>
      chromaRgb(biasedHue(variant, 3, drift, hueSkew), p.random(72, 100), p.random(76, 100));
    const generateColor = (preferDark = false) => {
      if (preferDark) return p.random() < 0.5 ? generateDarkColor() : generateMediumColor();
      const rand = p.random();
      if (rand < 0.28) return generateDarkColor();
      if (rand < 0.72) return generateMediumColor();
      return generateBrightColor();
    };
    const generateWhite = () =>
      p.random() < 0.1
        ? chromaRgb(p.random(28, 48), p.random(10, 28), p.random(90, 100))
        : generateMediumColor();
    const rgbToHex = (r, g, b) => `#${[r, g, b].map((x) => { const hex = x.toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("")}`;
    const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;
    const gradients = [];
    const color1 = generateColor(variant === 0);
    const alpha1 = 0.32 + p.random(0.2);
    const angle1 = (p.random(360) + angleShift + 360) % 360;
    const fade1 = 30 + p.random(20);
    gradients.push(`linear-gradient(${angle1}deg, ${rgba(color1.r, color1.g, color1.b, alpha1)} 0%, rgba(0, 0, 0, 0) ${fade1}%)`);
    const color2a = generateColor(true);
    const color2b = p.random() < 0.7 ? generateMediumColor() : generateColor(true);
    gradients.push(`linear-gradient(${spineDeg}deg, ${rgbToHex(color2a.r, color2a.g, color2a.b)} 0%, ${rgbToHex(color2b.r, color2b.g, color2b.b)} 100%)`);
    const color3a = generateColor(true);
    const color3b = generateMediumColor();
    const color3c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle3 = (p.random(360) + angleShift * 0.85 + 360) % 360;
    const stop3 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle3}deg, ${rgbToHex(color3a.r, color3a.g, color3a.b)} 0%, ${rgbToHex(color3b.r, color3b.g, color3b.b)} ${stop3}%, ${rgbToHex(color3c.r, color3c.g, color3c.b)} 100%)`);
    const color4a = generateColor(true);
    const color4b = generateMediumColor();
    const color4c = generateWhite();
    const angle4 = (p.random(360) + angleShift * 1.1 + 360) % 360;
    const stop4 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle4}deg, ${rgbToHex(color4a.r, color4a.g, color4a.b)} 0%, ${rgbToHex(color4b.r, color4b.g, color4b.b)} ${stop4}%, ${rgbToHex(color4c.r, color4c.g, color4c.b)} 100%)`);
    const color5a = generateColor(true);
    const color5b = p.random() < 0.4 ? generateBrightColor() : generateMediumColor();
    const size5 = 150 + p.random(100);
    const size5y = size5 * (1.8 + p.random(1.2));
    const pos5x = p.constrain(radialX + p.random(-6, 6), 0, 100);
    const pos5y = p.constrain(radialY + p.random(-8, 8), 0, 100);
    gradients.push(`radial-gradient(${size5}% ${size5y}% at ${pos5x}% ${pos5y}%, ${rgbToHex(color5a.r, color5a.g, color5a.b)} 0%, ${rgbToHex(color5b.r, color5b.g, color5b.b)} 100%)`);
    const color6a = generateColor(true);
    const color6b = generateMediumColor();
    const color6c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle6 = (p.random(360) + angleShift * 0.75 + 360) % 360;
    const stop6a = p.random(10);
    const stop6b = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle6}deg, ${rgbToHex(color6a.r, color6a.g, color6a.b)} ${stop6a}%, ${rgbToHex(color6b.r, color6b.g, color6b.b)} ${stop6b}%, ${rgbToHex(color6c.r, color6c.g, color6c.b)} 100%)`);
    const color7a = p.random() < 0.3 ? generateBrightColor() : generateColor(true);
    const color7b = generateMediumColor();
    const color7c = generateWhite();
    const size7 = 120 + p.random(80);
    const size7y = size7 * (1.2 + p.random(0.6));
    const pos7x = p.constrain(radialX2 + p.random(-5, 5), 0, 100);
    const pos7y = p.constrain(radialY2 + p.random(-7, 7), 0, 100);
    const stop7 = 40 + p.random(20);
    gradients.push(`radial-gradient(${size7}% ${size7y}% at ${pos7x}% ${pos7y}%, ${rgbToHex(color7a.r, color7a.g, color7a.b)} 0%, ${rgbToHex(color7b.r, color7b.g, color7b.b)} ${stop7}%, ${rgbToHex(color7c.r, color7c.g, color7c.b)} 100%)`);
    if (p.random() < 0.45) {
      const i = 1 + p.floor(p.random(5));
      const t = gradients[i];
      gradients[i] = gradients[i + 1];
      gradients[i + 1] = t;
    }
    return gradients.join(", ");
  };

  p.generateTopGradient = (variant = 0) => {
    const angleShift = variant * 127 + p.random(-22, 22);
    const radialX = variant === 0 ? p.random(8, 40) : p.random(60, 92);
    const radialY = variant === 0 ? p.random(20, 55) : p.random(45, 85);
    const radialX2 = variant === 0 ? p.random(12, 44) : p.random(56, 88);
    const radialY2 = variant === 0 ? p.random(25, 60) : p.random(40, 75);
    const spineDeg = 175 + variant * 55 + p.random(-16, 16);
    const hueSkew = variant === 0 ? -72 : 104;
    const drift = 61;
    const generateDarkColor = () => {
      if (p.random() < 0.08) return chromaRgb(biasedHue(variant, 8, drift, hueSkew), p.random(10, 30), p.random(36, 60));
      return chromaRgb(biasedHue(variant, 4, drift, hueSkew), p.random(46, 90), p.random(30, 56));
    };
    const generateMediumColor = () =>
      chromaRgb(biasedHue(variant, 5, drift, hueSkew), p.random(50, 90), p.random(46, 80));
    const generateBrightColor = () =>
      chromaRgb(biasedHue(variant, 6, drift, hueSkew), p.random(72, 100), p.random(74, 100));
    const generateColor = (preferDark = false) => {
      if (preferDark) return p.random() < 0.48 ? generateDarkColor() : generateMediumColor();
      const rand = p.random();
      if (rand < 0.26) return generateDarkColor();
      if (rand < 0.7) return generateMediumColor();
      return generateBrightColor();
    };
    const generateWhite = () =>
      p.random() < 0.1
        ? chromaRgb(p.random(0, 360), p.random(8, 26), p.random(90, 100))
        : generateMediumColor();
    const rgbToHex = (r, g, b) => `#${[r, g, b].map((x) => { const hex = x.toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("")}`;
    const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;
    const gradients = [];
    const color1 = generateColor(variant === 1);
    const alpha1 = 0.32 + p.random(0.2);
    const angle1 = (p.random(360) + angleShift + 360) % 360;
    const fade1 = 30 + p.random(20);
    gradients.push(`linear-gradient(${angle1}deg, ${rgba(color1.r, color1.g, color1.b, alpha1)} 0%, rgba(0, 0, 0, 0) ${fade1}%)`);
    const color2a = generateColor(true);
    const color2b = p.random() < 0.7 ? generateMediumColor() : generateColor(true);
    gradients.push(`linear-gradient(${spineDeg}deg, ${rgbToHex(color2a.r, color2a.g, color2a.b)} 0%, ${rgbToHex(color2b.r, color2b.g, color2b.b)} 100%)`);
    const color3a = generateColor(true);
    const color3b = generateMediumColor();
    const color3c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle3 = (p.random(360) + angleShift * 0.9 + 360) % 360;
    const stop3 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle3}deg, ${rgbToHex(color3a.r, color3a.g, color3a.b)} 0%, ${rgbToHex(color3b.r, color3b.g, color3b.b)} ${stop3}%, ${rgbToHex(color3c.r, color3c.g, color3c.b)} 100%)`);
    const color4a = generateColor(true);
    const color4b = generateMediumColor();
    const color4c = generateWhite();
    const angle4 = (p.random(360) + angleShift * 1.05 + 360) % 360;
    const stop4 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle4}deg, ${rgbToHex(color4a.r, color4a.g, color4a.b)} 0%, ${rgbToHex(color4b.r, color4b.g, color4b.b)} ${stop4}%, ${rgbToHex(color4c.r, color4c.g, color4c.b)} 100%)`);
    const color5a = generateColor(true);
    const color5b = p.random() < 0.4 ? generateBrightColor() : generateMediumColor();
    const size5 = 150 + p.random(100);
    const size5y = size5 * (1.8 + p.random(1.2));
    const pos5x = p.constrain(radialX + p.random(-6, 6), 0, 100);
    const pos5y = p.constrain(radialY + p.random(-8, 8), 0, 100);
    gradients.push(`radial-gradient(${size5}% ${size5y}% at ${pos5x}% ${pos5y}%, ${rgbToHex(color5a.r, color5a.g, color5a.b)} 0%, ${rgbToHex(color5b.r, color5b.g, color5b.b)} 100%)`);
    const color6a = generateColor(true);
    const color6b = generateMediumColor();
    const color6c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle6 = (p.random(360) + angleShift * 0.7 + 360) % 360;
    const stop6a = p.random(10);
    const stop6b = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle6}deg, ${rgbToHex(color6a.r, color6a.g, color6a.b)} ${stop6a}%, ${rgbToHex(color6b.r, color6b.g, color6b.b)} ${stop6b}%, ${rgbToHex(color6c.r, color6c.g, color6c.b)} 100%)`);
    const color7a = p.random() < 0.3 ? generateBrightColor() : generateColor(true);
    const color7b = generateMediumColor();
    const color7c = generateWhite();
    const size7 = 120 + p.random(80);
    const size7y = size7 * (1.2 + p.random(0.6));
    const pos7x = p.constrain(radialX2 + p.random(-5, 5), 0, 100);
    const pos7y = p.constrain(radialY2 + p.random(-7, 7), 0, 100);
    const stop7 = 40 + p.random(20);
    gradients.push(`radial-gradient(${size7}% ${size7y}% at ${pos7x}% ${pos7y}%, ${rgbToHex(color7a.r, color7a.g, color7a.b)} 0%, ${rgbToHex(color7b.r, color7b.g, color7b.b)} ${stop7}%, ${rgbToHex(color7c.r, color7c.g, color7c.b)} 100%)`);
    if (p.random() < 0.45) {
      const i = 1 + p.floor(p.random(5));
      const t = gradients[i];
      gradients[i] = gradients[i + 1];
      gradients[i + 1] = t;
    }
    return gradients.join(", ");
  };

  p.drawNextGroup = (zOffset = 0) => {
    if (p.reachable.length === 0) p.reachable.push(new Group(p, 15, 0, p.radiush, p.radius));
    let currGroup = p.reachable.shift();
    while (currGroup && (p.visitedGroups.has(currGroup.key) || currGroup.size === 0)) {
      currGroup = p.reachable.length > 0 ? p.reachable.shift() : null;
    }
    if (!currGroup) return;
    p.visitedGroups.add(currGroup.key);
    p.evolHue = (p.evolHue + p.dHue + 360) % 360;
    const willSpin = p.random() < 0.1;
    const spinSpeedZ = willSpin ? (p.random() < 0.5 ? -1 : 1) * p.random(0.00018, 0.0009) : 0;
    const spinSpeedX = willSpin ? (p.random() < 0.5 ? -1 : 1) * p.random(0.00015, 0.0007) : 0;
    const spinSpeedY = willSpin ? (p.random() < 0.5 ? -1 : 1) * p.random(0.00015, 0.0007) : 0;
    const tiltX = willSpin ? p.random(-0.14, 0.14) : 0;
    const tiltY = willSpin ? p.random(-0.14, 0.14) : 0;
    p.drawnGroups.push({
      group: currGroup,
      hue: p.evolHue,
      zOffset,
      materialType: p.random() < MATERIAL_OTHER_CHANCE ? p.random(MATERIAL_OTHER_TYPES) : "emissive",
      spinSpeedZ,
      spinSpeedX,
      spinSpeedY,
      tiltX,
      tiltY,
    });
    const repr = currGroup.values().next().value;
    const neighGroups = [];
    dneighbors.forEach((dk) => {
      const ng = new Group(p, repr.kx + dk.dx, repr.ky + dk.dy, p.radiush, p.radius);
      if (ng.size === 0) return;
      if (p.visitedGroups.has(ng.key)) return;
      if (p.reachable.some((r) => r.key === ng.key)) return;
      neighGroups.push(ng);
    });
    arrayShuffle(neighGroups);
    p.reachable.push(...neighGroups);
  };

  p.applyTorusMaterial = (materialType, c) => {
    p.shininess(80);
    if (materialType === "normal") p.normalMaterial();
    else {
      p[`${materialType}Material`](p.red(c), p.green(c), p.blue(c));
      p.fill(c);
    }
  };

  p.drawHex = (hex, hue, materialType = null, rotX = 0, rotY = 0, rotZ = 0, tiltX = 0, tiltY = 0) => {
    const x = hex.c.x - p.width / 2;
    const y = hex.c.y - p.height / 2;
    p.push();
    p.translate(x, y, 0);
    if (tiltX) p.rotateX(tiltX);
    if (tiltY) p.rotateY(tiltY);
    if (rotX) p.rotateX(rotX);
    if (rotY) p.rotateY(rotY);
    if (rotZ) p.rotateZ(rotZ);
    p.noStroke();
    const c = p.color(`hsl(${hue}, 100%, 50%)`);
    if (materialType) p.applyTorusMaterial(materialType, c);
    else p.fill(c);
    const r = p.radius * TORUS_SCALE;
    p.torus(r, r * 0.15);
    p.pop();
  };

  p.executeTrack0 = (note) => { for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextGroup(); };
  p.setGradientBg = () => {
    const upperLeft = p.gradientTopLeft ?? p.generateTopGradient(0);
    const upperRight = p.gradientTopRight ?? p.generateTopGradient(1);
    const lowerLeft = p.gradientBottomLeft ?? p.generateBottomGradient(0);
    const lowerRight = p.gradientBottomRight ?? p.generateBottomGradient(1);
    const upperLeftBlend = "soft-light, screen, overlay, difference, exclusion, overlay, normal";
    const upperRightBlend = "overlay, soft-light, overlay, hue, lighten, screen, normal";
    const lowerBlend = "overlay, lighten, overlay, soft-light, soft-light, overlay, normal";
    if (p.gradientTopLeftEl) {
      p.gradientTopLeftEl.style.background = upperLeft;
      p.gradientTopLeftEl.style.backgroundBlendMode = upperLeftBlend;
    }
    if (p.gradientTopRightEl) {
      p.gradientTopRightEl.style.background = upperRight;
      p.gradientTopRightEl.style.backgroundBlendMode = upperRightBlend;
    }
    if (p.gradientBottomLeftEl) {
      p.gradientBottomLeftEl.style.background = lowerLeft;
      p.gradientBottomLeftEl.style.backgroundBlendMode = lowerBlend;
    }
    if (p.gradientBottomRightEl) {
      p.gradientBottomRightEl.style.background = lowerRight;
      p.gradientBottomRightEl.style.backgroundBlendMode = lowerBlend;
    }
  };

  p.executeTrack8 = (note) => {
    p.gradientTopLeft = p.generateTopGradient(0);
    p.gradientTopRight = p.generateTopGradient(1);
    p.setGradientBg();
    const duration = (note.durationTicks / p.PPQ) * (60 / p.bpm);
    p.blackFadeTop.active = true;
    p.blackFadeTop.startTime = p.song.currentTime() * 1000;
    p.blackFadeTop.duration = duration * 1000;
    for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextGroup();
  };
  p.executeTrack11 = (note) => {
    if ([10, 20, 29, 39, 48, 58, 67].includes(note.currentCue)) p.resetPattern();
    for (let i = 0; i < 12; i++) p.drawNextGroup(p.track11Z);
    p.track11Z += TRACK11_Z_STEP;
  };
  p.executeTrack13 = (note) => {
    p.gradientBottomLeft = p.generateBottomGradient(0);
    p.gradientBottomRight = p.generateBottomGradient(1);
    p.setGradientBg();
    const duration = (note.durationTicks / p.PPQ) * (60 / p.bpm);
    p.blackFadeBottom.active = true;
    p.blackFadeBottom.startTime = p.song.currentTime() * 1000;
    p.blackFadeBottom.duration = duration * 1000;
  };

  p.setup = () => {
    p.gradientTopLeft = p.generateTopGradient(0);
    p.gradientTopRight = p.generateTopGradient(1);
    p.gradientBottomLeft = p.generateBottomGradient(0);
    p.gradientBottomRight = p.generateBottomGradient(1);

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:fixed;inset:0;z-index:0;";
    p.gradientTopLeftEl = document.createElement("div");
    p.gradientTopLeftEl.style.cssText = "position:absolute;top:0;left:0;width:50%;height:50%;";
    p.gradientTopRightEl = document.createElement("div");
    p.gradientTopRightEl.style.cssText = "position:absolute;top:0;left:50%;width:50%;height:50%;";
    p.gradientBottomLeftEl = document.createElement("div");
    p.gradientBottomLeftEl.style.cssText = "position:absolute;top:50%;left:0;width:50%;height:50%;";
    p.gradientBottomRightEl = document.createElement("div");
    p.gradientBottomRightEl.style.cssText = "position:absolute;top:50%;left:50%;width:50%;height:50%;";
    const tunnelEl = document.createElement("div");
    tunnelEl.style.cssText = "position:absolute;left:50%;top:50%;width:55vmin;height:55vmin;margin-left:-27.5vmin;margin-top:-27.5vmin;border-radius:50%;background:radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 25%, rgba(0,0,0,0.2) 55%, transparent 75%);pointer-events:none;";
    wrapper.appendChild(p.gradientTopLeftEl);
    wrapper.appendChild(p.gradientTopRightEl);
    wrapper.appendChild(p.gradientBottomLeftEl);
    wrapper.appendChild(p.gradientBottomRightEl);
    wrapper.appendChild(tunnelEl);
    document.body.insertBefore(wrapper, document.body.firstChild);

    p.setGradientBg();
    p.pixelDensity(1);
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    wrapper.appendChild(p.canvas);
    p.canvas.style.position = "absolute";
    p.canvas.style.top = "0";
    p.canvas.style.left = "0";
    p.canvas.style.zIndex = "1";
    p.canvas.style.background = "transparent";
    p.canvas.classList.add("p5Canvas");
    p.perspective(p.PI / 3.5, p.width / p.height, 50, 80000);
    const diag = p.sqrt(p.width * p.width + p.height * p.height);
    p.radiush = diag * (RADIUS_MINI + (RADIUS_MAXI - RADIUS_MINI) * p.random()) * RADIUS_SCALE;
    p.radius = p.radiush * rac3s2;
    p.evolHue = p.floor(p.random(360));
    p.dHue = p.random() < 0.5 ? DHUE : -DHUE;
    p.reachable = [];
    p.visitedGroups = new Set();
    p.drawnGroups = [];
    p.track11Z = TRACK11_Z_START;
  };

  p.draw = () => {
    p.clear();

    if (p.song) {
      if (p.blackFadeTop.active) {
        const elapsed = p.song.currentTime() * 1000 - p.blackFadeTop.startTime;
        if (elapsed >= p.blackFadeTop.duration) p.blackFadeTop.active = false;
      }
      if (p.blackFadeBottom.active) {
        const elapsed = p.song.currentTime() * 1000 - p.blackFadeBottom.startTime;
        if (elapsed >= p.blackFadeBottom.duration) p.blackFadeBottom.active = false;
      }
    }

    p.ambientLight(180);
    p.noStroke();
    p.translate(0, 0, SCENE_Z);

    p.colorMode(p.RGB, 255);
    if (p.song && (p.blackFadeTop.active || p.blackFadeBottom.active)) {
      const dist = Math.abs(SCENE_Z + TRACK11_Z_START);
      const fovy = p.PI / 3.5;
      const visibleH = 2 * dist * Math.tan(fovy / 2) * 2;
      const visibleW = visibleH * (p.width / p.height);

      const drawFadeArcStack = ({ yOffset, startAngle, stopAngle, opacity, count = 48, minRFactor = 0.04, opacityMul = 1, angleOffset = 0, ringAlphaBoost = 1 }) => {
        const maxR = Math.max(visibleW, visibleH) * 0.78;
        const minR = maxR * minRFactor;
        const band = (maxR - minR) / count;
        const overlap = band * 0.02;
        const steps = 42;

        p.push();
        p.translate(0, yOffset, 0);
        p.noStroke();
        for (let i = 0; i < count; i++) {
          const r0 = minR + i * band;
          const r1 = minR + (i + 1) * band + overlap;
          const layerT = i / Math.max(1, count - 1);
          const a = p.constrain(opacity * opacityMul * ringAlphaBoost * (0.12 + 0.55 * (1 - layerT)), 0, 1);
          p.noStroke();
          p.fill(0, 0, 0, a * 255);
          p.push();
          p.translate(0, 0, i * 0.6);
          p.beginShape();
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const ang = p.lerp(startAngle, stopAngle, t) + angleOffset;
            p.vertex(p.cos(ang) * r1, p.sin(ang) * r1);
          }
          for (let s = steps; s >= 0; s--) {
            const t = s / steps;
            const ang = p.lerp(startAngle, stopAngle, t) + angleOffset;
            p.vertex(p.cos(ang) * r0, p.sin(ang) * r0);
          }
          p.endShape(p.CLOSE);
          p.pop();
        }
        p.pop();
      };

      p.push();
      p.translate(0, 0, TRACK11_Z_START);
      p.noStroke();
      if (p.blackFadeTop.active) {
        const elapsed = p.song.currentTime() * 1000 - p.blackFadeTop.startTime;
        const progress = p.constrain(elapsed / p.blackFadeTop.duration, 0, 1);
        const opacity = p.constrain(Math.pow(progress, FADE_TOP_EASE_POW) * FADE_TOP_MAX_OPACITY, 0, 1);
        drawFadeArcStack({
          yOffset: 0,
          startAngle: p.PI,
          stopAngle: p.TWO_PI,
          opacity,
        });
      }
      if (p.blackFadeBottom.active) {
        const elapsed = p.song.currentTime() * 1000 - p.blackFadeBottom.startTime;
        const progress = p.constrain(elapsed / p.blackFadeBottom.duration, 0, 1);
        const opacity = p.constrain(Math.pow(progress, FADE_BOTTOM_EASE_POW) * FADE_BOTTOM_MAX_OPACITY, 0, 1);
        drawFadeArcStack({
          yOffset: 0,
          startAngle: 0,
          stopAngle: p.PI,
          opacity,
          ringAlphaBoost: FADE_BOTTOM_RING_ALPHA_BOOST,
        });
      }
      p.pop();
    }

    const byZ = [...p.drawnGroups].sort((a, b) => (a.zOffset ?? 0) - (b.zOffset ?? 0));
    byZ.forEach((item) => {
      const { group, hue, zOffset = 0, materialType = null, spinSpeedZ = 0, spinSpeedX = 0, spinSpeedY = 0, tiltX = 0, tiltY = 0 } = item;
      p.push();
      p.translate(0, 0, zOffset);
      const t = p.song ? p.song.currentTime() * 1000 : p.millis();
      const rotX = spinSpeedX ? t * spinSpeedX : 0;
      const rotY = spinSpeedY ? t * spinSpeedY : 0;
      const rotZ = spinSpeedZ ? t * spinSpeedZ : 0;
      group.forEach((hex) => p.drawHex(hex, hue, materialType, rotX, rotY, rotZ, tiltX, tiltY));
      p.pop();
    });
  };

  p.mousePressed = () => {
    if (p.song && !p.song.isPlaying()) p.song.play();
    else if (p.song && p.song.isPlaying()) p.song.pause();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
};

new p5(sketch);
