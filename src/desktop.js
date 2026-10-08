// SPDX-License-Identifier: MIT

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {NepaliCalendar, localize} from './calendar.js';

const MARGIN = 48;
// Pixels the pointer must move before a press becomes a drag, so plain
// clicks still reach the buttons inside the card.
const DRAG_THRESHOLD = 8;
const SATURDAY = 6;

/** Today's date without the month grid: one line (small) or a date card (medium). */
const DesktopDate = GObject.registerClass(
class DesktopDate extends St.BoxLayout {
    _init(settings, compact) {
        super._init({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: compact ? 'nepali-desk-small' : 'nepali-desk-medium',
        });
        this._settings = settings;
        this._compact = compact;
        const label = style => {
            const l = new St.Label({style_class: style, x_align: Clutter.ActorAlign.CENTER});
            this.add_child(l);
            return l;
        };
        if (compact) {
            this._line = label('nepali-desk-line');
        } else {
            this._weekday = label('nepali-desk-weekday');
            this._day = label('nepali-desk-day');
            this._month = label('nepali-desk-month');
            this._ad = label('nepali-desk-ad');
        }
    }

    setToday(today) {
        const l = localize(this._settings);
        if (this._compact) {
            this._line.text = today ? `${l.num(today.day)} ${l.month(today.month)} ${l.num(today.year)}` : 'BS ?';
            return;
        }
        if (!today) {
            this._day.text = 'BS ?';
            return;
        }
        this._weekday.text = l.weekday(today.weekday);
        if (today.weekday === SATURDAY)
            this._weekday.add_style_class_name('nepali-cal-saturday');
        else
            this._weekday.remove_style_class_name('nepali-cal-saturday');
        this._day.text = l.num(today.day);
        this._month.text = `${l.month(today.month)} ${l.num(today.year)}`;
        this._ad.text = new Date().toLocaleDateString('en-US', {day: 'numeric', month: 'long', year: 'numeric'});
    }
});

/**
 * Today's date as a card on the desktop: the month calendar (large), a date
 * card (medium) or one line (small). It sits in the window stack just above
 * the desktop-icons window (if any), so it stays clickable but is covered by
 * normal windows. Drag it to move it.
 */
export const DesktopCalendar = GObject.registerClass(
class DesktopCalendar extends St.Bin {
    _init(settings) {
        super._init({style_class: 'nepali-desktop', reactive: true});
        this._settings = settings;
        this._today = null;
        this._buildContent();

        global.window_group.add_child(this);
        // Mutter re-sorts the window actors after a restack and adds new window
        // actors on top, so place the card again just before the next frame.
        global.display.connectObject('restacked', () => this._queueRestack(), this);
        global.window_group.connectObject('child-added', (_group, child) => {
            if (child !== this)
                this._queueRestack();
        }, this);
        Main.layoutManager.connectObject('monitors-changed', () => this._place(), this);
        this._settings.connectObject(
            'changed::desktop-position', () => this._place(),
            'changed::desktop-size', () => this._buildContent(),
            this);
        this.connect('notify::width', () => this._place());

        this.connect('button-press-event', this._onPress.bind(this));
        this.connect('motion-event', this._onMotion.bind(this));
        this.connect('button-release-event', this._onRelease.bind(this));
        this.connect('destroy', () => {
            this._endDrag();
            if (this._restackId)
                global.compositor.get_laters().remove(this._restackId);
            this._restackId = 0;
        });

        this._queueRestack();
        this._place();
    }

    _buildContent() {
        const size = this._settings.get_string('desktop-size');
        this._content?.destroy();
        this._content = size === 'large'
            ? new NepaliCalendar(this._settings, {navigation: false})
            : new DesktopDate(this._settings, size === 'small');
        for (const s of ['small', 'medium', 'large'])
            this.remove_style_class_name(`nepali-desktop-${s}`);
        this.add_style_class_name(`nepali-desktop-${size}`);
        this.set_child(this._content);
        this._content.setToday(this._today);
    }

    /** Show today's date (BS, or null if out of range). */
    setToday(today) {
        this._today = today;
        this._content.setToday(today);
    }

    _isDesktopWindow(window) {
        // Desktop Icons NG marks its window as DESKTOP (or flags it when it
        // can't) only after the window appears; its app id is there from the start.
        return window.get_window_type() === Meta.WindowType.DESKTOP ||
            window.get_gtk_application_id() === 'com.rastersoft.ding' ||
            !!window.customJS_ding?._keepAtBottom;
    }

    _queueRestack() {
        if (this._restackId)
            return;
        this._restackId = global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._restackId = 0;
            this._restack();
            return GLib.SOURCE_REMOVE;
        });
    }

    _restack() {
        // The background group is always the bottom child of the window group.
        // Scan the children: global.get_window_actors() leaves out windows
        // hidden from the window list, which Desktop Icons NG's window is.
        let sibling = global.window_group.get_first_child();
        for (const actor of global.window_group.get_children()) {
            if (actor.meta_window && this._isDesktopWindow(actor.meta_window))
                sibling = actor;
        }
        if (sibling !== this)
            global.window_group.set_child_above_sibling(this, sibling);
    }

    _place() {
        if (this._dragOffset)
            return;
        let [x, y] = this._settings.get_value('desktop-position').deep_unpack();
        if (x < 0 || y < 0) {
            const monitor = Main.layoutManager.primaryMonitor;
            if (!monitor)
                return;
            x = monitor.x + monitor.width - this.width - MARGIN;
            y = monitor.y + Main.panel.height + MARGIN;
        }
        this._moveTo(x, y);
    }

    _moveTo(x, y) {
        const maxX = Math.max(0, global.stage.width - this.width);
        const maxY = Math.max(0, global.stage.height - this.height);
        this.set_position(
            Math.round(Math.min(Math.max(x, 0), maxX)),
            Math.round(Math.min(Math.max(y, 0), maxY)));
    }

    _onPress(_actor, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;
        // Don't take the press: a click on a day or the Today button must
        // still work. The drag starts in _onMotion once the pointer moves.
        this._pressStart = event.get_coords();
        return Clutter.EVENT_PROPAGATE;
    }

    _onMotion(_actor, event) {
        if (!this._pressStart)
            return Clutter.EVENT_PROPAGATE;
        if (!(event.get_state() & Clutter.ModifierType.BUTTON1_MASK)) {
            this._endDrag();
            return Clutter.EVENT_PROPAGATE;
        }
        const [x, y] = event.get_coords();
        if (!this._dragOffset) {
            const [sx, sy] = this._pressStart;
            if (Math.hypot(x - sx, y - sy) < DRAG_THRESHOLD)
                return Clutter.EVENT_PROPAGATE;
            this._dragOffset = [sx - this.x, sy - this.y];
            this._grab = global.stage.grab(this);
        }
        this._moveTo(x - this._dragOffset[0], y - this._dragOffset[1]);
        return Clutter.EVENT_STOP;
    }

    _onRelease() {
        const dragged = !!this._dragOffset;
        this._endDrag();
        if (!dragged)
            return Clutter.EVENT_PROPAGATE;
        this._settings.set_value('desktop-position', new GLib.Variant('(ii)', [this.x, this.y]));
        return Clutter.EVENT_STOP;
    }

    _endDrag() {
        this._grab?.dismiss();
        this._grab = null;
        this._dragOffset = null;
        this._pressStart = null;
    }
});
