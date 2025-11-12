export const sketchMetadata = {
  'number-8': {
    title: '#CirclesNo8',
    description: 'An exploration into generative circles.',
    sketch: 'CirclesNo8.js',
  },
};

export function getAllSketches() {
  return Object.keys(sketchMetadata).map(id => ({
    id,
    ...sketchMetadata[id]
  }));
}

export function getSketchById(id) {
  return sketchMetadata[id] || null;
}
