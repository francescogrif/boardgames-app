// Inizializza Supabase (richiede SDK + config.js in index.html)
const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

let STATE = {
  games: [],
  filterText: "",
  playersEq: "",      // numero giocatori esatto richiesto
  maxTime: "",        // durata massima in minuti
  sortBy: "title_asc" // title_asc | time_asc | players_desc
};

// Parsing helper: "2-5" -> {min:2, max:5}
function parsePlayersRange(str){
  if(!str) return {min:null, max:null};
  const m = String(str).match(/(\d+)\s*[-–]\s*(\d+)/);
  if(m) return {min:+m[1], max:+m[2]};
  const n = parseInt(str,10);
  return Number.isFinite(n) ? {min:n, max:n} : {min:null, max:null};
}

// Calcola “capienza giocatori” massima (per ordinamento players_desc)
function playersCapacity(str){
  const {min, max} = parsePlayersRange(str);
  if(Number.isFinite(max)) return max;
  if(Number.isFinite(min)) return min;
  return 0;
}

function cardHTML(g){
  const meta = [];
  if (g.players) meta.push(g.players);
  if (Number.isFinite(g.time_minutes)) meta.push(`${g.time_minutes}’`);
  if (Number.isFinite(g.min_age)) meta.push(`+${g.min_age}`);

  const tags = Array.isArray(g.tags) ? g.tags : [];
  const tagsHtml = tags.slice(0,6).map(t => `<span class="tag">#${t}</span>`).join("");

  return `
    <article class="card">
      <h3>${g.title ?? "Senza titolo"}</h3>
      <div class="badges">
        ${meta.length ? `<span class="badge">${meta.join(" • ")}</span>` : ""}
      </div>
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ""}
    </article>
  `;
}

function applyFiltersAndRender(){
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  const count = document.getElementById("count");

  const f = STATE.filterText.toLowerCase().trim();
  const wantPlayers = STATE.playersEq ? parseInt(STATE.playersEq,10) : null;
  const wantMaxTime = STATE.maxTime ? parseInt(STATE.maxTime,10) : null;

  let list = STATE.games.filter(g => {
    // filtro testuale su title/players/tags
    const hay = [
      (g.title||""),
      (g.players||""),
      (Array.isArray(g.tags) ? g.tags.join(" ") : "")
    ].join(" ").toLowerCase();

    if (f && !hay.includes(f)) return false;

    // filtro per numero giocatori: il valore scelto deve ricadere nel range del gioco
    if (Number.isFinite(wantPlayers)) {
      const {min, max} = parsePlayersRange(g.players);
      const ok = (Number.isFinite(min) && Number.isFinite(max))
        ? (wantPlayers >= min && wantPlayers <= max)
        : (Number.isFinite(min) ? wantPlayers === min : true);
      if (!ok) return false;
    }

    // filtro durata massima
    if (Number.isFinite(wantMaxTime) && Number.isFinite(g.time_minutes)) {
      if (g.time_minutes > wantMaxTime) return false;
    }

    return true;
  });

  // ordinamento
  list.sort((a,b)=>{
    if (STATE.sortBy === "time_asc") {
      const ta = Number.isFinite(a.time_minutes) ? a.time_minutes : 9999;
      const tb = Number.isFinite(b.time_minutes) ? b.time_minutes : 9999;
      return ta - tb;
    }
    if (STATE.sortBy === "players_desc") {
      return playersCapacity(b.players) - playersCapacity(a.players);
    }
    // default: titolo A→Z
    return (a.title||"").localeCompare(b.title||"");
  });

  // render
  grid.innerHTML = list.map(cardHTML).join("");
  empty.hidden = list.length > 0;
  count.textContent = String(list.length);
}

function wireUI(){
  const search = document.getElementById("search");
  const players = document.getElementById("players");
  const maxTime = document.getElementById("maxTime");
  const sortBy = document.getElementById("sortBy");

  search.addEventListener("input", e => {
    STATE.filterText = e.target.value;
    applyFiltersAndRender();
  });
  players.addEventListener("change", e => {
    STATE.playersEq = e.target.value;
    applyFiltersAndRender();
  });
  maxTime.addEventListener("change", e => {
    STATE.maxTime = e.target.value;
    applyFiltersAndRender();
  });
  sortBy.addEventListener("change", e => {
    STATE.sortBy = e.target.value;
    applyFiltersAndRender();
  });
}

async function load(){
  wireUI();

  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("title", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("empty").hidden = false;
    document.getElementById("empty").textContent = "Errore nel caricamento dei dati.";
    return;
  }

  STATE.games = Array.isArray(data) ? data : [];
  applyFiltersAndRender();
}

load();


