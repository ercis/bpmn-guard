# duplicate_check fixtures — third-party data (GPL-3.0)

These BPMN models are **third-party data under the GNU General Public License
v3.0**, *not* the MIT license that covers BPMN Guard's source code. They are used
only by the manual duplicate-check integration test
(`backend/tests/integration/services/test_duplicate_check_service.py`).

- `Hotel.bpmn`, `ClientAcquisition_V2.bpmn`, `Credit_V3.bpmn`,
  `Dispatch-of-goods_V3.bpmn`, `Hospital_V3.bpmn` are taken from the viadee
  *Process-Document Coherence-Checking Dataset*
  (<https://github.com/viadee/process-document-coherence-checking-dataset>).
- `anonym1`, `anonym2`, `anonym4`, `anonym5`, `anonym6` are anonymized variants
  derived from those models (the positive "is a duplicate" cases).

The full GPL-3.0 license text and the provenance of the underlying corpora are in
[`bpmn_examples/CoherenceCheckingDataset/`](../../../../bpmn_examples/CoherenceCheckingDataset/)
(see its `LICENSE` and `README.md`). If you redistribute or build on these files,
comply with GPL-3.0.
