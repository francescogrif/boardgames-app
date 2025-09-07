// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const modal = $('#gameModal');
$('#mClose')?.addEventListener('click', () => modal.close());

const state = {
  all: [],
  q: '',
  genre: '',
  players: '',
  duration: '',
  complexity: '',
  sort: 'rating-desc',
};

// ---- util
const n = (v) => (v === undefined || v === null || v === '' ? null : +v);
const toInt = (v) => {
  const x = n(v);
  return Number.isFinite(x) ? Math.trunc(x) : null;
};
const clamp01 = (x) => (x == null ? null : Math.max(0, Math.min(1, x)));
const asPlayersText = (min, max) => {
  if (!min && !max) return null;
  if (min && max) return `${min}–${max}`;
  return `${min || max}`;
};
const asTags = (val) =>
  Array.isArray(val) ? val :
  typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(Boolean) : [];

// ===== Mapping: input -> UI + riga Supabase =====
function mapGame(g) {
  // Titolo / cover
  const title = g.title || g.name || g.titolo || 'Senza titolo';
  const image_url = g.image_url || g.cover || g.img || g.cover_url || g.image || '';
  const bggIdRaw = g.bgg_id ?? g.id ?? null;
  const bgg_id = bggIdRaw != null ? toInt(bggIdRaw) : null;
  const bgg_url = g.bgg_url || (bgg_id ? `https://boardgamegeek.com/boardgame/${bgg_id}` : null);
  const bgg_thumb = g.bgg_thumb || image_url || null;

  // Players: prova varie chiavi e fallback parsing stringa "2-5"
  let pmin = g.players_min ?? g.minPlayers ?? g.min_players ?? null;
  let pmax = g.players_max ?? g.maxPlayers ?? g.max_players ?? null;
  if (!pmin && !pmax && typeof g.players === 'string') {
    const m = g.players.match(/(\d+)\D+(\d+)/);
    if (m) { pmin = +m[1]; pmax = +m[2]; }
  }
  const playersTxt = asPlayersText(pmin, pmax);

  // Durata: scegliamo la durata “tipica”: preferisci max se presente, altrimenti min
  const dmin = g.duration_min ?? g.minDuration ?? g.min_duration ?? g.duration ?? null;
  const dmax = g.duration_max ?? g.maxDuration ?? g.max_duration ?? null;
  const time_minutes = toInt(dmax ?? dmin ?? null);

  // Età minima
  const min_age = toInt(g.min_age ?? g.age ?? g.minAge);

  // Complessità (BGG weight 1–5)
  let weight = g.weight ?? g.complexity ?? g.difficulty ?? null;
  if (weight && weight > 5) weight = (weight / 10) * 5;

  // Rating BGG (non è in tabella, lo teniamo solo per la UI)
  const rating = g.bgg_rating ?? g.rating ?? g.vote ?? null;

  // Tag / generi
  const tags = asTags(g.tags || g.genres || g.genre || g.tipo);

  // Descrizione
  const description = g.description || g.desc || '';

  // Riga tabellare per Supabase (schema esatto)
  const row = {
    id: g.uuid || crypto.randomUUID(),  // uuid locale se non presente
    title: title ?? null,
    players: playersTxt,                // es. "2–5"
    time_minutes: time_minutes,         // int
    min_age: min_age,                   // int
    weight: n(weight),                  // numeric(…)
    image_url: image_url || null,
    tags: tags,                         // text[]
    bgg_id: bgg_id,                     // int
    bgg_url: bgg_url || null,
    bgg_thumb: bgg_thumb || null,
    last_bgg_sync: null,                // lo popolerai lato backend
    sync_status: null                   // es. "ok" / "pending" / "error"
  };

  // Oggetto UI (come il resto dell'app si aspetta)
  return {
    id: row.id,
    title: row.title,
    cover: row.image_url,
    players: { min: pmin ?? null, max: pmax ?? null },
    duration: { min: dmin ?? null, max: dmax ?? null },
    weight: row.weight,
    rating: rating,
    genre: row.tags,
    desc: description,
    bgg_url: row.bgg_url,
    rules_url: g.rules_url || g.rules || null,
    _row: row
  };
}

function badge(text, cls = '') {
  return `<span class="badge ${cls}">${text}</span>`;
}

function renderCard(game) {
  const p = game.players;
  const d = game.duration;
  const meta = [
    p.min ? `${p.min}${p.max ? `–${p.max}` : ''}p` : '—p',
    d.min ? `${d.min}${d.max ? `–${d.max}` : ''}′` : (d.max ? `${d.max}′` : '—′'),
    game.weight ? `Diff ${(+game.weight).toFixed(1)}` : '—',
  ].map((v) => badge(v)).join('');
  const tags = (game.genre || []).slice(0, 3).map((t) => badge(t)).join('');

  return `
  <article class="card" data-id="${game.id}">
    <div class="card__cover" style="background-image:url('${game.cover || ''}');"></div>
    <div class="card__body">
      <h3 class="card__title">${game.title}</h3>
      <div class="meta">${meta} ${
        game.rating ? badge(`BGG ${(+game.rating).toFixed(1)}`, 'rating') : ''
      }
        ${game.weight ? badge(`${(+game.weight).toFixed(1)}`, 'weight') : ''}
      </div>
      <div class="meta">${tags}</div>
    </div>
    <div class="card__actions">
      <button class="link js-open">Scheda</button>
      ${
        game.rules_url
          ? `<a class="link" href="${game.rules_url}" target="_blank" rel="noopener">Regole</a>`
          : ''
      }
    </div>
  </article>`;
}

function openModal(game) {
  $('#mTitle').textContent = game.title;
  $('#mCover').style.backgroundImage = `url('${game.cover || ''}')`;
  $('#mMeta').innerHTML = [
    game.players.min
      ? badge(`${game.players.min}${game.players.max ? `–${game.players.max}` : ''} giocatori`)
      : '',
    (game.duration.min || game.duration.max)
      ? badge(`${game.duration.min ?? game.duration.max}${game.duration.max ? `–${game.duration.max}` : ''} minuti`)
      : '',
    game.rating ? badge(`Voto BGG ${(+game.rating).toFixed(1)}`, 'rating') : '',
    game.weight ? badge(`Difficoltà ${(+game.weight).toFixed(1)}`, 'weight') : '',
    ...(game.genre || []).slice(0, 5).map((t) => badge(t)),
  ].join('');
  $('#mDesc').textContent = game.desc || '—';
  const bgg = $('#mBgg');
  const rules = $('#mRules');
  if (game.bgg_url) { bgg.href = game.bgg_url; bgg.style.display = 'inline-flex'; } else { bgg.style.display = 'none'; }
  if (game.rules_url) { rules.href = game.rules_url; rules.style.display = 'inline-flex'; } else { rules.style.display = 'none'; }
  modal.showModal();
}

function applyFilters(list) {
  const q = (state.q || '').toLowerCase();
  return list.filter((g) => {
    const matchesQ =
      !q ||
      g.title.toLowerCase().includes(q) ||
      (g.genre || []).some((t) => t.toLowerCase().includes(q));
    const matchesGenre =
      !state.genre ||
      (g.genre || []).map((x) => x.toLowerCase()).includes(state.genre.toLowerCase());
    const matchesPlayers = !state.players || (g.players.min && g.players.min <= +state.players);
    const maxDur = +state.duration || Infinity;
    const durVal = g.duration.min || g.duration.max || Infinity;
    const matchesDuration = !state.duration || durVal <= maxDur;
    const maxW = [null, 1.5, 2.5, 3.5, 4.5][+state.complexity || 0] ?? null;
    const matchesComplexity = !state.complexity || (g.weight && g.weight <= maxW);
    return matchesQ && matchesGenre && matchesPlayers && matchesDuration && matchesComplexity;
  });
}

function applySort(list) {
  const [key, dir] = state.sort.split('-');
  const m = (g) =>
    ({
      rating: g.rating ?? -Infinity,
      title: (g.title || '').toLowerCase(),
      duration: g.duration.min ?? g.duration.max ?? Infinity,
      complexity: g.weight ?? Infinity,
    }[key]);
  return list.slice().sort((a, b) => {
    const va = m(a), vb = m(b);
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function render(list) {
  grid.innerHTML = list.map(renderCard).join('');
  grid.querySelectorAll('.js-open').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.closest('.card').dataset.id;
      const game = state.all.find((x) => x.id === id);
      if (game) openModal(game);
    });
  });
}

// ===== Init =====
async function boot() {
  // El. UI
  const q = $('#q'), qClear = $('#qClear');
  const genre = $('#genre'), players = $('#players'), duration = $('#duration');
  const complexity = $('#complexity'), sort = $('#sort');

  // Search & Clear
  if (q) q.addEventListener('input', (e) => { state.q = e.target.value; update(); });
  if (qClear) qClear.addEventListener('click', (e) => {
    e.preventDefault();
    if (!q) return;
    q.value = ''; state.q = ''; update(); q.focus();
  });

  // Filters
  genre?.addEventListener('change', (e) => { state.genre = e.target.value; update(); });
  players?.addEventListener('change', (e) => { state.players = e.target.value; update(); });
  duration?.addEventListener('change', (e) => { state.duration = e.target.value; update(); });
  complexity?.addEventListener('change', (e) => { state.complexity = e.target.value; update(); });
  sort?.addEventListener('change', (e) => { state.sort = e.target.value; update(); });

  // Dati locali
  try {
    const res = await fetch('games.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    state.all = (Array.isArray(raw) ? raw : (raw.games || [])).map(mapGame);
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="small">Errore nel caricamento dei dati: ${err?.message || err}</div>`;
  }

  update();
}

function update() {
  const filtered = applyFilters(state.all);
  const sorted = applySort(filtered);
  render(sorted);
}

boot();
