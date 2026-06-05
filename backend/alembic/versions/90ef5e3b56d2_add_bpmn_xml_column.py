"""add_bpmn_xml_column

Revision ID: 90ef5e3b56d2
Revises: 9ef24e42fac7
Create Date: 2025-12-14 23:02:12.935937

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "90ef5e3b56d2"
down_revision: Union[str, None] = "9ef24e42fac7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add bpmn_xml column to bpmn_models table (nullable for backward compatibility)
    op.add_column("bpmn_models", sa.Column("bpmn_xml", sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove bpmn_xml column from bpmn_models table
    op.drop_column("bpmn_models", "bpmn_xml")
