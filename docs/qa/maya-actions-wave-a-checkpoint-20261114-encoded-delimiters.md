# Maya Actions QA A checkpoint — 2026-11-14 (encoded local delimiters)

Scope: only `qa/maya-actions-wave-a-evidence-20261111`. Baseline integration `6f1c9fd1bf16fc0046228993a83118390da62760`; frozen QA A candidate `096c9fd619a551f23ba8c7d9e3e72a7e01605a6e`, Android runtime 2.0.43, v148. No merge or OTA.

- Code SHA `fdca6fd73f3496c68ad300417b20aa1f397ef660`: reject percent-encoded ?/# delimiters in local evidence references.
- Regression SHA `72248cc025744bbad68b0266f89f67e73a5770a1`: three synthetic negative cases. Test execution not yet established.
- Before change, comparison: QA 128 ahead / 7 behind integration; ten QA-only changed files. PR #142 reviews []; previous SHA `00119f1149fa16b152ff0d331a645f46e715af1b` PR-triggered workflow runs [] and combined statuses []; neither is CI approval. New SHA CI still unverified.

| Wave | Plan state / gate | Wave branch HEAD verified this run? |
|---|---|---|
| 01 | PR #122 merged per plan; physical QA A A01–A16 pending; NO-GO | No |
| 02 | PR #124 merged per plan; physical QA A A01–A16 pending; NO-GO | No |
| 03 | PR #134 merged per plan; read-only device QA pending | No |
| 04 | PR #132 merged per plan; QA C only, manual sharing | No |
| 05 | Preflight controls pending; no execution | No |
| 06 | Financial execution blocked | No |
| 07 | Scheduler, opt-in and audit pending | No |
| 08 | Integration auth and privacy controls pending | No |
| 09 | PR #123/#127 merged per plan; real quote backend unhomologated | No |
| 10 | PR #125 merged per plan; review-only, no submissions | No |
| 11 | Purchases/checkout blocked | No |
| 12 | Reservations blocked | No |

No new wave branch SHA was established: do not invent individual HEADs or approvals. Do not merge the diverged QA branch wholesale. Next: verify exact-SHA CI, obtain distinct redacted device A01–A16 records, reconcile seven behind commits and promote only approved diffs. Production OTA NO-GO; PR #185 out of scope.
