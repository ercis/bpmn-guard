"""Service for issue exclusion database operations."""

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.evaluation_report import EvaluationReport
from app.db.models.issue_exclusion import IssueExclusion
from app.schemas.issue_exclusion import (
    BulkExclusionRequest,
    IssueExclusionCreate,
)

logger = logging.getLogger(__name__)


class IssueExclusionService:
    """Service class for issue exclusion operations."""

    @staticmethod
    async def get_exclusions_for_report(db: AsyncSession, report_id: UUID) -> list[IssueExclusion]:
        """
        Get all exclusions for a specific evaluation report.

        Args:
            db: Async database session
            report_id: UUID of the evaluation report

        Returns:
            List of issue exclusions for the report
        """
        try:
            result = await db.execute(
                select(IssueExclusion)
                .where(IssueExclusion.report_id == report_id)
                .order_by(IssueExclusion.created_at.desc())
            )
            exclusions = result.scalars().all()
            logger.info(f"Retrieved {len(exclusions)} exclusions for report {report_id}")
            return list(exclusions)
        except Exception as e:
            logger.error(f"Error retrieving exclusions for report {report_id}: {e}")
            raise

    @staticmethod
    async def get_exclusion_by_id(db: AsyncSession, exclusion_id: UUID) -> IssueExclusion | None:
        """
        Get an exclusion by its ID.

        Args:
            db: Async database session
            exclusion_id: UUID of the exclusion

        Returns:
            Issue exclusion or None if not found
        """
        try:
            result = await db.execute(select(IssueExclusion).where(IssueExclusion.id == exclusion_id))
            exclusion = result.scalar_one_or_none()
            if exclusion:
                logger.info(f"Retrieved exclusion: {exclusion_id}")
            else:
                logger.warning(f"Exclusion not found: {exclusion_id}")
            return exclusion
        except Exception as e:
            logger.error(f"Error retrieving exclusion {exclusion_id}: {e}")
            raise

    @staticmethod
    async def _verify_report_exists(db: AsyncSession, report_id: UUID) -> None:
        """
        Verify that an evaluation report exists.

        Args:
            db: Async database session
            report_id: UUID of the evaluation report

        Raises:
            HTTPException: If report not found
        """
        result = await db.execute(select(EvaluationReport.id).where(EvaluationReport.id == report_id))
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evaluation report {report_id} not found",
            )

    @staticmethod
    async def _check_duplicate_exclusion(
        db: AsyncSession,
        report_id: UUID,
        check_type: str,
        issue_identifier: dict,
    ) -> bool:
        """
        Check if an exclusion already exists for this issue.

        Args:
            db: Async database session
            report_id: UUID of the evaluation report
            check_type: Type of check
            issue_identifier: JSON identifier for the issue

        Returns:
            True if duplicate exists, False otherwise
        """
        result = await db.execute(
            select(IssueExclusion.id)
            .where(IssueExclusion.report_id == report_id)
            .where(IssueExclusion.check_type == check_type)
            .where(IssueExclusion.issue_identifier == issue_identifier)
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def create_exclusion(
        db: AsyncSession,
        report_id: UUID,
        data: IssueExclusionCreate,
        user_id: str,
    ) -> IssueExclusion:
        """
        Create a new issue exclusion.

        Args:
            db: Async database session
            report_id: UUID of the evaluation report
            data: Exclusion data
            user_id: ID of the user creating the exclusion

        Returns:
            Created issue exclusion

        Raises:
            HTTPException: If report not found or duplicate exclusion
        """
        try:
            # Verify report exists
            await IssueExclusionService._verify_report_exists(db, report_id)

            # Check for duplicate
            if await IssueExclusionService._check_duplicate_exclusion(
                db, report_id, data.check_type.value, data.issue_identifier
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This issue has already been excluded",
                )

            # Create exclusion
            exclusion = IssueExclusion(
                report_id=report_id,
                check_type=data.check_type.value,
                issue_identifier=data.issue_identifier,
                issue_snapshot=data.issue_snapshot,
                reason=data.reason,
                excluded_by=user_id,
            )
            db.add(exclusion)
            await db.commit()
            await db.refresh(exclusion)

            logger.info(f"Created exclusion {exclusion.id} for report {report_id}")
            return exclusion

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating exclusion for report {report_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create exclusion",
            )

    @staticmethod
    async def delete_exclusion(db: AsyncSession, exclusion_id: UUID) -> bool:
        """
        Delete an issue exclusion (restore the issue).

        Args:
            db: Async database session
            exclusion_id: UUID of the exclusion to delete

        Returns:
            True if deleted, False if not found
        """
        try:
            exclusion = await IssueExclusionService.get_exclusion_by_id(db, exclusion_id)
            if not exclusion:
                return False

            await db.delete(exclusion)
            await db.commit()

            logger.info(f"Deleted exclusion: {exclusion_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting exclusion {exclusion_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete exclusion",
            )

    @staticmethod
    async def bulk_update_exclusions(
        db: AsyncSession,
        report_id: UUID,
        data: BulkExclusionRequest,
        user_id: str,
    ) -> tuple[int, int, int, list[IssueExclusion]]:
        """
        Bulk update exclusions for a report (create new ones, delete removed ones).

        Args:
            db: Async database session
            report_id: UUID of the evaluation report
            data: Bulk update request with to_create and to_delete lists
            user_id: ID of the user making the changes

        Returns:
            Tuple of (created_count, deleted_count, skipped_count, current_exclusions)

        Raises:
            HTTPException: If report not found or operation fails
        """
        try:
            # Verify report exists
            await IssueExclusionService._verify_report_exists(db, report_id)

            created_count = 0
            deleted_count = 0
            skipped_count = 0

            # Fetch all existing exclusions for this report once (avoid N+1 queries)
            result = await db.execute(select(IssueExclusion).where(IssueExclusion.report_id == report_id))
            existing_exclusions = result.scalars().all()

            # Create lookup structures for efficient duplicate checking
            exclusions_by_id = {exc.id: exc for exc in existing_exclusions}
            existing_keys = {(exc.check_type, str(exc.issue_identifier)) for exc in existing_exclusions}

            # Delete exclusions
            for exclusion_id in data.to_delete:
                exclusion = exclusions_by_id.get(exclusion_id)
                if exclusion:
                    await db.delete(exclusion)
                    deleted_count += 1
                    # Remove from lookup so we don't count it as duplicate later
                    existing_keys.discard((exclusion.check_type, str(exclusion.issue_identifier)))

            # Create new exclusions
            for exclusion_data in data.to_create:
                # Skip duplicates using in-memory lookup
                duplicate_key = (exclusion_data.check_type.value, str(exclusion_data.issue_identifier))
                if duplicate_key in existing_keys:
                    logger.warning(f"Skipping duplicate exclusion for {exclusion_data.check_type}")
                    skipped_count += 1
                    continue

                exclusion = IssueExclusion(
                    report_id=report_id,
                    check_type=exclusion_data.check_type.value,
                    issue_identifier=exclusion_data.issue_identifier,
                    issue_snapshot=exclusion_data.issue_snapshot,
                    reason=exclusion_data.reason,
                    excluded_by=user_id,
                )
                db.add(exclusion)
                created_count += 1
                # Add to lookup to prevent duplicates within the same batch
                existing_keys.add(duplicate_key)

            await db.commit()

            # Fetch current state
            current_exclusions = await IssueExclusionService.get_exclusions_for_report(db, report_id)

            logger.info(
                f"Bulk update for report {report_id}: "
                f"created {created_count}, deleted {deleted_count}, skipped {skipped_count}"
            )

            return created_count, deleted_count, skipped_count, current_exclusions

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in bulk update for report {report_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update exclusions",
            )
