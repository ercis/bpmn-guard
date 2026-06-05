import logging
from pathlib import Path
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langsmith import traceable

from app.schemas.semantic_label_check_schemas import SemanticLabelCheckResult
from app.language_model_client.client import LLMClient
from app.db.models.bpmn_model import BPMNModel

logger = logging.getLogger(__name__)


class SemanticLabelCheckService:
    def __init__(self, llm_client: BaseChatModel):
        self.llm_client: BaseChatModel = llm_client

    @traceable(run_type="chain", name="Semantic Label Check")
    def check_semantic_label(self, bpmn_model: BPMNModel) -> SemanticLabelCheckResult:
        """Function to perform semantic label check on a BPMN model.

        Args:
            bpmn_model (BPMNModel): BPMN model database object.

        Returns:
            SemanticLabelCheckReview: Review of the semantic label check.
        """
        logger.info(f"Starting semantic label check for model {bpmn_model.id}")
        bpmn_model_xml = bpmn_model.bpmn_xml
        if not bpmn_model_xml:
            raise ValueError("BPMN model does not have XML content available")

        model = self.llm_client.with_structured_output(SemanticLabelCheckResult)
        prompt = Path("app/agents/system_prompts/semantic_label_check_prompt.md").read_text(encoding="utf-8")
        messages = [SystemMessage(content=prompt), HumanMessage(content=bpmn_model_xml)]
        result: SemanticLabelCheckResult = model.invoke(messages)  # type: ignore
        logger.info(f"Semantic label check completed for model {bpmn_model.id}")
        return result

    @classmethod
    def setup_semantic_label_check_service(cls, llm_client: BaseChatModel | None = None) -> "SemanticLabelCheckService":
        """Function to setup the SemanticLabelCheckService.

        Args:
            llm_client (BaseChatModel): Large language model client.

        Returns:
            SemanticLabelCheckService: An instance of the SemanticLabelCheckService.
        """
        if not llm_client:
            llm_client = LLMClient().create_llm_model()
        return cls(llm_client)
