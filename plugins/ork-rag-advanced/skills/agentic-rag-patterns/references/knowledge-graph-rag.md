# Knowledge Graph RAG: Entity Extraction and Graph Traversal

Combine vector search with knowledge graph traversal for entity-rich domains.

## Architecture Overview

```
Query → Extract Entities → Parallel Search:
                             ├── Vector Search (semantic)
                             └── Graph Traversal (structured)
                                        ↓
                              Merge & Rank Results
                                        ↓
                                    Generate
```

## Neo4j Graph Setup

```python
from neo4j import GraphDatabase
from langchain_community.graphs import Neo4jGraph

class KnowledgeGraph:
    """Knowledge graph interface using Neo4j."""

    def __init__(
        self,
        uri: str,
        username: str,
        password: str,
        database: str = "neo4j"
    ):
        self.driver = GraphDatabase.driver(uri, auth=(username, password))
        self.database = database
        self.graph = Neo4jGraph(
            url=uri,
            username=username,
            password=password,
            database=database
        )

    def close(self):
        self.driver.close()

    def query(self, cypher: str, params: dict = None) -> list[dict]:
        """Execute Cypher query and return results."""
        with self.driver.session(database=self.database) as session:
            result = session.run(cypher, params or {})
            return [record.data() for record in result]

    def get_schema(self) -> str:
        """Get graph schema for LLM context."""
        return self.graph.schema
```

## Entity Extraction

```python
from pydantic import BaseModel, Field

class ExtractedEntities(BaseModel):
    """Entities extracted from query."""
    entities: list[str] = Field(
        description="Named entities mentioned in the query"
    )
    entity_types: dict[str, str] = Field(
        description="Mapping of entity to its type (person, company, product, etc.)"
    )
    relationships: list[str] = Field(
        default_factory=list,
        description="Relationships or connections mentioned"
    )

def create_entity_extractor(llm):
    """Create entity extractor with structured output."""
    system = """Extract named entities from the query.

Entity types to look for:
- PERSON: People's names
- ORGANIZATION: Companies, institutions
- PRODUCT: Products, services
- LOCATION: Places, regions
- DATE: Time references
- CONCEPT: Technical concepts, topics

Also identify any relationships mentioned (e.g., "works for", "created by")."""

    return llm.with_structured_output(ExtractedEntities).bind(system=system)

async def extract_entities(query: str, extractor) -> ExtractedEntities:
    """Extract entities from a query."""
    return await extractor.ainvoke({"query": query})
```

## Graph Traversal Patterns

```python
class GraphRetriever:
    """Retrieve context from knowledge graph."""

    def __init__(self, kg: KnowledgeGraph):
        self.kg = kg

    def get_entity_context(
        self,
        entities: list[str],
        max_hops: int = 2,
        max_results: int = 20
    ) -> list[dict]:
        """Get context for entities via graph traversal."""
        if not entities:
            return []

        # Multi-hop traversal query
        cypher = """
        MATCH (e:Entity)
        WHERE e.name IN $entities
        CALL {
            WITH e
            MATCH path = (e)-[*1..%d]-(related)
            RETURN path, related, length(path) as hops
            ORDER BY hops
            LIMIT %d
        }
        RETURN e.name as source,
               related.name as target,
               [r in relationships(path) | type(r)] as relationships,
               related.description as description
        """ % (max_hops, max_results)

        return self.kg.query(cypher, {"entities": entities})

    def get_entity_neighbors(
        self,
        entity: str,
        relationship_type: str = None
    ) -> list[dict]:
        """Get immediate neighbors of an entity."""
        if relationship_type:
            cypher = """
            MATCH (e:Entity {name: $entity})-[r:%s]-(neighbor)
            RETURN neighbor.name as name,
                   neighbor.description as description,
                   type(r) as relationship
            """ % relationship_type
        else:
            cypher = """
            MATCH (e:Entity {name: $entity})-[r]-(neighbor)
            RETURN neighbor.name as name,
                   neighbor.description as description,
                   type(r) as relationship
            """

        return self.kg.query(cypher, {"entity": entity})

    def find_path(
        self,
        source: str,
        target: str,
        max_hops: int = 4
    ) -> list[dict]:
        """Find shortest path between two entities."""
        cypher = """
        MATCH path = shortestPath(
            (a:Entity {name: $source})-[*1..%d]-(b:Entity {name: $target})
        )
        RETURN [n in nodes(path) | n.name] as entities,
               [r in relationships(path) | type(r)] as relationships
        """ % max_hops

        return self.kg.query(cypher, {"source": source, "target": target})
```

## Hybrid Search: Vector + Graph

```python
from langchain_core.documents import Document

class HybridGraphRetriever:
    """Combine vector search with knowledge graph."""

    def __init__(
        self,
        vector_retriever,
        graph_retriever: GraphRetriever,
        entity_extractor
    ):
        self.vector = vector_retriever
        self.graph = graph_retriever
        self.extractor = entity_extractor

    async def retrieve(
        self,
        query: str,
        vector_k: int = 5,
        graph_k: int = 10
    ) -> list[Document]:
        """Hybrid retrieval from both sources."""
        # 1. Extract entities from query
        entities = await self.extractor.ainvoke({"query": query})

        # 2. Parallel retrieval
        import asyncio

        vector_task = asyncio.create_task(
            self.vector.ainvoke(query)
        )

        graph_results = self.graph.get_entity_context(
            entities.entities,
            max_results=graph_k
        )

        vector_docs = await vector_task

        # 3. Convert graph results to Documents
        graph_docs = self._graph_to_documents(graph_results, entities)

        # 4. Merge and deduplicate
        merged = self._merge_results(vector_docs, graph_docs)

        return merged

    def _graph_to_documents(
        self,
        graph_results: list[dict],
        entities: ExtractedEntities
    ) -> list[Document]:
        """Convert graph traversal results to Documents."""
        docs = []
        for result in graph_results:
            content = self._format_graph_result(result)
            doc = Document(
                page_content=content,
                metadata={
                    "source": "knowledge_graph",
                    "source_entity": result.get("source"),
                    "target_entity": result.get("target"),
                    "relationships": result.get("relationships", [])
                }
            )
            docs.append(doc)
        return docs

    def _format_graph_result(self, result: dict) -> str:
        """Format graph result as readable text."""
        source = result.get("source", "Unknown")
        target = result.get("target", "Unknown")
        rels = result.get("relationships", [])
        desc = result.get("description", "")

        rel_str = " -> ".join(rels) if rels else "related to"
        return f"{source} {rel_str} {target}. {desc}"

    def _merge_results(
        self,
        vector_docs: list[Document],
        graph_docs: list[Document]
    ) -> list[Document]:
        """Merge results, prioritizing vector for semantic, graph for entities."""
        merged = []
        seen_content = set()

        # Add vector docs first (semantic relevance)
        for doc in vector_docs:
            content_key = doc.page_content[:200]
            if content_key not in seen_content:
                doc.metadata["retrieval_source"] = "vector"
                merged.append(doc)
                seen_content.add(content_key)

        # Add graph docs (entity context)
        for doc in graph_docs:
            content_key = doc.page_content[:200]
            if content_key not in seen_content:
                doc.metadata["retrieval_source"] = "graph"
                merged.append(doc)
                seen_content.add(content_key)

        return merged
```

## GraphRAG Community Detection

```python
class GraphRAGCommunities:
    """Microsoft GraphRAG-style community summaries."""

    def __init__(self, kg: KnowledgeGraph, llm):
        self.kg = kg
        self.llm = llm

    def detect_communities(self, algorithm: str = "louvain") -> list[dict]:
        """Detect communities in the graph."""
        cypher = """
        CALL gds.louvain.stream('entity-graph')
        YIELD nodeId, communityId
        RETURN gds.util.asNode(nodeId).name AS entity,
               communityId
        ORDER BY communityId
        """
        return self.kg.query(cypher)

    async def summarize_community(
        self,
        community_id: int,
        max_entities: int = 20
    ) -> str:
        """Generate summary for a community."""
        # Get community members
        cypher = """
        MATCH (e:Entity)
        WHERE e.communityId = $community_id
        RETURN e.name as name, e.description as description
        LIMIT $max_entities
        """
        members = self.kg.query(
            cypher,
            {"community_id": community_id, "max_entities": max_entities}
        )

        # Get internal relationships
        cypher_rels = """
        MATCH (a:Entity)-[r]-(b:Entity)
        WHERE a.communityId = $community_id
          AND b.communityId = $community_id
        RETURN a.name as source, type(r) as relationship, b.name as target
        LIMIT 50
        """
        relationships = self.kg.query(cypher_rels, {"community_id": community_id})

        # Generate summary
        context = self._format_community_context(members, relationships)
        summary = await self.llm.ainvoke({
            "instruction": "Summarize this group of related entities.",
            "context": context
        })

        return summary

    def _format_community_context(
        self,
        members: list[dict],
        relationships: list[dict]
    ) -> str:
        """Format community for summarization."""
        member_text = "\n".join([
            f"- {m['name']}: {m.get('description', 'No description')}"
            for m in members
        ])
        rel_text = "\n".join([
            f"- {r['source']} {r['relationship']} {r['target']}"
            for r in relationships
        ])
        return f"Entities:\n{member_text}\n\nRelationships:\n{rel_text}"
```

## Complete Knowledge Graph RAG Pipeline

```python
class KnowledgeGraphRAG:
    """Full KG-RAG pipeline with entity extraction and hybrid search."""

    def __init__(
        self,
        vector_retriever,
        kg: KnowledgeGraph,
        entity_extractor,
        generator
    ):
        self.vector = vector_retriever
        self.kg = kg
        self.graph_retriever = GraphRetriever(kg)
        self.extractor = entity_extractor
        self.generator = generator
        self.hybrid = HybridGraphRetriever(
            vector_retriever,
            self.graph_retriever,
            entity_extractor
        )

    async def query(self, question: str) -> dict:
        """Execute KG-RAG query."""
        # 1. Extract entities
        entities = await self.extractor.ainvoke({"query": question})

        # 2. Hybrid retrieval
        docs = await self.hybrid.retrieve(question)

        # 3. Add graph schema context if entities found
        schema_context = ""
        if entities.entities:
            schema_context = f"\n\nGraph context: {self.kg.get_schema()}"

        # 4. Generate answer
        context = "\n\n".join([d.page_content for d in docs])
        answer = await self.generator.ainvoke({
            "context": context + schema_context,
            "question": question,
            "entities": entities.entities
        })

        return {
            "answer": answer,
            "entities": entities.entities,
            "sources": [d.metadata for d in docs],
            "vector_count": sum(1 for d in docs if d.metadata.get("retrieval_source") == "vector"),
            "graph_count": sum(1 for d in docs if d.metadata.get("retrieval_source") == "graph")
        }
```

## When to Use Knowledge Graph RAG

**Use KG-RAG when:**
- Domain has rich entity relationships
- Multi-hop reasoning required
- Structured data exists alongside unstructured
- Entity disambiguation is important
- Explainable reasoning paths needed

**Skip KG-RAG when:**
- No clear entity structure in data
- Simple semantic search suffices
- Graph maintenance overhead too high
- Real-time performance critical (< 200ms)
