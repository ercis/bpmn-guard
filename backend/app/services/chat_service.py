"""Chat service for BPMN model discussions with persistence."""

import logging
from collections.abc import AsyncGenerator
from pathlib import Path
from uuid import UUID

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langsmith import traceable
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bpmn_model import BPMNModel
from app.db.models.chat_message import ChatMessage
from app.language_model_client.client import LLMClient
from app.schemas.evaluation import EvaluationReport as EvaluationReportSchema

logger = logging.getLogger(__name__)


class ChatService:
    """Service for handling chat interactions about BPMN models."""

    def __init__(self, llm_client: BaseChatModel):
        self.llm_client = llm_client

    @staticmethod
    async def get_chat_history(
        db: AsyncSession,
        report_id: UUID,
    ) -> list[ChatMessage]:
        """Get all chat messages for a report."""
        logger.info(f"Fetching chat history for report {report_id}")
        result = await db.execute(
            select(ChatMessage).where(ChatMessage.report_id == report_id).order_by(ChatMessage.created_at.asc())
        )
        messages = list(result.scalars().all())
        logger.info(f"Retrieved {len(messages)} messages for report {report_id}")
        return messages

    @staticmethod
    async def save_message(
        db: AsyncSession,
        report_id: UUID,
        role: str,
        content: str,
    ) -> ChatMessage:
        """Save a chat message to the database."""
        message = ChatMessage(
            report_id=report_id,
            role=role,
            content=content,
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message

    @staticmethod
    async def delete_chat_history(
        db: AsyncSession,
        report_id: UUID,
    ) -> int:
        """Delete all chat messages for a report. Returns count deleted."""
        logger.info(f"Deleting chat history for report {report_id}")
        result = await db.execute(delete(ChatMessage).where(ChatMessage.report_id == report_id))
        await db.commit()
        deleted_count: int = result.rowcount  # type: ignore[assignment]
        logger.info(f"Deleted {deleted_count} messages for report {report_id}")
        return deleted_count

    def _build_system_prompt(
        self,
        bpmn_model: BPMNModel,
        report: EvaluationReportSchema,
    ) -> str:
        """Build the system prompt with BPMN model and evaluation context."""
        prompt_path = Path(__file__).parent.parent / "agents" / "system_prompts" / "chat_assistant_prompt.md"
        base_prompt = prompt_path.read_text(encoding="utf-8")

        # Build evaluation summary
        eval_context = []

        if report.model_description:
            desc = report.model_description
            if desc.description:
                eval_context.append(f"## Model Description\n{desc.description}")

        if report.model_evaluation:
            evaluation = report.model_evaluation
            eval_context.append(f"""## Overall Evaluation
- Rating: {evaluation.evaluation_rating}/10
- Summary: {evaluation.evaluation_summary}""")

        if report.syntax_check:
            syntax = report.syntax_check
            syntax_section = f"""## Syntax Check Results
- Valid: {syntax.is_valid}
- Errors: {syntax.error_count}
- Warnings: {syntax.warning_count}
- Total Issues: {syntax.total_issues}"""
            if syntax.issues:
                syntax_section += "\n\n### Syntax Issues by Rule:"
                for rule in syntax.issues:
                    syntax_section += f"\n\n#### {rule.rule_name}"
                    for issue in rule.issues:
                        syntax_section += f"\n- [{issue.category.value.upper()}] (ID: {issue.id}): {issue.message}"
            eval_context.append(syntax_section)

        if report.semantic_label_check:
            semantic = report.semantic_label_check
            semantic_section = f"""## Semantic Label Check Results
- Rating: {semantic.rating}%
- Evaluation: {semantic.evaluation}
- Violations: {len(semantic.violations)} issues found"""
            if semantic.violations:
                semantic_section += "\n\n### Semantic Violations:"
                for v in semantic.violations:
                    semantic_section += (
                        f"\n- Element ID: {v.bpmn_element_id}, Rule: {v.rule_id}\n  Explanation: {v.explanation}"
                    )
            eval_context.append(semantic_section)

        if report.custom_rules_check:
            custom = report.custom_rules_check
            custom_section = f"""## Custom Rules Check Results
- Checks Passed: {custom.checks_passed}
- Checks Failed: {custom.checks_failed}
- Total Issues: {custom.total_issues} (Errors: {custom.error_count}, Warnings: {custom.warning_count}, Info: {custom.info_count})"""
            # Add detailed check results
            if custom.checks:
                custom_section += "\n\n### Custom Rule Details:"
                for check in custom.checks:
                    status = "✓ PASSED" if check.passed else "✗ FAILED"
                    custom_section += f"\n\n#### {check.check_name} [{status}]\n- Description: {check.description}"
                    if check.issues:
                        custom_section += "\n- Issues:"
                        for issue in check.issues:
                            element_info = ""
                            if issue.element_name:
                                element_info = f" '{issue.element_name}'"
                            if issue.element_id:
                                element_info += f" (ID: {issue.element_id})"
                            custom_section += f"\n  - [{issue.category.value.upper()}]{element_info}: {issue.message}"
            eval_context.append(custom_section)

        if report.duplicate_check:
            duplicate = report.duplicate_check
            duplicate_section = f"""## Duplicate Check Results
{duplicate.response_answer}"""
            if duplicate.similar_models:
                duplicate_section += "\n\n### Similar Models Found:"
                for model in duplicate.similar_models:
                    duplicate_section += f"\n- Model ID: {model.model_id}, Similarity Rating: {model.rating}/10\n  Reasoning: {model.reasoning}"
            eval_context.append(duplicate_section)

        if report.complexity_check:
            complexity = report.complexity_check
            eval_context.append(f"""## Complexity Analysis
- CFC Score: {complexity.cfc_score}
- CW Score: {complexity.cw_score}""")

        # Combine everything
        full_prompt = f"""{base_prompt}

---

# BPMN Model Context

## Model Information
- Name: {bpmn_model.name}
- File: {bpmn_model.file_path}

## BPMN XML Content
```xml
{bpmn_model.bpmn_xml}
```

---

# Evaluation Results

{chr(10).join(eval_context)}

---

Remember to reference specific elements, issues, and metrics from the above context when answering questions.
"""
        return full_prompt

    def _build_messages(
        self,
        system_prompt: str,
        history: list[ChatMessage],
        user_message: str,
    ) -> list[SystemMessage | HumanMessage | AIMessage]:
        """Build the message list for the LLM."""
        messages: list[SystemMessage | HumanMessage | AIMessage] = [SystemMessage(content=system_prompt)]

        for msg in history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))

        messages.append(HumanMessage(content=user_message))
        return messages

    @traceable(run_type="chain", name="BPMN Guard Chat Stream")
    async def chat_stream(
        self,
        bpmn_model: BPMNModel,
        report: EvaluationReportSchema,
        history: list[ChatMessage],
        message: str,
    ) -> AsyncGenerator[str, None]:
        """
        Chat about a BPMN model with streaming response.

        Args:
            bpmn_model: The BPMN model being discussed
            report: The evaluation report for the model
            history: Previous chat messages from database
            message: User's new message

        Yields:
            Chunks of the assistant's response
        """
        logger.info(f"Starting chat stream for model {bpmn_model.id}")
        system_prompt = self._build_system_prompt(bpmn_model, report)
        messages = self._build_messages(system_prompt, history, message)

        async for chunk in self.llm_client.astream(messages):
            if chunk.content:
                yield str(chunk.content)
        logger.info(f"Chat stream completed for model {bpmn_model.id}")

    @classmethod
    def setup_chat_service(cls, llm_client: BaseChatModel | None = None) -> "ChatService":
        """Factory method to create a ChatService instance."""
        if not llm_client:
            llm_client = LLMClient().create_llm_model()
        return cls(llm_client)
