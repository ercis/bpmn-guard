# Coherence Checking Dataset

This directory is a **verbatim copy of a third-party dataset** — the
`Experiment Data` of the viadee *Process-Document Coherence-Checking Dataset*
(<https://github.com/viadee/process-document-coherence-checking-dataset>),
renamed here to `CoherenceCheckingDataset`. BPMN Guard uses it to seed the
duplicate-check vector store and to exercise the duplicate/coherence checks.

## License: GPL-3.0 (not MIT)

The upstream dataset is licensed under the **GNU General Public License v3.0**,
which is **different from this project's MIT license**. These files remain under
GPL-3.0; the project's MIT license does **not** apply to them. The MIT-licensed
BPMN Guard source and this GPL-licensed dataset are distributed together as an
aggregate (GPLv3 §5 "mere aggregation"), and each retains its own license. The
full GPL-3.0 text is in the [`LICENSE`](LICENSE) file in this directory.

## Structure

Each case subfolder contains:

- a base BPMN 2.0 model (e.g. `Hotel.bpmn`),
- a modified variant (`*_V3` / `*_v2`),
- a natural-language process description (`*.txt`), and
- `solution_config.json` annotating how the variant differs from the base model
  — changes labelled *relevant*, *unrelated*, or *negligible* across the *task*,
  *control flow*, *data*, and *organization* dimensions.

## Provenance of the 12 cases

The 12 model–text pairs originate equally from two established BPM corpora, as
documented by the upstream dataset:

- **Friedrich, Mendling & Puhlmann (2011)**, *Process Model Generation from
  Natural Language Text* — Dispatching, Hospital, Hotel, Part Production,
  Recourse, Zoo.
- **Eid-Sabbagh et al. (2012)**, *A Platform for Research on Process Model
  Collections* — Client Acquisition, Credit, Invoice, Purchasing,
  Replacement Parts, Web Design.

Related: Sànchez-Ferreres et al. (2018), *Aligning Textual and Model-Based
Process Descriptions*.

If you redistribute or build on these files, comply with GPL-3.0 and cite the
upstream dataset and the original corpora above.
