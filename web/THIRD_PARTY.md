# Media engine distribution

This frontend distributes the unmodified `@libmedia/avplayer` 1.3.1 UMD bundle and its matching WebAssembly decoder/resampler/stretch-pitch modules. JavaScript versions are pinned by `web/package-lock.json`; binary versions and SHA-256 hashes are pinned by `web/media-codecs.json`.

Corresponding source and build instructions: https://github.com/zhaohappy/libmedia/tree/152f629d3021fd8013efa464fcb7b55f9fbe7753

Binary release assets: https://github.com/zhaohappy/libmedia/tree/1.3.1

License: LGPL-3.0-or-later. A copy is served at `/vendor/libmedia/COPYING.LGPLv3`. The library remains a separately loaded, replaceable script and its binary modules remain separately loaded files. No engine source modifications are applied. See the upstream release's license notices for individual bundled codec components.

Build-time downloads come from the pinned upstream release mirrored by jsDelivr and are verified against the checked-in hashes. At runtime the player, workers and codecs are served from the same site; movie bytes, selected languages and subtitle content never go to a third-party codec service.
