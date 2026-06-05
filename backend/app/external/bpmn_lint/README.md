# BPMN Validation Service

Node.js-based BPMN validation using **bpmnlint**, integrated with the Python backend via subprocess.

## Prerequisites

- **Node.js >= 20.17** (the bundled Dockerfile installs Node 22; `bpmnlint@11.x` transitively requires the ESM-only `min-dash@5`, which Node 18 cannot `require()`).
- **npm** (comes with Node.js)
- Python 3.12+ (for backend integration)

## Installation

```bash
# Install Node.js dependencies
npm install
```

## Usage

### From the Python backend

Access validation from `backend/app/services/bpmn_validation_services.py`:

```python
from app.services.bpmn_validation_services import BPMNValidationService

validator = BPMNValidationService()

# Validate file by path
result = validator.validate_file("path/to/diagram.bpmn")

# Validate XML content
result = validator.validate_content(bpmn_xml_string, filename="diagram.bpmn")

# Check results
if result.is_valid:
    print("File is valid")
else:
    for issue in result.issues:
        print(f"  {issue.category}: {issue.message}")
```

### Modular Usage (CLI)

```bash
# Validate single file
node validate.js diagram.bpmn

# JSON output (for automation)
node validate.js diagram.bpmn --json

# Multiple files
node validate.js *.bpmn

# Custom config
node validate.js diagram.bpmn --config .bpmnlintrc
```

## Configuration

Customize validation rules in `.bpmnlintrc`:

```json
{
  "extends": "bpmnlint:recommended",
  "rules": {
    "label-required": "off",
    "no-disconnected": "error"
  }
}
```

**Available presets:**
- `bpmnlint:recommended` (default) - Best practices + BPMN compliance
- `bpmnlint:correctness` - BPMN compliance only
- `bpmnlint:all` - All rules as errors (most strict)

**Common rules:** `start-event-required`, `end-event-required`, `label-required`, `no-disconnected`, `no-duplicate-sequence-flows`, `conditional-flows`, `superfluous-gateway`

See [bpmnlint docs](https://github.com/bpmn-io/bpmnlint/tree/main/docs/rules) for complete reference.

## Integration

The validator is consumed internally by the evaluation workflow ([`backend/app/agents/workflows/evaluation_workflow.py`](../../agents/workflows/evaluation_workflow.py)) as the `validation_check` node; it is not exposed as a standalone HTTP endpoint. Results conform to the `ValidationResult` schema in [`backend/app/schemas/validation.py`](../../schemas/validation.py), with grouped `issues`, `error_count`, and `warning_count`.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module 'bpmnlint'" | Run `npm install` to reinstall dependencies |
| `ERR_REQUIRE_ESM` for `min-dash` | Upgrade Node to 20.17+/22 — `bpmnlint@11.x` pulls in ESM-only `min-dash@5`, which Node 18 cannot `require()`. |
| Invalid BPMN file | Ensure file is valid XML and can open in BPMN editor |
| Rules too strict | Add `"rule-name": "off"` to `.bpmnlintrc` |

## Exit Codes

- `0` - All files valid
- `1` - Validation errors found
- `2` - Invalid arguments or file not found

---

**Integrated with:** `backend/app/services/bpmn_validation_services.py`
**Dependencies:** bpmnlint (^11.6.1), bpmn-moddle (^9.0.1)
