# Five for Fire TV

> **80s & 90s UK TV is back!**

![Five retro television banner](firetv/app/src/main/res/drawable-nodpi/five_banner.png)

Five is a deliberately simple live TV app for Android-based Fire TV Sticks. It replaces a busy viewing screen with five numbered choices, remote-first controls, and a Nostalgia section for UK archive clips and advert compilations.

It is designed for people who prefer a small, familiar set of choices, including older viewers and people experiencing changes in memory or attention. A family member or trusted helper can set it up. Five is not a medical product, and it does not uninstall or disable Fire OS apps: “debloat” here means a simpler TV viewing experience.

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

See [Fire TV build, install, and connection instructions](firetv/README.md). In short, build and install the APK, start the local helper on the computer for channels 4 and 5, and run `scripts/connect-fire-tv.sh` to establish the Fire TV tunnel.

If the Stick disconnects or ADB restarts, ADB removes its reverse tunnel. Run `./scripts/connect-fire-tv.sh <device-serial> --launch` again. The script checks the helper, recreates `adb reverse tcp:4186 tcp:4186`, and verifies the mapping before reopening Five.

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
