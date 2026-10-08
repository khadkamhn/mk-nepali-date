// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function comboRow(settings, key, title, options) {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(options.map(([, label]) => label)),
    });
    const sync = () => {
        row.selected = Math.max(0, options.findIndex(([value]) => value === settings.get_string(key)));
    };
    sync();
    row.connect('notify::selected', () => settings.set_string(key, options[row.selected][0]));
    settings.connect(`changed::${key}`, sync);
    return row;
}

function switchRow(settings, key, title) {
    const row = new Adw.SwitchRow({title});
    settings.bind(key, row, 'active', 0);
    return row;
}

export default class NepaliDatePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        const display = new Adw.PreferencesGroup({title: 'Display'});
        display.add(comboRow(settings, 'language', 'Language', [
            ['nepali', 'नेपाली'],
            ['english', 'English'],
        ]));
        display.add(switchRow(settings, 'show-weekday', 'Show weekday in top bar'));
        const weekdayFormat = comboRow(settings, 'weekday-format', 'Weekday format', [
            ['short', 'Short (आइत, Thu)'],
            ['full', 'Full (आइतबार, Thursday)'],
        ]);
        settings.bind('show-weekday', weekdayFormat, 'visible', 0);
        display.add(weekdayFormat);
        display.add(switchRow(settings, 'show-year', 'Show year in top bar'));
        page.add(display);

        const placement = new Adw.PreferencesGroup({title: 'Placement'});
        placement.add(comboRow(settings, 'panel-position', 'Top bar position', [
            ['left', 'Left'],
            ['center', 'Center'],
            ['right', 'Right'],
        ]));
        page.add(placement);

        window.add(page);
    }
}
