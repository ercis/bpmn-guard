"""Service for BPMN model database operations."""

import logging
import re
from typing import Any, List
from uuid import UUID, uuid4
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile, HTTPException, status

from app.db.models.bpmn_model import BPMNModel
from app.schemas.bpmn_model import BPMNModelCreate, BPMNModelUpdate, BPMNModelResponse, ReportSummary
from app.utils import local_storage
from app.services.bpmn_validation_services import BPMNValidationService, BPMNValidationError
from app.services.vector_service import get_vector_service
from app.language_model_client.client import LLMClient
from app.utils.bpmn_model_utils import BPMNModelUtils

logger = logging.getLogger(__name__)

# Initialize BPMN validation service
try:
    bpmn_validation_service = BPMNValidationService()
except BPMNValidationError as e:
    logger.warning(f"BPMN validation service initialization warning: {e}")
    bpmn_validation_service = None


class BPMNModelService:
    """Service class for BPMN model operations."""

    # Storage configuration
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    MAX_FILES = 10
    PATH = "models"
    ALLOWED_EXTENSIONS = {"bpmn", "xml"}

    # LLM prompt for generating BPMN model descriptions
    DESCRIPTION_GENERATION_PROMPT = """You are an expert BPMN analyst. Analyze the following BPMN model and provide a concise 2-sentence description for business process modelers.

    First sentence: State what business process or workflow this model represents.
    Second sentence: Highlight the key outcome or main decision point.

    Write in clear, professional language. Avoid technical XML details. Focus on what a modeler browsing models needs to know at a glance.

    BPMN Model:
    {bpmn_xml}"""

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to prevent path traversal attacks.

        Removes directory separators and potentially dangerous characters.
        Keeps only the base filename with extension.

        Args:
            filename: Original filename from upload

        Returns:
            Sanitized filename safe for storage
        """
        # Get just the filename (no path components)
        safe_name = Path(filename).name

        # Remove any remaining path separators and null bytes
        safe_name = safe_name.replace("/", "_").replace("\\", "_").replace("\0", "")

        # Remove any characters that aren't alphanumeric, dash, underscore, or dot
        safe_name = re.sub(r"[^\w\-\.]", "_", safe_name)

        # Ensure filename isn't empty after sanitization
        if not safe_name or safe_name == "." or safe_name == "..":
            safe_name = "upload.bpmn"

        return safe_name

    SORTABLE_FIELDS: dict[str, Any] = {
        "name": BPMNModel.name,
        "version": BPMNModel.version,
        "file_size": BPMNModel.file_size,
        "created_at": BPMNModel.created_at,
        "updated_at": BPMNModel.updated_at,
    }

    @staticmethod
    async def get_all_models(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 15,
        uploaded_by: UUID | None = None,
        sort_by: str = "created_at",
        sort_direction: str = "desc",
    ) -> tuple[List[BPMNModel], int]:
        """
        Get paginated BPMN models from the database.

        Args:
            db: Async database session
            page: Page number (1-based)
            page_size: Number of items per page
            uploaded_by: Optional filter by user UUID
            sort_by: Field to sort by (name, version, file_size, created_at, updated_at)
            sort_direction: Sort direction (asc or desc)

        Returns:
            Tuple of (list of BPMN models, total count)
        """
        try:
            query = select(BPMNModel)
            count_query = select(func.count()).select_from(BPMNModel)

            if uploaded_by is not None:
                query = query.where(BPMNModel.uploaded_by == uploaded_by)
                count_query = count_query.where(BPMNModel.uploaded_by == uploaded_by)

            # Get total count
            total_result = await db.execute(count_query)
            total = total_result.scalar_one()

            # Get paginated results with sorting
            offset = (page - 1) * page_size
            sort_column = BPMNModelService.SORTABLE_FIELDS.get(sort_by, BPMNModel.created_at)
            order = sort_column.asc() if sort_direction == "asc" else sort_column.desc()
            query = query.order_by(order).offset(offset).limit(page_size)
            result = await db.execute(query)
            models = result.scalars().all()

            logger.info(f"Retrieved {len(models)} BPMN models (page {page}, total {total})")
            return list(models), total
        except Exception as e:
            logger.error(f"Error retrieving BPMN models: {e}")
            raise

    @staticmethod
    async def get_model_by_id(db: AsyncSession, model_id: UUID) -> BPMNModel | None:
        """
        Get a BPMN model by its ID.

        Args:
            db: Async database session
            model_id: UUID of the model

        Returns:
            BPMN model or None if not found
        """
        try:
            result = await db.execute(select(BPMNModel).where(BPMNModel.id == model_id))
            model = result.scalar_one_or_none()
            if model:
                logger.info(f"Retrieved BPMN model: {model_id}")
            else:
                logger.warning(f"BPMN model not found: {model_id}")
            return model
        except Exception as e:
            logger.error(f"Error retrieving BPMN model {model_id}: {e}")
            raise

    @staticmethod
    async def get_model_with_reports(db: AsyncSession, model_id: UUID) -> BPMNModelResponse | None:
        """
        Get a BPMN model by its ID with associated evaluation reports.

        Args:
            db: Async database session
            model_id: UUID of the model

        Returns:
            BPMNModelResponse with reports or None if not found
        """
        try:
            result = await db.execute(
                select(BPMNModel).where(BPMNModel.id == model_id).options(selectinload(BPMNModel.evaluation_reports))
            )
            model = result.scalar_one_or_none()
            if not model:
                logger.warning(f"BPMN model not found: {model_id}")
                return None

            # Build report summaries from loaded evaluation_reports
            reports = [
                ReportSummary(
                    id=report.id,
                    evaluation_rating=report.evaluation_rating,
                    created_at=report.created_at,
                )
                for report in model.evaluation_reports
            ]

            return BPMNModelResponse(
                id=model.id,
                name=model.name,
                description=model.description,
                version=model.version,
                file_path=model.file_path,
                file_size=model.file_size,
                uploaded_by=model.uploaded_by,
                created_at=model.created_at,
                updated_at=model.updated_at,
                reports=reports,
            )
        except Exception as e:
            logger.error(f"Error retrieving BPMN model {model_id}: {e}")
            raise

    @staticmethod
    async def create_model(db: AsyncSession, file: UploadFile, model_data: BPMNModelCreate) -> BPMNModel:
        """
        Create a new BPMN model by uploading file and creating database record.

        Args:
            db: Async database session
            file: The uploaded BPMN file
            model_data: BPMNModelCreate object containing model metadata (name, description, version, uploaded_by)

        Returns:
            Created BPMN model
        """
        file_path: str | None = None
        try:
            # Validate file extension
            if not file.filename:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name is required")

            # Check for valid file extension
            if "." not in file.filename or file.filename.startswith(".") or file.filename.endswith("."):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file name. File must have a valid extension. Allowed: {', '.join(BPMNModelService.ALLOWED_EXTENSIONS)}",
                )

            file_extension = file.filename.rsplit(".", 1)[-1].lower()
            if file_extension not in BPMNModelService.ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file extension. Allowed: {', '.join(BPMNModelService.ALLOWED_EXTENSIONS)}",
                )

            # Read content first to validate actual size
            content = await file.read()

            # Validate file size based on actual content length
            if len(content) > BPMNModelService.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size exceeds maximum allowed size of {BPMNModelService.MAX_FILE_SIZE / (1024 * 1024)}MB",
                )

            # Decode content
            try:
                content_str = content.decode("utf-8")
            except UnicodeDecodeError as decode_error:
                logger.error(f"File encoding error: {decode_error}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File must be valid UTF-8 encoded XML. Please ensure the file is saved with UTF-8 encoding.",
                )

            # Validate content
            if bpmn_validation_service:
                try:
                    bpmn_validation_service.validate_content(content_str)
                    logger.info(f"BPMN file validated successfully: {file.filename}")
                except BPMNValidationError as e:
                    logger.error(f"BPMN validation failed: {e}")
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid BPMN file: {str(e)}")
            else:
                logger.warning("BPMN validation service not available, skipping validation")

            # Generate Description
            llm_client = LLMClient().create_llm_model()
            description = BPMNModelUtils.describe_bpmn_model(
                bpmn_model_xml=content_str,
                llm_client=llm_client,
                user_prompt=BPMNModelService.DESCRIPTION_GENERATION_PROMPT.format(bpmn_xml=content_str),
            )

            # Generate unique file path
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid4())[:8]
            safe_filename = BPMNModelService._sanitize_filename(file.filename)
            file_path = f"{BPMNModelService.PATH}/{timestamp}_{unique_id}_{safe_filename}"

            # Persist file to local storage
            local_storage.save_file(file_path, content)

            # Create database record
            db_model = BPMNModel(
                name=model_data.name,
                description=description,
                version=model_data.version,
                file_path=file_path,
                file_size=len(content),
                uploaded_by=model_data.uploaded_by,
                bpmn_xml=content_str,
            )
            db.add(db_model)
            await db.commit()
            await db.refresh(db_model)
            logger.info(f"Created BPMN model: {db_model.id} with file: {file_path}")

            # Add to vector store for duplicate detection (best effort - don't fail if this errors)
            try:
                vector_service = get_vector_service()
                vector_service.add_model(
                    model_id=db_model.id,
                    model_name=db_model.name,
                    description=description or "",
                    bpmn_xml=content_str,
                    file_path=file_path,
                )
            except Exception as vector_error:
                logger.warning(f"Failed to add model {db_model.id} to vector store: {vector_error}")

            return db_model
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating BPMN model: {e}")
            # Try to cleanup uploaded file if database operation failed
            if file_path:
                local_storage.delete_file(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create BPMN model: {str(e)}"
            )

    @staticmethod
    async def update_model(db: AsyncSession, model_id: UUID, model_data: BPMNModelUpdate) -> BPMNModel | None:
        """
        Update an existing BPMN model metadata.

        All fields are optional - only provided fields will be updated.
        Validates that provided string fields are not empty.

        Args:
            db: Async database session
            model_id: UUID of the model to update
            model_data: Model metadata update (name, description, version - all optional)

        Returns:
            Updated BPMN model or None if not found

        Raises:
            ValueError: If provided data is invalid (e.g., empty strings)
            Exception: If database operation fails
        """
        try:
            result = await db.execute(select(BPMNModel).where(BPMNModel.id == model_id))
            db_model = result.scalar_one_or_none()

            if not db_model:
                logger.warning(f"BPMN model not found for update: {model_id}")
                return None

            # Update only provided fields
            update_data = model_data.model_dump(exclude_unset=True)

            # Validate fields with db entry
            if "name" in update_data:
                if not update_data["name"] or not update_data["name"].strip():
                    raise ValueError("Model name cannot be empty (required field)")
                update_data["name"] = update_data["name"].strip()

            if "version" in update_data:
                if not update_data["version"] or not update_data["version"].strip():
                    raise ValueError("Model version cannot be empty (required field)")
                update_data["version"] = update_data["version"].strip()

            if "description" in update_data:
                if update_data["description"] is not None and update_data["description"] != "":
                    stripped = update_data["description"].strip()
                    if not stripped:
                        raise ValueError("Model description cannot contain only whitespace")
                    update_data["description"] = stripped
                else:
                    update_data["description"] = None

            # Log the fields being updated
            logger.info(f"Updating BPMN model {model_id} fields: {list(update_data.keys())}")

            for field, value in update_data.items():
                setattr(db_model, field, value)

            await db.commit()
            await db.refresh(db_model)
            logger.info(f"Successfully updated BPMN model: {model_id}")
            return db_model

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error updating BPMN model {model_id}: {e}")
            raise

    @staticmethod
    async def update_file(db: AsyncSession, model_id: UUID, file: UploadFile, user_id: UUID) -> BPMNModel | None:
        """
        Replace an existing BPMN model's file and regenerate description.

        This will:
        - Validate and upload the new file
        - Generate a new description from the new file content
        - Update file_path, file_size, description, and uploaded_by
        - Delete the old file from storage

        Args:
            db: Async database session
            model_id: UUID of the model to update
            file: New BPMN file to upload
            user_id: UUID of the user replacing the file

        Returns:
            Updated BPMN model or None if not found

        Raises:
            HTTPException: If validation fails or file operations fail
        """
        new_file_path: str | None = None
        old_file_path: str | None = None

        try:
            # Get existing model
            result = await db.execute(select(BPMNModel).where(BPMNModel.id == model_id))
            db_model = result.scalar_one_or_none()

            if not db_model:
                logger.warning(f"BPMN model not found for file update: {model_id}")
                return None

            # Store old file path for cleanup later
            old_file_path = str(db_model.file_path)

            # Validate file extension
            if not file.filename:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name is required")

            # Check for valid file extension (must have a dot and a non-empty extension)
            if "." not in file.filename or file.filename.startswith(".") or file.filename.endswith("."):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file name. File must have a valid extension. Allowed: {', '.join(BPMNModelService.ALLOWED_EXTENSIONS)}",
                )

            file_extension = file.filename.rsplit(".", 1)[-1].lower()
            if file_extension not in BPMNModelService.ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file extension. Allowed: {', '.join(BPMNModelService.ALLOWED_EXTENSIONS)}",
                )

            # Read content first to validate actual size
            content = await file.read()

            # Validate file size based on actual content length
            if len(content) > BPMNModelService.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size exceeds maximum allowed size of {BPMNModelService.MAX_FILE_SIZE / (1024 * 1024)}MB",
                )

            # Decode content
            try:
                content_str = content.decode("utf-8")
            except UnicodeDecodeError as decode_error:
                logger.error(f"File encoding error: {decode_error}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File must be valid UTF-8 encoded XML. Please ensure the file is saved with UTF-8 encoding.",
                )

            # Validate content
            if bpmn_validation_service:
                try:
                    bpmn_validation_service.validate_content(content_str)
                    logger.info(f"BPMN file validated successfully: {file.filename}")
                except BPMNValidationError as e:
                    logger.error(f"BPMN validation failed: {e}")
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid BPMN file: {str(e)}")
            else:
                logger.warning("BPMN validation service not available, skipping validation")

            # Generate new description from new file
            llm_client = LLMClient().create_llm_model()
            description = BPMNModelUtils.describe_bpmn_model(
                bpmn_model_xml=content_str,
                llm_client=llm_client,
                user_prompt=BPMNModelService.DESCRIPTION_GENERATION_PROMPT.format(bpmn_xml=content_str),
            )

            # Generate unique file path for new file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid4())[:8]
            safe_filename = BPMNModelService._sanitize_filename(file.filename)
            new_file_path = f"{BPMNModelService.PATH}/{timestamp}_{unique_id}_{safe_filename}"

            # Persist new file to local storage
            local_storage.save_file(new_file_path, content)

            # Update database record with new file info
            update_data = {
                "file_path": new_file_path,
                "file_size": len(content),
                "description": description,
                "uploaded_by": user_id,
                "bpmn_xml": content_str,
            }

            for field, value in update_data.items():
                setattr(db_model, field, value)

            await db.commit()
            await db.refresh(db_model)

            # Delete old file from storage (best effort)
            local_storage.delete_file(old_file_path)

            # Update vector store for duplicate detection (best effort - don't fail if this errors)
            try:
                vector_service = get_vector_service()
                vector_service.update_model(
                    model_id=db_model.id,
                    model_name=db_model.name,
                    description=description or "",
                    bpmn_xml=content_str,
                    file_path=new_file_path,
                )
            except Exception as vector_error:
                logger.warning(f"Failed to update model {db_model.id} in vector store: {vector_error}")

            logger.info(f"Successfully updated file for BPMN model: {model_id}")
            return db_model

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating BPMN model file {model_id}: {e}")

            # Try to cleanup new file if database operation failed
            if new_file_path:
                local_storage.delete_file(new_file_path)

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update BPMN model file: {str(e)}"
            )

    @staticmethod
    async def delete_model(db: AsyncSession, model_id: UUID) -> bool:
        """
        Delete a BPMN model and its associated file from storage.

        This will:
        - Delete the database record
        - Delete the file from Supabase storage (best effort)

        Args:
            db: Async database session
            model_id: UUID of the model to delete

        Returns:
            True if deleted, False if not found
        """
        try:
            result = await db.execute(select(BPMNModel).where(BPMNModel.id == model_id))
            db_model = result.scalar_one_or_none()

            if not db_model:
                logger.warning(f"BPMN model not found for deletion: {model_id}")
                return False

            # Store file path before deleting record
            file_path = str(db_model.file_path)

            # Delete database record
            await db.delete(db_model)
            await db.commit()
            logger.info(f"Deleted BPMN model from database: {model_id}")

            # Delete file from storage (best effort)
            local_storage.delete_file(file_path)

            # Delete from vector store (best effort - don't fail if this errors)
            try:
                vector_service = get_vector_service()
                vector_service.delete_model(model_id)
            except Exception as vector_error:
                logger.warning(f"Failed to delete model {model_id} from vector store: {vector_error}")

            return True
        except Exception as e:
            logger.error(f"Error deleting BPMN model {model_id}: {e}")
            raise

    @staticmethod
    async def get_file_bytes(db: AsyncSession, model_id: UUID) -> tuple[str, bytes] | None:
        """Return (filename, bytes) for a model's stored BPMN file.

        Falls back to the bpmn_xml column if the on-disk file is missing — useful
        for resilience when the storage volume gets wiped but the DB is preserved.
        """
        result = await db.execute(select(BPMNModel).where(BPMNModel.id == model_id))
        db_model = result.scalar_one_or_none()
        if not db_model:
            return None

        file_path = str(db_model.file_path)
        filename = Path(file_path).name or f"{db_model.name}.bpmn"
        try:
            return filename, local_storage.read_file(file_path)
        except FileNotFoundError:
            logger.warning(f"Stored file missing for model {model_id}, falling back to bpmn_xml column")
            if db_model.bpmn_xml:
                return filename, db_model.bpmn_xml.encode("utf-8")
            raise
