import pytest
from pathlib import Path
from uuid import uuid4
from unittest.mock import Mock
import time

from app.db.models.bpmn_model import BPMNModel
from langchain_core.documents import Document

"""
Execute from the repository root (with docker compose up running):

    docker compose exec backend uv run pytest tests/integration/services/test_duplicate_check_service.py -v

Real integration tests for the duplicate check service. These call the LLM API.
"""


# --- Helpers / Config ---
DUPLICATE_THRESHOLD = 7  # production logic keeps ratings >= 7
NON_DUPLICATE_MAX_RATING = 6
LLM_RETRIES = 3
RETRY_SLEEP_SECONDS = 1.0


def _resource_path(filename: str) -> Path:
    return Path(__file__).parent.parent.parent / "resources" / "duplicate_check" / filename


def load_bpmn(filename: str) -> str:
    return _resource_path(filename).read_text(encoding="utf-8")


def create_bpmn_model(filename: str, bpmn_xml: str) -> BPMNModel:
    """Create a mock BPMN model from XML."""
    model = Mock(spec=BPMNModel)
    model.id = uuid4()
    model.name = filename
    model.description = f"Test BPMN model for {filename}"
    model.bpmn_xml = bpmn_xml
    model.file_path = f"test/{filename}"
    return model


@pytest.fixture(scope="module")
def duplicate_check_service():
    """Create the real duplicate check service once per module.

    Note: The underlying PGVector store is shared, so tests should be robust even if
    other documents already exist from previous tests.
    """
    from app.services.duplicate_check_service import setup_duplicate_check_service

    return setup_duplicate_check_service()


class TestDuplicateCheckService:
    """Expanded integration tests to reduce flakiness from LLM nondeterminism.

    Each assertion is its own test method so pytest can report a clear pass-rate.
    """

    @staticmethod
    def _seed_vector_store(service, bpmn_model_id: str, bpmn_xml: str) -> None:
        """Insert a BPMN model into the vector store using real description generation."""
        from app.utils.bpmn_model_utils import BPMNModelUtils

        description = BPMNModelUtils.describe_bpmn_model(bpmn_xml, service.duplicate_check_workflow.llm_client)
        if description is None:
            description = f"BPMN process: {bpmn_model_id}"

        doc = Document(
            page_content=description,
            metadata={
                "id": bpmn_model_id,
                "source": f"tests/resources/{bpmn_model_id}.bpmn",
                "bpmn_model_xml": bpmn_xml,
                "bpmn_model_description": description,
            },
        )
        service.duplicate_check_workflow.vector_storage.add_documents([doc])

    @staticmethod
    def _run_duplicate_check_with_retries(service, model: BPMNModel):
        """Run duplicate check a few times to smooth out occasional LLM variance."""
        last = None
        for attempt in range(1, LLM_RETRIES + 1):
            last = service.duplicate_check(model)
            if last is not None:
                return last
            # if the service returned None due to transient provider/network errors
            time.sleep(RETRY_SLEEP_SECONDS * attempt)
        return last

    @staticmethod
    def _assert_duplicate_of(result, expected_model_id: str) -> None:
        assert result is not None, "Duplicate check should return a result"
        assert hasattr(result, "similar_models"), "Result should have similar_models attribute"
        assert isinstance(result.similar_models, list), "similar_models should be a list"

        assert len(result.similar_models) > 0, (
            f"No similar models found. Response: {getattr(result, 'response_answer', '')}"
        )

        match = next((m for m in result.similar_models if m.model_id == expected_model_id), None)
        assert match is not None, (
            f"{expected_model_id} not found in similar_models. Found: {[(m.model_id, m.rating) for m in result.similar_models]}"
        )
        assert match.rating >= DUPLICATE_THRESHOLD, (
            f"{expected_model_id} found but with low rating: {match.rating}. Reasoning: {match.reasoning}"
        )

    @staticmethod
    def _assert_not_duplicate_of(result, forbidden_model_id: str) -> None:
        assert result is not None, "Duplicate check should return a result"
        assert hasattr(result, "similar_models"), "Result should have similar_models attribute"
        assert isinstance(result.similar_models, list), "similar_models should be a list"

        forbidden = next((m for m in result.similar_models if m.model_id == forbidden_model_id), None)
        if forbidden is None:
            return
        assert forbidden.rating <= NON_DUPLICATE_MAX_RATING, (
            f"Model unexpectedly matched {forbidden_model_id} with high rating: {forbidden.model_id}={forbidden.rating}. "
            f"Reasoning: {forbidden.reasoning}"
        )

    def _ensure_seeded(self, service, model_id: str, filename: str) -> None:
        """Seed the vector store with a model if needed.

        Safe to call multiple times: adding a duplicate document is okay for these
        tests (we only assert the presence/absence of a specific match).
        """
        xml = load_bpmn(filename)
        self._seed_vector_store(service, model_id, xml)

    def test_01_anonym1_is_duplicate_of_hotel(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Hotel", "Hotel.bpmn")

        anonym1_xml = load_bpmn("anonym1.bpmn")
        anonym1_model = create_bpmn_model("anonym1.bpmn", anonym1_xml)
        result = self._run_duplicate_check_with_retries(service, anonym1_model)
        self._assert_duplicate_of(result, "Hotel")

    def test_02_client_acquisition_not_duplicate_of_hotel(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Hotel", "Hotel.bpmn")

        client_xml = load_bpmn("ClientAcquisition_V2.bpmn")
        client_model = create_bpmn_model("ClientAcquisition_V2.bpmn", client_xml)
        result = self._run_duplicate_check_with_retries(service, client_model)
        self._assert_not_duplicate_of(result, "Hotel")

    def test_03_anonym2_is_duplicate_of_client_acquisition(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "ClientAcquisition_V2", "ClientAcquisition_V2.bpmn")

        anonym2_xml = load_bpmn("anonym2.bpmn")
        anonym2_model = create_bpmn_model("anonym2.bpmn", anonym2_xml)
        result = self._run_duplicate_check_with_retries(service, anonym2_model)
        self._assert_duplicate_of(result, "ClientAcquisition_V2")

    def test_04_credit_not_duplicate_of_hotel_nor_client_acquisition(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Hotel", "Hotel.bpmn")
        self._ensure_seeded(service, "ClientAcquisition_V2", "ClientAcquisition_V2.bpmn")

        credit_xml = load_bpmn("Credit_V3.bpmn")
        credit_model = create_bpmn_model("Credit_V3.bpmn", credit_xml)
        result = self._run_duplicate_check_with_retries(service, credit_model)
        self._assert_not_duplicate_of(result, "Hotel")
        self._assert_not_duplicate_of(result, "ClientAcquisition_V2")

    def test_05_anonym4_is_duplicate_of_credit(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Credit_V3", "Credit_V3.bpmn")

        anonym4_xml = load_bpmn("anonym4.bpmn")
        anonym4_model = create_bpmn_model("anonym4.bpmn", anonym4_xml)
        result = self._run_duplicate_check_with_retries(service, anonym4_model)
        self._assert_duplicate_of(result, "Credit_V3")

    def test_06_dispatch_not_duplicate_of_previous(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Hotel", "Hotel.bpmn")
        self._ensure_seeded(service, "ClientAcquisition_V2", "ClientAcquisition_V2.bpmn")
        self._ensure_seeded(service, "Credit_V3", "Credit_V3.bpmn")

        dispatch_xml = load_bpmn("Dispatch-of-goods_V3.bpmn")
        dispatch_model = create_bpmn_model("Dispatch-of-goods_V3.bpmn", dispatch_xml)
        result = self._run_duplicate_check_with_retries(service, dispatch_model)
        self._assert_not_duplicate_of(result, "Hotel")
        self._assert_not_duplicate_of(result, "ClientAcquisition_V2")
        self._assert_not_duplicate_of(result, "Credit_V3")

    def test_07_anonym5_is_duplicate_of_dispatch(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Dispatch-of-goods_V3", "Dispatch-of-goods_V3.bpmn")

        anonym5_xml = load_bpmn("anonym5.bpmn")
        anonym5_model = create_bpmn_model("anonym5.bpmn", anonym5_xml)
        result = self._run_duplicate_check_with_retries(service, anonym5_model)
        self._assert_duplicate_of(result, "Dispatch-of-goods_V3")

    def test_08_hospital_not_duplicate_of_previous(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Hotel", "Hotel.bpmn")
        self._ensure_seeded(service, "ClientAcquisition_V2", "ClientAcquisition_V2.bpmn")
        self._ensure_seeded(service, "Credit_V3", "Credit_V3.bpmn")
        self._ensure_seeded(service, "Dispatch-of-goods_V3", "Dispatch-of-goods_V3.bpmn")

        hospital_xml = load_bpmn("Hospital_V3.bpmn")
        hospital_model = create_bpmn_model("Hospital_V3.bpmn", hospital_xml)
        result = self._run_duplicate_check_with_retries(service, hospital_model)
        self._assert_not_duplicate_of(result, "Hotel")
        self._assert_not_duplicate_of(result, "ClientAcquisition_V2")
        self._assert_not_duplicate_of(result, "Credit_V3")
        self._assert_not_duplicate_of(result, "Dispatch-of-goods_V3")

    def test_09_anonym6_is_duplicate_of_hospital(self, duplicate_check_service):
        service = duplicate_check_service
        self._ensure_seeded(service, "Hospital_V3", "Hospital_V3.bpmn")

        anonym6_xml = load_bpmn("anonym6.bpmn")
        anonym6_model = create_bpmn_model("anonym6.bpmn", anonym6_xml)
        result = self._run_duplicate_check_with_retries(service, anonym6_model)
        self._assert_duplicate_of(result, "Hospital_V3")
