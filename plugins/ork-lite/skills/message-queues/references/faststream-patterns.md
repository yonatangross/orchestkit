# FastStream Patterns

FastStream provides a unified API for Kafka, RabbitMQ, NATS, and Redis Streams.

## Installation

```bash
pip install faststream[kafka]      # Kafka only
pip install faststream[rabbit]     # RabbitMQ only
pip install faststream[redis]      # Redis Streams only
pip install faststream[nats]       # NATS only
pip install faststream[all]        # All brokers
```

## Basic Kafka Application

```python
from faststream import FastStream
from faststream.kafka import KafkaBroker
from pydantic import BaseModel

broker = KafkaBroker("localhost:9092")
app = FastStream(broker)

class OrderEvent(BaseModel):
    order_id: str
    customer_id: str
    total: float

@broker.subscriber("orders.created")
async def handle_order(event: OrderEvent):
    """Automatic Pydantic validation."""
    print(f"Processing order {event.order_id}")

@broker.publisher("orders.processed")
async def process_order(order_id: str) -> dict:
    return {"order_id": order_id, "status": "processed"}
```

## RabbitMQ with Exchanges

```python
from faststream import FastStream
from faststream.rabbit import RabbitBroker, RabbitExchange, RabbitQueue

broker = RabbitBroker("amqp://guest:guest@localhost/")
app = FastStream(broker)

# Define exchange and queue
orders_exchange = RabbitExchange("orders", type="topic")
orders_queue = RabbitQueue("order-processor", routing_key="orders.#")

@broker.subscriber(orders_queue, orders_exchange)
async def handle_order(data: dict):
    print(f"Received: {data}")
```

## Dependency Injection

```python
from faststream import Context, Depends

async def get_db():
    async with async_session() as session:
        yield session

@broker.subscriber("users.created")
async def handle_user(
    event: UserEvent,
    db = Depends(get_db),
    logger = Context(),  # Access logger from context
):
    await db.add(User(**event.dict()))
    logger.info(f"Created user {event.user_id}")
```

## Multiple Brokers

```python
from faststream import FastStream
from faststream.kafka import KafkaBroker
from faststream.rabbit import RabbitBroker

kafka = KafkaBroker("localhost:9092")
rabbit = RabbitBroker("amqp://localhost/")

app = FastStream(kafka, rabbit)

@kafka.subscriber("high-volume-events")
async def kafka_handler(data: dict):
    pass

@rabbit.subscriber("task-queue")
async def rabbit_handler(data: dict):
    pass
```

## Testing

```python
import pytest
from faststream.kafka import TestKafkaBroker

@pytest.fixture
def test_broker():
    return TestKafkaBroker(broker)

@pytest.mark.asyncio
async def test_order_handler(test_broker):
    async with test_broker:
        await test_broker.publish(
            {"order_id": "123", "customer_id": "456", "total": 99.99},
            topic="orders.created",
        )
        # Handler is automatically called
        # Add assertions based on side effects
```

## AsyncAPI Documentation

FastStream auto-generates AsyncAPI documentation:

```python
# Generate docs
from faststream.asyncapi import get_app_schema

schema = get_app_schema(app)
print(schema.to_yaml())
```

Access at `http://localhost:8000/asyncapi` when running with `faststream run`.
