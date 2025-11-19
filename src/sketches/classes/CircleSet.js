import Circle from "./Circle.js";
import ColorGenerator from "@/lib/p5.colorGenerator.js";

class CircleSet {
  constructor(p, baseColor, depthRange = 800, depthOffset = 0) {
    this.p = p;
    this.baseColor = baseColor;
    
    const generator = new ColorGenerator(p, baseColor.toString());
    this.complementaryColor = generator.getComplementary()[1];
    
    this.depthRange = depthRange;
    this.depthOffset = depthOffset;
    this.circles = [];
    this.twinCircles = [];
    this.growthActive = true;
    
    const initialRadius = Math.min(p.width, p.height) / 3;
    this.circles.push(
      new Circle(
        p,
        p.width / 2,
        p.height / 2,
        initialRadius,
        depthOffset,
        baseColor,
        true
      )
    );
  }

  addCircle() {
    const x = this.p.random(this.p.width);
    const y = this.p.random(this.p.height);
    const z = this.p.random(-this.depthRange, 0) + this.depthOffset;
    
    const newCircle = new Circle(
      this.p,
      x,
      y,
      1,
      z,
      this.baseColor
    );
    
    for (let i = 0; i < this.circles.length; i++) {
      const other = this.circles[i];
      const d = this.p.dist(newCircle.x, newCircle.y, other.x, other.y);
      if (d < other.r + 4) {
        return false;
      }
    }
    
    this.circles.push(newCircle);
    
    let duplicateCircle = new Circle(
      this.p,
      x,
      y,
      1,
      z - this.depthRange,
      this.baseColor
    );
    this.twinCircles.push(duplicateCircle);

    duplicateCircle = new Circle(
      this.p,
      x,
      y,
      1,
      z - (this.depthRange * 2),
      this.baseColor
    );
    this.twinCircles.push(duplicateCircle);
    
    return true;
  }

  tryAddCircles(target) {
    let count = 0;
    for (let i = 0; i < 1000; i++) {
      if (this.addCircle()) {
        count++;
      }
      if (count === target) {
        break;
      }
    }
    return count;
  }

  update() {
    for (let i = 0; i < this.circles.length; i++) {
      const c = this.circles[i];
      const twin = this.twinCircles[i];
      
      if (this.growthActive && c.growing) {
        c.grow();
        if (twin) twin.grow();

        for (let j = 0; j < this.circles.length; j++) {
          const other = this.circles[j];
          if (other !== c) {
            const d = this.p.dist(c.x, c.y, other.x, other.y);
            if (d - 1 < c.r + other.r) {
              c.growing = false;
              if (twin) twin.growing = false;
              break;
            }
          }
        }

        if (c.growing) {
          const hitEdge = c.edges();
          c.growing = !hitEdge;
          if (twin) twin.growing = !hitEdge;
        }
      }
    }

    if (this.growthActive) {
      const target = 1 + this.p.constrain(this.p.floor(this.p.frameCount / 120), 0, 20);
      const count = this.tryAddCircles(target);

      if (count < 1) {
        this.growthActive = false;
        console.log("finished growing");
      }
    }
  }

  show() {
    for (let i = 0; i < this.circles.length; i++) {
      this.circles[i].show();
    }
    for (let i = 0; i < this.twinCircles.length; i++) {
      this.twinCircles[i].show();
    }
  }
}

export default CircleSet;

