import sys
from pathlib import Path
from unittest.mock import Mock
from uuid import uuid4

import pytest

from app.db.models.bpmn_model import BPMNModel
from app.language_model_client.client import LLMClient
from app.schemas.common import LLMProvider
from app.services.semantic_label_check_service import SemanticLabelCheckService


@pytest.fixture(scope="session", autouse=True)
def _ensure_backend_on_path() -> None:
    """Ensure backend root is on sys.path for direct `app.*` imports.

    In most setups this is already true (because tests run from backend/), but some IDEs
    run tests from other working dirs.
    """

    backend_dir = Path(__file__).parent.parent.parent.parent
    p = str(backend_dir)
    if p not in sys.path:
        sys.path.insert(0, p)


"""
Execute from backend directory:
uv run pytest tests/integration/services/test_semantic_label_check_service.py -v

Tests each semantic labeling rule (R1-R9) with actual BPMN files.
Note: These are integration tests that make real API calls.
"""


class TestSemanticLabelCheckService:
    """Test semantic label checking for each individual rule."""

    @pytest.fixture
    def service(self):
        """Create semantic label check service instance with OpenAI."""
        llm_client = LLMClient(provider=LLMProvider.OPENAI).create_llm_model()
        return SemanticLabelCheckService(llm_client=llm_client)

    @pytest.fixture
    def resources_path(self):
        """Get the path to test resources."""
        return Path(__file__).parent.parent.parent / "resources" / "semantic_label_check"

    def create_bpmn_model(self, resources_path: Path, filename: str) -> BPMNModel:
        """Create a BPMN model from a test file."""
        file_path = resources_path / filename
        with open(file_path, "r", encoding="utf-8") as f:
            bpmn_xml = f.read()

        model = Mock(spec=BPMNModel)
        model.id = uuid4()
        model.name = filename
        model.description = f"Test BPMN model for {filename}"
        model.bpmn_xml = bpmn_xml
        model.file_path = f"test/{filename}"
        return model

    # Rule R1: Activity names should use verb + object pattern

    @pytest.mark.parametrize(
        "filename",
        [
            "r1_valid_verb_object.bpmn",
            "r1_valid_procure_to_pay_12.bpmn",
            "r1_valid_customer_onboarding_9.bpmn",
            "r1_valid_claim_handling_18.bpmn",
        ],
    )
    def test_r1_valid_task_name(self, service, resources_path, filename):
        """Test R1: Tasks with valid verb + object pattern pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R1" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r1_invalid_vague_verb.bpmn",
            "r1_invalid_vague_verb_procure_10.bpmn",
            "r1_invalid_process_payment_8.bpmn",
            "r1_invalid_manage_order_14.bpmn",
        ],
    )
    def test_r1_invalid_task_name_vague_verb(self, service, resources_path, filename):
        """Test R1: Tasks with vague verbs like 'handle', 'manage', or 'process' should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R1" for v in result.violations)

    # Rule R2: Event names should describe business result/state

    @pytest.mark.parametrize(
        "filename",
        [
            "r2_valid_state.bpmn",
            "r2_valid_payment_state_8.bpmn",
            "r2_valid_order_fulfillment_state_12.bpmn",
            "r2_valid_claim_state_20.bpmn",
        ],
    )
    def test_r2_valid_event_name(self, service, resources_path, filename):
        """Test R2: Events with object + past-participle/state structure pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R2" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r2_invalid_ambiguous.bpmn",
            "r2_invalid_processed_state_9.bpmn",
            "r2_invalid_done_state_14.bpmn",
            "r2_invalid_ambiguous_state_24.bpmn",
        ],
    )
    def test_r2_invalid_event_name_ambiguous(self, service, resources_path, filename):
        """Test R2: Events with ambiguous verbs like 'processed' or 'done' should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R2" for v in result.violations)

    # Rule R3: Gateway names should be questions

    @pytest.mark.parametrize(
        "filename",
        [
            "r3_valid_question.bpmn",
            "r3_valid_invoice_approval_9.bpmn",
            "r3_valid_order_return_14.bpmn",
            "r3_valid_credit_check_22.bpmn",
        ],
    )
    def test_r3_valid_gateway_name(self, service, resources_path, filename):
        """Test R3: Gateways with question format and answer/condition flows pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R3" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r3_invalid_not_question.bpmn",
            "r3_invalid_gateway_not_question_8.bpmn",
            "r3_invalid_flow_labels_12.bpmn",
            "r3_invalid_credit_check_18.bpmn",
        ],
    )
    def test_r3_invalid_gateway_name_not_question(self, service, resources_path, filename):
        """Test R3: Non-question gateway names or non-answer/condition outgoing flow labels should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R3" for v in result.violations)

    # Rule R4: Short, clear names (≤ 4 words)

    @pytest.mark.parametrize(
        "filename",
        [
            "r4_valid_short.bpmn",
            "r4_valid_order_fulfillment_10.bpmn",
            "r4_valid_claim_intake_16.bpmn",
            "r4_valid_purchase_request_24.bpmn",
        ],
    )
    def test_r4_valid_short_name(self, service, resources_path, filename):
        """Test R4: Elements with short names (≤4 words) pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R4" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r4_invalid_long.bpmn",
            "r4_invalid_order_long_labels_9.bpmn",
            "r4_invalid_claim_long_task_18.bpmn",
            "r4_invalid_procurement_long_steps_26.bpmn",
        ],
    )
    def test_r4_invalid_long_name(self, service, resources_path, filename):
        """Test R4: Elements with long names (>4 words) should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R4" for v in result.violations)

    # Rule R5: Consistent naming style

    @pytest.mark.parametrize(
        "filename",
        [
            "r5_valid_consistent.bpmn",
            "r5_valid_invoice_processing_12.bpmn",
            "r5_valid_order_to_cash_18.bpmn",
            "r5_valid_claim_settlement_24.bpmn",
        ],
    )
    def test_r5_consistent_naming(self, service, resources_path, filename):
        """Test R5: Consistent terminology across the diagram passes."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R5" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r5_invalid_inconsistent.bpmn",
            "r5_invalid_invoice_synonyms_12.bpmn",
            "r5_invalid_order_synonyms_18.bpmn",
            "r5_invalid_claim_synonyms_24.bpmn",
        ],
    )
    def test_r5_inconsistent_naming(self, service, resources_path, filename):
        """Test R5: Inconsistent terminology (unnecessary synonyms) should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R5" for v in result.violations)

    # Rule R6: Only name elements requiring business meaning

    @pytest.mark.parametrize(
        "filename",
        [
            "r6_valid_meaningful.bpmn",
            "r6_valid_billing_reminder_10.bpmn",
            "r6_valid_return_window_16.bpmn",
            "r6_valid_claim_sla_24.bpmn",
        ],
    )
    def test_r6_meaningful_name(self, service, resources_path, filename):
        """Test R6: Only meaningful names (and correct timer naming) pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R6" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r6_invalid_meaningless.bpmn",
            "r6_invalid_generic_names_8.bpmn",
            "r6_invalid_timer_no_time_14.bpmn",
            "r6_invalid_lane_and_gateway_names_22.bpmn",
        ],
    )
    def test_r6_meaningless_name(self, service, resources_path, filename):
        """Test R6: Generic/redundant names or wrong timer content should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R6" for v in result.violations)

    # Rule R7: Sentence case

    @pytest.mark.parametrize(
        "filename",
        [
            "r7_valid_sentence_case.bpmn",
            "r7_valid_invoice_to_cash_12.bpmn",
            "r7_valid_returns_18.bpmn",
            "r7_valid_purchase_approval_24.bpmn",
        ],
    )
    def test_r7_valid_sentence_case(self, service, resources_path, filename):
        """Test R7: Names in sentence case pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R7" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r7_invalid_title_case.bpmn",
            "r7_invalid_invoice_title_case_12.bpmn",
            "r7_invalid_returns_title_case_18.bpmn",
            "r7_invalid_purchase_title_case_24.bpmn",
        ],
    )
    def test_r7_invalid_title_case(self, service, resources_path, filename):
        """Test R7: Names in title case should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R7" for v in result.violations)

    # Rule R8: Avoid technical jargon

    @pytest.mark.parametrize(
        "filename",
        [
            "r8_valid_business.bpmn",
            "r8_valid_order_changes_12.bpmn",
            "r8_valid_claim_review_18.bpmn",
            "r8_valid_purchase_payment_24.bpmn",
        ],
    )
    def test_r8_valid_business_language(self, service, resources_path, filename):
        """Test R8: Business-oriented names pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R8" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r8_invalid_jargon.bpmn",
            "r8_invalid_api_database_12.bpmn",
            "r8_invalid_webhook_oauth_http_18.bpmn",
            "r8_invalid_sap_salesforce_24.bpmn",
        ],
    )
    def test_r8_invalid_technical_jargon(self, service, resources_path, filename):
        """Test R8: Technical jargon or system names should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R8" for v in result.violations)

    # Rule R9: Avoid or define abbreviations

    @pytest.mark.parametrize(
        "filename",
        [
            "r9_valid_defined_abbrev.bpmn",
            "r9_valid_kyc_onboarding_12.bpmn",
            "r9_valid_po_invoice_18.bpmn",
            "r9_valid_sla_claim_24.bpmn",
        ],
    )
    def test_r9_valid_defined_abbreviation(self, service, resources_path, filename):
        """Test R9: Defined or standard abbreviations pass."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert not any(v.rule_id == "R9" for v in result.violations)

    @pytest.mark.parametrize(
        "filename",
        [
            "r9_invalid_undefined_abbrev.bpmn",
            "r9_invalid_fin_dept_12.bpmn",
            "r9_invalid_ops_mgr_18.bpmn",
            "r9_invalid_inv_proc_24.bpmn",
        ],
    )
    def test_r9_invalid_undefined_abbreviation(self, service, resources_path, filename):
        """Test R9: Undefined abbreviations should fail."""
        model = self.create_bpmn_model(resources_path, filename)
        result = service.check_semantic_label(model)

        assert any(v.rule_id == "R9" for v in result.violations)

    # Test multiple violations

    def test_multiple_rule_violations(self, service, resources_path):
        """Test multiple rule violations in single BPMN."""
        model = self.create_bpmn_model(resources_path, "multiple_violations.bpmn")
        result = service.check_semantic_label(model)

        assert result.rating < 100
        assert len(result.violations) >= 3
