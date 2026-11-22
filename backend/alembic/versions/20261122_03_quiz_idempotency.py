"""Add idempotency keys to quiz attempts.

Revision ID: 20261122_03_quiz_idempotency
Revises: 20261122_02_progress
Create Date: 2026-11-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261122_03_quiz_idempotency"
down_revision: str | Sequence[str] | None = "20261122_02_progress"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "quiz_attempts",
        sa.Column("client_attempt_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "quiz_attempts",
        sa.Column("request_hash", sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        "uq_quiz_attempts_client_attempt",
        "quiz_attempts",
        ["user_id", "course_id", "client_attempt_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_quiz_attempts_client_attempt", "quiz_attempts", type_="unique")
    op.drop_column("quiz_attempts", "request_hash")
    op.drop_column("quiz_attempts", "client_attempt_id")
