"""Service for managing BPMN model vectors in PGVector storage."""

import logging
from uuid import UUID

from langchain_core.documents import Document
from langchain_postgres import PGVector

from app.core.config import get_settings
from app.language_model_client.client import LLMClient
from app.db.vector_storage import VectorDB

settings = get_settings()
logger = logging.getLogger(__name__)

# Collection name for BPMN models
VECTOR_COLLECTION_NAME = "bpmn_examples_corpus"


class VectorService:
    """Service for managing BPMN model vectors in PGVector storage."""

    def __init__(self, vector_storage: PGVector | None = None):
        """Initialize VectorService with optional vector storage.

        Args:
            vector_storage: PGVector instance. If None, creates one using settings.
        """
        if vector_storage is not None:
            self._vector_storage = vector_storage
        else:
            self._vector_storage = None

    @property
    def vector_storage(self) -> PGVector:
        """Lazy initialization of vector storage."""
        if self._vector_storage is None:
            embeddings = LLMClient.get_embedding_function()
            self._vector_storage = VectorDB.create_pg_vector_db(
                connection_string=settings.SYNC_DATABASE_URI,
                collection_name=VECTOR_COLLECTION_NAME,
                embeddings=embeddings,
            )
        return self._vector_storage

    def add_model(
        self,
        model_id: UUID,
        model_name: str,
        description: str,
        bpmn_xml: str,
        file_path: str | None = None,
    ) -> str:
        """Add a BPMN model to the vector store.

        Args:
            model_id: UUID of the BPMN model (used as vector store ID).
            model_name: Name of the model.
            description: Model description (used for embedding).
            bpmn_xml: The BPMN XML content.
            file_path: Optional file path.

        Returns:
            The ID of the added document.
        """
        doc = Document(
            page_content=description,
            metadata={
                "id": str(model_id),
                "name": model_name,
                "source": file_path or "",
                "bpmn_model_xml": bpmn_xml,
                "bpmn_model_description": description,
            },
        )

        try:
            ids = self.vector_storage.add_documents([doc], ids=[str(model_id)])
            logger.info(f"Added model {model_id} to vector store")
            return ids[0] if ids else str(model_id)
        except Exception as e:
            logger.error(f"Failed to add model {model_id} to vector store: {e}")
            raise

    def update_model(
        self,
        model_id: UUID,
        model_name: str,
        description: str,
        bpmn_xml: str,
        file_path: str | None = None,
    ) -> str:
        """Update a BPMN model in the vector store (delete + add).

        Args:
            model_id: UUID of the BPMN model.
            model_name: Name of the model.
            description: New model description.
            bpmn_xml: New BPMN XML content.
            file_path: Optional file path.

        Returns:
            The ID of the updated document.
        """
        try:
            # Delete existing entry (ignore if not found)
            self.delete_model(model_id)
        except Exception as e:
            logger.warning(f"Could not delete existing vector for model {model_id}: {e}")

        # Add new entry
        return self.add_model(model_id, model_name, description, bpmn_xml, file_path)

    def delete_model(self, model_id: UUID) -> bool:
        """Delete a BPMN model from the vector store.

        Args:
            model_id: UUID of the BPMN model to delete.

        Returns:
            True if deletion was attempted (PGVector doesn't confirm if ID existed).
        """
        try:
            self.vector_storage.delete(ids=[str(model_id)])
            logger.info(f"Deleted model {model_id} from vector store")
            return True
        except Exception as e:
            logger.error(f"Failed to delete model {model_id} from vector store: {e}")
            raise


# Singleton instance for reuse
_vector_service: VectorService | None = None


def get_vector_service() -> VectorService:
    """Get or create the singleton VectorService instance.

    Returns:
        VectorService instance.
    """
    global _vector_service
    if _vector_service is None:
        _vector_service = VectorService()
    return _vector_service
