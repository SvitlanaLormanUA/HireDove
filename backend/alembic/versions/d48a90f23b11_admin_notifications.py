"""Add audit records and recipient notifications; preserve all existing domain data.

Revision ID: d48a90f23b11
Revises: c92e714a03b1
"""
from alembic import op
import sqlalchemy as sa

revision = "d48a90f23b11"
down_revision = "c92e714a03b1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("audit_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("target_type", sa.String(30), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    for field in ("admin_id", "action", "created_at"):
        op.create_index(f"ix_audit_records_{field}", "audit_records", [field])
    op.create_index("ix_audit_target", "audit_records", ["target_type", "target_id"])
    op.create_table("notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(60), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("related_type", sa.String(30), nullable=True),
        sa.Column("related_id", sa.Integer(), nullable=True),
        sa.Column("event_key", sa.String(160), unique=True, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"])
    op.create_index("ix_notifications_recipient_read", "notifications", ["recipient_id", "read_at"])


def downgrade():
    op.drop_table("notifications")
    op.drop_table("audit_records")
