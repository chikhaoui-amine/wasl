# Backup, Export & Recovery Guide

WASL Local provides reliable, non-destructive backup export and import mechanisms directly from your browser.

---

## 1. Local Backups (`.wasl-backup`)

### Why Regular Backups Matter
In WASL Local, all data is stored inside your browser's IndexedDB database (`wasl-local`). Browser maintenance actions—such as clearing site data, resetting cookies, or using private browsing mode—will delete IndexedDB data.

### Exporting a Backup
1. Open WASL in your browser.
2. Click the **Settings** tab in the sidebar or navigation menu.
3. Select **Backup & transfer**.
4. Click **Export Backup**.
5. Your browser will download a timestamped JSON file (e.g. `wasl-backup-2026-08-27T12-00-00-000Z.wasl-backup`).

### Importing a Backup
To prevent accidental data corruption or conflicting merge collisions, full backups are imported into a clean database:
1. Go to **Settings → Backup & transfer**.
2. Click **Reset Local Data** (this automatically downloads a safety backup before resetting).
3. Click **Import Backup** and select your `.wasl-backup` file.
4. WASL validates schema signatures and restores all 11 active domains.

---

## 2. Selective Transfer (`.wasl-transfer`)

If you want to move or merge only specific modules (e.g. just Notes or Goals) into an existing database without resetting other data, use **Selective Transfer**:
- Choose **Export Transfer** and select the domains or items you want to transfer.
- On the target machine, use **Import Transfer** to review duplicates and merge smoothly.
