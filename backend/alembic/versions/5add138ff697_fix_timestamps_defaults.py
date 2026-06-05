"""fix_timestamps_defaults

Revision ID: 5add138ff697
Revises: 5111fea41397
Create Date: 2026-01-16 12:43:39.503338

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "5add138ff697"
down_revision: Union[str, None] = "5111fea41397"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add default values for created_at and updated_at if they don't exist
    op.execute("ALTER TABLE bpmn_models ALTER COLUMN created_at SET DEFAULT NOW()")
    op.execute("ALTER TABLE bpmn_models ALTER COLUMN updated_at SET DEFAULT NOW()")

    # Update any existing NULL values
    op.execute("UPDATE bpmn_models SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE bpmn_models SET updated_at = NOW() WHERE updated_at IS NULL")


def downgrade() -> None:
    # Remove default values
    op.execute("ALTER TABLE bpmn_models ALTER COLUMN created_at DROP DEFAULT")
    op.execute("ALTER TABLE bpmn_models ALTER COLUMN updated_at DROP DEFAULT")
