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
const asPlayersText = (min, max) => {
  if (!min && !max) return null;
  if (min && max) return `${min}–${max}`;
  return `${min || max}`;
};
const asTags = (val) =>
  Array.isArray(val) ? val :
  typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(Boolean) : [];

// ===== Mapping (DB row -> UI) =====
function mapFromDbRow(row) {
  // players in tabella è testo tipo "2–5" o "2-5"
  let pmin = null, pmax = null;
  if (row.players && typeof row.players === 'string') {
    const m = row.players.match(/(\d+)\D+(\d+)/);
    if (m) { pmin = +m[1]; pmax = +m[2]; }
    else {
      const one = row.players.match(/(\d+)/);
      if (one) pmin = +one[1];
    }
  }

  // durata: in tabella abbiamo time_minutes (int)
  const dmin = null;
  const dmax = row.time_minutes ?? null;

  return {
    id: row.id,
    title: row.title || 'Senza titolo',
    cover: row.image_url || row.bgg_thumb || '',
    players: { min: pmin, max: pmax },
    duration: { min: dmin, max: dmax },
    weight: row.weight ?? null,
    rating: null,            // non presente in tabella, opzionale in futuro
    genre: row.tags || [],
    desc: '',                // opzionale
    bgg_url: row.bgg_url || null,
    rules_url: null,
    _row: row
  };
}

// ===== Mapping (JSON -> UI + DB row) =====
function mapFromJson(g) {
  const title = g.title || g.name || g.titolo || 'Senza titolo';
  const image_url = g.image_url || g.cover || g.img || g.cover_url || g.image || '';
  const bggIdRaw = g.bgg_id ?? g.id ?? null;
  const bgg_id = bggIdRaw != null ? toInt(bggIdRaw) : null;
  const bgg_url = g.bgg_url || (bgg_id ? `https://boardgamegeek.com/boardgame/${bgg_id}` : null);
  const bgg_thumb = g.bgg_thumb || image_url || null;

  // players
  let pmin = g.players_min ?? g.minPlayers ?? g.min_players ?? null;
  let pmax = g.players_max ?? g.maxPlayers ?? g.max_players ?? null;
  if (!pmin && !pmax && typeof g.players === 'string') {
    const m = g.players.match(/(\d+)\D+(\d+)/);
    if (m) { pmin = +m[1]; pmax = +m[2]; }
  }
  const playersTxt = asPlayersText(pmin, pmax);

  // durata
  const dmin = g.duration_min ?? g.minDuration ?? g.min_duration ?? g.duration ?? null;
  const dmax = g.duration_max ?? g.maxDuration ?? g.max_duration ?? null;
  const time_minutes = toInt(dmax ?? dmin ?? null);

  // età minima
  const min_age = toInt(g.min_age ?? g.age ?? g.minAge);

  // complessità
  let weight = g.weight ?? g.complexity ?? g.difficulty ?? null;
  if (weight && weight > 5) weight = (weight / 10) * 5;

  // rating (solo UI)
  const rating = g.bgg_rating ?? g.rating ?? g.vote ?? null;

  // tag
  const tags = asTags(g.tags || g.genres || g.genre || g.tipo);

  const row = {
    id: g.uuid || crypto.randomUUID(),
    title: title ?? null,
    players: playersTxt,
    time_minutes: time_minutes,
    min_age: min_age,
    weight: n(weight),
    image_url: image_url || null,
    tags: tags,
    bgg_id: bgg_id,
    bgg_url: bgg_url || null,
    bgg_thumb: bgg_thumb || null,
    last_bgg_sync: null,
    sync_status: null
  };

  return {
    id: row.id,
    title: row.title,
    cover: row.image_url,
    players: { min: pmin ?? null, max: pmax ?? null },
    duration: { min: dmin ?? null, max: dmax ?? null },
    weight: row.weight,
    rating: rating,
    genre: row.tags,
    desc: g.description || g.desc || '',
    bgg_url: row.bgg_url,
    rules_url: g.rules_url || g.rules || null,
    _row: row
  };
}

// ===== UI bits =====
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

// ===== Filters & sort =====
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

// ===== Data loading =====
async function loadFromSupabase() {
  if (!window.DB?.sb) return { rows: [], error: new Error('Supabase non inizializzato') };
  const { sb, tables } = window.DB;
  const { data, error } = await sb
    .from(tables.games)
    .select('*')
    .order('title', { ascending: true });
  return { rows: data || [], error };
}

async function loadFromJson() {
  const res = await fetch('games.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  const arr = (Array.isArray(raw) ? raw : (raw.games || [])).map(mapFromJson);
  return arr;
}

// ===== Init =====
async function boot() {
  // UI refs
  const q = $('#q'), qClear = $('#qClear');
  const genre = $('#genre'), players = $('#players'), duration = $('#duration');
  const complexity = $('#complexity'), sort = $('#sort');

  // Search & Clear
  if (qClear) qClear.hidden = !q?.value;
  if (q && qClear) q.addEventListener('input', (e) => {
    state.q = e.target.value;
    qClear.hidden = !e.target.value;
    update();
  });
  if (qClear) qClear.addEventListener('click', (e) => {
    e.preventDefault();
    if (!q) return;
    q.value = '';
    state.q = '';
    qClear.hidden = true;
    update();
    q.focus();
    });
  // Filters
  genre?.addEventListener('change', (e) => { state.genre = e.target.value; update(); });
  players?.addEventListener('change', (e) => { state.players = e.target.value; update(); });
  duration?.addEventListener('change', (e) => { state.duration = e.target.value; update(); });
  complexity?.addEventListener('change', (e) => { state.complexity = e.target.value; update(); });
  sort?.addEventListener('change', (e) => { state.sort = e.target.value; update(); });

  // Data: Supabase first, fallback JSON
  try {
    const { rows, error } = await loadFromSupabase();
    if (error) console.warn('[supabase] select error:', error.message);
    if (rows && rows.length) {
      state.all = rows.map(mapFromDbRow);
    } else {
      // fallback locale
      state.all = await loadFromJson();
    }
  } catch (err) {
    console.error(err);
    try {
      state.all = await loadFromJson();
    } catch (err2) {
      grid.innerHTML = `<div class="small">Errore nel caricamento dei dati: ${err2?.message || err2}</div>`;
    }
  }

  update();
}

function update() {
  const filtered = applyFilters(state.all);
  const sorted = applySort(filtered);
  render(sorted);
}

boot();

/* ===== Upsert pronto per il prossimo step (non usato ancora in UI) =====
async function upsertGameRow(row) {
  if (!window.DB?.sb) throw new Error('Supabase non inizializzato');
  const { sb, tables } = window.DB;
  const { data, error } = await sb.from(tables.games).upsert(row, { onConflict: 'id' }).select();
  if (error) throw error;
  return data;
}
*/
