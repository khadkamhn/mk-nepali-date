// SPDX-License-Identifier: MIT

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as BS from './bs.js';

const SATURDAY = 6;

/** Formatting helpers for the current language setting. */
export function localize(settings) {
    const nepali = settings.get_string('language') === 'nepali';
    return {
        nepali,
        num: n => nepali ? BS.toNepaliDigits(n) : String(n),
        month: m => (nepali ? BS.MONTHS_NE : BS.MONTHS_EN)[m - 1],
        weekday: w => (nepali ? BS.WEEKDAYS_NE : BS.WEEKDAYS_EN)[w],
    };
}

/**
 * Month calendar with BS and AD days, a Today button and, unless
 * `navigation` is false, previous/next month arrows.
 */
export const NepaliCalendar = GObject.registerClass(
class NepaliCalendar extends St.BoxLayout {
    _init(settings, {navigation = true} = {}) {
        super._init({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'nepali-cal',
        });
        this._settings = settings;
        this._today = null;

        // Header: ‹  Month Year  ›
        const header = new St.BoxLayout({style_class: 'nepali-cal-header'});
        if (navigation) {
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
            this._prevButton.connect('clicked', () => this._shiftMonth(-1));
            this._nextButton.connect('clicked', () => this._shiftMonth(1));
        }
        const titleBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });
        this._title = new St.Label({style_class: 'nepali-cal-title', x_align: Clutter.ActorAlign.CENTER});
        this._subtitle = new St.Label({style_class: 'nepali-cal-subtitle', x_align: Clutter.ActorAlign.CENTER});
        titleBox.add_child(this._title);
        titleBox.add_child(this._subtitle);
        if (navigation)
            header.add_child(this._prevButton);
        header.add_child(titleBox);
        if (navigation)
            header.add_child(this._nextButton);
        this.add_child(header);

        // Day grid
        this._gridLayout = new Clutter.GridLayout({column_homogeneous: true, row_homogeneous: true});
        this._grid = new St.Widget({layout_manager: this._gridLayout, style_class: 'nepali-cal-grid'});
        this.add_child(this._grid);

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
        this._todayButton.connect('clicked', () => this.showToday());
        footer.add_child(details);
        footer.add_child(this._todayButton);
        this.add_child(footer);
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

    _formatLong(bs) {
        const weekday = (this._nepali ? BS.WEEKDAYS_NE : BS.WEEKDAYS_EN)[bs.weekday];
        return `${weekday}, ${this._num(bs.day)} ${this._monthName(bs.month)} ${this._num(bs.year)}`;
    }

    /** Update today's date (BS, or null if out of range) and redraw. */
    setToday(today) {
        this._today = today;
        this._todayButton.label = this._nepali ? 'आज' : 'Today';
        if (this._viewYear === undefined)
            this.showToday();
        else
            this.render();
    }

    showToday() {
        if (!this._today)
            return;
        this._viewYear = this._today.year;
        this._viewMonth = this._today.month;
        this._selected = this._today;
        this.render();
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
        this.render();
    }

    render() {
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

        if (this._prevButton) {
            this._prevButton.reactive = BS.isSupported(m === 1 ? y - 1 : y);
            this._nextButton.reactive = BS.isSupported(m === 12 ? y + 1 : y);
        }

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
                this.render();
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
});
