class Circle {
  constructor(p, x, y, r, z = 0, color = null, isMainCircle = false) {
    this.p = p;
    this.growing = true;
    this.x = x;
    this.y = y;
    this.r = r;
    this.z = z;
    this.color = color || p.color(255, 0, 175, 220);
    this.isMainCircle = isMainCircle;
    
    if (!isMainCircle && p.random() < 0.3) {
      const materials = ['ambient', 'specular', 'normal'];
      this.materialType = p.random(materials);
    } else {
      this.materialType = 'emissive';
    }
  }

  getMaterialColor() {
    const p = this.p;
    p.push();
    p.colorMode(p.RGB, 255);
    const colorArray = [p.red(this.color), p.green(this.color), p.blue(this.color), 220];
    p.pop();
    return colorArray;
  }

  edges() {
    const p = this.p;
    return (
      this.r > p.width - this.x ||
      this.r > this.x ||
      this.r > p.height - this.y ||
      this.r > this.y
    );
  }

  grow() {
    this.r += 0.5;
  }

  show() {
    const p = this.p;
    p.push();
    p.translate(this.x, this.y, this.z);

    p.noStroke();
    p.shininess(80);
    
    const materialFunction = `${this.materialType}Material`;
    const colorArray = this.getMaterialColor();
    
    if (this.materialType === 'normal') {
      p[materialFunction]();
    } else {
      p[materialFunction](...colorArray);
    }

    const tubeRadius = Math.max(this.r * 0.12, 1);
    p.torus(this.r, tubeRadius);
    p.fill(this.color);
    p.pop();
  }
}

export default Circle;

