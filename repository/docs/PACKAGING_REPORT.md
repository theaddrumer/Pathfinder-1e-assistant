# GitHub checkpoint provenance

Engine version: 3.51.0. Desktop manifest version: 1.5.0-beta.1. GitHub packaging revision: 1.

The provided Ubuntu archive was truncated: 4,040 complete local ZIP entries were recovered with decompression, length and CRC validation, but the central directory and trailing entries were absent. Four missing runtime files (time_engine.mjs, trait_library.mjs, weapon_materials.mjs, vocabulary_probe.mjs) were restored from the intact desktop package based on the same engine. Desktop-only files were not inserted into the Ubuntu runtime.

The missing transport_tests.mjs, time_engine_tests.mjs and the synthetic session_v347.json fixture were recovered from the earlier V3.48 source checkout and rerun against this engine. Other absent trailing historical test files are not claimed to have been recovered. The generated tests.html gallery is rebuilt from the supplied templates and modules. This repository is a working distribution source checkpoint, not a reconstruction of every historical development file.

The old account-specific release builder was replaced with a GitHub builder. Setup documentation now names these release assets and explains independent tester connections. The original developer-bound website-plugin ZIP is deliberately excluded. The desktop manifest identity remains unchanged in its separate experimental package; it is an identifier, not a live account connection or secret.

Original mechanics and launcher behavior were preserved. The GitHub packaging adds documentation, exclusion rules, dependency/license inventories, a reproducible release builder and archive verification. Original working installations, saves and account plugins were not modified.

Automated results for this preparation run are recorded in VALIDATION.txt. Actual fresh Windows/WSL installation, independent-account tunnel setup, and ChatGPT desktop installation remain external tests.
