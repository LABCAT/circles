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
          const track1 = result.tracks[1].notes; // Combinator 2 - Dance Bass Kit
          const track2 = result.tracks[2].notes; // Combinator 3 - Vox Stack
          p.scheduleCueSet(track1, 'executeTrack1');
          p.scheduleCueSet(track2, 'executeTrack2');
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
    
    // Generate and set the galaxy gradient background
    document.documentElement.style.setProperty('--gradient-bg', p.generateGalaxyGradient());
    document.documentElement.style.setProperty('--gradient-blend-mode', 'hard-light, overlay, overlay, overlay, difference, difference, normal');
    
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

  p.generateGalaxyGradient = () => {

    // Weighted color generation - favor dark colors, use bright sparingly
    const generateDarkColor = () => {
      // Dark colors (high weight - 60% chance)
      const darkTypes = [
        // Dark teals/blues (very common in good examples)
        () => ({ r: 0, g: Math.floor(40 + p.random(60)), b: Math.floor(70 + p.random(80)) }),
        () => ({ r: 0, g: Math.floor(50 + p.random(50)), b: Math.floor(100 + p.random(60)) }),
        () => ({ r: 0, g: Math.floor(60 + p.random(50)), b: Math.floor(120 + p.random(50)) }),
        // Dark blues
        () => ({ r: Math.floor(20 + p.random(30)), g: 0, b: Math.floor(120 + p.random(100)) }),
        () => ({ r: Math.floor(30 + p.random(40)), g: Math.floor(50 + p.random(50)), b: Math.floor(130 + p.random(50)) }),
        // Dark reds/browns
        () => ({ r: Math.floor(60 + p.random(60)), g: 0, b: 0 }),
        () => ({ r: Math.floor(80 + p.random(40)), g: Math.floor(30 + p.random(30)), b: 0 }),
        () => ({ r: Math.floor(90 + p.random(30)), g: Math.floor(50 + p.random(20)), b: 0 })
      ];
      return darkTypes[Math.floor(p.random(darkTypes.length))]();
    };

    const generateMediumColor = () => {
      // Medium colors (30% chance)
      const mediumTypes = [
        // Medium teals/blues
        () => ({ r: 0, g: Math.floor(100 + p.random(80)), b: Math.floor(120 + p.random(60)) }),
        () => ({ r: 0, g: Math.floor(70 + p.random(80)), b: Math.floor(100 + p.random(80)) }),
        () => ({ r: Math.floor(30 + p.random(50)), g: Math.floor(100 + p.random(80)), b: Math.floor(150 + p.random(50)) }),
        // Medium magentas/pinks
        () => ({ r: Math.floor(150 + p.random(80)), g: Math.floor(100 + p.random(100)), b: Math.floor(150 + p.random(80)) })
      ];
      return mediumTypes[Math.floor(p.random(mediumTypes.length))]();
    };

    const generateBrightColor = () => {
      // Bright colors (10% chance - used sparingly as accents)
      const brightTypes = [
        // Bright magentas/pinks
        () => ({ r: Math.floor(220 + p.random(35)), g: 0, b: Math.floor(180 + p.random(75)) }),
        // Bright cyans
        () => ({ r: 0, g: Math.floor(150 + p.random(105)), b: Math.floor(200 + p.random(55)) }),
        // Bright greens (sparingly)
        () => ({ r: Math.floor(30 + p.random(50)), g: Math.floor(200 + p.random(55)), b: Math.floor(30 + p.random(50)) })
      ];
      return brightTypes[Math.floor(p.random(brightTypes.length))]();
    };

    const generateColor = (preferDark = false) => {
      // Weighted selection: 60% dark, 30% medium, 10% bright (unless preferDark)
      if (preferDark) {
        return p.random() < 0.8 ? generateDarkColor() : generateMediumColor();
      }
      const rand = p.random();
      if (rand < 0.6) return generateDarkColor();
      if (rand < 0.9) return generateMediumColor();
      return generateBrightColor();
    };

    const generateWhite = () => {
      // White is rare (5% chance when explicitly requested)
      return p.random() < 0.05 ? { r: 255, g: 255, b: 255 } : generateMediumColor();
    };

    const rgbToHex = (r, g, b) => {
      return `#${[r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('')}`;
    };

    const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;

    // Generate 7 gradient layers with vibrant, mystical colors
    const gradients = [];

    // Layer 1: Dark nebula glow with transparency fade (good examples use dark teals/blues)
    const color1 = generateColor(true); // Prefer dark for layer 1
    const alpha1 = 0.4 + p.random(0.25); // 0.4-0.65 opacity (slightly lower for darker feel)
    const angle1 = p.random(360);
    const fade1 = 30 + p.random(20);
    gradients.push(`linear-gradient(${angle1}deg, ${rgba(color1.r, color1.g, color1.b, alpha1)} 0%, rgba(0, 0, 0, 0) ${fade1}%)`);

    // Layer 2: Vertical gradient - MUST start dark (never white!)
    const color2a = generateColor(true); // Always dark start
    const color2b = p.random() < 0.7 ? generateMediumColor() : generateColor(true); // 70% medium, 30% dark
    gradients.push(`linear-gradient(180deg, ${rgbToHex(color2a.r, color2a.g, color2a.b)} 0%, ${rgbToHex(color2b.r, color2b.g, color2b.b)} 100%)`);

    // Layer 3: Multi-stop gradient - dark to medium to bright accent
    const color3a = generateColor(true); // Start dark
    const color3b = generateMediumColor();
    const color3c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor(); // 30% bright accent
    const angle3 = p.random(360);
    const stop3 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle3}deg, ${rgbToHex(color3a.r, color3a.g, color3a.b)} 0%, ${rgbToHex(color3b.r, color3b.g, color3b.b)} ${stop3}%, ${rgbToHex(color3c.r, color3c.g, color3c.b)} 100%)`);

    // Layer 4: Multi-stop gradient - dark to medium, white only 5% chance
    const color4a = generateColor(true); // Start dark
    const color4b = generateMediumColor();
    const color4c = generateWhite(); // Rare white, usually medium
    const angle4 = p.random(360);
    const stop4 = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle4}deg, ${rgbToHex(color4a.r, color4a.g, color4a.b)} 0%, ${rgbToHex(color4b.r, color4b.g, color4b.b)} ${stop4}%, ${rgbToHex(color4c.r, color4c.g, color4c.b)} 100%)`);

    // Layer 5: Radial gradient - dark to bright accent
    const color5a = generateColor(true); // Start dark
    const color5b = p.random() < 0.4 ? generateBrightColor() : generateMediumColor(); // 40% bright accent
    const size5 = 150 + p.random(100); // Slightly larger (150-250)
    const size5y = size5 * (1.8 + p.random(1.2)); // More elongated (1.8-3.0)
    const pos5x = p.random(100);
    const pos5y = p.random(100);
    gradients.push(`radial-gradient(${size5}% ${size5y}% at ${pos5x}% ${pos5y}%, ${rgbToHex(color5a.r, color5a.g, color5a.b)} 0%, ${rgbToHex(color5b.r, color5b.g, color5b.b)} 100%)`);

    // Layer 6: Multi-stop linear gradient - dark to medium to bright accent
    const color6a = generateColor(true); // Start dark
    const color6b = generateMediumColor();
    const color6c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor(); // 30% bright accent
    const angle6 = p.random(360);
    const stop6a = p.random(10);
    const stop6b = 40 + p.random(20);
    gradients.push(`linear-gradient(${angle6}deg, ${rgbToHex(color6a.r, color6a.g, color6a.b)} ${stop6a}%, ${rgbToHex(color6b.r, color6b.g, color6b.b)} ${stop6b}%, ${rgbToHex(color6c.r, color6c.g, color6c.b)} 100%)`);

    // Layer 7: Radial gradient with multiple stops - dark to medium, white rare
    const color7a = p.random() < 0.3 ? generateBrightColor() : generateColor(true); // 30% bright start
    const color7b = generateMediumColor();
    const color7c = generateWhite(); // Rare white
    const size7 = 120 + p.random(80); // 120-200
    const size7y = size7 * (1.2 + p.random(0.6)); // 1.2-1.8
    const pos7x = p.random(100);
    const pos7y = p.random(100);
    const stop7 = 40 + p.random(20);
    gradients.push(`radial-gradient(${size7}% ${size7y}% at ${pos7x}% ${pos7y}%, ${rgbToHex(color7a.r, color7a.g, color7a.b)} 0%, ${rgbToHex(color7b.r, color7b.g, color7b.b)} ${stop7}%, ${rgbToHex(color7c.r, color7c.g, color7c.b)} 100%)`);

    return gradients.join(', ');
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


new p5(sketch);
