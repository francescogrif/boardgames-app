// app.js — versione Supabase (sostituisci tutto il file con questo)

// 1) Client Supabase: richiede che in index.html ci sia lo script SDK
//    e che tu abbia creato config.js con SUPABASE_URL e SUPABASE_ANON_KEY
const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

async function load() {
  const ul = document.getElementById('list');
  const input = document.getElementById('search');
  const empty = document.getElementById('empty');

  try {
    // 2) Leggi i giochi dalla tabella 'games'
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .order('title', { ascending: true });

    if (error) throw error;

    function render(filter = '') {
      ul.innerHTML = '';
      const f = filter.toLowerCase();

      const filtered = games.filter(g =>
        (g.title || '').toLowerCase().includes(f) ||
        (g.players || '').toLowerCase().includes(f) ||
        (Array.isArray(g.tags) ? g.tags.join(' ') : '').toLowerCase().includes(f)
      );

      empty.hidden = filtered.length > 0;

      filtered.forEach(g => {
        const meta = [
          g.players ? g.players : null,
          Number.isFinite(g.time_minutes) ? `${g.time_minutes}’` : null,
          Number.isFinite(g.min_age) ? `+${g.min_age}` : null
        ].filter(Boolean).join(' • ');

        const li = document.createElement('li');
        li.innerHTML = `
          <span>${g.title}</span>
          <span class="badge">${meta}</span>
        `;
        ul.appendChild(li);
      });
    }

    render();
    input.addEventListener('input', e => render(e.target.value));

  } catch (err) {
    console.error(err);
    ul.innerHTML = '<li>Errore nel caricamento dei dati.</li>';
  }
}

load();

