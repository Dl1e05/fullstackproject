"""Add course progress and quiz attempts.

Revision ID: 20261122_02_progress
Revises: 20261122_01_auth
Create Date: 2026-11-22

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261122_02_progress"
down_revision: str | Sequence[str] | None = "20261122_01_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "course_progress",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.String(length=50), nullable=False),
        sa.Column("saved", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("last_lesson_id", sa.String(length=50), nullable=True),
        sa.Column("last_lesson_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["last_lesson_id"], ["lessons.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "course_id"),
    )
    op.create_index("ix_course_progress_course_id", "course_progress", ["course_id"], unique=False)

    op.create_table(
        "lesson_completions",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.String(length=50), nullable=False),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "lesson_id"),
    )
    op.create_index(
        "ix_lesson_completions_lesson_id", "lesson_completions", ["lesson_id"], unique=False
    )

    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.String(length=50), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "total > 0 AND score >= 0 AND score <= total",
            name="ck_quiz_attempts_score_valid",
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quiz_attempts_course_id", "quiz_attempts", ["course_id"], unique=False)
    op.create_index(
        "ix_quiz_attempts_user_course_created",
        "quiz_attempts",
        ["user_id", "course_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_quiz_attempts_user_course_created", table_name="quiz_attempts")
    op.drop_index("ix_quiz_attempts_course_id", table_name="quiz_attempts")
    op.drop_table("quiz_attempts")
    op.drop_index("ix_lesson_completions_lesson_id", table_name="lesson_completions")
    op.drop_table("lesson_completions")
    op.drop_index("ix_course_progress_course_id", table_name="course_progress")
    op.drop_table("course_progress")
