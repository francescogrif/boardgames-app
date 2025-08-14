async function load() {
  try {
    const res = await fetch('games.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Impossibile caricare games.json');
    const games = await res.json();

    const ul = document.getElementById('list');
    const input = document.getElementById('search');
    const empty = document.getElementById('empty');

    function render(filter = '') {
      ul.innerHTML = '';
      const filtered = games.filter(g =>
        (g.title || '').toLowerCase().includes(filter.toLowerCase())
      );
      empty.hidden = filtered.length > 0;
      filtered.forEach(g => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${g.title}</span>
                        <span class="badge">${g.players} • ${g.time}’</span>`;
        ul.appendChild(li);
      });
    }

    render();
    input.addEventListener('input', e => render(e.target.value));
  } catch (err) {
    console.error(err);
    document.getElementById('list').innerHTML = '<li>Errore nel caricamento dei dati.</li>';
  }
}
load();
