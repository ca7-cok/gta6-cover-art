// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo;
// ?shot=cover shows the cover alone at an export size. Query params:
// photo (boulevard|pier), caption (title), subtitle, layout, grade, size
// (square|portrait|wide). window.__shotReady is set once painted.
export async function runShot(shot, query, state, photos, loadImage, render, sync) {
  const photoName = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'Neon Coast';
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'vice';
  const size = query.get('size') ?? 'square';
  state.title = caption;
  state.subtitle = subtitle;
  if (layout) state.layout = layout;
  if (grade) state.grade = grade;
  if (size) state.size = size;
  const other = photoName === 'pier' ? 'boulevard' : 'pier';
  try {
    photos[0] = await loadImage(`samples/${photoName}.jpg`);
    photos[1] = await loadImage(`samples/${other}.jpg`);
  } catch {
    // A missing sample still leaves a graded title band to screenshot.
  }
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
  if (sync) sync();
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
