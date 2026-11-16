import * as store from '../store.js';
import { esc, icon, toast } from '../ui.js';

// Store events (imports, refreshes) must not wipe the progress line mid-run.
export function update(root, route, detail) {
  if (detail?.type === 'import') render(root);
}

export function render(root) {
  const count = Object.keys(store.entries()).length;
  root.innerHTML = `<section class="page page--data">
    <h1 class="title-xl">Daten &amp; Backup</h1>
    <p class="lede">Dein Regal liegt nur in diesem Browser, auf diesem Gerät. Kein Konto, kein Server. Wenn du den Browserspeicher löschst oder das Gerät wechselst, brauchst du eine Sicherung.</p>

    <div class="data-actions">
      <div class="data-card">
        <h2 class="title-md">Sichern</h2>
        <p class="muted">Lädt eine kleine JSON-Datei mit deinen ${count} ${count === 1 ? 'Serie' : 'Serien'}, Wertungen und gesehenen Folgen herunter.</p>
        <button type="button" class="btn btn--primary" data-export ${count ? '' : 'disabled'}>${icon('download')}Sicherung herunterladen</button>
      </div>
      <div class="data-card">
        <h2 class="title-md">Wiederherstellen</h2>
        <p class="muted">Ersetzt dein aktuelles Regal durch eine Sicherung. Die Seriendaten werden danach frisch von TVmaze geladen.</p>
        <label class="btn btn--outline">${icon('upload')}Sicherung öffnen<input type="file" accept="application/json,.json" data-import class="visually-hidden"></label>
      </div>
      <div class="data-card">
        <h2 class="title-md">Aktualisieren</h2>
        <p class="muted">Holt neue Folgen und Staffeln für alle Serien im Regal. Passiert sonst automatisch, wenn du eine Serie öffnest.</p>
        <button type="button" class="btn btn--outline" data-refresh ${count ? '' : 'disabled'}>${icon('refresh')}Alle Serien aktualisieren</button>
      </div>
    </div>
    <p class="progress-line muted" aria-live="polite"></p>

    <section class="about">
      <h2 class="title-md">Woher die Daten kommen</h2>
      <p>Serientitel, Staffeln, Folgentitel, Ausstrahlungsdaten, Laufzeiten und Poster stammen von <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVmaze</a>. Die Daten stehen unter der Lizenz <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.de" target="_blank" rel="noopener">Creative Commons BY-SA 4.0</a> und dürfen mit Namensnennung genutzt werden. Folgentitel sind meist im englischen Original.</p>
      <p>Wo TVmaze für eine Folge keine Länge kennt, rechnet das Regal mit der üblichen Laufzeit der Serie und schreibt „ca.“ davor.</p>
    </section>

    <div class="danger-zone">
      <button type="button" class="btn btn--quiet" data-wipe ${count ? '' : 'disabled'}>${icon('trash')}Ganzes Regal leeren</button>
    </div>
  </section>`;

  const line = root.querySelector('.progress-line');
  const progress = (done, total) => { line.textContent = `${done} von ${total} Serien geladen …`; if (done === total) line.textContent = 'Fertig.'; };

  root.querySelector('[data-export]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.exportData(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `boxset-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (count && !confirm(`Dein aktuelles Regal mit ${count} Serien wird durch die Sicherung ersetzt. Fortfahren?`)) return;
      const n = await store.importData(data, progress);
      toast(`Sicherung geladen: ${n} Serien.`);
    } catch (err) {
      toast(esc(err instanceof SyntaxError ? 'Die Datei ist kein gültiges JSON.' : err.message));
    } finally {
      e.target.value = '';
    }
  });

  root.querySelector('[data-refresh]').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await store.refreshAll(progress);
    toast('Alle Serien sind auf dem neuesten Stand.');
  });

  root.querySelector('[data-wipe]').addEventListener('click', async () => {
    if (!confirm(`Wirklich alle ${count} Serien, Wertungen und gesehenen Folgen löschen? Das lässt sich nicht rückgängig machen, außer du hast eine Sicherung.`)) return;
    await store.wipe();
    toast('Das Regal ist leer.');
  });
}
