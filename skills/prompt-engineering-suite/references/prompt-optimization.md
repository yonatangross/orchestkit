# Prompt Optimization

Automatically optimize prompts using DSPy and evaluation-driven techniques.

## DSPy Overview

DSPy is a framework for optimizing LLM programs algorithmically rather than manually.

### Installation

```bash
pip install dspy-ai
```

### Basic Setup

```python
import dspy

# Configure LLM
lm = dspy.LM("openai/gpt-4o-mini")
dspy.configure(lm=lm)
```

## DSPy Signatures

Define input/output specifications:

```python
# Simple signature (string format)
class QA(dspy.Signature):
    """Answer the question based on the context."""
    context: str = dspy.InputField()
    question: str = dspy.InputField()
    answer: str = dspy.OutputField()

# Use in module
class RAGAnswer(dspy.Module):
    def __init__(self):
        self.generate = dspy.Predict(QA)

    def forward(self, context: str, question: str) -> str:
        return self.generate(context=context, question=question).answer
```

## BootstrapFewShot Optimization

Automatically find the best few-shot examples:

```python
from dspy.teleprompt import BootstrapFewShot

# Define your module
class Classifier(dspy.Module):
    def __init__(self):
        self.classify = dspy.Predict("text -> category")

    def forward(self, text):
        return self.classify(text=text).category

# Define metric
def exact_match(example, prediction, trace=None):
    return example.category == prediction

# Create training examples
trainset = [
    dspy.Example(text="I love this!", category="positive").with_inputs("text"),
    dspy.Example(text="Terrible product", category="negative").with_inputs("text"),
    # ... more examples
]

# Optimize
optimizer = BootstrapFewShot(metric=exact_match, max_bootstrapped_demos=3)
optimized_classifier = optimizer.compile(Classifier(), trainset=trainset)

# Use optimized module
result = optimized_classifier("This is amazing!")
```

## MIPRO Optimization

More advanced optimization with instruction tuning:

```python
from dspy.teleprompt import MIPRO

optimizer = MIPRO(
    metric=exact_match,
    num_candidates=10,  # Instructions to try
    init_temperature=0.7
)

optimized = optimizer.compile(
    Classifier(),
    trainset=trainset,
    num_trials=50
)
```

## Chain-of-Thought Optimization

Optimize reasoning chains:

```python
class MathSolver(dspy.Module):
    def __init__(self):
        # ChainOfThought adds reasoning automatically
        self.solve = dspy.ChainOfThought("problem -> answer")

    def forward(self, problem):
        return self.solve(problem=problem)

# Optimize with examples
optimizer = BootstrapFewShot(metric=math_correct)
optimized_solver = optimizer.compile(MathSolver(), trainset=math_examples)
```

## Custom Metrics

Define metrics for optimization:

```python
def semantic_similarity(example, prediction, trace=None):
    """Metric based on embedding similarity."""
    expected_emb = embed(example.answer)
    predicted_emb = embed(prediction)
    return cosine_similarity(expected_emb, predicted_emb) > 0.8

def multi_criteria(example, prediction, trace=None):
    """Composite metric."""
    relevance = is_relevant(example.question, prediction)
    accuracy = is_accurate(example.context, prediction)
    conciseness = len(prediction) < 500

    return relevance and accuracy and conciseness
```

## Evaluation-Driven Optimization

Run evaluations to guide optimization:

```python
from dspy.evaluate import Evaluate

# Create evaluator
evaluator = Evaluate(
    devset=dev_examples,
    metric=exact_match,
    display_progress=True
)

# Evaluate baseline
baseline_score = evaluator(Classifier())
print(f"Baseline: {baseline_score}")

# Evaluate optimized
optimized_score = evaluator(optimized_classifier)
print(f"Optimized: {optimized_score}")
```

## Saving and Loading Optimized Prompts

```python
# Save optimized module
optimized_classifier.save("classifier_v1.json")

# Load later
loaded = Classifier()
loaded.load("classifier_v1.json")
```

## Manual Prompt Optimization Techniques

When DSPy isn't suitable:

### 1. Iterative Refinement

```python
async def optimize_prompt_iteratively(
    base_prompt: str,
    test_cases: list[dict],
    iterations: int = 5
) -> str:
    """Iteratively improve prompt based on failures."""

    current_prompt = base_prompt

    for i in range(iterations):
        # Test current prompt
        results = await test_prompt(current_prompt, test_cases)

        if results["pass_rate"] >= 0.95:
            break

        # Get failed cases
        failures = [r for r in results["details"] if not r["passed"]]

        # Ask LLM to improve prompt
        improvement = await llm.complete(f"""
The following prompt is failing on some test cases.

Current prompt:
{current_prompt}

Failed cases:
{json.dumps(failures[:3])}

Suggest an improved prompt that handles these cases.
Return ONLY the improved prompt text.
""")

        current_prompt = improvement.strip()

    return current_prompt
```

### 2. Prompt Components Analysis

```python
async def analyze_prompt_components(prompt: str, test_cases: list) -> dict:
    """Analyze which parts of prompt contribute to performance."""

    components = {
        "role": extract_role(prompt),
        "instructions": extract_instructions(prompt),
        "format": extract_format(prompt),
        "examples": extract_examples(prompt)
    }

    results = {}

    # Test each component's contribution
    for component, content in components.items():
        # Remove component
        reduced = remove_component(prompt, component)
        score = await evaluate_prompt(reduced, test_cases)

        results[component] = {
            "content": content[:100],
            "impact": baseline_score - score  # How much removing it hurts
        }

    return results
```

## Best Practices

1. **Start with clear signature** - Define inputs/outputs explicitly
2. **Use diverse training data** - Include edge cases
3. **Define good metrics** - Align with actual goals
4. **Evaluate on held-out set** - Avoid overfitting to trainset
5. **Save optimized prompts** - Version control the results
6. **A/B test in production** - Validate real-world performance

## Anti-Patterns

```python
# Optimizing on test set (data leakage)
optimizer.compile(module, trainset=testset)  # WRONG

# Single metric for complex task
metric = lambda ex, pred: ex.answer == pred  # Too simple

# No evaluation before deployment
optimized = optimizer.compile(...)
deploy(optimized)  # No evaluation!

# CORRECT: Split data, multi-metric, evaluate
trainset, devset, testset = split_data(examples)
optimizer.compile(module, trainset=trainset)
score = evaluate(optimized, devset)
if score > threshold:
    final_score = evaluate(optimized, testset)
```
