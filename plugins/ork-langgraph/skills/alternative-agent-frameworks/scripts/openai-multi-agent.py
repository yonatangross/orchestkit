"""
Production-ready OpenAI Agents SDK multi-agent workflow template.

Features:
- Orchestrator with handoffs to specialists
- Tool integration with @tool decorator
- Input/output guardrails for safety
- Tracing for observability
- Streaming support
- Error handling and recovery
"""

import json
import os
from typing import Any

import structlog
from agents import Agent, Runner, handoff, tool, trace
from agents.exceptions import InputGuardrailException, OutputGuardrailException
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
from agents.guardrails import InputGuardrail, OutputGuardrail
from langfuse.decorators import langfuse_context, observe

logger = structlog.get_logger()


# ============================================================================
# TOOLS
# ============================================================================

@tool
def search_knowledge_base(query: str, limit: int = 5) -> str:
    """Search the knowledge base for relevant information.

    Args:
        query: The search query to find relevant documents
        limit: Maximum number of results to return
    """
    logger.info("Searching knowledge base", query=query, limit=limit)
    # Replace with actual search implementation
    results = [
        {"title": f"Result {i}", "content": f"Content for: {query}"}
        for i in range(min(limit, 3))
    ]
    return json.dumps(results)


@tool
def create_support_ticket(
    title: str,
    description: str,
    priority: str,
    category: str
) -> str:
    """Create a support ticket in the system.

    Args:
        title: Brief title of the issue
        description: Detailed description of the problem
        priority: Priority level (low, medium, high, urgent)
        category: Category (billing, technical, account, other)
    """
    logger.info("Creating support ticket", title=title, priority=priority)
    # Replace with actual ticket creation
    ticket_id = f"TKT-{hash(title) % 10000:04d}"
    return json.dumps({
        "ticket_id": ticket_id,
        "status": "created",
        "message": f"Ticket {ticket_id} created successfully"
    })


@tool
def check_account_status(account_id: str) -> str:
    """Check the status of a customer account.

    Args:
        account_id: The customer's account identifier
    """
    logger.info("Checking account status", account_id=account_id)
    # Replace with actual account lookup
    return json.dumps({
        "account_id": account_id,
        "status": "active",
        "plan": "professional",
        "billing_status": "current"
    })


@tool
def process_refund(account_id: str, amount: float, reason: str) -> str:
    """Process a refund for a customer.

    Args:
        account_id: The customer's account identifier
        amount: Refund amount in USD
        reason: Reason for the refund
    """
    logger.info("Processing refund", account_id=account_id, amount=amount)
    # Replace with actual refund processing
    return json.dumps({
        "refund_id": f"REF-{hash(account_id) % 10000:04d}",
        "status": "processed",
        "amount": amount,
        "message": "Refund will be credited within 5-7 business days"
    })


# ============================================================================
# GUARDRAILS
# ============================================================================

class PIIDetectionGuardrail(InputGuardrail):
    """Detect and block PII in input."""

    PII_PATTERNS = ["ssn", "social security", "credit card", "password"]

    async def check(self, input_text: str) -> str:
        """Check input for PII."""
        input_lower = input_text.lower()
        for pattern in self.PII_PATTERNS:
            if pattern in input_lower:
                logger.warning("PII detected in input", pattern=pattern)
                raise InputGuardrailException(
                    f"Potential PII detected. Please remove sensitive information."
                )
        return input_text


class ContentSafetyGuardrail(OutputGuardrail):
    """Ensure output doesn't contain harmful content."""

    BLOCKED_PHRASES = ["hack", "exploit", "bypass security"]

    async def check(self, output_text: str) -> str:
        """Check output for harmful content."""
        output_lower = output_text.lower()
        for phrase in self.BLOCKED_PHRASES:
            if phrase in output_lower:
                logger.warning("Blocked phrase in output", phrase=phrase)
                return "I cannot provide information on that topic."
        return output_text


# ============================================================================
# SPECIALIST AGENTS
# ============================================================================

# Technical Support Agent
technical_agent = Agent(
    name="technical_support",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are a technical support specialist. You help users troubleshoot
technical issues with products and services.

Your responsibilities:
1. Diagnose technical problems
2. Provide step-by-step solutions
3. Search the knowledge base for relevant articles
4. Create support tickets for unresolved issues

When the technical issue is resolved or requires escalation,
hand back to the triage agent with a summary.

Always be patient and clear in your explanations.""",
    model="gpt-5.2",
    tools=[search_knowledge_base, create_support_ticket]
)

# Billing Support Agent
billing_agent = Agent(
    name="billing_support",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are a billing support specialist. You help users with
billing inquiries, payments, and refunds.

Your responsibilities:
1. Check account and billing status
2. Explain charges and invoices
3. Process refunds when appropriate
4. Update payment information

When the billing issue is resolved or requires escalation,
hand back to the triage agent with a summary.

Be empathetic and transparent about billing matters.""",
    model="gpt-5.2",
    tools=[check_account_status, process_refund]
)

# Account Management Agent
account_agent = Agent(
    name="account_management",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are an account management specialist. You help users with
account settings, upgrades, and general account inquiries.

Your responsibilities:
1. Check account status and details
2. Explain plan features and pricing
3. Assist with account changes
4. Handle account-related questions

When the account matter is resolved, hand back to the
triage agent with a summary.

Be helpful and proactive in suggesting improvements.""",
    model="gpt-5.2",
    tools=[check_account_status]
)


# ============================================================================
# ORCHESTRATOR AGENT
# ============================================================================

orchestrator = Agent(
    name="triage",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are the triage agent - the first point of contact for all
customer inquiries. Your role is to understand the customer's
needs and route them to the appropriate specialist.

Routing guidelines:
- Technical issues (errors, bugs, how-to): hand off to technical_support
- Billing questions (payments, refunds, invoices): hand off to billing_support
- Account matters (settings, upgrades, plans): hand off to account_management
- General questions: answer directly if you can

When specialists hand back to you:
1. Summarize what was accomplished
2. Ask if there's anything else to help with
3. Route to another specialist if needed

Always be friendly, professional, and efficient.""",
    model="gpt-5.2",
    handoffs=[
        handoff(agent=technical_agent),
        handoff(agent=billing_agent),
        handoff(agent=account_agent)
    ],
    input_guardrails=[PIIDetectionGuardrail()],
    output_guardrails=[ContentSafetyGuardrail()]
)


# ============================================================================
# WORKFLOW EXECUTION
# ============================================================================

@observe()
async def run_support_workflow(user_message: str, session_id: str) -> dict[str, Any]:
    """Run the multi-agent support workflow.

    Args:
        user_message: The user's initial message
        session_id: Session identifier for conversation tracking

    Returns:
        Dictionary with workflow result and metadata
    """
    langfuse_context.update_current_trace(
        name="openai_agents_support",
        session_id=session_id,
        metadata={"initial_message": user_message[:100]}
    )

    logger.info("Starting support workflow", session_id=session_id)

    runner = Runner(trace=True)

    try:
        with trace.span("support_workflow"):
            result = await runner.run(orchestrator, user_message)

            langfuse_context.update_current_observation(
                output={"status": "success", "trace_id": result.trace_id},
                metadata={"handoffs": result.handoff_count if hasattr(result, 'handoff_count') else 0}
            )

            logger.info(
                "Support workflow completed",
                session_id=session_id,
                trace_id=result.trace_id
            )

            return {
                "status": "success",
                "response": result.final_output,
                "trace_id": result.trace_id,
                "session_id": session_id
            }

    except InputGuardrailException as e:
        logger.warning("Input guardrail triggered", error=str(e))
        return {
            "status": "guardrail_blocked",
            "response": str(e),
            "session_id": session_id
        }

    except Exception as e:
        logger.error("Support workflow failed", error=str(e))

        langfuse_context.update_current_observation(
            output={"status": "error", "error": str(e)},
            level="error"
        )

        return {
            "status": "error",
            "response": "I apologize, but I encountered an error. Please try again.",
            "error": str(e),
            "session_id": session_id
        }


@observe()
async def run_support_workflow_streaming(
    user_message: str,
    session_id: str
) -> dict[str, Any]:
    """Run the workflow with streaming responses.

    Args:
        user_message: The user's initial message
        session_id: Session identifier for conversation tracking

    Yields:
        Response chunks as they're generated
    """
    logger.info("Starting streaming support workflow", session_id=session_id)

    runner = Runner(trace=True)
    full_response = ""

    try:
        async for chunk in runner.stream(orchestrator, user_message):
            if chunk.content:
                full_response += chunk.content
                yield {
                    "type": "chunk",
                    "content": chunk.content
                }

        yield {
            "type": "complete",
            "full_response": full_response,
            "session_id": session_id
        }

    except Exception as e:
        logger.error("Streaming workflow failed", error=str(e))
        yield {
            "type": "error",
            "error": str(e)
        }


# ============================================================================
# CONVERSATION MANAGEMENT
# ============================================================================

class ConversationManager:
    """Manage multi-turn conversations with the support system."""

    def __init__(self):
        self.conversations: dict[str, list] = {}
        self.runner = Runner(trace=True)

    async def send_message(
        self,
        session_id: str,
        message: str
    ) -> dict[str, Any]:
        """Send a message in an existing or new conversation.

        Args:
            session_id: Session identifier
            message: User message

        Returns:
            Agent response with metadata
        """
        # Get or create conversation history
        if session_id not in self.conversations:
            self.conversations[session_id] = []

        # Add user message
        self.conversations[session_id].append({
            "role": "user",
            "content": message
        })

        # Run with conversation history
        try:
            result = await self.runner.run(
                orchestrator,
                self.conversations[session_id]
            )

            # Add agent response
            self.conversations[session_id].append({
                "role": "assistant",
                "content": result.final_output
            })

            return {
                "status": "success",
                "response": result.final_output,
                "session_id": session_id,
                "message_count": len(self.conversations[session_id])
            }

        except Exception as e:
            logger.error("Conversation error", session_id=session_id, error=str(e))
            return {
                "status": "error",
                "error": str(e),
                "session_id": session_id
            }

    def clear_conversation(self, session_id: str) -> None:
        """Clear conversation history for a session."""
        if session_id in self.conversations:
            del self.conversations[session_id]
            logger.info("Conversation cleared", session_id=session_id)


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

async def main():
    """Example usage of the multi-agent support system."""
    import asyncio

    # Single message
    result = await run_support_workflow(
        user_message="I'm having trouble logging into my account. Can you help?",
        session_id="session-001"
    )
    print(f"Response: {result['response']}")

    # Multi-turn conversation
    manager = ConversationManager()

    # First message
    response1 = await manager.send_message(
        "session-002",
        "I have a billing question about my last invoice"
    )
    print(f"Agent: {response1['response']}")

    # Follow-up
    response2 = await manager.send_message(
        "session-002",
        "The charge for $99 seems wrong, I'm on the $49 plan"
    )
    print(f"Agent: {response2['response']}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
