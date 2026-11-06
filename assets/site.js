const specimen = document.querySelector('[data-specimen]');

if (specimen) {
  const switcher = specimen.querySelector('[data-specimen-switch]');
  const image = specimen.querySelector('[data-specimen-image]');
  const label = specimen.querySelector('[data-specimen-label]');
  const views = {
    reconstruction: {
      src: 'assets/organoid-reconstruction.webp',
      alt: 'Cluster of reconstructed organoid cells, with each cell in a different color',
      label: 'Reconstructed cell surfaces',
    },
    shape: {
      src: 'assets/organoid-shape-space.webp',
      alt: 'Reconstructed cell surfaces arranged by shape similarity in a UMAP embedding',
      label: 'Cell shapes arranged by similarity',
    },
  };

  for (const button of switcher.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      const view = views[button.dataset.view];
      image.src = view.src;
      image.alt = view.alt;
      label.textContent = view.label;
      switcher.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
    });
  }

  switcher.hidden = false;
}

const stack = document.querySelector('[data-stack]');

if (stack) {
  const controls = stack.querySelector('[data-stack-controls]');
  const source = stack.querySelector('[data-stack-source]');
  const frame = stack.querySelector('canvas');
  const fallback = stack.querySelector('[data-stack-fallback]');
  const depth = stack.querySelector('input[type="range"]');
  const depthLabel = stack.querySelector('output');
  const mode = stack.querySelector('select');
  const context = frame.getContext('2d');

  function draw() {
    const projection = mode.value === 'projection';
    const index = projection ? 64 : Number(depth.value) - 1;
    context.drawImage(source, (index % 8) * 64, Math.floor(index / 8) * 64, 64, 64, 0, 0, 64, 64);
    depth.disabled = projection;
    depthLabel.value = projection ? 'All 64 planes' : `Plane ${depth.value} of 64`;
    frame.setAttribute('aria-label', projection ? 'Maximum-intensity projection of the synthetic volume' : `Cross-section at Z plane ${depth.value} of 64`);
  }

  function enableStack() {
    if (!context || !source.naturalWidth) return;
    draw();
    frame.hidden = false;
    fallback.hidden = true;
    controls.hidden = false;
    depth.addEventListener('input', draw);
    mode.addEventListener('change', draw);
  }

  if (source.complete) enableStack();
  else source.addEventListener('load', enableStack, { once: true });
}
