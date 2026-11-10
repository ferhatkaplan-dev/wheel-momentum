# Changelog

## 1.0.1

- Settings changes no longer restart the daemon: the tray sends `SIGHUP` and the
  daemon applies multiplier/friction/rate/max speed live. This avoids systemd's
  start rate limit, which could leave the service `failed` with
  `start-limit-hit` after a few slider moves.
- `mode` changes apply over `SIGHUP` too: devices are rebuilt in place.
- Enabling from the tray clears a failed state (`reset-failed`) first.
- The tray treats `activating` as enabled, so it no longer shows *Off* while the
  `Type=notify` unit is still starting.

## 1.0.0

First public release.

- System-wide inertial scrolling: every wheel detent becomes a decaying stream
  of `REL_WHEEL_HI_RES` events (120 units = one detent).
- Two modes: `additive` (default, never takes the device, cannot lose clicks or
  scroll) and `grab` (full takeover for maximum smoothness).
- Fail-open behaviour: forwarding errors release the device back to the kernel,
  failing devices are not re-attached.
- systemd `Type=notify` watchdog kills a hung daemon, which drops any grab.
- Touchpads and tablets (`ABS_X`) are skipped; multiple mice are supported.
- Tray applet (StatusNotifierItem) with enable switch, presets, settings panel,
  autostart and a game-safe switch.
- `--selftest` for the scroll model and `--probe` for read-only diagnostics.
- Installer sets up a private venv, installs the executables and both user units.
