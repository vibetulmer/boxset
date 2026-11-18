import * as store from '../store.js';
import { esc, icon, toast } from '../ui.js';

// Store events (imports, refreshes) must not wipe the progress line mid-run.
export function update(root, route, detail) {
  if (['import', 'save-error', 'save-ok'].includes(detail?.type)) render(root);
}

const DAY = 24 * 60 * 60 * 1000;

function backupLine(count) {
  const last = store.lastExport();
  if (!count) return '';
  if (!last) return '<strong>Noch nie gesichert.</strong>';
  const days = Math.floor((Date.now() - last) / DAY);
  const when = days === 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`;
  return `Letzte Sicherung: ${days > 30 ? `<strong>${when}</strong>` : when}.`;
}

export function render(root) {
  const count = Object.keys(store.entries()).length;
  root.innerHTML = `<section class="page page--data">
    <h1 class="title-xl">Daten &amp; Backup</h1>
    <p class="lede">Dein Regal liegt nur in diesem Browser, auf diesem Gerät. Kein Konto, kein Server. Wenn du den Browserspeicher löschst oder das Gerät wechselst, brauchst du eine Sicherung.</p>
    ${store.saveProblem() ? '<p class="notice notice--error"><strong>Der Browser lässt gerade nicht speichern</strong> (Speicher voll oder privater Modus). Deine Änderungen leben nur noch bis zum Neuladen. Lade jetzt eine Sicherung herunter.</p>' : ''}

    <div class="data-actions">
      <div class="data-card">
        <h2 class="title-md">Sichern</h2>
        <p class="muted">Lädt eine kleine JSON-Datei mit deinen ${count} ${count === 1 ? 'Serie' : 'Serien'}, Wertungen und gesehenen Folgen herunter. <span data-backup-line>${backupLine(count)}</span></p>
        <button type="button" class="btn btn--primary" data-export ${count ? '' : 'disabled'}>${icon('download')}Sicherung herunterladen</button>
      </div>
      <div class="data-card" data-import-card>
        <h2 class="title-md">Wiederherstellen</h2>
        <p class="muted">Holt eine Sicherung zurück, auch von einem anderen Gerät. Du entscheidest dann, ob sie mit deinem Regal zusammengeführt wird oder es ersetzt.</p>
        <label class="btn btn--outline">${icon('upload')}Sicherung öffnen<input type="file" accept="application/json,.json" data-import class="visually-hidden"></label>
        <div class="import-choice" hidden>
          <p class="muted" data-choice-text></p>
          <div class="import-choice__btns">
            <button type="button" class="btn btn--primary btn--sm" data-mode="merge">Zusammenführen</button>
            <button type="button" class="btn btn--outline btn--sm" data-mode="replace">Ersetzen</button>
            <button type="button" class="btn btn--quiet btn--sm" data-mode="cancel">Abbrechen</button>
          </div>
        </div>
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
    a.download = `series-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    store.markExported();
    root.querySelector('[data-backup-line]').innerHTML = backupLine(count);
  });

  const choice = root.querySelector('.import-choice');
  let pending = null;
  const run = async (mode) => {
    const data = pending;
    pending = null;
    choice.hidden = true;
    try {
      const n = await store.importData(data, progress, { mode });
      toast(mode === 'merge' ? `Zusammengeführt: ${n} Serien im Regal.` : `Sicherung geladen: ${n} Serien.`);
    } catch (err) {
      toast(esc(err.message));
    }
  };
  choice.addEventListener('click', (e) => {
    const mode = e.target.closest('[data-mode]')?.dataset.mode;
    if (!mode || !pending) return;
    if (mode === 'cancel') { pending = null; choice.hidden = true; return; }
    if (mode === 'replace' && !confirm(`Dein aktuelles Regal mit ${count} Serien wird komplett durch die Sicherung ersetzt. Fortfahren?`)) return;
    run(mode);
  });

  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = store.checkBackup(JSON.parse(await file.text()));
      pending = data;
      if (!count) return run('replace');
      const date = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('de-DE') : 'unbekannt';
      choice.querySelector('[data-choice-text]').innerHTML = `Sicherung vom ${esc(date)} mit ${data.shows.length} Serien. <strong>Zusammenführen</strong> behält beide Stände und nimmt pro Serie den zuletzt geänderten. <strong>Ersetzen</strong> löscht dein jetziges Regal.`;
      choice.hidden = false;
      choice.querySelector('[data-mode="merge"]').focus();
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
