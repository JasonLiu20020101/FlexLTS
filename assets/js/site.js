(function bootstrapFlexLTSSite(global) {
  'use strict';

  function wrapIndex(index, length) {
    if (!Number.isFinite(length) || length <= 0) return 0;
    return ((index % length) + length) % length;
  }

  function parseHash(hash) {
    if (typeof hash !== 'string') return null;
    const parts = hash.replace(/^#/, '').split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    try {
      const datasetId = decodeURIComponent(parts[0]);
      const sampleId = decodeURIComponent(parts[1]);
      return datasetId && sampleId ? { datasetId, sampleId } : null;
    } catch {
      return null;
    }
  }

  function buildHash(datasetId, sampleId) {
    return `#${encodeURIComponent(datasetId)}/${encodeURIComponent(sampleId)}`;
  }

  function configureVideo(video, source, fallbackLink, errorMessage, src) {
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    source.type = 'video/mp4';
    source.src = src;
    fallbackLink.href = src;
    video.append(source);
    video.addEventListener('error', () => {
      errorMessage.hidden = false;
    });
  }

  function releaseVideos(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return;
    container.querySelectorAll('video').forEach((video) => {
      video.pause();
      video.removeAttribute('src');
      video.querySelectorAll('source').forEach((source) => source.removeAttribute('src'));
      video.load();
    });
  }

  function configurePaperLink(link, paperUrl) {
    if (!link || typeof paperUrl !== 'string' || !paperUrl.trim()) return false;
    link.href = paperUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.classList.remove('is-disabled');
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    const note = link.querySelector('.button-note');
    if (note) note.textContent = 'View paper';
    return true;
  }

  function configureOptionalSection(section, visible) {
    if (!section) return false;
    section.hidden = !visible;
    return visible;
  }

  function createElement(documentRef, tagName, className, text) {
    const element = documentRef.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createTranscriptPanel(documentRef, dataset, sample) {
    const paired = dataset.id === 'real-world';
    const panel = createElement(
      documentRef,
      'div',
      `transcript-panel${paired ? ' transcript-panel--paired' : ''}`,
    );

    const addTranscript = (label, value, modifier = '') => {
      const item = createElement(
        documentRef,
        'div',
        `transcript-item${modifier ? ` transcript-item--${modifier}` : ''}`,
      );
      item.append(
        createElement(documentRef, 'span', 'transcript-label', label),
        createElement(documentRef, 'p', 'transcript-text', value),
      );
      panel.append(item);
    };

    addTranscript(paired ? 'Ground-truth transcript' : 'Transcript', sample.transcript);
    if (paired) addTranscript('VSR transcript', sample.vsrTranscript, 'vsr');
    return panel;
  }

  function createVideoCard(documentRef, videoDefinition) {
    const card = createElement(
      documentRef,
      'article',
      `video-card video-card--${videoDefinition.group}`,
    );
    const header = createElement(documentRef, 'div', 'video-card-header');
    const badgeLabels = {
      'ground-truth': 'Reference',
      ours: 'FlexLTS',
      baseline: 'Baseline',
    };
    header.append(
      createElement(documentRef, 'span', 'method-name', videoDefinition.label),
      createElement(
        documentRef,
        'span',
        'method-badge',
        badgeLabels[videoDefinition.group] || 'Method',
      ),
    );

    const frame = createElement(documentRef, 'div', 'video-frame');
    const video = createElement(documentRef, 'video');
    const source = createElement(documentRef, 'source');
    const errorMessage = createElement(documentRef, 'p', 'video-error');
    const fallbackLink = createElement(documentRef, 'a', '', 'Open the video directly');
    video.setAttribute('aria-label', `${videoDefinition.label} result video`);
    fallbackLink.target = '_blank';
    fallbackLink.rel = 'noopener noreferrer';
    errorMessage.hidden = true;
    errorMessage.append('This video could not be loaded. ', fallbackLink, '.');
    configureVideo(video, source, fallbackLink, errorMessage, videoDefinition.src);
    frame.append(video);
    card.append(header, frame, errorMessage);
    return card;
  }

  function createToolbar(documentRef, dataset, selectedIndex, onSelect) {
    const toolbar = createElement(documentRef, 'div', 'demo-toolbar');
    const picker = createElement(documentRef, 'div', 'sample-picker');
    const selectId = `${dataset.id}-sample-select`;
    const label = createElement(documentRef, 'label', '', `Choose a ${dataset.title} sample`);
    label.htmlFor = selectId;

    const select = createElement(documentRef, 'select', 'sample-select');
    select.id = selectId;
    dataset.samples.forEach((sample, index) => {
      const option = createElement(
        documentRef,
        'option',
        '',
        `${sample.label} — ${sample.id}`,
      );
      option.value = String(index);
      select.append(option);
    });
    select.value = String(selectedIndex);
    select.addEventListener('change', () => onSelect(Number(select.value), true));
    picker.append(label, select);

    const navigation = createElement(documentRef, 'div', 'sample-navigation');
    const previous = createElement(documentRef, 'button', 'sample-button', '← Previous');
    const counter = createElement(documentRef, 'span', 'sample-counter');
    const next = createElement(documentRef, 'button', 'sample-button', 'Next →');
    previous.type = 'button';
    next.type = 'button';
    previous.setAttribute('aria-label', `Show previous ${dataset.title} sample`);
    next.setAttribute('aria-label', `Show next ${dataset.title} sample`);
    counter.setAttribute('aria-live', 'polite');
    previous.addEventListener('click', () => onSelect(Number(select.value) - 1, true));
    next.addEventListener('click', () => onSelect(Number(select.value) + 1, true));
    navigation.append(previous, counter, next);
    toolbar.append(picker, navigation);

    return { toolbar, select, counter };
  }

  function mountDataset(documentRef, globalRef, mount, dataset, initialSampleId) {
    const initialIndex = Math.max(
      0,
      dataset.samples.findIndex(({ id }) => id === initialSampleId),
    );
    const content = createElement(documentRef, 'div', 'demo-content');
    let selectedIndex = initialIndex;
    let controls;

    function render(nextIndex, updateHash) {
      selectedIndex = wrapIndex(nextIndex, dataset.samples.length);
      const sample = dataset.samples[selectedIndex];
      controls.select.value = String(selectedIndex);
      controls.counter.textContent = `${selectedIndex + 1} / ${dataset.samples.length}`;

      releaseVideos(content);
      const transcriptPanel = createTranscriptPanel(documentRef, dataset, sample);
      const grid = createElement(documentRef, 'div', 'video-grid');
      grid.dataset.layout = dataset.id === 'real-world' ? 'real-world' : 'benchmark';
      grid.setAttribute('aria-label', `${dataset.title} method comparisons for ${sample.label}`);
      sample.videos.forEach((videoDefinition) => {
        grid.append(createVideoCard(documentRef, videoDefinition));
      });
      content.replaceChildren(transcriptPanel, grid);

      if (updateHash && globalRef.history && globalRef.location) {
        globalRef.history.replaceState(
          null,
          '',
          buildHash(dataset.id, sample.id),
        );
      }
    }

    controls = createToolbar(documentRef, dataset, selectedIndex, render);
    mount.replaceChildren(controls.toolbar, content);
    render(selectedIndex, false);
    return { render, release: () => releaseVideos(content) };
  }

  function initialize(
    documentRef = global.document,
    data = global.FLEXLTS_DATA,
    config = global.FLEXLTS_CONFIG || {},
  ) {
    if (!documentRef) return [];
    if (!data || !Array.isArray(data.datasets)) {
      documentRef.querySelectorAll('.demo-mount').forEach((mount) => {
        mount.textContent = 'Demo data is unavailable. Please reload the page.';
      });
      return [];
    }

    configurePaperLink(
      documentRef.getElementById('paper-link'),
      config.paperUrl ?? data.paperUrl,
    );
    configureOptionalSection(
      documentRef.getElementById('method-overview'),
      config.showModelFigure !== false,
    );
    const initialHash = global.location ? parseHash(global.location.hash) : null;
    const mounted = [];
    documentRef.querySelectorAll('.demo-mount[data-dataset]').forEach((mount) => {
      const dataset = data.datasets.find(({ id }) => id === mount.dataset.dataset);
      if (!dataset) {
        mount.textContent = 'This dataset could not be found.';
        return;
      }
      const initialSampleId = initialHash?.datasetId === dataset.id
        ? initialHash.sampleId
        : null;
      mounted.push(mountDataset(documentRef, global, mount, dataset, initialSampleId));
    });

    if (typeof global.addEventListener === 'function') {
      global.addEventListener('pagehide', () => {
        mounted.forEach(({ release }) => release());
      }, { once: true });
    }
    return mounted;
  }

  global.FlexLTSSite = {
    wrapIndex,
    parseHash,
    buildHash,
    configureVideo,
    releaseVideos,
    configurePaperLink,
    configureOptionalSection,
    initialize,
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', () => initialize());
    } else {
      initialize();
    }
  }
}(typeof window === 'undefined' ? globalThis : window));
