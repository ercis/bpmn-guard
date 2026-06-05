"""Module for defining the BPMN duplicate check workflow using Langgraph."""

import logging

from typing_extensions import TypedDict
from langchain_postgres import PGVector
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langsmith import traceable

from app.db.vector_storage import VectorDB
from app.utils.bpmn_model_utils import BPMNModelUtils
from app.schemas.duplicate_check import ModelRating, DuplicateCheckResult

logger = logging.getLogger(__name__)


class DuplicateCheckState(TypedDict):
    """Typed Dict for persisting the state of the duplicate check workflow."""

    input_bpmn_model_xml: str
    bpmn_model_description: str
    vector_search_results: list[dict]
    vector_search_scores: list[float]
    model_ratings: list[ModelRating]
    final_result: DuplicateCheckResult
    has_error: bool
    exclude_model_id: str


class DuplicateCheckWorkflow:
    """Class for compiling a Langgraph workflow for conducting BPMN duplicate checks."""

    def __init__(self, llm_client: BaseChatModel, vector_storage: PGVector, num_similar_models: int = 3):  # type: ignore[valid-type]
        """Initialize the DuplicateCheckWorkflow class.

        Attributes:
            :param llm_client (BaseChatModel): A basic llm chat model for generating model descriptions.
            :param vector_storage (PGVector): PGVector storage object.
            :param num_similar_models (int): Number of similar models to return.
            :param graph (CompiledStateGraph): Compiled Langgraph workflow for BPMN duplicate checks.
        """
        self.llm_client = llm_client
        self.num_similar_models = num_similar_models
        self.vector_storage = vector_storage
        self.graph = self._build_graph()

    def _build_graph(self) -> CompiledStateGraph:
        """Function to create a Langgraph Workflow for BPMN duplicate checks."""
        workflow = StateGraph(DuplicateCheckState)

        workflow.add_node("describe_bpmn", self.generate_bpmn_model_description)
        workflow.add_node("vector_search", self.similarity_search)
        workflow.add_node("compare_models", self.compare_bpmn_models)
        workflow.add_node("summarize_results", self.summarize_results)

        workflow.add_edge(START, "describe_bpmn")
        workflow.add_conditional_edges(
            "describe_bpmn",
            lambda state: "continue" if not state.get("has_error", False) else "end",
            {"continue": "vector_search", "end": END},
        )
        workflow.add_conditional_edges(
            "vector_search",
            lambda state: "continue" if not state.get("has_error", False) else "end",
            {"continue": "compare_models", "end": END},
        )
        workflow.add_conditional_edges(
            "compare_models",
            lambda state: "continue" if not state.get("has_error", False) else "end",
            {"continue": "summarize_results", "end": END},
        )
        workflow.add_edge("summarize_results", END)
        return workflow.compile()

    @traceable(name="Node: Describe BPMN")
    def generate_bpmn_model_description(self, state: DuplicateCheckState) -> dict:
        """Node to generate a BPMN model description."""
        try:
            bpmn_xml = state["input_bpmn_model_xml"]
            description = BPMNModelUtils.describe_bpmn_model(bpmn_xml, self.llm_client)

            if description is None:
                raise Exception

            return {"bpmn_model_description": description}
        except Exception as e:
            logger.error(f"Error generating BPMN description: {e}")
            return {
                "bpmn_model_description": "",
                "final_result": DuplicateCheckResult(
                    response_answer="Error generating model description for input model, duplicate check aborted",
                    similar_models=[],
                ),
                "has_error": True,
            }

    @traceable(name="Node: Vector Search")
    def similarity_search(self, state: DuplicateCheckState) -> dict:
        """Node to perform similarity search for BPMN models."""
        try:
            description = state["bpmn_model_description"]
            results, scores = VectorDB.similarity_search(
                vector_storage=self.vector_storage,
                query=description,
                num_returns=self.num_similar_models,
                filter_columns=None,
            )
            return {
                "vector_search_results": results,
                "vector_search_scores": scores,
            }
        except Exception as e:
            logger.error(f"Error searching for similar BPMN models: {e}")
            return {
                "vector_search_results": [],
                "vector_search_scores": [],
                "final_result": DuplicateCheckResult(
                    response_answer="Error searching for similar BPMN models, duplicate check aborted",
                    similar_models=[],
                ),
                "has_error": True,
            }

    @traceable(name="Node: Compare Models")
    def compare_bpmn_models(self, state: DuplicateCheckState) -> dict:
        """Node to compare input_bpmn_model_xml with found similar models."""
        try:
            target_input_xml = state["input_bpmn_model_xml"]
            search_results = state["vector_search_results"]
            exclude_id = state.get("exclude_model_id", "")

            model_ratings = []

            for result in search_results:
                candidate_model_xml = result.get("bpmn_model_xml", "")
                candidate_model_id = result.get("id", "")
                candidate_model_name = result.get("name", "Unknown")

                if not candidate_model_xml:
                    continue

                # Skip self-match (algorithmic filter)
                if exclude_id and candidate_model_id == exclude_id:
                    continue

                rating = BPMNModelUtils.compare_bpmn_models(
                    target_input_xml, candidate_model_id, candidate_model_name, candidate_model_xml, self.llm_client
                )

                if rating is None:
                    raise Exception

                if rating.rating <= 6:
                    continue

                model_ratings.append(rating)

            return {"model_ratings": model_ratings}
        except Exception as e:
            logger.error(f"Error comparing BPMN models: {e}")
            return {
                "model_ratings": [],
                "final_result": DuplicateCheckResult(
                    response_answer="Error while comparing BPMN models, duplicate check aborted",
                    similar_models=[],
                ),
                "has_error": True,
            }

    @traceable(name="Node: Summarize Results")
    def summarize_results(self, state: DuplicateCheckState) -> dict:
        """Node to summarize the duplicate check results."""
        try:
            model_ratings = state["model_ratings"]
            summary_prompt = f"""
            TASK:
            Summarize the results of the BPMN duplicate check.

            OUTPUT-FORMAT:
            Provide a concise summary addressing the presence of duplicate or similar BPMN models in maximum 150 Tokens
            as a coherent paragraph.

            CRITERIA:
            Create a concise summary addressing the following:
            1. Were duplicates found? (Rating >= 9)
            2. Are there very similar models? (Rating 7–8)
            3. Provide an overall assessment of the results with a corresponding
            recommended course of action
            Be specific and refer to models by their name, not their ID.

            INPUT:
            A total of {len(model_ratings)} similar models were found and evaluated:

            {self._format_ratings_for_prompt(model_ratings)}
            """

            summary_response = self.llm_client.invoke([HumanMessage(content=summary_prompt)])
            content = summary_response.content
            response_answer = content if isinstance(content, str) else "Duplicate check failed."

            result = DuplicateCheckResult(response_answer=response_answer, similar_models=model_ratings)

            return {"final_result": result}

        except Exception as e:
            logger.error(f"Error summarizing duplicate check results: {e}")
            return {
                "final_result": DuplicateCheckResult(
                    response_answer="Error summarizing duplicate check results, duplicate check aborted",
                    similar_models=[],
                ),
                "has_error": True,
            }

    @staticmethod
    def _format_ratings_for_prompt(ratings: list[ModelRating]) -> str:
        """Format DuplicateCheckResponse model ratings for prompt inclusion.

        Args:
            :arg ratings (list[ModelRating]): List of ModelRating objects.

        Returns:
            :return str: Formatted string of model ratings.
        """
        formatted = []
        for rating in ratings:
            formatted.append(
                f'Candidate Model Name "{rating.model_name}": Rating {rating.rating}/10 - Reasoning:{rating.reasoning}'
            )
        return "\n".join(formatted)

    @traceable(run_type="chain", name="Duplicate Check Workflow")
    def run_workflow(self, bpmn_model_xml: str, exclude_model_id: str = "") -> DuplicateCheckResult:
        """
        Method to run the duplicate check workflow for a given BPMN Model.

        Args:
            :arg bpmn_model_xml (str): XML of the corresponding BPMN model to check.
            :arg exclude_model_id (str): Model ID to exclude from results (to prevent self-matching).

        Returns:
            :return DuplicateCheckResponse: Response answer and similar models.
        """

        initial_state = {
            "input_bpmn_model_xml": bpmn_model_xml,
            "bpmn_model_description": "",
            "vector_search_results": [],
            "vector_search_scores": [],
            "model_ratings": [],
            "final_result": DuplicateCheckResult(response_answer="No duplicate check performed.", similar_models=[]),
            "has_error": False,
            "exclude_model_id": exclude_model_id,
        }

        final_state = self.graph.invoke(initial_state)
        return final_state["final_result"]
