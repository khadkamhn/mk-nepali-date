// SPDX-License-Identifier: MIT

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as BS from './bs.js';
import {NepaliCalendar} from './calendar.js';
import {DesktopCalendar} from './desktop.js';

const NepaliDateIndicator = GObject.registerClass(
class NepaliDateIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.5, 'Nepali Date');
        this._settings = settings;

        this._label = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'nepali-date-label',
        });
        this.add_child(this._label);

        this._calendar = new NepaliCalendar(settings);
        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        item.add_child(this._calendar);
        this.menu.addMenuItem(item);
        this.menu.connectObject('open-state-changed', (_menu, open) => {
            if (open)
                this._calendar.showToday();
        }, this);
    }

    get _nepali() {
        return this._settings.get_string('language') === 'nepali';
    }

    _num(n) {
        return this._nepali ? BS.toNepaliDigits(n) : String(n);
    }

    /** Show today's date (BS, or null if out of range) in the label and popup. */
    setToday(today) {
        this._calendar.setToday(today);
        if (!today) {
            this._label.text = 'BS ?';
            return;
        }

        const parts = [];
        if (this._settings.get_boolean('show-weekday')) {
            const weekday = this._settings.get_string('weekday-format') === 'full'
                ? (this._nepali ? BS.WEEKDAYS_NE : BS.WEEKDAYS_EN)[today.weekday]
                : (this._nepali ? BS.WEEKDAYS_SHORT_NE : BS.WEEKDAYS_SHORT_EN)[today.weekday];
            parts.push(`${weekday},`);
        }
        parts.push(this._num(today.day), (this._nepali ? BS.MONTHS_NE : BS.MONTHS_EN)[today.month - 1]);
        if (this._settings.get_boolean('show-year'))
            parts.push(this._num(today.year));
        this._label.text = parts.join(' ');
        if (this._nepali)
            this._label.add_style_class_name('nepali-date-ne');
        else
            this._label.remove_style_class_name('nepali-date-ne');
    }
});

export default class NepaliDateExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._today = null;
        this._addIndicator();
        this._syncDesktop();
        this._settings.connectObject(
            'changed::panel-position', () => {
                this._indicator?.destroy();
                this._addIndicator();
            },
            'changed::show-desktop-calendar', () => this._syncDesktop(),
            'changed', (_settings, key) => {
                if (key !== 'desktop-position')
                    this._update(true);
            },
            this);

        // Re-check every 30s; cheap, and survives suspend/resume and timezone changes.
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this._update(false);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _update(force) {
        const today = BS.fromGregorian(new Date());
        const changed = !this._today || !today ||
            today.year !== this._today.year || today.month !== this._today.month || today.day !== this._today.day;
        if (!changed && !force)
            return;
        this._today = today;
        this._indicator?.setToday(today);
        this._desktop?.setToday(today);
    }

    _addIndicator() {
        this._indicator = new NepaliDateIndicator(this._settings);
        const position = this._settings.get_string('panel-position');
        Main.panel.addToStatusArea(this.uuid, this._indicator, position === 'right' ? 0 : -1, position);
        this._update(true);
    }

    _syncDesktop() {
        const show = this._settings.get_boolean('show-desktop-calendar');
        if (show && !this._desktop) {
            this._desktop = new DesktopCalendar(this._settings);
            this._update(true);
        } else if (!show && this._desktop) {
            this._desktop.destroy();
            this._desktop = null;
        }
    }

    disable() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        this._settings?.disconnectObject(this);
        this._indicator?.destroy();
        this._indicator = null;
        this._desktop?.destroy();
        this._desktop = null;
        this._settings = null;
    }
}
