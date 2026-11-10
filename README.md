# wheel-momentum

Inertial (momentum) scrolling for the mouse wheel on Linux — the same buttery
glide your touchpad has, in every application.

A scroll wheel only sends discrete detents: no velocity, no "release" event,
so browsers and toolkits can only animate each step. **wheel-momentum** sits
below the applications: it grabs the mouse at the evdev layer and turns every
detent into a decaying stream of high-resolution wheel events, which the
compositor renders as smooth pixel scrolling that keeps gliding and slowly
settles after you stop turning.

```
mouse ──EVIOCGRAB──▶ wheel-momentum ──uinput (REL_WHEEL_HI_RES)──▶ compositor ──▶ app
                          │
                          └─ exponential decay: 120 units = 1 detent
```

## Features

- Works **system-wide** — terminals, editors, browsers, Electron apps, GTK/Qt.
- No root daemon: runs as your user, only needs `/dev/uinput` write access.
- Touchpads and tablets are never touched (they have `ABS_X`, so they're skipped).
- Tray applet with an enable switch, presets and a settings panel (StatusNotifierItem).
- Two `systemd --user` units, no extra background services.
- Safety: the grab is released by the kernel if the daemon dies, so the mouse
  can never stay dead.

## Requirements

- Linux with `libinput`-based input stack. Tested on **Sway/wlroots 0.19**
  (Wayland). KWin/Mutter should work; X11 via `xf86-input-libinput` is untested.
- High-resolution wheel support (`wl_pointer.axis_value120`) for the smooth part:
  wlroots ≥ 0.17, recent KWin/Mutter. Older stacks still scroll, just coarser.
- `python3` + `systemd` (user services) for the installer.
- For the tray: `python-gobject`, `gtk3`, `libayatana-appindicator`, and a
  StatusNotifierItem host (waybar's `tray` module, KDE, GNOME extension, …).
- Read access to `/dev/input/event*` and write access to `/dev/uinput`.

## Install

```bash
git clone https://github.com/REdDomates/wheel-momentum.git
cd wheel-momentum
./install.sh
```

The installer creates a private venv with `python-evdev`, copies the executables
to `~/.local/bin`, installs the two user units and starts them.

## Permissions

Reading input devices needs the `input` group:

```bash
sudo usermod -aG input "$USER"   # then log out and back in
```

Writing `/dev/uinput` is usually already granted by systemd-logind via an ACL
(`uaccess`). If it isn't:

```bash
sudo tee /etc/udev/rules.d/60-uinput.rules >/dev/null <<'EOF'
KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"
EOF
sudo udevadm control --reload && sudo modprobe uinput
```

## Usage

Tray icon (blue mouse when enabled, grey slashed mouse when off):

| Item | Effect |
|---|---|
| **Enabled** | starts/stops and enables/disables the daemon |
| **Presets ▸** | Soft / Balanced / Firm / Instant, applied immediately |
| **Settings…** | panel with sliders |
| **Start on login** | autostart for the tray applet |
| **Quit** | exits the applet (daemon keeps running) |

Open the panel from a terminal or a keybinding:

```bash
wheel-momentum-tray --show
# sway: bindsym $mod+Shift+w exec wheel-momentum-tray --show
```

CLI:

```bash
systemctl --user status wheel-momentum       # state
systemctl --user restart wheel-momentum      # after editing config
systemctl --user stop wheel-momentum         # mouse returns to native instantly
journalctl --user -u wheel-momentum -f       # live log ("grabbed: ..." lines)
wheel-momentum --selftest                    # verify math + uinput emission
```

## Configuration

`~/.config/wheel-momentum/config.json`, then
`systemctl --user restart wheel-momentum` (or use the panel, which does it for you).

| Key | Default | Meaning |
|---|---|---|
| `multiplier` | `1.4` | Total travel per detent. `1.0` = exactly one detent, `1.8` = strong inertia |
| `friction` | `0.93` | Damping per 16.7 ms. `0.90` long glide, `0.96` stops quickly |
| `hz` | `125` | Emission rate. `200` is smoother, slightly more CPU |
| `max_velocity` | `4.0` | Velocity ceiling (hi-res units/ms) |
| `stop_velocity` | `0.02` | Below this the animation ends |
| `exclude` | `[]` | Device name substrings to ignore, e.g. `["jogdial"]` |
| `include` | `[]` | If set, only these device names are grabbed |

Presets shipped with the tray:

| Preset | multiplier | friction |
|---|---|---|
| Soft | 1.9 | 0.905 |
| Balanced | 1.4 | 0.93 |
| Firm | 1.1 | 0.96 |
| Instant | 1.0 | 0.99 |

## Notes and tuning

- **Double momentum in Firefox/Zen.** Firefox applies its own kinetic scrolling
  to touchpad-like pixel input. If the glide feels too strong, lower
  `multiplier` to `1.0` or set `apz.gtk.kinetic_scroll.enabled` to `false` in
  `about:config`.
- **Gaming.** The daemon sits in the input path and forwards everything 1:1,
  but some games behave differently with a virtual device. Toggle *Enabled* off
  in the tray, or add the device to `exclude`.
- **Devices.** Like touchpads, anything with `ABS_X` (tablets, touchscreens) is
  skipped. Multi-device setups are fine: each matching mouse gets its own clone.

## Troubleshooting

| Symptom | Check |
|---|---|
| Nothing happens | `journalctl --user -u wheel-momentum -f` — did it print `grabbed: <your mouse>`? |
| Mouse frozen | `systemctl --user stop wheel-momentum`; the kernel releases the grab when the process exits |
| No tray icon | your bar needs a StatusNotifierItem host (waybar's `tray` module) |
| "uinput is not writable" | see [Permissions](#permissions) |
| Tray window tiled | add `for_window [app_id="wheel-momentum-tray"] floating enable, move position center` to your sway config |

## Uninstall

```bash
./uninstall.sh          # keeps ~/.config/wheel-momentum
./uninstall.sh --purge  # removes config too
```

## Optional: Zen/Firefox extension

`zen-extension/` contains a standalone WebExtension that does the same decay in
JavaScript inside the browser (no system access needed). Install it from
`about:addons` → gear → *Install Add-on From File…*; `xpinstall.signatures.required`
must be `false` for an unsigned build. Do not run it together with the daemon —
one is enough.

## License

MIT
