"""Utility class for tasks related to BPMN models."""

import logging
from pathlib import Path
from typing import cast

from langchain_core.messages import HumanMessage
from langchain_core.language_models import BaseChatModel
from langsmith import traceable
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.schemas.duplicate_check import ModelRating

logger = logging.getLogger(__name__)

settings = get_settings()


class BPMNModelUtils:
    """BPMNModelUtilityClass."""

    @staticmethod
    def check_if_model_description_exists(bpmn_model_to_check: Path, bpmn_description_paths: list[Path]) -> Path | None:
        """Check whether a model description exists for a corresponding BPMN model.

        Arguments:
            :arg: bpmn_model_to_check: Path to the BPMN model to check.
            :arg: bpmn_description_paths: List of paths to BPMN model descriptions.
        Returns:
            :return: Path to the BPMN model description if it exists, else None.
        """
        description_map = {desc_path.stem: desc_path for desc_path in bpmn_description_paths}
        return description_map.get(bpmn_model_to_check.stem)

    @staticmethod
    @traceable(run_type="llm", name="Describe BPMN Model")
    def describe_bpmn_model(
        bpmn_model_xml: str, llm_client: BaseChatModel, user_prompt: str | None = None
    ) -> str | None:
        """Function to describe a BPMN model in natural language using a LLM.

        Arguments:
            :arg: bpmn_model_xml: BPMN model xml file in string format.
            :arg: llm_client: LLM client to use for generating the description.
            :arg: user_prompt: Optional custom user prompt to use instead of the default.

        Returns:
            :return: Description of the BPMN model in natural language.
        """

        if user_prompt is None:
            user_prompt = f"""
            TASK:
            You are an expert in business process modeling. I will provide you with a BPMN model in XML format.
            Your task is to analyze the structure and describe the process it represents in clear, natural English.
            - Summarize the main flow of activities, decisions, and participants (e.g., pools, lanes, and tasks).
            - Mention key gateways, events, and subprocesses if they are relevant to understanding the logic.
            - Avoid listing every technical detail or XML element — focus on the business meaning and flow.
            - Keep your description concise and easy to read, using no more than 250 tokens.

            OUTPUT-FORMAT:
            Provide the description as a single coherent paragraph.

            INPUT:
            Here is the BPMN XML: {bpmn_model_xml}.
            """

        try:
            result = llm_client.invoke([HumanMessage(user_prompt)]).content
            # content is str for text-only responses, list for multi-modal
            return cast(str, result) if isinstance(result, str) else None
        except Exception as e:
            logger.error(f"Error invoking LLM for BPMN creating description: {e}")
            return None

    @staticmethod
    @traceable(run_type="llm", name="Compare BPMN Models")
    def compare_bpmn_models(
        target_model_xml: str,
        candidate_model_id: str,
        candidate_model_name: str,
        candidate_model_xml: str,
        llm_client: BaseChatModel,
    ) -> ModelRating | None:
        """Function to compare two BPMN models XMLs using a LLM.

        Arguments:
            :arg: target_model_xml (str): Target BPMN model under review.
            :arg: candidate_model_id (str): Identifier of the candidate model.
            :arg: candidate_model_name (str): Name of the candidate model.
            :arg: candidate_model_xml (str): BPMN model that needs to be compared against the target model.
            :arg: llm_client (BaseChatModel): LLM client to use for the comparison.

        Returns:
            :return: Comparison result.
        """

        user_prompt = f"""
        TASK:
        You are an expert in business process modeling. I will provide you with two BPMN models in XML format.
        Your task is to analyze the structure and content of a target bpmn model with a potential similar
        candidate bpmn model xml.

        OUTPUT-FORMAT:
        {{
            "rating (int)": Rating from 0 (not similar) to 10 (very similar) based on the RATING SCALE below,
            "reasoning (str)": "Explanation of why this rating was given"
        }}

        DECISION CRITERIA:
        - Structural similarities.
        - Process logic and procedure.
        - Naming conventions of tasks, events activities etc.
        - Variations in flow of activities, decisions, participants (e.g., pools, lanes, and tasks).
        - Key gateways, events, and subprocesses that differ or align between the models.

        RATING SCALE:
        - 0-2: No relevant similarities
        - 3-6: Some similarities, but also significant differences
        - 7-8: Very similar, minor differences
        - 9-10: Duplicate or nearly identical models

        INPUT:
        --------------------------------------------------------------\n
        Here is the Target BPMN Model XML: {target_model_xml}.
        --------------------------------------------------------------\n
        Here is the Comparison BPMN Model XML: {candidate_model_xml}.
        """

        try:
            # Use a simpler schema for LLM output (just rating and reasoning)
            class LLMRatingOutput(BaseModel):
                rating: int = Field(ge=0, le=10)
                reasoning: str

            result = llm_client.with_structured_output(LLMRatingOutput).invoke([HumanMessage(user_prompt)])
            llm_output = cast(LLMRatingOutput, result)

            # Build full ModelRating with metadata we already have
            return ModelRating(
                model_id=candidate_model_id,
                model_name=candidate_model_name,
                rating=llm_output.rating,
                reasoning=llm_output.reasoning,
            )
        except Exception as e:
            logger.error(f"Error invoking LLM for BPMN model comparison: {e}")
            return None
