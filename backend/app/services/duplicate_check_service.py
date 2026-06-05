"""Service to provide LLM-assisted BPMN duplicate checks."""

import logging

from app.core.config import get_settings
from app.db.vector_storage import VectorDB
from app.language_model_client.client import LLMClient
from app.schemas.duplicate_check import DuplicateCheckResult
from app.agents.workflows.duplicate_check_workflow import DuplicateCheckWorkflow
from app.db.models.bpmn_model import BPMNModel

settings = get_settings()

logger = logging.getLogger(__name__)


class DuplicateCheckService:
    """Class to provide LLM-assisted duplicate checks.

    Attributes:
        :param  duplicate_check_workflow (DuplicateCheckWorkflow): Langgraph workflow object for BPMN duplicate checks.
    """

    def __init__(self, duplicate_check_workflow: DuplicateCheckWorkflow) -> None:
        self.duplicate_check_workflow = duplicate_check_workflow

    def duplicate_check(self, bpmn_model: BPMNModel) -> DuplicateCheckResult | None:
        """Function to perform duplicate check on a BPMN model.

        Args:
            bpmn_model (BPMNModel): BPMN model database object."""
        logger.info(f"Starting duplicate check for model {bpmn_model.id}")
        bpmn_model_xml = bpmn_model.bpmn_xml
        if not bpmn_model_xml:
            raise ValueError("BPMN model does not have XML content available")

        try:
            result = self.duplicate_check_workflow.run_workflow(
                bpmn_model_xml=bpmn_model_xml,
                exclude_model_id=str(bpmn_model.id),
            )
            logger.info(f"Duplicate check completed for model {bpmn_model.id}")
            return result
        except Exception as e:
            logger.error(f"Error invoking duplicate check: {e}")
            raise RuntimeError(f"Duplicate check failed: {e}") from e


def setup_duplicate_check_service() -> DuplicateCheckService:
    """Initialize a DuplicateCheckService object using default settings.

    Returns:
        :return: DuplicateCheckService object.
    """
    llm_client = LLMClient().create_llm_model()
    embeddings = LLMClient.get_embedding_function()
    vector_storage = VectorDB.create_pg_vector_db(settings.SYNC_DATABASE_URI, "bpmn_examples_corpus", embeddings)

    duplicate_check_workflow = DuplicateCheckWorkflow(
        llm_client=llm_client,
        vector_storage=vector_storage,
        num_similar_models=5,
    )

    return DuplicateCheckService(duplicate_check_workflow=duplicate_check_workflow)
