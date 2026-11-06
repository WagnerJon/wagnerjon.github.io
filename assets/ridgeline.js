(() => {
  const footer = document.querySelector('[data-ridgeline]');
  const scene = footer?.querySelector('.footer-scene');
  const canvas = scene?.querySelector('canvas');
  const context = canvas?.getContext('2d');
  if (!context) return;

  // The fixed, low-resolution canvas gives the Bayer pattern its printed texture.
  const { width, height } = canvas;
  const layerCount = 7;
  const seed = 23;
  const duration = 4200;
  const palette = ['f8f7f4', 'eae4f3', 'd5c7e7', 'b49dce', '8b70ac', '624883', '382653']
    .map((color) => color.match(/../g).map((channel) => parseInt(channel, 16)));
  const bayer = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
  ].map((step) => (step + 0.5) / 64);

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const ease = (progress) => 1 - (1 - clamp(progress)) ** 3;

  function smooth(low, high, value) {
    const t = clamp((value - low) / (high - low));
    return t * t * (3 - 2 * t);
  }

  function hash(x, y, key) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(key, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function noise(x, y, key) {
    const left = Math.floor(x);
    const top = Math.floor(y);
    const u = smooth(0, 1, x - left);
    const v = smooth(0, 1, y - top);
    const a = hash(left, top, key);
    const b = hash(left + 1, top, key);
    const c = hash(left, top + 1, key);
    const d = hash(left + 1, top + 1, key);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fractal(x, y, key) {
    return (
      4 * noise(x, y, key) +
      2 * noise(x * 2.03, y * 2.03, key + 31) +
      noise(x * 4.1209, y * 4.1209, key + 62)
    ) / 7;
  }

  function makeRidge(index) {
    const depth = index / (layerCount - 1);
    const base = height * (0.38 + 0.66 * depth ** 1.4);
    const amplitude = height * (0.2 + 0.24 * depth);
    const frequency = 6 - 3.8 * depth;
    const flank = height * 0.5 * depth ** 3;
    const left = flank * (0.55 + 0.6 * hash(index, 11, seed));
    const right = flank * (0.55 + 0.6 * hash(index, 13, seed));
    const tilt = (hash(index, 7, seed) - 0.5) * height * 0.34 * (0.4 + depth);
    const key = seed * 13 + index * 101;
    const crest = new Float32Array(width);
    const slope = new Float32Array(width);
    const pool = new Float32Array(width);
    const ceiling = 39;

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const large = 1 - Math.abs(noise(u * frequency + index * 3.7, 0.5, key) * 2 - 1);
      const small = 1 - Math.abs(noise(u * frequency * 2.3, 3.5, key + 1) * 2 - 1);
      const peaks = large * large * 0.62 + small * 0.24 + fractal(u * frequency * 4.1, 9.5, key + 2) * 0.14;
      const edge = Math.abs(u * 2 - 1);
      const y = base - peaks * amplitude + tilt * (u - 0.5) * 2 - (u < 0.5 ? left : right) * edge ** 2.5;
      crest[x] = Math.max(y, ceiling + (y - ceiling) * 0.2);
      pool[x] = height * (0.08 + 0.42 * depth) * (0.45 + 1.1 * fractal(u * 4, index * 5.3, seed + 9));
    }
    for (let x = 0; x < width; x++) {
      const gradient = (crest[Math.min(width - 1, x + 2)] - crest[Math.max(0, x - 2)]) * 0.06;
      slope[x] = Math.max(-0.2, Math.min(0.2, gradient));
    }

    return { crest, slope, pool, depth, tone: 0.16 + 0.76 * depth ** 1.6, reveal: 0, rise: 0 };
  }

  function develop(animated) {
    const ridges = Array.from({ length: layerCount }, (_, index) => makeRidge(index));
    const image = context.createImageData(width, height);
    image.data.fill(255);
    const fogWidth = Math.ceil(width / 2);
    const fogHeight = Math.ceil(height / 2);
    const fog = new Float32Array(fogWidth * fogHeight);

    function draw(age) {
      const drift = age * 0.00006;
      const lift = 1 - ease((age - 900) / 1800);
      for (let y = 0; y < fogHeight; y++) {
        const ny = y * 4.4 / height;
        for (let x = 0; x < fogWidth; x++) {
          const nx = x * 9 / width + drift;
          const warp = noise(nx * 0.45 - drift * 0.6, ny * 0.8, 77) * 0.6;
          fog[y * fogWidth + x] = smooth(0.3, 0.74, fractal(nx + warp, ny + warp * 0.4, 31));
        }
      }

      for (const [index, ridge] of ridges.entries()) {
        ridge.reveal = ease((age - 260 - index * 150) / 1200);
        ridge.rise = (1 - ridge.reveal) * height * 0.09;
      }

      for (let y = 0; y < height; y++) {
        const fade = smooth(0, 64, y);
        const fogRow = (y >> 1) * fogWidth;
        for (let x = 0; x < width; x++) {
          let tone = 0.04 * smooth(height * 0.15, height * 0.6, y);
          let mist = 0.24;
          for (let index = layerCount - 1; index >= 0; index--) {
            const ridge = ridges[index];
            if (ridge.reveal <= 0) continue;
            const below = y - ridge.crest[x] - ridge.rise;
            if (below < 0) continue;
            const depth = ridge.pool[x];
            tone = ridge.tone * (1 - smooth(0, depth, below) * (0.88 - 0.45 * ridge.depth));
            tone += ridge.slope[x] * (1 - smooth(0, depth * 0.5, below));
            tone += (hash(x + Math.round(ridge.crest[x] * 7), Math.floor(below), index) - 0.5) * 0.07 * ridge.depth;
            tone *= ridge.reveal;
            mist = 0.8 * (0.95 - 0.5 * ridge.depth);
            break;
          }

          const fogTone = clamp(fog[fogRow + (x >> 1)] * mist + lift * 0.55);
          const faded = clamp((Math.min(tone, 0.93) * (1 - fogTone) + 0.09 * fogTone * (1 - lift)) * fade);
          const threshold = bayer[(y & 7) * 8 + (x & 7)];
          const color = palette[Math.floor(faded * (palette.length - 1) + threshold)];
          const offset = (y * width + x) * 4;
          image.data[offset] = color[0];
          image.data[offset + 1] = color[1];
          image.data[offset + 2] = color[2];
        }
      }
      context.putImageData(image, 0, 0);
    }

    if (!animated) {
      draw(duration);
      return;
    }

    let started;
    let previousFrame = -Infinity;
    function frame(now) {
      started ??= now;
      const age = Math.min(now - started, duration);
      if (now - previousFrame >= 32 || age === duration) {
        draw(age);
        previousFrame = now;
      }
      if (age < duration) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    develop(false);
    return;
  }

  const reveal = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    footer.classList.add('footer-visible');
    reveal.disconnect();
  }, { threshold: 0.1 });

  const landscape = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    develop(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    landscape.disconnect();
  }, { threshold: 0.1 });

  reveal.observe(footer);
  landscape.observe(scene);
})();
