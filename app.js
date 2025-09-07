// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const grid = $('#grid');
const modal = $('#gameModal');
$('#mClose').onclick = () => modal.close();

const state = {
  all: [],
  q: '', genre: '', players: '', duration: '', complexity: '',
  sort: 'rating-desc',
};
const debounce = (fn, ms=180) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); } };


// Prova a mappare diversi schemi verso un formato canonico
function mapGame(g){
  const title = g.title || g.name || g.titolo || 'Senza titolo';
  const cover = g.cover || g.image || g.img || g.cover_url || '';
  // players
  let pmin = g.players_min ?? g.minPlayers ?? g.min_players ?? null;
  let pmax = g.players_max ?? g.maxPlayers ?? g.max_players ?? null;
  if(!pmin && !pmax && typeof g.players === 'string'){
    const m = g.players.match(/(\d+)\D+(\d+)/); if(m){ pmin=+m[1]; pmax=+m[2]; }
  }
  // durata
  let dmin = g.duration_min ?? g.minDuration ?? g.duration ?? null;
  let dmax = g.duration_max ?? g.maxDuration ?? null;
  // complessità (BGG weight 1-5)
  let weight = g.complexity ?? g.weight ?? g.difficulty ?? null;
  if (weight && weight > 5) weight = (weight/10)*5; // se arrivasse 0-10
  // rating BGG 0-10
  const rating = g.bgg_rating ?? g.rating ?? g.vote ?? null;
  // genere/i
  const genre = Array.isArray(g.genre) ? g.genre
               : (g.genres || g.tags || g.tipo ? (g.genres||g.tags||g.tipo) : [])
  const genreArr = Array.isArray(genre) ? genre : (typeof genre === 'string' ? genre.split(',').map(s=>s.trim()) : []);

  return {
    id: g.id ?? g.bgg_id ?? crypto.randomUUID(),
    title, cover,
    players: {min:pmin, max:pmax},
    duration: {min:dmin, max:dmax},
    weight, rating,
    genre: genreArr,
    desc: g.description || g.desc || '',
    bgg_url: g.bgg_url || (g.bgg_id ? `https://boardgamegeek.com/boardgame/${g.bgg_id}` : null),
    rules_url: g.rules_url || g.rules || null
  };
}

function badge(text, cls=''){ return `<span class="badge ${cls}">${text}</span>` }

function renderCard(game){
  const p = game.players;
  const d = game.duration;
  const meta = [
    p.min?`${p.min}${p.max?`–${p.max}`:''}p`:'—p',
    d.min?`${d.min}${d.max?`–${d.max}`:''}′`:'—′',
    game.weight?`Diff ${(+game.weight).toFixed(1)}`:'—',
  ].map(v=>badge(v)).join('');
  const tags = (game.genre||[]).slice(0,3).map(t=>badge(t)).join('');

  return `
  <article class="card" data-id="${game.id}">
    <div class="card__cover" style="background-image:url('${game.cover||''}');"></div>
    <div class="card__body">
      <h3 class="card__title">${game.title}</h3>
      <div class="meta">${meta} ${game.rating?badge(`BGG ${(+game.rating).toFixed(1)}`,'rating'):''}
        ${game.weight?badge(`${(+game.weight).toFixed(1)}`,'weight'):''}
      </div>
      <div class="meta">${tags}</div>
    </div>
    <div class="card__actions">
      <button class="link js-open">Scheda</button>
      ${game.rules_url ? `<a class="link" href="${game.rules_url}" target="_blank" rel="noopener">Regole</a>`:''}
    </div>
  </article>`
}

function openModal(game){
  $('#mTitle').textContent = game.title;
  $('#mCover').style.backgroundImage = `url('${game.cover||''}')`;
  $('#mMeta').innerHTML = [
    game.players.min?badge(`${game.players.min}${game.players.max?`–${game.players.max}`:''} giocatori`):'',
    game.duration.min?badge(`${game.duration.min}${game.duration.max?`–${game.duration.max}`:''} minuti`):'',
    game.rating?badge(`Voto BGG ${(+game.rating).toFixed(1)}`,'rating'):'',
    game.weight?badge(`Difficoltà ${(+game.weight).toFixed(1)}`,'weight'):'',
    ...(game.genre||[]).slice(0,5).map(t=>badge(t))
  ].join('');
  $('#mDesc').textContent = game.desc || '—';
  const bgg = $('#mBgg'); const rules = $('#mRules');
  if(game.bgg_url){ bgg.href = game.bgg_url; bgg.style.display='inline-flex'; } else { bgg.style.display='none'; }
  if(game.rules_url){ rules.href = game.rules_url; rules.style.display='inline-flex'; } else { rules.style.display='none'; }
  modal.showModal();
}

function applyFilters(list){
  const q = state.q.toLowerCase();
  return list.filter(g=>{
    const matchesQ = !q || g.title.toLowerCase().includes(q) || (g.genre||[]).some(t=>t.toLowerCase().includes(q));
    const matchesGenre = !state.genre || (g.genre||[]).map(x=>x.toLowerCase()).includes(state.genre.toLowerCase());
    const matchesPlayers = !state.players || (g.players.min && g.players.min <= +state.players);
    const maxDur = +state.duration || Infinity;
    const durVal = g.duration.min || g.duration.max || Infinity;
    const matchesDuration = !state.duration || (durVal <= maxDur);
    const maxW = [null,1.5,2.5,3.5,4.5][+state.complexity||0] ?? null;
    const matchesComplexity = !state.complexity || (g.weight && g.weight <= maxW);
    return matchesQ && matchesGenre && matchesPlayers && matchesDuration && matchesComplexity;
  });
}

function applySort(list){
  const [key,dir] = state.sort.split('-');
  const m = (g)=>({
    'rating': g.rating ?? -Infinity,
    'title': (g.title||'').toLowerCase(),
    'duration': g.duration.min ?? g.duration.max ?? Infinity,
    'complexity': g.weight ?? Infinity,
  }[key]);
  return list.slice().sort((a,b)=>{
    const va=m(a), vb=m(b);
    if(va<vb) return (dir==='asc'?-1:1);
    if(va>vb) return (dir==='asc'?1:-1);
    return 0;
  });
}

function render(list){
  grid.innerHTML = list.map(renderCard).join('');
  grid.querySelectorAll('.js-open').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = e.currentTarget.closest('.card').dataset.id;
      const game = state.all.find(x=>x.id===id);
      if(game) openModal(game);
    });
  });
}

// ===== Init =====
async function boot(){
  const res = await fetch('games.json');
  const raw = await res.json();
  state.all = (Array.isArray(raw)?raw:(raw.games||[])).map(mapGame);
  update();

  // events
  $('#q').addEventListener('input', e=>{ state.q = e.target.value; update() });
  $('#genre').addEventListener('change', e=>{ state.genre = e.target.value; update() });
  $('#players').addEventListener('change', e=>{ state.players = e.target.value; update() });
  $('#duration').addEventListener('change', e=>{ state.duration = e.target.value; update() });
  $('#complexity').addEventListener('change', e=>{ state.complexity = e.target.value; update() });
  $('#sort').addEventListener('change', e=>{ state.sort = e.target.value; update() });
  $('#q').addEventListener('input', debounce(e=>{ state.q = e.target.value; update() }, 160));
  $('#qClear').addEventListener('click', ()=>{
    $('#q').value = ''; state.q=''; update(); $('#q').focus();
  });

}

function update(){
  const filtered = applyFilters(state.all);
  const sorted = applySort(filtered);
  render(sorted);
}

boot().catch(err=>{
  grid.innerHTML = `<div class="small">Errore nel caricamento dei dati: ${err?.message||err}</div>`;
});
