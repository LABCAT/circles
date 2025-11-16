import p5 from "p5";
import "p5/lib/addons/p5.sound";
import '@/lib/p5.randomColor.js';
import { Midi } from '@tonejs/midi';
import initCapture from '@/lib/p5.capture.js';
import Circle from "./classes/Circle.js";
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
    p.colorPalette = p.generatePalette();
    
    for (let i = 0; i < 18; i++) {
      const color = p.colorPalette.dark[i];
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

    p.background(0);
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
