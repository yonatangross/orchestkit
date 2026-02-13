# Fine-Tuning Decision Checklist

Determine whether fine-tuning is appropriate.

## Pre-Fine-Tuning Validation

- [ ] Prompt engineering tried and insufficient
- [ ] RAG tried and doesn't capture domain nuances
- [ ] Few-shot learning tried with optimal examples
- [ ] Task requires deep specialization beyond prompting

## Data Requirements

- [ ] Minimum 1000+ high-quality examples available
- [ ] Examples are diverse and representative
- [ ] Ground truth labels are accurate
- [ ] Data cleaned and formatted correctly
- [ ] Train/eval split prepared (90/10 typical)

## Use Case Fit

- [ ] Specific output format consistently required
- [ ] Domain terminology/style needed
- [ ] Persona must be deeply embedded
- [ ] Performance gains justify cost

## Technical Readiness

- [ ] GPU resources available (LoRA: 16GB+, Full: 80GB+)
- [ ] Training framework selected (Unsloth, TRL, Axolotl)
- [ ] Base model chosen appropriately
- [ ] Hyperparameters planned

## LoRA Configuration

- [ ] Rank (r) selected: 16-64 typical
- [ ] Alpha set to 2x rank
- [ ] Target modules identified:
  - Attention: q_proj, k_proj, v_proj, o_proj
  - MLP: gate_proj, up_proj, down_proj (if QLoRA)
- [ ] Dropout configured (0.05 typical)

## Training Setup

- [ ] Learning rate appropriate (2e-4 for LoRA)
- [ ] Batch size fits in memory
- [ ] Epochs limited (1-3 to avoid overfitting)
- [ ] Warmup ratio set (3% typical)
- [ ] Evaluation checkpoints configured

## DPO Alignment (if applicable)

- [ ] Preference pairs collected (chosen/rejected)
- [ ] Reference model frozen
- [ ] Beta coefficient set (0.1 typical)
- [ ] Lower learning rate (5e-6)

## Evaluation Plan

- [ ] Eval metrics defined (task-specific)
- [ ] Baseline performance recorded
- [ ] Comparison with prompting approaches
- [ ] Human evaluation planned for quality

## Post-Training

- [ ] Model evaluated on held-out test set
- [ ] Compared to baseline and prompt-based approaches
- [ ] Model merged (if using adapters)
- [ ] Deployment plan ready
- [ ] Rollback procedure defined
