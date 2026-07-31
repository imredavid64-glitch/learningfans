# Build downloads here

Run these commands to build app artifacts into this folder:

| Platform  | Command                          | Output                                   |
|-----------|----------------------------------|------------------------------------------|
| Android   | `npm run mobile:android:apk`     | `learningfans-android.apk`               |
| macOS     | `npm run desktop:build:mac`      | `learningfans-mac.dmg` (in `release/`)   |
| Windows   | `npm run desktop:build:win`      | `learningfans-windows.exe` (in `release/`) |
| Linux     | `npm run desktop:build:linux`    | `learningfans-linux.AppImage` (in `release/`) |

Then run `npm run desktop:copy` to copy the built artifacts into `public/downloads/`.
iOS installs are served from the App Store (see the download page).

Note: electron-builder must be run on the target OS to produce that OS's binary.
