# Five for Fire TV

Five is a simple, remote-controlled live TV app for Android-based Amazon Fire TV devices. It gives five familiar UK channels number buttons, plus a small Nostalgia section.

![Five retro television banner](firetv/app/src/main/res/drawable-nodpi/five_banner.png)

## Channels

| Key | Channel | What happens |
| --- | --- | --- |
| 1 | BBC One | Plays in Five |
| 2 | BBC Two | Plays in Five |
| 3 | ITV1 | Opens the ITVX app on the Fire TV |
| 4 | Channel 4 | Plays in Five; needs the local helper |
| 5 | Channel 5 | Plays in Five; needs the local helper |

The helper can run on an always-on Raspberry Pi or Linux computer. ADB reverse connects the Fire TV to it without exposing the helper to the home network. The helper and tunnel must be running for channels 4 and 5; channels 1–3 do not depend on them. ITVX must be installed on the Fire TV.

## Install

For the full build, ADB install, and optional Raspberry Pi setup, follow [the Fire TV setup guide](firetv/README.md).

In brief: enable ADB debugging on the Fire TV, build and install the APK, start `local-helper/server.mjs` on an always-on machine, and run `scripts/connect-fire-tv.sh <device-serial> --launch` on that same machine. If ADB reconnects or restarts, run the script again to restore the tunnel.

### Ask an AI agent

Open this repository in an AI agent that can use a terminal and ask:

> Read `README.md` and `firetv/README.md`, then help me install Five on my Android-based Fire TV. Check the available build tools, enable/connect ADB with my help, build and install the APK, and launch it. For channels 4 and 5, check whether the local helper already runs on an always-on machine; if not, help me set it up and keep the ADB reverse tunnel available. Verify the channels and remote controls. Ask me for any device details you need, and never put passwords or private device details in the repository.

If the agent cannot access the Fire TV or terminal, it can guide you through the commands in [`firetv/README.md`](firetv/README.md).

## Controls

- Press **1–5** to select a channel.
- Use **Up/Down** and **Select** to navigate the menu and Nostalgia choices.
- Press **Back** to leave Five or return from ITVX.

## Status and compatibility

This is a proof of concept tested on one Fire TV Stick, including playback through the Raspberry Pi helper. Broadcaster streams can change, and other Fire TV models and Fire OS versions still need testing. Five is an Android APK; it does not support Roku or Fire TV devices running Vega OS.

Five simplifies the viewing screen and remote flow. It does not uninstall, disable, or replace Fire OS system apps. It is not a medical product, and its accessibility has not been formally evaluated.

## Screenshots

![Five start screen](screenshots/start-screen.png)

![Five playing BBC One with channel controls](screenshots/channel-one.png)

![Five menu with Nostalgia and settings options](screenshots/menu-and-nostalgia.png)

## License

This repository has no blanket license for reuse. Notices for bundled hls.js and dash.js are in [`third-party-licenses/`](third-party-licenses/). Broadcaster streams and YouTube videos remain subject to their providers' terms.
