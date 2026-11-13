// @ts-check
import { defineConfig } from 'astro/config';
import inject from '@rollup/plugin-inject';
import { astroAnimationsScssPrepend } from '@labcat2020/animation-lab/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://landscapes.labcat.nz',
  devToolbar: {
    enabled: false
  },
  base: '/',
  vite: {
    plugins: [
      inject({
        p5: ['p5', 'default'],
      }),
    ],
    resolve: {
      alias: {
        '@sketches': '/src/sketches',
        '@layouts': '/src/layouts',
        '@styles': '/src/styles',
        '@lib': '/src/lib',
        '@templates': '/src/templates',
        '@components': '/src/components',
        '@pages': '/src/pages',
        '@': '/src',
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: astroAnimationsScssPrepend(),
          silenceDeprecations: ['import', 'global-builtin']
        }
      }
    }
  },
});
