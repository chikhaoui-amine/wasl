# Backup, Export & Recovery Guide

WASL Local stores personal data in your browser's IndexedDB database (`wasl-local`). Backups are therefore essential before clearing browser data, changing browser/profile, moving to another machine, or experimenting with storage settings.

## Full backup (`.wasl-backup`)

### Export

1. Open WASL.
2. Go to **Settings → Backup & transfer**.
3. Export a full backup.
4. Store the downloaded `.wasl-backup` file somewhere outside the browser profile you are protecting.

WASL verifies the generated backup checksum before reporting a successful export.

### Restore

A full restore requires an empty destination database.

1. If the destination contains data you still need, export a backup first.
2. Reset the local database. WASL offers a safety-backup option before destructive reset.
3. Return to **Settings → Backup & transfer**.
4. Select the `.wasl-backup` file and review the validation preview.
5. Run the full restore.

WASL validates the backup before importing it and rejects incompatible or invalid input rather than silently applying it.

## Selective transfer (`.wasl-transfer`)

Use selective transfer when you want to move or merge only chosen domains or entities into an existing WASL database.

### Export

1. Go to **Settings → Backup & transfer**.
2. Open selective export.
3. Choose the domains and, where supported, the specific entities you want to include.
4. Export the `.wasl-transfer` file.

### Import

1. On the destination WASL instance, open **Settings → Backup & transfer**.
2. Select the `.wasl-transfer` file.
3. Review the preview and duplicate-resolution strategy.
4. Import the transfer package.

Selective transfers are designed for controlled merging; they do not require wiping the whole destination database first.

## Storage safety

Browser storage is scoped to a browser profile and origin. Data saved under one local URL/profile does not automatically follow you to another browser, profile, hostname, or device.

Recommended practice:

- export regular full backups;
- keep at least one backup outside the machine/browser profile running WASL;
- export before clearing site data or resetting the database;
- verify that an important backup can be selected and previewed before deleting the original data.
