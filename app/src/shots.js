// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the cover alone, sized by ?w= and ?h=.
// `layout`, `grade`, `photo` and `caption` pick the scene. window.__shotReady
// is set once the cover has been painted (and the webfonts have loaded).
export async function runShot(shot, query, api) {
  const layout = query.get('layout') ?? 'diagonal';
  const grade = query.get('grade') ?? 'neon';
  const photo = query.get('photo') ?? 'boulevard';
  const caption = query.get('caption') ?? 'MIDNIGHT RUN';
  const subtitle = query.get('subtitle') ?? 'one last score after dark';
  const tag = query.get('tag') ?? 'VICE CITY · 2 AM';
  const heat = Number(query.get('heat') ?? '4');

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const w = Number(query.get('w') ?? '1920');
    const h = Number(query.get('h') ?? '1080');
    const canvas = document.getElementById('cover');
    canvas.width = w;
    canvas.height = h;
  }
  await document.fonts.ready;
  await api.applyShot({ layout, grade, title: caption, subtitle, tag, photo, heat });
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
