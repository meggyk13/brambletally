import { error } from '../../lib/http.js';
import { requireProject } from '../../lib/projects.js';

const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

function fmtDur(min) {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m ? m + 'm' : '');
}
const fmtDate = (d) => (d ? esc(String(d).slice(0, 10)) : '');

const PAGE_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    max-width: 42rem; margin: 2rem auto; padding: 0 1.25rem;
    font: 15px/1.6 "Iowan Old Style", Georgia, "Times New Roman", serif;
    color: #23202b; background: #fff;
  }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  h2 {
    font-size: 1rem; text-transform: uppercase; letter-spacing: .06em;
    color: #6a6472; margin: 1.75rem 0 .6rem; border-bottom: 1px solid #e3dfe8; padding-bottom: .2rem;
  }
  .meta { color: #6a6472; font-size: .9rem; margin-bottom: .25rem; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: .3rem 1.5rem; margin: .5rem 0; }
  .stats div { font-size: .95rem; }
  .stats b { font-weight: 600; }
  ul.steps { list-style: none; padding-left: 0; margin: 0; }
  ul.steps ul { list-style: none; padding-left: 1.5rem; }
  li.step { margin: .2rem 0; }
  li.step .box { font-family: system-ui, sans-serif; margin-right: .4rem; }
  li.step.done > .line { color: #8a8592; text-decoration: line-through; }
  li.step .note { color: #6a6472; font-size: .88rem; margin: 0 0 .2rem 1.9rem; }
  li.step .tag { color: #6a6472; font-size: .85rem; }
  table { border-collapse: collapse; width: 100%; font-size: .93rem; }
  th, td { text-align: left; padding: .35rem .5rem; border-bottom: 1px solid #e8e5ee; }
  th { color: #6a6472; font-weight: 600; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 600; border-top: 2px solid #d9d5e0; border-bottom: none; }
  .links a, .journal a { color: #5a4b8a; }
  .journal-entry { margin: .6rem 0; }
  .journal-entry .when { color: #6a6472; font-size: .82rem; }
  .toolbar { margin: 0 0 1rem; font-family: system-ui, sans-serif; font-size: .85rem; }
  .toolbar a { color: #5a4b8a; }
  @media print {
    body { margin: 0; max-width: none; }
    .toolbar { display: none; }
    h2 { break-after: avoid; }
    li.step, tr, .journal-entry { break-inside: avoid; }
  }
`;

// GET /api/projects/:id/print — a standalone, print-friendly HTML page for the
// project. Viewer+ access. The journal is left out unless ?journal=1.
export async function onRequestGet(context) {
  const { id } = context.params;
  const g = await requireProject(context, id, 'viewer');
  if (g.fail) return g.fail;

  const db = context.env.DB;
  const url = new URL(context.request.url);
  const withJournal = url.searchParams.get('journal') === '1';

  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  if (!project) return error(404, 'Project not found');

  const [owner, steps, supplies, links, collaborators, journal] = await Promise.all([
    db.prepare('SELECT display_name, name FROM users WHERE id = ?').bind(project.owner_id).first(),
    db
      .prepare('SELECT * FROM project_steps WHERE project_id = ? ORDER BY sort_order, created_at')
      .bind(id)
      .all()
      .then((r) => r.results),
    db.prepare('SELECT * FROM project_supplies WHERE project_id = ? ORDER BY created_at').bind(id).all().then((r) => r.results),
    db
      .prepare('SELECT * FROM project_links WHERE project_id = ? ORDER BY sort_order, created_at')
      .bind(id)
      .all()
      .then((r) => r.results),
    db
      .prepare(
        `SELECT pc.user_id, u.display_name, u.name FROM project_collaborators pc
           JOIN users u ON u.id = pc.user_id WHERE pc.project_id = ?`
      )
      .bind(id)
      .all()
      .then((r) => r.results),
    withJournal
      ? db
          .prepare(
            `SELECT j.text, j.created_at, u.display_name, u.name
               FROM project_journal j JOIN users u ON u.id = j.user_id
              WHERE j.project_id = ? ORDER BY j.created_at`
          )
          .bind(id)
          .all()
          .then((r) => r.results)
      : Promise.resolve([]),
  ]);

  const nameOf = (row) => (row && (row.display_name || row.name)) || 'Someone';
  const collabName = (uid) => {
    const c = collaborators.find((x) => x.user_id === uid);
    return c ? nameOf(c) : null;
  };

  const parentIds = new Set(steps.filter((s) => s.parent_step_id).map((s) => s.parent_step_id));
  const isLeaf = (s) => !parentIds.has(s.id);
  const leaves = steps.filter(isLeaf);
  const doneLeaves = leaves.filter((s) => s.completed);
  const openLeaves = leaves.filter((s) => !s.completed);
  const minsLeft = openLeaves.reduce((n, s) => n + (s.estimate_minutes || 0), 0);
  const minsTotal = leaves.reduce((n, s) => n + (s.estimate_minutes || 0), 0);
  const stamps = doneLeaves.map((s) => s.completed_at).filter(Boolean).sort();
  const pct = leaves.length ? Math.round((doneLeaves.length / leaves.length) * 100) : 0;

  const box = (checked) => (checked ? '&#9745;' : '&#9744;');
  const tagStr = (s) => {
    const asg = s.assignee_id ? collabName(s.assignee_id) : null;
    return [
      s.due_date ? 'due ' + fmtDate(s.due_date) : '',
      s.estimate_minutes ? '~' + fmtDur(s.estimate_minutes) : '',
      asg ? '→ ' + esc(asg) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  };
  const stepLiInner = (s, checked) => {
    const t = tagStr(s);
    return `<span class="line"><span class="box">${box(checked)}</span>${esc(s.title)}${
      t ? ` <span class="tag">${t}</span>` : ''
    }</span>${s.notes ? `<div class="note">${esc(s.notes)}</div>` : ''}`;
  };
  const stepLi = (s, kids) => {
    const checked = kids.length ? kids.every((k) => k.completed) : !!s.completed;
    return `<li class="step${checked ? ' done' : ''}">${stepLiInner(s, checked)}${
      kids.length
        ? `<ul>${kids
            .map((k) => `<li class="step${k.completed ? ' done' : ''}">${stepLiInner(k, !!k.completed)}</li>`)
            .join('')}</ul>`
        : ''
    }</li>`;
  };

  const topSteps = steps.filter((s) => !s.parent_step_id);
  const kidsOf = (pid) => steps.filter((s) => s.parent_step_id === pid);

  const costTotal = supplies.reduce((n, s) => n + (s.cost || 0), 0);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(project.title)} — Brambletally</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="toolbar">
  ${
    withJournal
      ? `<a href="?">Hide journal entries</a>`
      : `<a href="?journal=1">Include journal entries</a>`
  } &nbsp;·&nbsp; <a href="javascript:window.print()">Print / Save as PDF</a>
</div>

<h1>${esc(project.title)}</h1>
<div class="meta">
  ${esc(project.status)}${project.archived_at ? ' · archived' : ''}${
    project.category ? ' · ' + esc(project.category) : ''
  }${project.deadline ? ' · due ' + fmtDate(project.deadline) : ''}
</div>
<div class="meta">Kept by ${esc(nameOf(owner))} · exported ${esc(new Date().toISOString().slice(0, 10))}</div>

${project.description ? `<p>${esc(project.description)}</p>` : ''}
${project.pickup_note ? `<h2>Project notes</h2><p>${esc(project.pickup_note)}</p>` : ''}

<h2>Summary</h2>
<div class="stats">
  <div><b>${doneLeaves.length}</b> of <b>${leaves.length}</b> steps done${
    leaves.length ? ` (${pct}%)` : ''
  }</div>
  <div>Time left: <b>${minsLeft ? esc(fmtDur(minsLeft)) : '—'}</b>${
    minsTotal ? ` of ${esc(fmtDur(minsTotal))} estimated` : ''
  }</div>
  ${
    stamps.length
      ? `<div>First step done <b>${fmtDate(stamps[0])}</b></div>
         <div>Last done <b>${fmtDate(stamps[stamps.length - 1])}</b></div>`
      : ''
  }
</div>

${
  topSteps.length
    ? `<h2>Steps</h2><ul class="steps">${topSteps
        .map((s) => stepLi(s, kidsOf(s.id)))
        .join('')}</ul>`
    : ''
}

${
  supplies.length
    ? `<h2>Supplies</h2>
<table>
  <thead><tr><th>Item</th><th>Source</th><th class="num">Cost</th><th>Have</th></tr></thead>
  <tbody>
    ${supplies
      .map(
        (s) =>
          `<tr><td>${esc(s.name)}</td><td>${esc(s.source || '')}</td><td class="num">${
            s.cost != null ? esc(s.cost) : ''
          }</td><td>${s.acquired ? '&#9745;' : '&#9744;'}</td></tr>`
      )
      .join('')}
  </tbody>
  ${costTotal ? `<tfoot><tr><td colspan="2">Total</td><td class="num">${esc(costTotal.toFixed(2))}</td><td></td></tr></tfoot>` : ''}
</table>`
    : ''
}

${
  links.length
    ? `<h2>Links</h2><ul class="links">${links
        .map(
          (l) =>
            `<li><a href="${esc(l.url)}">${esc(l.title || l.url)}</a>${
              l.note ? ` — ${esc(l.note)}` : ''
            }</li>`
        )
        .join('')}</ul>`
    : ''
}

${
  withJournal && journal.length
    ? `<h2>Journal</h2><div class="journal">${journal
        .map(
          (j) =>
            `<div class="journal-entry"><div class="when">${fmtDate(j.created_at)} · ${esc(
              nameOf(j)
            )}</div><div>${esc(j.text)}</div></div>`
        )
        .join('')}</div>`
    : ''
}

</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}
