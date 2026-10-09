# Nepali Date - GNOME Shell extension

Shows today's Bikram Sambat date in the top bar (e.g. `२२ असोज २०८३`). Click it for a
month calendar with BS days, the matching AD days, Saturdays in red, and month navigation.
The same calendar can also sit on the desktop; drag it anywhere.

- `src/bs.js` - BS⇄AD conversion (1975–2199 BS). Add rows to `MONTH_LENGTHS` as new official calendars are published.
- `src/extension.js` - top-bar indicator and calendar popup.
- `src/calendar.js` - the month calendar, shared by the popup and the desktop.
- `src/desktop.js` - the draggable desktop calendar.
- `src/prefs.js` - settings: language (नेपाली/English), weekday/year in the top bar, position, desktop calendar.

Requires GNOME Shell 48, 49 or 50.

## Install and run

From source:

```sh
git clone https://github.com/khadkamhn/mk-nepali-date.git
cd mk-nepali-date
scripts/install.sh
```

Then load it:

1. Log out and back in. On Wayland, GNOME Shell only picks up new extensions at login (on GNOME 48 or 49 in an X11 session, `Alt+F2`, `r`, Enter also works; GNOME 50 has no X11 session).
2. `gnome-extensions enable mk-nepali-date@mohankhadka.com.np`

From the zip (e.g. a GitHub release):

```sh
gnome-extensions install --force mk-nepali-date.zip
```

Then log out and back in and enable it as above.

Settings: `gnome-extensions prefs mk-nepali-date@mohankhadka.com.np`, or the Extensions app.

Update: `git pull && scripts/install.sh`, then log out and back in.

Uninstall: `scripts/uninstall.sh` - unloads it from the top bar right away, removes its files and resets its settings.

## Development

- Edit files in `src/`, run `scripts/install.sh`, then log out and back in to see the change (Wayland).
- To test without logging out, run a nested shell: `dbus-run-session gnome-shell --devkit --wayland` (GNOME 49+, needs the `mutter-dev-bin` package on Ubuntu; on 48 use `--nested`), then enable the extension inside it.
- Logs: `journalctl -f -o cat /usr/bin/gnome-shell`.
- Screenshots: `scripts/screenshots.sh` regenerates `docs/screenshots/*.png`.

## Deploy

To extensions.gnome.org:

1. Bump `version-name` in `src/metadata.json`.
2. `scripts/build.sh` - validates the schema and writes `dist/mk-nepali-date.zip`.
3. Upload the zip at https://extensions.gnome.org/upload/ and wait for review.

To GitHub: commit, push, tag the version (`git tag v1.1 && git push --tags`) and attach `dist/mk-nepali-date.zip` to the release.

## Screenshots

![Calendar in Nepali](docs/screenshots/calendar-nepali.png)

![Calendar in English, with weekday](docs/screenshots/calendar-english.png)

On the desktop:

![Desktop calendar](docs/screenshots/desktop.png)

Settings:

![Settings](docs/screenshots/prefs.png)

Regenerate all screenshots with `scripts/screenshots.sh`. It runs a throwaway headless GNOME Shell, so your own session is never touched.
