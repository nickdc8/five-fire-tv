# Five for Fire TV

Five is a simple, full-screen live TV app for Android-based Fire TV devices. It offers five familiar numbered channels, remote-first controls, and a Nostalgia section. ITV1 opens the official ITVX app; channels 4 and 5 play inside Five through the local helper.

## Build

Requirements: JDK 17 and Android SDK platform 36/build tools 35 or newer. The Gradle wrapper is included.

```sh
./gradlew assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Install and connect

Enable ADB debugging in Fire TV developer options, then connect the device:

```sh
adb connect <fire-tv-ip>:5555
adb install -r firetv/app/build/outputs/apk/debug/app-debug.apk
```

Start the helper from the project root on an always-on machine and leave it running:

```sh
node local-helper/server.mjs
```

In a second terminal on that same machine, establish the device-to-helper tunnel:

```sh
./scripts/connect-fire-tv.sh
```

With multiple ADB devices, pass the Fire TV serial (for example `192.168.1.50:5555`). To reopen Five after connecting:

```sh
./scripts/connect-fire-tv.sh <device-serial> --launch
```

The script checks that the helper is answering, creates `adb reverse tcp:4186 tcp:4186`, and verifies the tunnel. **ADB removes reverse tunnels when a device disconnects or ADB restarts.** Run the script again after reconnecting the Stick. The helper and tunnel are required for channels 4 and 5; the BBC channels do not use them.

### Always-on Raspberry Pi setup

The helper does not need to run on the computer used to build the APK. An always-on Raspberry Pi or other Linux computer on the same home network can host it; the Stick then reaches the helper through ADB reverse. This is the setup used for the author's Fire TV: the Pi keeps the helper and tunnel available while the Mac is off.

To adapt this setup, install Node.js and Android platform-tools on the Pi, copy the repository's `dist/`, `local-helper/`, and `scripts/` directories while keeping their relative locations, enable ADB debugging on the Stick, and connect the Pi to the Stick:

```sh
adb connect <fire-tv-ip>:5555
node local-helper/server.mjs
```

In another Pi terminal, run `./scripts/connect-fire-tv.sh <fire-tv-ip>:5555 --launch` from the project root. Keep the helper running. Configure both the helper and the ADB connection/tunnel to start on boot and recover after disconnects (for example, with systemd). A DHCP reservation for the Stick makes the Pi's reconnect target stable. The helper remains bound to `127.0.0.1`; do not expose port 4186 on the home network. The helper uses no ITV login, browser cookie, or personal account session.

## Remote

- Number keys 1–5 select the matching channel.
- Up/down navigate the open Menu and Nostalgia choices; Select activates an item.
- Back closes Five or returns from the ITVX app.
- App-handled volume keys adjust playback and show Five’s green volume display. TV volume commands sent directly over infrared are handled by the television.

## Channel behaviour

Channels 1 and 2 use the configured BBC live stream sources. Channel 3 opens ITVX, which must be installed and signed in on the Fire TV. Direct ITVX playback inside Five is still being explored; the desktop Chrome connector does not apply on Fire TV.

Channels 4 and 5 obtain their current DASH manifests and Widevine licences through `local-helper/server.mjs`, then play in Five using Android Media3. The helper binds to `127.0.0.1`; ADB reverse provides the device connection without exposing the helper to the home network. No ITV account or browser session is used for these channels.

## Compatibility and status

This is an early proof of concept tested on one Fire TV Stick. Playback can change when broadcasters change their streaming services. Other Stick models, sustained playback, and future Fire OS versions need testing. It targets Android-based Fire OS APKs; Roku and Fire TV devices running Vega OS are not supported.

Five simplifies the viewing screen and remote flow. It does not remove, disable, or replace Amazon Fire OS system apps, and it is not a medical or assistive-care product. It may suit viewers who prefer a small, predictable set of choices, with setup and support from someone they trust.
