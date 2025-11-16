class Circle {
  constructor(p, x, y, r, z = 0, color = [255, 0, 175, 220]) {
    this.p = p;
    this.growing = true;
    this.x = x;
    this.y = y;
    this.r = r;
    this.z = z;
    this.color = color;
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

    // Material palette — comment/uncomment a single line below to test.
    p.noStroke();
    p.shininess(80);
    p.emissiveMaterial(...this.color);
    // p.ambientMaterial(...this.color);
    // p.specularMaterial(...this.color);
    // p.normalMaterial();
    // p.noFill(); p.stroke(...this.color); p.strokeWeight(1);

    const tubeRadius = Math.max(this.r * 0.12, 1);
    p.torus(this.r, tubeRadius);
    p.pop();
  }
}

export default Circle;

