// Inserisci qui le tue credenziali Supabase (progetto -> Settings -> API)

(function () {
  // === MODIFICA QUI: URL e ANON KEY del tuo progetto ===
  const SUPABASE_URL = 'https://mgcdkrstkeitcrqrjkxh.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nY2RrcnN0a2VpdGNycXJqa3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxODM2NjAsImV4cCI6MjA3MDc1OTY2MH0.ezb6QBqU6OY_XN49uuDWzr8-_QXOp5JZ5ZFlQLzA6jE';

  // Tabella principale (quella che hai mostrato nello schema)
  const TABLE_GAMES = 'games';

  // Crea client Supabase (SDK v2 via CDN è già caricato in index.html)
  // Nota OPEX: nessuna sessione persistente, solo letture pubbliche (RLS read-only)
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-app': 'boardgames-app' } },
  });

  // Esporta in global per usarlo in app.js
  window.DB = {
    sb,
    tables: {
      games: TABLE_GAMES,
    },
  };

  // Mini check in console
  if (!SUPABASE_URL.startsWith('https://') || SUPABASE_ANON_KEY.length < 20) {
    console.warn('[config] Ricorda di impostare SUPABASE_URL e SUPABASE_ANON_KEY.');
  }
})();
