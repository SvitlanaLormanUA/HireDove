"""Add candidate profiles, singleton resumes and saved vacancies.

Revision ID: c92e714a03b1
Revises: f7c1f38c6b2b
"""
from alembic import op
import sqlalchemy as sa

revision = "c92e714a03b1"
down_revision = "f7c1f38c6b2b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "candidate_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phone", sa.String(50), nullable=False),
        sa.Column("location", sa.String(120), nullable=False),
        sa.Column("education", sa.Text(), nullable=False),
        sa.Column("skills", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("avatar", sa.LargeBinary(), nullable=True),
    )
    op.create_index("ix_candidate_profiles_user_id", "candidate_profiles", ["user_id"], unique=True)
    op.create_table(
        "resumes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        *[sa.Column(field, sa.JSON(), nullable=False) for field in ("education", "experience", "projects", "skills", "languages")],
        sa.Column("additional_information", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"], unique=True)
    op.create_table(
        "saved_vacancies",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("vacancy_id", sa.Integer(), sa.ForeignKey("vacancies.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_saved_vacancies_vacancy_id", "saved_vacancies", ["vacancy_id"])


def downgrade():
    op.drop_table("saved_vacancies")
    op.drop_table("resumes")
    op.drop_table("candidate_profiles")
