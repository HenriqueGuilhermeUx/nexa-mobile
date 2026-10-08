# Mobile preparation: Nexa Pay + US Receiving

This branch does not change the current production navigation.

Prepared routes:

- `/(app)/pay`
- `/(app)/receive-usd`

Both redirect back to the current app unless their explicit public flags are true:

- `EXPO_PUBLIC_NEXA_PAY_ENABLED=false`
- `EXPO_PUBLIC_NEXA_US_RECEIVING_ENABLED=false`

No current menu or home action links to these routes.

The prepared screens are intentionally non-executable. Provider approval and backend
homologation must happen first.
