"""PGVector database."""

import logging
from pathlib import Path

from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_core.language_models import BaseChatModel
from langchain_postgres.vectorstores import PGVector
from langsmith import traceable

from app.core.config import get_settings
from app.utils.bpmn_model_utils import BPMNModelUtils

settings = get_settings()

logger = logging.getLogger(__name__)


class VectorDB:
    """Class to manage the lifecycle of a Postgres(PG) vector database instance."""

    @staticmethod
    def create_pg_vector_db(
        connection_string: str,
        collection_name: str,
        embeddings: OpenAIEmbeddings,
        pre_delete_collection: bool = False,
    ) -> PGVector:
        """Create a PGVector database.

        Args:
            connection_string: The connection string to the database.
            collection_name: The name of the collection to store vectors.
            embeddings: Embeddings function to use.
            pre_delete_collection: If True, deletes existing collection before creating.

        Returns:
            The initialized PGVector database object.
        """
        return PGVector(
            embeddings=embeddings,
            collection_name=collection_name,
            connection=connection_string,
            use_jsonb=True,
            pre_delete_collection=pre_delete_collection,
        )

    @staticmethod
    def fill_pg_vector_db(vector_storage: PGVector, path_to_bpmn_examples: Path, llm_client: BaseChatModel) -> None:  # type: ignore[valid-type]
        """Function to fill the PGVector Storage using BPMN model descriptions.

        Args:
            :arg vector_storage (PGVector): The PGVector database instance.
            :arg path_to_bpmn_examples (Path): Path to the bpmn model example directory.
            :arg llm_client (BaseChatModel): Large Language Model Client.
        """

        try:
            bpmn_descriptions_list = []
            bpmn_model_paths = path_to_bpmn_examples.rglob("*.bpmn")
            bpmn_description_paths = list(path_to_bpmn_examples.rglob("*.txt"))
        except FileNotFoundError:
            return

        for bpmn_model_path in bpmn_model_paths:
            try:
                bpmn_model_xml = bpmn_model_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"Error reading BPMN file {bpmn_model_path}: {e}")
                continue

            try:
                bpmn_description_file_path = BPMNModelUtils.check_if_model_description_exists(
                    bpmn_model_path, bpmn_description_paths
                )
            except Exception as e:
                logger.warning(f"Error searching for description file for {bpmn_model_path.stem}: {e}")
                bpmn_description_file_path = None

            if bpmn_description_file_path:
                try:
                    bpmn_model_description = bpmn_description_file_path.read_text(encoding="utf-8")
                except (FileNotFoundError, UnicodeDecodeError) as e:
                    logger.warning(
                        f"Error reading description file {bpmn_description_file_path:}: {e}. Generating description instead."
                    )
                    try:
                        bpmn_model_description = BPMNModelUtils.describe_bpmn_model(bpmn_model_xml, llm_client)

                        if bpmn_model_description is None:
                            raise Exception
                    except Exception as e:
                        logger.error(f"Error generating description for {bpmn_model_path.stem}: {e}")
                        continue
            else:
                try:
                    bpmn_model_description = BPMNModelUtils.describe_bpmn_model(bpmn_model_xml, llm_client)

                    if bpmn_model_description is None:
                        raise Exception
                except Exception as e:
                    logger.error(f"Error generating description for {bpmn_model_path.stem}: {e}")
                    continue

            try:
                document = Document(
                    page_content=bpmn_model_description,
                    metadata={
                        "id": bpmn_model_path.stem,
                        "source": str(bpmn_model_path.as_posix()),
                        "bpmn_model_xml": bpmn_model_xml,
                        "bpmn_model_description": bpmn_model_description,
                    },
                )
                bpmn_descriptions_list.append(document)
                logger.info(f"Successfully processed BPMN model: {bpmn_model_path.stem}")
            except Exception as e:
                logger.error(f"Error creating Document object for {bpmn_model_path.stem}: {e}")
                continue

        try:
            vector_storage.add_documents(bpmn_descriptions_list)
            logger.info(f"Successfully added {len(bpmn_descriptions_list)} documents to vector storage")
        except Exception as e:
            logger.error(f"Error adding documents to vector storage: {e}", exc_info=True)
            raise

    @staticmethod
    @traceable(run_type="retriever", name="Vector Similarity Search")
    def similarity_search(
        vector_storage: PGVector,
        query: str,
        num_returns: int = 5,
        filter_columns: dict | None = None,
    ) -> tuple[list[dict], list[float]]:
        """Return the similarity search result including metadata.

        Args:
            :arg vector_storage (PGVector): The PGVector database instance.
            :arg query (str): The string to compare against the vectors.
            :arg num_returns (int): The number of similar results to return.
            :arg filter_columns (dict | None): Optional filter to apply on metadata columns.

        Returns:
            :return list[dict]: List of metadata dictionaries from the similarity search results.
        """
        similarity_search_response = vector_storage.similarity_search_with_score(
            query, num_returns, filter=filter_columns
        )
        metadata_doc = []
        scores_doc = []

        for doc, score in similarity_search_response:
            metadata_doc.append(doc.metadata)
            scores_doc.append(round(1 - score, 4))
        return metadata_doc, scores_doc
