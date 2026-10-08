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

const SATURDAY = 6;

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

        this._buildMenu();

        this._settings.connectObject('changed', () => this._refresh(true), this);
        this.menu.connectObject('open-state-changed', (_menu, open) => {
            if (open)
                this._showMonthOf(this._today);
        }, this);

        this._today = null;
        this._refresh(true);

        // Re-check every 30s; cheap, and survives suspend/resume and timezone changes.
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
            this._refresh(false);
            return GLib.SOURCE_CONTINUE;
        });
    }

    get _nepali() {
        return this._settings.get_string('language') === 'nepali';
    }

    _num(n) {
        return this._nepali ? BS.toNepaliDigits(n) : String(n);
    }

    _monthName(m) {
        return (this._nepali ? BS.MONTHS_NE : BS.MONTHS_EN)[m - 1];
    }

    _weekdayName(w) {
        return (this._nepali ? BS.WEEKDAYS_NE : BS.WEEKDAYS_EN)[w];
    }

    _formatLong(bs) {
        return `${this._weekdayName(bs.weekday)}, ${this._num(bs.day)} ${this._monthName(bs.month)} ${this._num(bs.year)}`;
    }

    _buildMenu() {
        const box = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'nepali-cal',
        });

        // Header: ‹  Month Year  ›
        const header = new St.BoxLayout({style_class: 'nepali-cal-header'});
        this._prevButton = new St.Button({
            style_class: 'icon-button nepali-cal-nav',
            child: new St.Icon({icon_name: 'pan-start-symbolic'}),
            accessible_name: 'Previous month',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._nextButton = new St.Button({
            style_class: 'icon-button nepali-cal-nav',
            child: new St.Icon({icon_name: 'pan-end-symbolic'}),
            accessible_name: 'Next month',
            y_align: Clutter.ActorAlign.CENTER,
        });
        const titleBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });
        this._title = new St.Label({style_class: 'nepali-cal-title', x_align: Clutter.ActorAlign.CENTER});
        this._subtitle = new St.Label({style_class: 'nepali-cal-subtitle', x_align: Clutter.ActorAlign.CENTER});
        titleBox.add_child(this._title);
        titleBox.add_child(this._subtitle);
        header.add_child(this._prevButton);
        header.add_child(titleBox);
        header.add_child(this._nextButton);
        this._prevButton.connect('clicked', () => this._shiftMonth(-1));
        this._nextButton.connect('clicked', () => this._shiftMonth(1));
        box.add_child(header);

        // Day grid
        this._gridLayout = new Clutter.GridLayout({column_homogeneous: true, row_homogeneous: true});
        this._grid = new St.Widget({layout_manager: this._gridLayout, style_class: 'nepali-cal-grid'});
        box.add_child(this._grid);

        // Footer: selected/today details + Today button
        const footer = new St.BoxLayout({style_class: 'nepali-cal-footer'});
        const details = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, x_expand: true});
        this._detail = new St.Label({style_class: 'nepali-cal-detail'});
        this._detailAd = new St.Label({style_class: 'nepali-cal-detail-ad'});
        details.add_child(this._detail);
        details.add_child(this._detailAd);
        this._todayButton = new St.Button({
            style_class: 'button nepali-cal-today-button',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._todayButton.connect('clicked', () => this._showMonthOf(this._today));
        footer.add_child(details);
        footer.add_child(this._todayButton);
        box.add_child(footer);

        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        item.add_child(box);
        this.menu.addMenuItem(item);
    }

    _refresh(force) {
        const today = BS.fromGregorian(new Date());
        const changed = !this._today || !today ||
            today.year !== this._today.year || today.month !== this._today.month || today.day !== this._today.day;
        if (!changed && !force)
            return;
        this._today = today;

        if (!today) {
            this._label.text = 'BS ?';
            return;
        }

        const parts = [];
        if (this._settings.get_boolean('show-weekday')) {
            const weekday = this._settings.get_string('weekday-format') === 'full'
                ? this._weekdayName(today.weekday)
                : (this._nepali ? BS.WEEKDAYS_SHORT_NE : BS.WEEKDAYS_SHORT_EN)[today.weekday];
            parts.push(`${weekday},`);
        }
        parts.push(this._num(today.day), this._monthName(today.month));
        if (this._settings.get_boolean('show-year'))
            parts.push(this._num(today.year));
        this._label.text = parts.join(' ');
        if (this._nepali)
            this._label.add_style_class_name('nepali-date-ne');
        else
            this._label.remove_style_class_name('nepali-date-ne');

        this._todayButton.label = this._nepali ? 'आज' : 'Today';
        if (this.menu.isOpen)
            this._renderMonth();
    }

    _showMonthOf(bs) {
        if (!bs)
            return;
        this._viewYear = bs.year;
        this._viewMonth = bs.month;
        this._selected = bs;
        this._renderMonth();
    }

    _shiftMonth(delta) {
        let m = this._viewMonth + delta;
        let y = this._viewYear;
        if (m < 1) {
            m = 12;
            y--;
        } else if (m > 12) {
            m = 1;
            y++;
        }
        if (!BS.isSupported(y))
            return;
        this._viewYear = y;
        this._viewMonth = m;
        this._renderMonth();
    }

    _renderMonth() {
        const y = this._viewYear, m = this._viewMonth;
        if (y === undefined)
            return;

        this._grid.destroy_all_children();

        const first = BS.toGregorian(y, m, 1);
        const count = BS.daysInMonth(y, m);
        const last = BS.toGregorian(y, m, count);

        this._title.text = `${this._monthName(m)} ${this._num(y)}`;
        const fmt = d => d.toLocaleDateString('en-US', {month: 'short', year: 'numeric'});
        this._subtitle.text = fmt(first) === fmt(last) ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;

        this._prevButton.reactive = BS.isSupported(m === 1 ? y - 1 : y);
        this._nextButton.reactive = BS.isSupported(m === 12 ? y + 1 : y);

        const shortDays = this._nepali ? BS.WEEKDAYS_SHORT_NE : BS.WEEKDAYS_SHORT_EN;
        shortDays.forEach((name, col) => {
            const label = new St.Label({
                text: name,
                style_class: 'nepali-cal-weekday',
                x_align: Clutter.ActorAlign.CENTER,
            });
            if (col === SATURDAY)
                label.add_style_class_name('nepali-cal-saturday');
            this._gridLayout.attach(label, col, 0, 1, 1);
        });

        const startCol = first.getDay();
        for (let day = 1; day <= count; day++) {
            const pos = startCol + day - 1;
            const col = pos % 7;
            const ad = new Date(first.getFullYear(), first.getMonth(), first.getDate() + day - 1);

            const cell = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
            cell.add_child(new St.Label({
                text: this._num(day),
                style_class: 'nepali-cal-day-bs',
                x_align: Clutter.ActorAlign.CENTER,
            }));
            cell.add_child(new St.Label({
                text: String(ad.getDate()),
                style_class: 'nepali-cal-day-ad',
                x_align: Clutter.ActorAlign.CENTER,
            }));

            const button = new St.Button({style_class: 'nepali-cal-day', child: cell, can_focus: true});
            if (col === SATURDAY)
                button.add_style_class_name('nepali-cal-saturday');
            if (this._today && y === this._today.year && m === this._today.month && day === this._today.day)
                button.add_style_class_name('nepali-cal-today');
            if (this._selected && y === this._selected.year && m === this._selected.month && day === this._selected.day)
                button.add_style_class_name('nepali-cal-selected');

            button.connect('clicked', () => {
                this._selected = {year: y, month: m, day, weekday: col};
                this._renderMonth();
            });
            this._gridLayout.attach(button, col, 1 + Math.floor(pos / 7), 1, 1);
        }

        const sel = this._selected && this._selected.year === y && this._selected.month === m
            ? this._selected : null;
        if (sel) {
            this._detail.text = this._formatLong(sel);
            this._detailAd.text = BS.toGregorian(sel.year, sel.month, sel.day).toLocaleDateString('en-US', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            });
        } else {
            this._detail.text = '';
            this._detailAd.text = '';
        }
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        this._settings.disconnectObject(this);
        super.destroy();
    }
});

export default class NepaliDateExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._addIndicator();
        this._settings.connectObject('changed::panel-position', () => {
            this._indicator?.destroy();
            this._addIndicator();
        }, this);
    }

    _addIndicator() {
        this._indicator = new NepaliDateIndicator(this._settings);
        const position = this._settings.get_string('panel-position');
        Main.panel.addToStatusArea(this.uuid, this._indicator, position === 'right' ? 0 : -1, position);
    }

    disable() {
        this._settings?.disconnectObject(this);
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }
}
