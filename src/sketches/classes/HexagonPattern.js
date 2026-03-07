const rac3 = Math.sqrt(3);
export const rac3s2 = rac3 / 2;

export const RADIUS_MINI = 0.003;
export const RADIUS_MAXI = 0.006;
export const DHUE = 1;

export function getKey(kx, ky) {
  return `${kx}:${ky}`;
}

export const dneighbors = [
  { dx: 1, dy: 1 },
  { dx: -1, dy: 2 },
  { dx: -2, dy: 1 },
  { dx: -1, dy: -1 },
  { dx: 1, dy: -2 },
  { dx: 2, dy: -1 },
];

export function rot60(k) {
  return { kx: -k.ky, ky: k.kx + k.ky };
}

export function symm(k) {
  return { kx: k.kx + k.ky, ky: -k.ky };
}

export class Hexagon {
  constructor(p, kx, ky, radiush, radius) {
    this.kx = kx;
    this.ky = ky;
    this.key = getKey(kx, ky);
    const maxx = p.width;
    const maxy = p.height;
    this.c = {
      x: maxx / 2 + ky * radiush * rac3s2,
      y: maxy / 2 - (kx + 0.5 * ky) * radiush,
    };
    this.isVisible =
      this.c.x >= -radius &&
      this.c.x <= maxx + radius &&
      this.c.y >= -radius &&
      this.c.y <= maxy + radius;
  }
}

export class Group extends Map {
  constructor(p, kx, ky, radiush, radius) {
    super();
    let key = "z";
    const addhex = (h) => {
      if (h.key < key) key = h.key;
      if (h.isVisible) this.set(h.key, h);
    };
    const points = [{ kx, ky }];
    for (let i = 0; i < 5; i++) points.push(rot60(points[points.length - 1]));
    for (let i = 0; i < 6; i++) {
      addhex(new Hexagon(p, points[i].kx, points[i].ky, radiush, radius));
    }
    for (let i = 0; i < 6; i++) {
      const n = symm(points[i]);
      addhex(new Hexagon(p, n.kx, n.ky, radiush, radius));
    }
    this.key = key;
  }
}

export function arrayShuffle(arr) {
  for (let k = arr.length - 1; k >= 1; k--) {
    const k1 = Math.floor((k + 1) * Math.random());
    [arr[k], arr[k1]] = [arr[k1], arr[k]];
  }
  return arr;
}
