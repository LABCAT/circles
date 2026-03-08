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
const TRACK11_Z_START = -3000;
const TRACK11_Z_STEP = 200;
const DRUM_Z_OFFSET = -600;
const DRUM_EDGE_MARGIN = 0.02;
const DRUM_EDGE_BAND = 0.12;

const sketch = (p) => {
  p.song = null;
  p.PPQ = 960;
  p.bpm = 102;

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
        // p.scheduleCueSet(result.tracks[0]?.notes ?? [], "executeTrack0");   // Redrum - Ambient Kit 01
        // p.scheduleCueSet(result.tracks[8]?.notes ?? [], "executeTrack8");     // Mimic - Vintage Multi Voice
        p.scheduleCueSet(result.tracks[12]?.notes ?? [], "executeTrack12");   // Kong - Kong Kit
        // p.scheduleCueSet(result.tracks[13]?.notes ?? [], "executeTrack13");   // Monotone Bass - Classic Saw
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
    p.drawnGroups.push({ type: "drum", x, y, hue: p.evolHue, zOffset: DRUM_Z_OFFSET });
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
    p.drawnGroups.push({ group: currGroup, hue: p.evolHue, zOffset });
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

  p.drawHex = (hex, hue) => {
    const x = hex.c.x - p.width / 2;
    const y = hex.c.y - p.height / 2;
    p.push();
    p.translate(x, y, 0);
    p.noStroke();
    p.fill(p.color(`hsl(${hue}, 100%, 50%)`));
    const r = p.radius * TORUS_SCALE;
    p.torus(r, r * 0.35);
    p.pop();
  };

  p.executeTrack0 = (note) => { for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextGroup(); };
  p.executeTrack8 = (note) => { for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextGroup(); };
  p.executeTrack11 = (note) => {
    if ([10, 20, 29, 39, 48, 58, 67].includes(note.currentCue)) p.resetPattern();
    for (let i = 0; i < 12; i++) p.drawNextGroup(p.track11Z);
    p.track11Z += TRACK11_Z_STEP;
  };
  p.executeTrack12 = (note) => { for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextDrumGroup(); };
  p.executeTrack13 = (note) => { for (let i = 0; i < GROUPS_PER_CUE; i++) p.drawNextGroup(); };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.perspective(p.PI / 3.5);
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
    p.background(20);
    p.orbitControl();
    p.ambientLight(80);
    p.directionalLight(200, 200, 200, 0.5, 0.5, -1);
    p.noStroke();
    p.translate(0, 0, SCENE_Z);
    p.drawnGroups.forEach((item) => {
      if (item.type === "drum") {
        p.push();
        p.translate(item.x, item.y, item.zOffset);
        p.noStroke();
        p.fill(p.color(`hsl(${item.hue}, 100%, 50%)`));
        const r = p.radius * TORUS_SCALE;
        p.torus(r, r * 0.35);
        p.pop();
      } else {
        const { group, hue, zOffset = 0 } = item;
        p.push();
        p.translate(0, 0, zOffset);
        group.forEach((hex) => p.drawHex(hex, hue));
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
