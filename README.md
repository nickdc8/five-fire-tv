# Five for Fire TV

> **80s & 90s UK TV is back!**

![Five retro television banner](firetv/app/src/main/res/drawable-nodpi/five_banner.png)

Five is a deliberately simple live TV app for Android-based Fire TV Sticks. It replaces a busy viewing screen with five numbered choices, remote-first controls, and a Nostalgia section for UK archive clips and advert compilations.

It is designed for people who prefer a small, familiar set of choices, including older viewers and people experiencing changes in memory or attention. A family member or trusted helper can set it up. Five is not a medical product, and it does not uninstall or disable Fire OS apps: “debloat” here means a simpler TV viewing experience.

## Screenshots

These are cropped captures of the web preview. The Fire TV app uses the same Five screen and adds native remote and video playback support.

![Five start screen](screenshots/start-screen.png)

![Five playing BBC One with channel controls](screenshots/channel-one.png)

![Five menu with Nostalgia and settings options](screenshots/menu-and-nostalgia.png)

## What works

| Remote key | Channel | Playback in Five |
| --- | --- | --- |
| 1 | BBC One | Yes |
| 2 | BBC Two | Yes |
| 3 | ITV1 | ITVX app handoff |
| 4 | Channel 4 | Yes, local helper required |
| 5 | Channel 5 | Yes, local helper required |

Nostalgia plays selected YouTube archive videos inside Five. Up/down and Select navigate the app menu, and Back returns from ITVX to Five.

**ITV note:** ITVX currently requires its official Fire TV app. Direct ITVX playback inside Five is being explored, with no release date promised. The desktop Chrome connector used in the web prototype does not work on Fire TV.

## Get started

See [Fire TV build, install, and connection instructions](firetv/README.md). In short, build and install the APK, start the local helper on an always-on computer for channels 4 and 5, and run `scripts/connect-fire-tv.sh` on that same machine to establish the Fire TV tunnel. In my setup, an always-on Raspberry Pi runs the helper and ADB tunnel, so the Mac can be off while Five is in use.

If the Stick disconnects or ADB restarts, ADB removes its reverse tunnel. Run `./scripts/connect-fire-tv.sh <device-serial> --launch` again on the helper host. The script checks the helper, recreates `adb reverse tcp:4186 tcp:4186`, and verifies the mapping before reopening Five. For an always-on Pi, configure the helper and tunnel to start and reconnect at boot (for example, with systemd); reserve the Stick's IP address in the router so ADB can reconnect to it. The Pi and Stick must be on the same home network.

### Deployed Pi services

This repository is the source of truth for Five, replacing the earlier `five-tv` browser prototype. The Fire TV app is installed as `tv.five.fire` and can run alongside the Omarchy TV launcher.

The existing Raspberry Pi deployment was inspected on 25 October 2026. Its runtime is in `~/five-fire-tv-runtime`, containing `dist/` and `local-helper/`. Two system services keep it available:

- `five-fire-tv-helper.service` runs Node.js with `local-helper/server.mjs`, listening only on `127.0.0.1:4186`, and restarts on failure.
- `five-fire-tv-adb-tunnel.service` runs `/usr/local/bin/five-fire-tv-adb-tunnel`. Every 15 seconds, the script reconnects to the Stick and restores `adb reverse tcp:4186 tcp:4186`. Its target is configured through `FIVE_FIRE_TV_DEVICE` in the service. The service restarts automatically.

Both services were active when inspected; this does not establish uninterrupted playback. The tunnel makes the Stick's `127.0.0.1:4186` reach the Pi helper, so the development computer can be switched off.

For this deployment, run these checks on the Pi if channels 4 and 5 lose signal:

```sh
systemctl status five-fire-tv-helper.service five-fire-tv-adb-tunnel.service
journalctl -u five-fire-tv-helper.service -u five-fire-tv-adb-tunnel.service -n 50 --no-pager
curl --fail http://127.0.0.1:4186/api/health
adb -s <fire-tv-ip>:5555 reverse --list
```

The reverse list should contain `tcp:4186 tcp:4186`. Check the service configuration with `systemctl cat five-fire-tv-helper.service five-fire-tv-adb-tunnel.service` if the runtime path or device address changes. These service names describe the existing deployment; a new installation must configure its own services as described in the [Pi setup instructions](firetv/README.md#always-on-raspberry-pi-setup).

### Ask an AI assistant to install Five

Open this repository in an AI coding assistant with terminal access, then paste:

> Help me install this Five app on my own Fire TV Stick. Read the repository README and `firetv/README.md` first. Check which operating system this computer uses and whether JDK 17, Android SDK, Node.js, and ADB are available. Guide me through enabling ADB debugging on the Stick and connecting to it; ask me for its IP or serial if needed. Build the APK from this repository and install it on my Stick. For channels 4 and 5, ask whether I want to run the helper on this computer or on an always-on Raspberry Pi or other Linux host. Start the helper on that host, run `scripts/connect-fire-tv.sh <device-serial> --launch` there, and verify the ADB reverse tunnel. If I choose a Pi, guide me through copying `dist/` and `local-helper/`, enabling Node.js and ADB, and configuring the helper and tunnel to restart after reboot or disconnection. If channels 4 or 5 show no signal, check that the helper is running and restore the tunnel after any ADB reconnect. Channel 3 opens the official ITVX app; ITVX does not currently play inside Five. Do not ask me for account passwords or publish any of my device details.

If the assistant cannot access a terminal or the Fire TV over ADB, have it walk you through the commands in `firetv/README.md`.

## Fire TV compatibility

Five is an Android APK for Android-based Fire OS devices. It does not support Roku or Fire TV devices running Vega OS. This early proof of concept has been tried on one Fire TV Stick; other models, sustained playback, and future Fire OS versions remain to be verified.

## Privacy and playback

The local helper binds only to `127.0.0.1` and uses ADB reverse for the Stick connection. It does not contain an ITV login, Chrome extension, or account token. No analytics are included. BBC, Channel 4, Channel 5, and YouTube playback requests go to their respective providers.

Channel 4 and Channel 5 use their current live streams and normal Widevine DRM playback. This project does not extract DRM keys or alter protected video. Availability depends on broadcaster services and may change.

The optional sample video in `dist/sample.mp4` is the CC0 flower clip from [MDN's interactive media examples](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4).

## Build the Android app

Install JDK 17 and Android SDK platform 36/build tools 35 or newer, then:

```sh
cd firetv
./gradlew assembleDebug
```

The APK appears at `firetv/app/build/outputs/apk/debug/app-debug.apk`.

## Project contents

- `dist/` — Five web interface and bundled player libraries.
- `firetv/` — Android TV app wrapper and remote-control integration.
- `local-helper/` — loopback server and Channel 4/5 playback providers.
- `scripts/connect-fire-tv.sh` — helper health check, ADB reverse setup, optional relaunch.
- `firetv/app/src/main/res/drawable-nodpi/five_banner.png` — Fire TV banner artwork.

## License

This repository has no blanket license for reuse. Notices for the bundled hls.js 1.6.13 and dash.js 4.7.4 distributions are in [`third-party-licenses/`](third-party-licenses/). Android libraries are resolved by Gradle under their upstream licenses. Broadcaster streams and YouTube videos remain subject to their providers’ terms.
