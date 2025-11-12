import p5 from "p5";
import "p5/lib/addons/p5.sound";
import '@/lib/p5.randomColor.js';
import { Midi } from '@tonejs/midi';
import initCapture from '@/lib/p5.capture.js';
import Circle from "./classes/Circle.js";

const base = import.meta.env.BASE_URL || './';
// const audio = base + 'audio/LandscapesNo2.mp3';
// const midi = base + 'audio/LandscapesNo2.mid';

const sketch = (p) => {
  const circles = [];
  const depthRange = 800;
  let growthActive = true;

  const addCircle = () => {
    const newCircle = new Circle(
      p,
      p.random(p.width),
      p.random(p.height),
      1,
      // 0
      -200 + p.random(-depthRange / 2, depthRange / 2)
    );
    for (let i = 0; i < circles.length; i++) {
      const other = circles[i];
      const d = p.dist(newCircle.x, newCircle.y, other.x, other.y);
      if (d < other.r + 4) {
        return false;
      }
    }
    circles.push(newCircle);
    return true;
  };

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
  
  /** 
   * MIDI loading and processing
   * Handles synchronization between audio and visuals
   */
  p.loadMidi = () => {
      Midi.fromUrl(midi).then((result) => {
          console.log('MIDI loaded:', result);
          const track1 = result.tracks[0].notes; 
          const track2 = result.tracks[1].notes; 
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
  // p.preload = () => {
  //     p.song = p.loadSound(audio, (sound) => {
  //         p.audioSampleRate = sound.sampleRate();
  //         p.totalAnimationFrames = Math.floor(sound.duration() * 60);
  //         p.loadMidi();
  //     });
  //     p.song.onended(() => {
  //         p.songHasFinished = true;
  //         if (p.canvas) {
  //             p.canvas.classList.add('p5Canvas--cursor-play');
  //             p.canvas.classList.remove('p5Canvas--cursor-pause');
  //         }
  //         if (p.captureEnabled && p.captureInProgress) {
  //           p.captureInProgress = false;
  //           p.downloadFrames();
  //         }
  //     });
  // };

  p.setup = () => {
    p.createCanvas(window.innerWidth, window.innerHeight, p.WEBGL);
    p.drawingContext.lineCap = 'round';
    p.colorPalette = p.generatePalette();
    document.getElementById("loader").classList.add("loading--complete");
    document.getElementById('play-icon').classList.add('fade-in');
    circles.push(
      new Circle(
        p,
        p.width / 2,
        p.height / 2,
        Math.min(p.width, p.height) / 3,
        0
      )
    );
  };

  p.draw = () => {
    p.background(0);
    p.ambientLight(60, 60, 60);
    p.directionalLight(255, 255, 255, 0.5, 0.5, -1);
    p.orbitControl();
    p.resetMatrix();
    p.translate(-p.width / 2, -p.height / 2);

    for (let i = 0; i < circles.length; i++) {
      const c = circles[i];
      c.show();

      if (growthActive && c.growing) {
        c.grow();

        for (let j = 0; j < circles.length; j++) {
          const other = circles[j];
          if (other !== c) {
            const d = p.dist(c.x, c.y, other.x, other.y);
            if (d - 1 < c.r + other.r) {
              c.growing = false;
              break;
            }
          }
        }

        if (c.growing) {
          c.growing = !c.edges();
        }
      }
    }

    if (growthActive) {
      const target = 1 + p.constrain(p.floor(p.frameCount / 120), 0, 20);
      let count = 0;

      for (let i = 0; i < 1000; i++) {
        if (addCircle()) {
          count++;
        }
        if (count === target) {
          break;
        }
      }

      if (count < 1) {
        growthActive = false;
        console.log("finished growing");
      }
    }
  };

  p.executeTrack1 = (note) => {
    const { durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
  };

   p.executeTrack2 = (note) => {
    const { currentCue, durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
  };

  p.generatePalette = () => {
    const darkPalette = p.randomColor({ count: 12, luminosity: 'dark' });
    p.shuffle(darkPalette);

    const lightPalette = p.randomColor({ count: 12, luminosity: 'light' });
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
          p.currentLandscapes = p.landscapes[0];
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
