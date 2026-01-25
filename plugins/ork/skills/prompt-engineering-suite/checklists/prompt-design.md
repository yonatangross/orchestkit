# Prompt Design Checklist

Quality assurance for production prompts.

## Requirements Analysis

- [ ] Task objective clearly defined
- [ ] Expected input format documented
- [ ] Desired output format specified
- [ ] Edge cases identified and handled
- [ ] Success criteria defined

## Pattern Selection

- [ ] Pattern chosen based on task complexity
  - Zero-shot: Simple, well-defined tasks
  - Few-shot: Complex tasks needing examples
  - Chain-of-Thought: Reasoning, math, logic
  - ReAct: Tool use, multi-step actions
  - Structured: JSON/schema output

## Prompt Structure

- [ ] Role/identity clearly defined
- [ ] Task description unambiguous
- [ ] Constraints and rules explicit
- [ ] Output format specified
- [ ] Examples included (if few-shot)

## Few-Shot Examples (if applicable)

- [ ] 3-5 diverse, representative examples
- [ ] Edge cases included in examples
- [ ] Examples ordered (similar last for recency)
- [ ] Example format matches desired output

## Chain-of-Thought (if applicable)

- [ ] Reasoning steps explicitly requested
- [ ] Step format specified
- [ ] Verification step included
- [ ] Final answer format defined

## Token Optimization

- [ ] Redundant instructions removed
- [ ] Concise language used
- [ ] Model implicit knowledge leveraged
- [ ] Token count within budget

## Testing

- [ ] Happy path tested
- [ ] Edge cases tested
- [ ] Error handling verified
- [ ] Output format consistency checked
- [ ] Diverse input samples tested

## Versioning

- [ ] Prompt versioned in Langfuse/similar
- [ ] Labels configured (production/staging)
- [ ] Rollback procedure defined
- [ ] A/B test variants tracked

## Documentation

- [ ] Prompt purpose documented
- [ ] Known limitations listed
- [ ] Optimization history recorded
- [ ] Test results documented
