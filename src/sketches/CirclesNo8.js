import p5 from "p5";
import "p5/lib/addons/p5.sound";
import '@/lib/p5.randomColor.js';
import { Midi } from '@tonejs/midi';
import initCapture from '@/lib/p5.capture.js';
import CircleSet from "./classes/CircleSet.js";

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/CirclesNo8.mp3';
const midi = base + 'audio/CirclesNo8.mid';

const sketch = (p) => {
  /** 
   * Core audio properties
   */
  p.song = null;
  p.audioSampleRate = 0;
  p.totalAnimationFrames = 0;
  p.PPQ = 3840 * 4;
  p.bpm = 97;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.circleSets = [];
  p.circleSet = null;
  p.currentCircleSetIndex = 0;
  p.cameraZOffset = 0;
  p.cameraAnimation = null;
  
  /** 
   * MIDI loading and processing
   * Handles synchronization between audio and visuals
   */
  p.loadMidi = () => {
      Midi.fromUrl(midi).then((result) => {
          console.log('MIDI loaded:', result);
          const track1 = result.tracks[1].notes; // Combinator 1 
          p.scheduleCueSet(track1, 'executeTrack1');
          document.getElementById("loader").classList.add("loading--complete");
          document.getElementById('play-icon').classList.add('fade-in');
          p.audioLoaded = true;
      });
  };

  /** 
   * Schedule MIDI cues to trigger animations
   * @param {Array} noteSet - Array of MIDI notes
   * @param {String} callbackName - Name of the callback function to execute
   * @param {Boolean} polyMode - Allow multiple notes at same time if true
   */
  p.scheduleCueSet = (noteSet, callbackName, polyMode = false) => {
      let lastTicks = -1,
          currentCue = 1;
      for (let i = 0; i < noteSet.length; i++) {
          const note = noteSet[i],
              { ticks, time } = note;
          if(ticks !== lastTicks || polyMode){
              note.currentCue = currentCue;
              p.song.addCue(time, p[callbackName], note);
              lastTicks = ticks;
              currentCue++;
          }
      }
  }

  /** 
   * Preload function - Loading audio and setting up MIDI
   * This runs first, before setup()
   */
  p.preload = () => {
      p.song = p.loadSound(audio, (sound) => {
          p.audioSampleRate = sound.sampleRate();
          p.totalAnimationFrames = Math.floor(sound.duration() * 60);
          p.loadMidi();
      });
      p.song.onended(() => {
          p.songHasFinished = true;
          if (p.canvas) {
              p.canvas.classList.add('p5Canvas--cursor-play');
              p.canvas.classList.remove('p5Canvas--cursor-pause');
          }
          if (p.captureEnabled && p.captureInProgress) {
            p.captureInProgress = false;
            p.downloadFrames();
          }
      });
  };

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
    p.canvas.style.position = 'relative';
    p.canvas.style.zIndex = '1';
    p.colorPalette = p.generatePalette();
    
    for (let i = 0; i < 19; i++) {
      const color = i ===  18 ? p.colorPalette.dark[0] : p.colorPalette.dark[i];
      const baseColor = [
        p.red(color),
        p.green(color),
        p.blue(color),
        220
      ];
      const depthOffset = -i * 2400;
      p.circleSets.push(new CircleSet(p, baseColor, 800, depthOffset));
    }
    
    p.circleSet = p.circleSets[0];
  };

  p.draw = () => {
    if (p.cameraAnimation && p.song) {
      const currentTime = p.song.currentTime();
      const elapsed = currentTime - p.cameraAnimation.startTime;
      const progress = Math.min(elapsed / p.cameraAnimation.duration, 1);
      
      const easedProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      p.cameraZOffset = p.lerp(p.cameraAnimation.startZ, p.cameraAnimation.targetZ, easedProgress);
      
      if (progress >= 1) {
        p.cameraAnimation = null;
      }
    }

    p.background(0, 0);
    
    p.ambientLight(60, 60, 60);
    p.directionalLight(255, 255, 255, 0.5, 0.5, -1);
    p.orbitControl();
    p.resetMatrix();
    p.translate(-p.width / 2, -p.height / 2, p.cameraZOffset);

    if (p.circleSet) {
      p.circleSet.update();
      p.circleSet.show();
    }
  };

  p.executeTrack1 = (note) => {
    const { currentCue, durationTicks, time } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);

    console.log(currentCue);
    

    if (duration < 0.5) {
      p.currentCircleSetIndex = (p.currentCircleSetIndex + 1) % p.circleSets.length;
      p.circleSet = p.circleSets[p.currentCircleSetIndex];
      return;
    }

    const totalDepth = 2400;
    const targetZ = p.cameraZOffset + totalDepth;
    
    p.cameraAnimation = {
      startTime: time,
      duration: duration,
      startZ: p.cameraZOffset,
      targetZ: targetZ
    };
  };

   p.executeTrack2 = (note) => {
    const { currentCue, durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
  };

  p.generatePalette = () => {
    const darkPalette = p.randomColor({ count: 18, luminosity: 'dark' });
    p.shuffle(darkPalette);

    const lightPalette = p.randomColor({ count: 18, luminosity: 'light' });
    p.shuffle(lightPalette);

    return { dark: darkPalette, light: lightPalette };
  };

  /**
   * Handle mouse/touch interaction - toggle night mode
   */
  p.mousePressed = () => {
    if(p.audioLoaded){
      if (p.captureEnabled) {
        p.startCapture();
        return;
      } else if (p.song.isPlaying()) {
          p.song.pause();
          p.canvas.classList.add('p5Canvas--cursor-play');
          p.canvas.classList.remove('p5Canvas--cursor-pause');
      } else {
          if (parseInt(p.song.currentTime()) >= parseInt(p.song.buffer.duration)) {
              /** 
               * Reset animation properties here
               */
          }
          document.getElementById("play-icon").classList.remove("fade-in");
          p.song.play();
          p.showingStatic = false;
          p.canvas.classList.add('p5Canvas--cursor-pause');
          p.canvas.classList.remove('p5Canvas--cursor-play');
      }
    }
  }

  /**
   * Handles key press events
   * and saves the sketch as a PNG
   * if the user presses Ctrl + S
   */
  p.keyPressed = () => {
    if (p.keyIsDown(p.CONTROL) && p.key === 's') {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      p.save(`sketch-3_${timestamp}.png`);
      return false;
    }
  };

  /**
   * Resize the canvas when the window is resized
   * and redraw
   */
  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

};

const generateGalaxyGradient = () => {
  const keyColors = [
    { r: 0, g: 0, b: 0 },           // Deep black
    { r: 10, g: 5, b: 30 },         // Deep purple-black
    { r: 20, g: 10, b: 60 },        // Rich purple
    { r: 40, g: 20, b: 100 },       // Vibrant purple
    { r: 80, g: 40, b: 150 },       // Magenta-purple
    { r: 120, g: 60, b: 200 },      // Bright purple
    { r: 150, g: 100, b: 255 },     // Light purple-blue
    { r: 100, g: 150, b: 255 },     // Cyan-blue
    { r: 0, g: 200, b: 255 },       // Bright cyan
    { r: 0, g: 255, b: 255 },       // Pure cyan
    { r: 255, g: 0, b: 200 },       // Hot pink
    { r: 200, g: 0, b: 150 },       // Deep magenta
    { r: 100, g: 0, b: 100 },       // Dark magenta
  ];
  
  const selectedColors = [];
  const numKeyColors = 5 + Math.floor(Math.random() * 4);
  
  for (let i = 0; i < numKeyColors; i++) {
    selectedColors.push(keyColors[Math.floor(Math.random() * keyColors.length)]);
  }
  
  const numStops = 40 + Math.floor(Math.random() * 20);
  const stops = [];
  
  for (let i = 0; i < numStops; i++) {
    const t = i / (numStops - 1);
    const colorIndex = t * (selectedColors.length - 1);
    const colorIndexFloor = Math.floor(colorIndex);
    const colorIndexCeil = Math.min(colorIndexFloor + 1, selectedColors.length - 1);
    const localT = colorIndex - colorIndexFloor;
    
    const color1 = selectedColors[colorIndexFloor];
    const color2 = selectedColors[colorIndexCeil];
    
    const r = Math.round(color1.r + (color2.r - color1.r) * localT);
    const g = Math.round(color1.g + (color2.g - color1.g) * localT);
    const b = Math.round(color1.b + (color2.b - color1.b) * localT);
    
    const alpha = 0.85 + Math.sin(t * Math.PI) * 0.15;
    const position = t * 100;
    
    const colorStr = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    stops.push(`${colorStr} ${position.toFixed(2)}%`);
  }
  
  return `linear-gradient(180deg, ${stops.join(', ')})`;
};

document.documentElement.style.setProperty('--gradient-bg', generateGalaxyGradient());

new p5(sketch);
