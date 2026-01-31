# Few-Shot Learning Patterns

Select, format, and order examples for optimal in-context learning.

## Basic Few-Shot Structure

```python
from langchain_core.prompts import FewShotChatMessagePromptTemplate, ChatPromptTemplate

# Define examples
examples = [
    {"input": "I love this product!", "output": "positive"},
    {"input": "Worst purchase ever.", "output": "negative"},
    {"input": "It's okay, nothing special.", "output": "neutral"},
]

# Create example prompt template
example_prompt = ChatPromptTemplate.from_messages([
    ("human", "{input}"),
    ("ai", "{output}"),
])

# Create few-shot prompt
few_shot_prompt = FewShotChatMessagePromptTemplate(
    examples=examples,
    example_prompt=example_prompt,
)

# Combine into final prompt
final_prompt = ChatPromptTemplate.from_messages([
    ("system", "Classify the sentiment of the following text."),
    few_shot_prompt,
    ("human", "{input}"),
])
```

## Dynamic Example Selection

Select examples based on similarity to input:

```python
from langchain_core.example_selectors import SemanticSimilarityExampleSelector
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

# Create selector with embeddings
selector = SemanticSimilarityExampleSelector.from_examples(
    examples=all_examples,
    embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
    vectorstore_cls=FAISS,
    k=3,  # Select 3 most similar
)

# Use in few-shot prompt
few_shot_prompt = FewShotChatMessagePromptTemplate(
    example_selector=selector,
    example_prompt=example_prompt,
)
```

## Example Selection Strategies

### 1. Semantic Similarity
Select examples most similar to the input:

```python
async def select_by_similarity(
    input_text: str,
    examples: list[dict],
    k: int = 3
) -> list[dict]:
    """Select k most similar examples."""
    # Embed input
    input_embedding = await embed(input_text)

    # Score examples by similarity
    scored = []
    for ex in examples:
        ex_embedding = await embed(ex["input"])
        score = cosine_similarity(input_embedding, ex_embedding)
        scored.append((score, ex))

    # Return top k
    scored.sort(key=lambda x: x[0], reverse=True)
    return [ex for _, ex in scored[:k]]
```

### 2. Diversity Selection
Ensure examples cover different aspects:

```python
from sklearn.cluster import KMeans

def select_diverse(
    examples: list[dict],
    embeddings: list[list[float]],
    k: int = 5
) -> list[dict]:
    """Select diverse examples using k-means clustering."""
    kmeans = KMeans(n_clusters=k)
    clusters = kmeans.fit_predict(embeddings)

    selected = []
    for cluster_id in range(k):
        # Get examples in this cluster
        cluster_examples = [
            (i, ex) for i, ex in enumerate(examples)
            if clusters[i] == cluster_id
        ]
        # Select one from each cluster
        if cluster_examples:
            selected.append(cluster_examples[0][1])

    return selected
```

### 3. Difficulty-Based Selection
Include examples of varying difficulty:

```python
def select_by_difficulty(
    examples: list[dict],
    k: int = 5
) -> list[dict]:
    """Select examples with varying difficulty levels."""
    easy = [ex for ex in examples if ex.get("difficulty") == "easy"]
    medium = [ex for ex in examples if ex.get("difficulty") == "medium"]
    hard = [ex for ex in examples if ex.get("difficulty") == "hard"]

    # Mix: 1 easy, 3 medium, 1 hard
    return easy[:1] + medium[:3] + hard[:1]
```

## Example Ordering

Order matters due to recency bias:

```python
def order_examples(
    examples: list[dict],
    input_text: str,
    strategy: str = "similar_last"
) -> list[dict]:
    """Order examples for optimal performance."""

    if strategy == "similar_last":
        # Most similar examples last (recency bias helps)
        return sorted(examples, key=lambda x: similarity(x, input_text))

    elif strategy == "easy_first":
        # Build understanding with simple examples first
        return sorted(examples, key=lambda x: x.get("difficulty", 1))

    elif strategy == "diverse_order":
        # Alternate between different categories
        categories = {}
        for ex in examples:
            cat = ex.get("category", "default")
            categories.setdefault(cat, []).append(ex)

        result = []
        while any(categories.values()):
            for cat in list(categories.keys()):
                if categories[cat]:
                    result.append(categories[cat].pop(0))
        return result

    return examples
```

## Example Formatting

### Format for Clarity

```python
EXAMPLE_FORMAT = """
Input: {input}
Category: {category}
Reasoning: {reasoning}
Output: {output}
"""

def format_example(example: dict) -> str:
    return EXAMPLE_FORMAT.format(**example)
```

### Structured Examples with CoT

```python
EXAMPLE_WITH_COT = """
Question: {question}
Let's think step by step:
{reasoning}
Therefore, the answer is: {answer}
"""
```

## Best Practices

1. **3-5 examples** - Sweet spot for most tasks
2. **Diverse coverage** - Cover edge cases and common patterns
3. **Similar last** - Put most relevant examples nearest to query
4. **Consistent format** - Use same structure for all examples
5. **Include reasoning** - For complex tasks, show the "why"
6. **Test example sets** - Different examples can dramatically change performance

## Anti-Patterns

```python
# Single example (not enough)
examples = [{"input": "x", "output": "y"}]

# All similar examples (no diversity)
examples = [
    {"input": "I love it", "output": "positive"},
    {"input": "I really love it", "output": "positive"},
    {"input": "Love this", "output": "positive"},
]

# Inconsistent format (confuses model)
examples = [
    {"input": "text", "output": "positive"},
    {"query": "text", "label": "neg"},  # Different keys!
]
```

## Performance Tips

- Cache embeddings for example selection
- Pre-compute example sets for common input patterns
- Use smaller model (GPT-4o-mini) to pre-filter examples
- Limit example length to avoid context overflow
