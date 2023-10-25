// Copyright Sebastian Wiesner <sebastian@swsnr.de>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Alternatively, the contents of this file may be used under the terms
// of the GNU General Public License Version 2 or later, as described below:
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from "gi://St";
import Clutter from "gi://Clutter";

import {
  Extension,
  ExtensionMetadata,
} from "resource:///org/gnome/shell/extensions/extension.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { PopupMenuItem } from "resource:///org/gnome/shell/ui/popupMenu.js";

// Shouldn't this be upstreamed to Gjs?
Gio._promisify(Gio.Subprocess.prototype, "communicate_utf8_async");

interface HomeIndicatorConstructorProperties {
  readonly name: string;
}

const HomeIndicator = GObject.registerClass(
  class HomeIndicator extends PanelMenu.Button {
    private readonly label: St.Label;

    constructor({ name }: HomeIndicatorConstructorProperties) {
      super(0, name, false);
      this.label = new St.Label();
      this.label.clutter_text.y_align = Clutter.ActorAlign.CENTER;
      this.add_child(this.label);
      this.set_label_actor(this.label);
      this.showRoutes([]);
    }

    showRoutes(routes: readonly string[]): void {
      this.menu.removeAll();
      if (0 < routes.length && routes[0]) {
        this.label.set_text(routes[0]);
        routes.slice(1).forEach((route) => {
          this.menu.addMenuItem(new PopupMenuItem(route));
        });
      } else {
        this.label.set_text("🚆 n.a.");
        this.menu.addMenuItem(new PopupMenuItem("no more routes"));
      }
    }

    showError(error: unknown) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.label.set_text(`Error: ${error}`);
      this.menu.removeAll();
    }
  },
);

type HomeIndicator = InstanceType<typeof HomeIndicator>;

const getRoutes = async (): Promise<readonly string[]> => {
  const flags =
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;
  const proc = Gio.Subprocess.new(["home"], flags);
  const [stdout, stderr] = await proc.communicate_utf8_async(null, null);
  if (proc.get_successful()) {
    return (stdout ?? "").trim().split("\n");
  } else {
    throw new Error(`home failed: ${stderr}`);
  }
};

const updateRoutesOnIndicator = async (
  indicator: HomeIndicator,
): Promise<void> => {
  try {
    indicator.showRoutes(await getRoutes());
  } catch (error) {
    console.error("Failed to update routes", error);
    indicator.showError(error);
  }
};

class EnabledExtension {
  private readonly sourceIdOfTimer: number;
  // Not read-only because we null the indicator after it's destroyed to prevent
  // use after destroy.
  private indicator: HomeIndicator | null;

  constructor(metadata: ExtensionMetadata) {
    this.indicator = new HomeIndicator({ name: `${metadata.uuid} indicator` });
    Main.panel.addToStatusArea(metadata.uuid, this.indicator);
    this.sourceIdOfTimer = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      60,
      () => {
        if (this.indicator !== null) {
          void updateRoutesOnIndicator(this.indicator);
          return true;
        } else {
          // If the indicator is gone, there's no point in continuing the timer.
          return false;
        }
      },
    );
    console.info("Updating initial routes")
    // Update routes immediately after the extension is enabled.
    void updateRoutesOnIndicator(this.indicator);
  }

  destroy(): void {
    GLib.source_remove(this.sourceIdOfTimer);
    this.indicator?.destroy();
    this.indicator = null;
  }
}

export default class HelloWorldExtension extends Extension {
  private enabledExtension?: EnabledExtension | null;

  override enable(): void {
    if (!this.enabledExtension) {
      this.enabledExtension = new EnabledExtension(this.metadata);
    }
  }

  override disable(): void {
    this.enabledExtension?.destroy();
    this.enabledExtension = null;
  }
}
