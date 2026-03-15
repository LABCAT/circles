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
const audio = base + "audio/CirclesNo9.wav";
const midi = base + "audio/CirclesNo9.mid";

const GROUPS_PER_CUE = 4;
const TORUS_SCALE = 0.52;
const RADIUS_SCALE = 2;
const SCENE_Z = 400;
/** Track 11 layers: start Z (more negative = further away). Tune for “from the distance” (e.g. -5000 to -8000). */
const TRACK11_Z_START = -3500;
const TRACK11_Z_STEP = 380;
const DRUM_Z_OFFSET = -600;
const DRUM_EDGE_MARGIN = 0.02;
const DRUM_EDGE_BAND = 0.12;
const MATERIAL_OTHER_CHANCE = 0.3;
const MATERIAL_OTHER_TYPES = ["ambient", "specular", "normal"];

const sketch = (p) => {
  p.song = null;
  p.PPQ = 960;
  p.bpm = 102;
  p.blackFadeTop = { active: true, startTime: 0, duration: 0 };
  p.blackFadeBottom = { active: true, startTime: 0, duration: 0 };

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
        p.scheduleCueSet(result.tracks[11]?.notes ?? [], "executeTrack11");   // Mimic - Single Sample Roads
        p.scheduleCueSet(result.tracks[8]?.notes ?? [], "executeTrack8");     // Mimic - Vintage Multi Voice (top-half gradient)
        // p.scheduleCueSet(result.tracks[12]?.notes ?? [], "executeTrack12");   // Kong - Kong Kit
        const track13Notes = result.tracks[13]?.notes ?? [];
        p.scheduleCueSet(track13Notes, "executeTrack13");   // Monotone Bass - Classic Saw
        document.getElementById("loader")?.classList.add("loading--complete");
      })
      .catch((err) => console.error("Failed to load CirclesNo9 MIDI:", err));
  };

  p.preload = () => {
    p.song = p.loadSound(audio, () => p.loadMidi());
  };

  p.resetPattern = () => {
    p.drawnGroups = p.drawnGroups.filter((d) => d.type === "drum");
    p.visitedGroups = new Set();
    p.reachable = [new Group(p, 15, 0, p.radiush, p.radius)];
    p.track11Z = TRACK11_Z_START;
  };

  p.generateBottomGradient = () => {
    const generateDarkColor = () => {
      const darkTypes = [
        () => ({ r: 0, g: p.floor(20 + p.random(50)), b: p.floor(60 + p.random(90)) }),
        () => ({ r: 0, g: p.floor(40 + p.random(60)), b: p.floor(100 + p.random(80)) }),
        () => ({ r: p.floor(15 + p.random(35)), g: p.floor(50 + p.random(60)), b: p.floor(100 + p.random(80)) }),
        () => ({ r: p.floor(30 + p.random(40)), g: 0, b: p.floor(100 + p.random(100)) }),
        () => ({ r: 0, g: p.floor(60 + p.random(50)), b: p.floor(120 + p.random(60)) }),
      ];
      return darkTypes[p.floor(p.random(darkTypes.length))]();
    };
    const generateMediumColor = () => {
      const mediumTypes = [
        () => ({ r: 0, g: p.floor(100 + p.random(80)), b: p.floor(140 + p.random(80)) }),
        () => ({ r: 0, g: p.floor(120 + p.random(80)), b: p.floor(160 + p.random(60)) }),
        () => ({ r: p.floor(40 + p.random(60)), g: p.floor(100 + p.random(100)), b: p.floor(150 + p.random(70)) }),
        () => ({ r: p.floor(80 + p.random(80)), g: p.floor(140 + p.random(80)), b: p.floor(120 + p.random(80)) }),
      ];
      return mediumTypes[p.floor(p.random(mediumTypes.length))]();
    };
    const generateBrightColor = () => {
      const brightTypes = [
        () => ({ r: 0, g: p.floor(180 + p.random(75)), b: p.floor(200 + p.random(55)) }),
        () => ({ r: p.floor(200 + p.random(55)), g: p.floor(180 + p.random(75)), b: p.floor(80 + p.random(80)) }),
        () => ({ r: p.floor(100 + p.random(80)), g: p.floor(200 + p.random(55)), b: p.floor(180 + p.random(75)) }),
      ];
      return brightTypes[p.floor(p.random(brightTypes.length))]();
    };
    const generateColor = (preferDark = false) => {
      if (preferDark) return p.random() < 0.8 ? generateDarkColor() : generateMediumColor();
      const rand = p.random();
      if (rand < 0.6) return generateDarkColor();
      if (rand < 0.9) return generateMediumColor();
      return generateBrightColor();
    };
    const generateWhite = () => (p.random() < 0.05 ? { r: 255, g: 245, b: 220 } : generateMediumColor());
    const rgbToHex = (r, g, b) => `#${[r, g, b].map((x) => { const hex = x.toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("")}`;
    const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;
    const gradients = [];
    const color1 = generateColor(true);
    const alpha1 = 0.4 + p.random(0.25);
    const angle1 = p.random(360);
    const fade1 = 30 + p.random(20);
    gradients.push(`linear-gradient(${angle1}deg, ${rgba(color1.r, color1.g, color1.b, alpha1)} 0%, rgba(0, 0, 0, 0) ${fade1}%)`);
    const color2a = generateColor(true);
    const color2b = p.random() < 0.7 ? generateMediumColor() : generateColor(true);
    gradients.push(`linear-gradient(180deg, ${rgbToHex(color2a.r, color2a.g, color2a.b)} 0%, ${rgbToHex(color2b.r, color2b.g, color2b.b)} 100%)`);
    const color3a = generateColor(true);
    const color3b = generateMediumColor();
    const color3c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle3 = p.random(360);
    const stop3 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle3}deg, ${rgbToHex(color3a.r, color3a.g, color3a.b)} 0%, ${rgbToHex(color3b.r, color3b.g, color3b.b)} ${stop3}%, ${rgbToHex(color3c.r, color3c.g, color3c.b)} 100%)`);
    const color4a = generateColor(true);
    const color4b = generateMediumColor();
    const color4c = generateWhite();
    const angle4 = p.random(360);
    const stop4 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle4}deg, ${rgbToHex(color4a.r, color4a.g, color4a.b)} 0%, ${rgbToHex(color4b.r, color4b.g, color4b.b)} ${stop4}%, ${rgbToHex(color4c.r, color4c.g, color4c.b)} 100%)`);
    const color5a = generateColor(true);
    const color5b = p.random() < 0.4 ? generateBrightColor() : generateMediumColor();
    const size5 = 150 + p.random(100);
    const size5y = size5 * (1.8 + p.random(1.2));
    const pos5x = p.random(100);
    const pos5y = p.random(100);
    gradients.push(`radial-gradient(${size5}% ${size5y}% at ${pos5x}% ${pos5y}%, ${rgbToHex(color5a.r, color5a.g, color5a.b)} 0%, ${rgbToHex(color5b.r, color5b.g, color5b.b)} 100%)`);
    const color6a = generateColor(true);
    const color6b = generateMediumColor();
    const color6c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle6 = p.random(360);
    const stop6a = p.random(10);
    const stop6b = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle6}deg, ${rgbToHex(color6a.r, color6a.g, color6a.b)} ${stop6a}%, ${rgbToHex(color6b.r, color6b.g, color6b.b)} ${stop6b}%, ${rgbToHex(color6c.r, color6c.g, color6c.b)} 100%)`);
    const color7a = p.random() < 0.3 ? generateBrightColor() : generateColor(true);
    const color7b = generateMediumColor();
    const color7c = generateWhite();
    const size7 = 120 + p.random(80);
    const size7y = size7 * (1.2 + p.random(0.6));
    const pos7x = p.random(100);
    const pos7y = p.random(100);
    const stop7 = 40 + p.random(20);
    gradients.push(`radial-gradient(${size7}% ${size7y}% at ${pos7x}% ${pos7y}%, ${rgbToHex(color7a.r, color7a.g, color7a.b)} 0%, ${rgbToHex(color7b.r, color7b.g, color7b.b)} ${stop7}%, ${rgbToHex(color7c.r, color7c.g, color7c.b)} 100%)`);
    return gradients.join(", ");
  };

  p.generateTopGradient = () => {
    const generateDarkColor = () => {
      const darkTypes = [
        () => ({ r: 0, g: p.floor(40 + p.random(60)), b: p.floor(70 + p.random(80)) }),
        () => ({ r: 0, g: p.floor(50 + p.random(50)), b: p.floor(100 + p.random(60)) }),
        () => ({ r: 0, g: p.floor(60 + p.random(50)), b: p.floor(120 + p.random(50)) }),
        () => ({ r: p.floor(20 + p.random(30)), g: 0, b: p.floor(120 + p.random(100)) }),
        () => ({ r: p.floor(30 + p.random(40)), g: p.floor(50 + p.random(50)), b: p.floor(130 + p.random(50)) }),
        () => ({ r: p.floor(60 + p.random(60)), g: 0, b: 0 }),
        () => ({ r: p.floor(80 + p.random(40)), g: p.floor(30 + p.random(30)), b: 0 }),
        () => ({ r: p.floor(90 + p.random(30)), g: p.floor(50 + p.random(20)), b: 0 }),
      ];
      return darkTypes[p.floor(p.random(darkTypes.length))]();
    };
    const generateMediumColor = () => {
      const mediumTypes = [
        () => ({ r: 0, g: p.floor(100 + p.random(80)), b: p.floor(120 + p.random(60)) }),
        () => ({ r: 0, g: p.floor(70 + p.random(80)), b: p.floor(100 + p.random(80)) }),
        () => ({ r: p.floor(30 + p.random(50)), g: p.floor(100 + p.random(80)), b: p.floor(150 + p.random(50)) }),
        () => ({ r: p.floor(150 + p.random(80)), g: p.floor(100 + p.random(100)), b: p.floor(150 + p.random(80)) }),
      ];
      return mediumTypes[p.floor(p.random(mediumTypes.length))]();
    };
    const generateBrightColor = () => {
      const brightTypes = [
        () => ({ r: p.floor(220 + p.random(35)), g: 0, b: p.floor(180 + p.random(75)) }),
        () => ({ r: 0, g: p.floor(150 + p.random(105)), b: p.floor(200 + p.random(55)) }),
        () => ({ r: p.floor(30 + p.random(50)), g: p.floor(200 + p.random(55)), b: p.floor(30 + p.random(50)) }),
      ];
      return brightTypes[p.floor(p.random(brightTypes.length))]();
    };
    const generateColor = (preferDark = false) => {
      if (preferDark) return p.random() < 0.8 ? generateDarkColor() : generateMediumColor();
      const rand = p.random();
      if (rand < 0.6) return generateDarkColor();
      if (rand < 0.9) return generateMediumColor();
      return generateBrightColor();
    };
    const generateWhite = () => (p.random() < 0.05 ? { r: 255, g: 255, b: 255 } : generateMediumColor());
    const rgbToHex = (r, g, b) => `#${[r, g, b].map((x) => { const hex = x.toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("")}`;
    const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;
    const gradients = [];
    const color1 = generateColor(true);
    const alpha1 = 0.4 + p.random(0.25);
    const angle1 = p.random(360);
    const fade1 = 30 + p.random(20);
    gradients.push(`linear-gradient(${angle1}deg, ${rgba(color1.r, color1.g, color1.b, alpha1)} 0%, rgba(0, 0, 0, 0) ${fade1}%)`);
    const color2a = generateColor(true);
    const color2b = p.random() < 0.7 ? generateMediumColor() : generateColor(true);
    gradients.push(`linear-gradient(180deg, ${rgbToHex(color2a.r, color2a.g, color2a.b)} 0%, ${rgbToHex(color2b.r, color2b.g, color2b.b)} 100%)`);
    const color3a = generateColor(true);
    const color3b = generateMediumColor();
    const color3c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle3 = p.random(360);
    const stop3 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle3}deg, ${rgbToHex(color3a.r, color3a.g, color3a.b)} 0%, ${rgbToHex(color3b.r, color3b.g, color3b.b)} ${stop3}%, ${rgbToHex(color3c.r, color3c.g, color3c.b)} 100%)`);
    const color4a = generateColor(true);
    const color4b = generateMediumColor();
    const color4c = generateWhite();
    const angle4 = p.random(360);
    const stop4 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle4}deg, ${rgbToHex(color4a.r, color4a.g, color4a.b)} 0%, ${rgbToHex(color4b.r, color4b.g, color4b.b)} ${stop4}%, ${rgbToHex(color4c.r, color4c.g, color4c.b)} 100%)`);
    const color5a = generateColor(true);
    const color5b = p.random() < 0.4 ? generateBrightColor() : generateMediumColor();
    const size5 = 150 + p.random(100);
    const size5y = size5 * (1.8 + p.random(1.2));
    const pos5x = p.random(100);
    const pos5y = p.random(100);
    gradients.push(`radial-gradient(${size5}% ${size5y}% at ${pos5x}% ${pos5y}%, ${rgbToHex(color5a.r, color5a.g, color5a.b)} 0%, ${rgbToHex(color5b.r, color5b.g, color5b.b)} 100%)`);
    const color6a = generateColor(true);
    const color6b = generateMediumColor();
    const color6c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
    const angle6 = p.random(360);
    const stop6a = p.random(10);
    const stop6b = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle6}deg, ${rgbToHex(color6a.r, color6a.g, color6a.b)} ${stop6a}%, ${rgbToHex(color6b.r, color6b.g, color6b.b)} ${stop6b}%, ${rgbToHex(color6c.r, color6c.g, color6c.b)} 100%)`);
    const color7a = p.random() < 0.3 ? generateBrightColor() : generateColor(true);
    const color7b = generateMediumColor();
    const color7c = generateWhite();
    const size7 = 120 + p.random(80);
    const size7y = size7 * (1.2 + p.random(0.6));
    const pos7x = p.random(100);
    const pos7y = p.random(100);
    const stop7 = 40 + p.random(20);
    gradients.push(`radial-gradient(${size7}% ${size7y}% at ${pos7x}% ${pos7y}%, ${rgbToHex(color7a.r, color7a.g, color7a.b)} 0%, ${rgbToHex(color7b.r, color7b.g, color7b.b)} ${stop7}%, ${rgbToHex(color7c.r, color7c.g, color7c.b)} 100%)`);
    return gradients.join(", ");
  };

  p.drawNextDrumGroup = () => {
    const halfW = p.width / 2;
    const halfH = p.height / 2;
    const margin = Math.min(halfW, halfH) * DRUM_EDGE_MARGIN;
    const bandW = halfW * DRUM_EDGE_BAND;
    const bandH = halfH * DRUM_EDGE_BAND;
    const edge = p.floor(p.random(4));
    let x, y;
    if (edge === 0) {
      x = p.random(-halfW + margin, halfW - margin);
      y = p.random(-halfH, -halfH + bandH);
    } else if (edge === 1) {
      x = p.random(halfW - bandW, halfW);
      y = p.random(-halfH + margin, halfH - margin);
    } else if (edge === 2) {
      x = p.random(-halfW + margin, halfW - margin);
      y = p.random(halfH - bandH, halfH);
    } else {
      x = p.random(-halfW, -halfW + bandW);
      y = p.random(-halfH + margin, halfH - margin);
    }
    p.evolHue = (p.evolHue + p.dHue + 360) % 360;
    p.drawnGroups.push({ type: "drum", x, y, hue: p.evolHue, zOffset: DRUM_Z_OFFSET, materialType: p.random() < MATERIAL_OTHER_CHANCE ? p.random(MATERIAL_OTHER_TYPES) : "emissive" });
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
    p.drawnGroups.push({ group: currGroup, hue: p.evolHue, zOffset, materialType: p.random() < MATERIAL_OTHER_CHANCE ? p.random(MATERIAL_OTHER_TYPES) : "emissive" });
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

  p.drawHex = (hex, hue, materialType = null) => {
    const x = hex.c.x - p.width / 2;
    const y = hex.c.y - p.height / 2;
    p.push();
    p.translate(x, y, 0);
    p.noStroke();
    const c = p.color(`hsl(${hue}, 100%, 50%)`);
    if (materialType) p.applyTorusMaterial(materialType, c);
    else p.fill(c);
    const r = p.radius * TORUS_SCALE;
    p.torus(r, r * 0.35);
    p.pop();
  };

  p.executeTrack0 = (note) => { for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextGroup(); };
  p.setGradientBg = () => {
    const bottom = p.gradientTop ?? p.generateTopGradient();
    const top = p.gradientBottom ?? p.generateBottomGradient();
    if (p.gradientTopEl) {
      p.gradientTopEl.style.background = top;
      p.gradientTopEl.style.backgroundBlendMode = "hard-light, overlay, overlay, overlay, difference, difference, normal";
    }
    if (p.gradientBottomEl) {
      p.gradientBottomEl.style.background = bottom;
      p.gradientBottomEl.style.backgroundBlendMode = "normal, overlay, overlay, overlay, soft-light, overlay, overlay";
    }
  };

  p.executeTrack8 = (note) => {
    p.gradientTop = p.generateTopGradient();
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
  p.executeTrack12 = (note) => { for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextDrumGroup(); };
  p.executeTrack13 = (note) => {
    p.gradientBottom = p.generateBottomGradient();
    p.setGradientBg();
    const duration = (note.durationTicks / p.PPQ) * (60 / p.bpm);
    p.blackFadeBottom.active = true;
    p.blackFadeBottom.startTime = p.song.currentTime() * 1000;
    p.blackFadeBottom.duration = duration * 1000;
  };

  p.setup = () => {
    p.gradientTop = p.generateTopGradient();
    p.gradientBottom = p.generateBottomGradient();

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:fixed;inset:0;z-index:0;";
    p.gradientTopEl = document.createElement("div");
    p.gradientTopEl.style.cssText = "position:absolute;top:0;left:0;width:100%;height:50%;";
    p.gradientBottomEl = document.createElement("div");
    p.gradientBottomEl.style.cssText = "position:absolute;top:50%;left:0;width:100%;height:50%;";
    const tunnelEl = document.createElement("div");
    tunnelEl.style.cssText = "position:absolute;left:50%;top:50%;width:55vmin;height:55vmin;margin-left:-27.5vmin;margin-top:-27.5vmin;border-radius:50%;background:radial-gradient(circle, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 25%, rgba(0,0,0,0.2) 55%, transparent 75%);pointer-events:none;";
    wrapper.appendChild(p.gradientTopEl);
    wrapper.appendChild(p.gradientBottomEl);
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

    // p.orbitControl();
    p.ambientLight(80);
    p.directionalLight(200, 200, 200, 0.5, 0.5, -1);
    p.noStroke();
    p.translate(0, 0, SCENE_Z);

    p.colorMode(p.RGB, 255);
    if (p.song && (p.blackFadeTop.active || p.blackFadeBottom.active)) {
      const dist = Math.abs(SCENE_Z + TRACK11_Z_START);
      const fovy = p.PI / 3.5;
      const visibleH = 2 * dist * Math.tan(fovy / 2) * 2;
      const visibleW = visibleH * (p.width / p.height);
      p.push();
      p.translate(0, 0, TRACK11_Z_START);
      p.noStroke();
      if (p.blackFadeTop.active) {
        const elapsed = p.song.currentTime() * 1000 - p.blackFadeTop.startTime;
        const progress = p.constrain(elapsed / p.blackFadeTop.duration, 0, 1);
        const opacity = Math.pow(progress, 0.75);
        p.fill(0, 0, 0, opacity * 255);
        p.translate(0, -visibleH / 4, 0);
        p.plane(visibleW, visibleH / 2);
        p.translate(0, visibleH / 4, 0);
      }
      if (p.blackFadeBottom.active) {
        const elapsed = p.song.currentTime() * 1000 - p.blackFadeBottom.startTime;
        const progress = p.constrain(elapsed / p.blackFadeBottom.duration, 0, 1);
        const opacity = Math.pow(progress, 0.5);
        p.fill(0, 0, 0, opacity * 255);
        p.translate(0, visibleH / 4, 0);
        p.plane(visibleW, visibleH / 2);
      }
      p.pop();
    }

    const byZ = [...p.drawnGroups].sort((a, b) => (a.zOffset ?? 0) - (b.zOffset ?? 0));
    byZ.forEach((item) => {
      if (item.type === "drum") {
        p.push();
        p.translate(item.x, item.y, item.zOffset);
        p.noStroke();
        const c = p.color(`hsl(${item.hue}, 100%, 50%)`);
        if (item.materialType) p.applyTorusMaterial(item.materialType, c);
        else p.fill(c);
        const r = p.radius * TORUS_SCALE;
        p.torus(r, r * 0.35);
        p.pop();
      } else {
        const { group, hue, zOffset = 0, materialType = null } = item;
        p.push();
        p.translate(0, 0, zOffset);
        group.forEach((hex) => p.drawHex(hex, hue, materialType));
        p.pop();
      }
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
