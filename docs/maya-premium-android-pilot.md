# Maya Premium Android — internal APK
This branch adds an authenticated, read-only Maya consultation screen. The feature
is hidden unless EXPO_PUBLIC_NEXA_MAYA_PREMIUM_ENABLED=true.

The EAS preview build uses staging API, produces an APK, and does not submit to
Google Play. A signed build requires the repository's EXPO_TOKEN secret.
Production rollout requires separate backend consent migration, integration
tests, and app release approval. No wallet, balance or transfer flows are changed.
