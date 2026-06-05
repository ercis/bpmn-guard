import pytest
from pathlib import Path
from unittest.mock import Mock
from uuid import uuid4

from app.services.complexity_check_services import evaluate_scientific_complexity
from app.db.models.bpmn_model import BPMNModel


"""
Execute from backend directory:
uv run pytest tests/integration/services/test_complexity_check_service.py -v

These tests are deterministic and run without external services.
They verify that the scientific complexity evaluation computes CW (cognitive weight)
and CFC (control flow complexity) and provides consistent breakdowns.
"""


def _make_bpmn_model(xml: str, name: str = "model.bpmn") -> BPMNModel:
    model = Mock(spec=BPMNModel)
    model.id = uuid4()
    model.name = name
    model.bpmn_xml = xml
    return model


class TestComplexityCheckService:
    @pytest.fixture
    def resources_path(self) -> Path:
        return Path(__file__).parent.parent.parent / "resources" / "complexity_check"

    def test_simple_test_bpmn_computes_expected_scores(self):
        xml = (Path(__file__).parent.parent.parent / "resources" / "complexity_check" / "simple_test.bpmn").read_text(
            encoding="utf-8"
        )
        model = _make_bpmn_model(xml, name="simple_test.bpmn")

        result = evaluate_scientific_complexity(model)
        assert result is not None

        # From simple_test.bpmn structure:
        # Tasks: Task_1, Task_2, Task_3 => 3 standard tasks (W=1)
        # XOR gateways: Gateway_1 has fan-out 2 => xor_binary count 1 (W=2)
        # Events: Start + 2 Ends => 3 events (W=1)
        assert result.cw_breakdown.standard_tasks == 3
        assert result.cw_breakdown.loop_tasks == 0
        assert result.cw_breakdown.sub_processes == 0
        assert result.cw_breakdown.xor_binary == 1
        assert result.cw_breakdown.xor_case == 0
        assert result.cw_breakdown.and_splits == 0
        assert result.cw_breakdown.or_splits == 0
        assert result.cw_breakdown.event_gateways == 0
        assert result.cw_breakdown.events == 3

        # Expected CW score = 3*1 + 1*2 + 3*1 = 8
        assert result.cw_score == 8

        # CFC: XOR with fan-out 2 => weight 2
        assert result.cfc_score == 2
        assert result.cfc_breakdown.get("XOR Split (W=Fan-out, Fan-out=2)") == (2, 1)

    def test_complex_gateway_fanout_affects_cw_and_cfc(self, resources_path: Path):
        xml = (resources_path / "complex_gateways.bpmn").read_text(encoding="utf-8")

        model = _make_bpmn_model(xml, name="complex_gateways.bpmn")
        result = evaluate_scientific_complexity(model)
        assert result is not None

        assert result.cw_breakdown.standard_tasks == 4
        assert result.cw_breakdown.xor_case == 1
        assert result.cw_breakdown.or_splits == 1
        assert result.cw_breakdown.and_splits == 1
        assert result.cw_breakdown.events == 2  # start + end

        # CFC expectations
        assert result.cfc_breakdown.get("XOR Split (W=Fan-out, Fan-out=3)") == (3, 1)
        assert result.cfc_breakdown.get("OR Split (W=2^Fan-out - 1, Fan-out=2)") == (3, 1)
        assert result.cfc_breakdown.get("AND Split (W=1)") == (1, 1)
        assert result.cfc_score == 3 + 3 + 1

        # tasks: 4*1, events: 2*1, gateways: xor_case 3 + or 7 + and 4 => total = 4 + 2 + 14 = 20
        assert result.cw_score == 20

    def test_loop_task_counts_as_loop_and_increases_cw(self, resources_path: Path):
        xml = (resources_path / "loop_task.bpmn").read_text(encoding="utf-8")
        model = _make_bpmn_model(xml, name="loop_task.bpmn")

        result = evaluate_scientific_complexity(model)
        assert result is not None

        # Structure:
        # - 1 loop task => loop_tasks=1 (W=6)
        # - start + end => events=2 (W=1 each)
        assert result.cw_breakdown.standard_tasks == 0
        assert result.cw_breakdown.loop_tasks == 1
        assert result.cw_breakdown.sub_processes == 0
        assert result.cw_breakdown.xor_binary == 0
        assert result.cw_breakdown.xor_case == 0
        assert result.cw_breakdown.and_splits == 0
        assert result.cw_breakdown.or_splits == 0
        assert result.cw_breakdown.event_gateways == 0
        assert result.cw_breakdown.events == 2

        assert result.cw_score == 6 + 2
        assert result.cfc_score == 0
        assert result.cfc_breakdown == {}

    def test_subprocess_and_event_based_gateway_affect_cw_and_cfc(self, resources_path: Path):
        xml = (resources_path / "subprocess_event_based.bpmn").read_text(encoding="utf-8")
        model = _make_bpmn_model(xml, name="subprocess_event_based.bpmn")

        result = evaluate_scientific_complexity(model)
        assert result is not None

        # Contains:
        # - 1 subprocess => sub_processes=1 (W=2)
        # - 1 eventBasedGateway => event_gateways=1 (W=6)
        # - events in this file: StartEvent_1, EndEvent_1, SubStart, SubEnd => 4 events (W=1 each)
        assert result.cw_breakdown.standard_tasks == 0
        assert result.cw_breakdown.loop_tasks == 0
        assert result.cw_breakdown.sub_processes == 1
        assert result.cw_breakdown.event_gateways == 1
        assert result.cw_breakdown.events == 4
        assert result.cw_score == 2 + 6 + 4  # subprocess(2) + eventGateway(6) + events(4)

        # CFC: event-based gateway fan-out = 2 -> weight 2
        assert result.cfc_score == 2
        assert result.cfc_breakdown.get("Event-Based Split (W=Fan-out, Fan-out=2)") == (2, 1)
