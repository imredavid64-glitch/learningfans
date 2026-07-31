# App downloads

Binaries are built and hosted on GitHub Releases:

- Repo: `github.com/imredavid64-glitch/learningfans`
- Release: `v0.1.0` → `github.com/imredavid64-glitch/learningfans/releases/tag/v0.1.0`

## Building

Run the CI workflow `build-binaries.yml` (workflow_dispatch, passing the target tag):

- **Android APK** — ubuntu runner, `npx cap add android && ./gradlew assembleRelease` (JDK 21, signed with debug keystore)
- **macOS DMG** — build locally on macOS: `npm run desktop:build:mac` (electron-builder cannot cross-compile)
- **Windows EXE** — Windows runner, `npx electron-builder --win`
- **Linux AppImage + deb** — ubuntu runner, `npx electron-builder --linux`

Then upload artifacts to the release with `gh release upload <tag> <files> --clobber`.

The download page (`/download`) links directly to the GitHub release asset URLs.
