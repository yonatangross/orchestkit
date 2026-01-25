"""
Bidirectional Streaming Chat Service Example

Demonstrates gRPC bidirectional streaming for a real-time chat application.
Features:
- Room-based chat with join/leave
- Message broadcasting to room members
- Presence updates (who's online)
- Graceful handling of disconnections

Proto Definition (chat.proto):
```protobuf
syntax = "proto3";
package chat.v1;

service ChatService {
  // Bidirectional stream for real-time chat
  rpc Connect(stream ChatRequest) returns (stream ChatEvent);
}

message ChatRequest {
  oneof request {
    JoinRoom join = 1;
    LeaveRoom leave = 2;
    SendMessage message = 3;
    Typing typing = 4;
  }
}

message JoinRoom {
  string room_id = 1;
  string user_id = 2;
  string display_name = 3;
}

message LeaveRoom {
  string room_id = 1;
}

message SendMessage {
  string room_id = 1;
  string content = 2;
}

message Typing {
  string room_id = 1;
  bool is_typing = 2;
}

message ChatEvent {
  oneof event {
    UserJoined user_joined = 1;
    UserLeft user_left = 2;
    Message message = 3;
    TypingIndicator typing = 4;
    RoomState room_state = 5;
    Error error = 6;
  }
}

message UserJoined {
  string room_id = 1;
  string user_id = 2;
  string display_name = 3;
}

message UserLeft {
  string room_id = 1;
  string user_id = 2;
}

message Message {
  string room_id = 1;
  string user_id = 2;
  string display_name = 3;
  string content = 4;
  google.protobuf.Timestamp timestamp = 5;
}

message TypingIndicator {
  string room_id = 1;
  string user_id = 2;
  bool is_typing = 3;
}

message RoomState {
  string room_id = 1;
  repeated string online_users = 2;
}

message Error {
  string code = 1;
  string message = 2;
}
```

Requirements:
    pip install grpcio>=1.60.0 grpcio-tools structlog
"""

import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncIterator
from uuid import uuid4

import grpc
import structlog
from grpc import aio

# In real code, import generated protos:
# from app.protos import chat_pb2 as pb2
# from app.protos import chat_pb2_grpc as pb2_grpc

logger = structlog.get_logger()


# =============================================================================
# Domain Models
# =============================================================================

@dataclass
class User:
    user_id: str
    display_name: str
    room_ids: set[str] = field(default_factory=set)


@dataclass
class Room:
    room_id: str
    users: dict[str, User] = field(default_factory=dict)
    message_queues: dict[str, asyncio.Queue] = field(default_factory=dict)


# =============================================================================
# Chat Room Manager
# =============================================================================

class ChatRoomManager:
    """
    Manages chat rooms and message routing.

    Thread-safe for use with concurrent gRPC streams.
    """

    def __init__(self):
        self._rooms: dict[str, Room] = defaultdict(lambda: Room(room_id=""))
        self._lock = asyncio.Lock()

    async def join_room(
        self,
        room_id: str,
        user_id: str,
        display_name: str,
        queue: asyncio.Queue,
    ) -> list[str]:
        """
        Add user to room and return list of current members.
        """
        async with self._lock:
            room = self._rooms[room_id]
            room.room_id = room_id

            # Add user
            user = User(user_id=user_id, display_name=display_name)
            user.room_ids.add(room_id)
            room.users[user_id] = user
            room.message_queues[user_id] = queue

            # Get current members
            members = list(room.users.keys())

            logger.info(
                "user_joined_room",
                room_id=room_id,
                user_id=user_id,
                member_count=len(members),
            )

        # Broadcast join event to other members (outside lock)
        await self._broadcast(
            room_id,
            {
                "type": "user_joined",
                "room_id": room_id,
                "user_id": user_id,
                "display_name": display_name,
            },
            exclude_user=user_id,
        )

        return members

    async def leave_room(self, room_id: str, user_id: str) -> None:
        """
        Remove user from room and notify others.
        """
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room or user_id not in room.users:
                return

            # Remove user
            del room.users[user_id]
            room.message_queues.pop(user_id, None)

            logger.info(
                "user_left_room",
                room_id=room_id,
                user_id=user_id,
                remaining=len(room.users),
            )

            # Clean up empty rooms
            if not room.users:
                del self._rooms[room_id]
                return

        # Broadcast leave event
        await self._broadcast(
            room_id,
            {
                "type": "user_left",
                "room_id": room_id,
                "user_id": user_id,
            },
        )

    async def send_message(
        self,
        room_id: str,
        user_id: str,
        content: str,
    ) -> None:
        """
        Broadcast message to all room members.
        """
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room or user_id not in room.users:
                raise ValueError("User not in room")

            user = room.users[user_id]

        await self._broadcast(
            room_id,
            {
                "type": "message",
                "room_id": room_id,
                "user_id": user_id,
                "display_name": user.display_name,
                "content": content,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    async def set_typing(
        self,
        room_id: str,
        user_id: str,
        is_typing: bool,
    ) -> None:
        """
        Broadcast typing indicator to room.
        """
        await self._broadcast(
            room_id,
            {
                "type": "typing",
                "room_id": room_id,
                "user_id": user_id,
                "is_typing": is_typing,
            },
            exclude_user=user_id,
        )

    async def _broadcast(
        self,
        room_id: str,
        event: dict,
        exclude_user: str | None = None,
    ) -> None:
        """
        Send event to all users in room.
        """
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room:
                return

            queues = [
                (uid, q) for uid, q in room.message_queues.items()
                if uid != exclude_user
            ]

        # Send to all queues (outside lock)
        for user_id, queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    "queue_full",
                    user_id=user_id,
                    room_id=room_id,
                )


# =============================================================================
# gRPC Service Implementation
# =============================================================================

class ChatServiceServicer:
    """
    Bidirectional streaming chat service.

    Each connected client has:
    1. An incoming stream for sending requests (join, message, etc.)
    2. An outgoing stream for receiving events (messages, presence, etc.)
    """

    def __init__(self, room_manager: ChatRoomManager):
        self.rooms = room_manager

    async def Connect(
        self,
        request_iterator: AsyncIterator,
        context: aio.ServicerContext,
    ) -> AsyncIterator:
        """
        Main bidirectional streaming RPC.

        Client sends: JoinRoom, LeaveRoom, SendMessage, Typing
        Server sends: UserJoined, UserLeft, Message, TypingIndicator, RoomState
        """
        user_id: str | None = None
        current_rooms: set[str] = set()
        event_queue: asyncio.Queue = asyncio.Queue(maxsize=100)

        log = logger.bind(peer=context.peer())
        log.info("client_connected")

        async def receive_requests():
            """
            Process incoming requests from client.
            """
            nonlocal user_id

            async for request in request_iterator:
                try:
                    # Handle join
                    if hasattr(request, 'join') and request.HasField('join'):
                        join = request.join
                        user_id = join.user_id
                        room_id = join.room_id

                        members = await self.rooms.join_room(
                            room_id=room_id,
                            user_id=user_id,
                            display_name=join.display_name,
                            queue=event_queue,
                        )
                        current_rooms.add(room_id)

                        # Send room state to joining user
                        event_queue.put_nowait({
                            "type": "room_state",
                            "room_id": room_id,
                            "online_users": members,
                        })

                    # Handle leave
                    elif hasattr(request, 'leave') and request.HasField('leave'):
                        room_id = request.leave.room_id
                        if room_id in current_rooms:
                            await self.rooms.leave_room(room_id, user_id)
                            current_rooms.discard(room_id)

                    # Handle message
                    elif hasattr(request, 'message') and request.HasField('message'):
                        msg = request.message
                        if user_id and msg.room_id in current_rooms:
                            await self.rooms.send_message(
                                room_id=msg.room_id,
                                user_id=user_id,
                                content=msg.content,
                            )

                    # Handle typing
                    elif hasattr(request, 'typing') and request.HasField('typing'):
                        typing = request.typing
                        if user_id and typing.room_id in current_rooms:
                            await self.rooms.set_typing(
                                room_id=typing.room_id,
                                user_id=user_id,
                                is_typing=typing.is_typing,
                            )

                except Exception as e:
                    log.exception("request_error", error=str(e))
                    event_queue.put_nowait({
                        "type": "error",
                        "code": "REQUEST_ERROR",
                        "message": str(e),
                    })

        # Start receiving requests in background
        receive_task = asyncio.create_task(receive_requests())

        try:
            # Stream events to client
            while context.is_active():
                try:
                    # Wait for event with timeout (allows cancellation check)
                    event = await asyncio.wait_for(
                        event_queue.get(),
                        timeout=1.0,
                    )

                    # Convert dict to proto message and yield
                    # In real code:
                    # yield create_chat_event(event)
                    yield event  # Placeholder

                except asyncio.TimeoutError:
                    continue

        except asyncio.CancelledError:
            log.info("stream_cancelled")
        finally:
            # Cleanup: leave all rooms
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass

            for room_id in current_rooms:
                await self.rooms.leave_room(room_id, user_id)

            log.info("client_disconnected", user_id=user_id)


# =============================================================================
# Server Setup
# =============================================================================

async def serve():
    """Start the chat server."""
    room_manager = ChatRoomManager()
    servicer = ChatServiceServicer(room_manager)

    server = aio.server(
        options=[
            ("grpc.keepalive_time_ms", 30000),
            ("grpc.keepalive_timeout_ms", 10000),
        ]
    )

    # In real code:
    # pb2_grpc.add_ChatServiceServicer_to_server(servicer, server)

    server.add_insecure_port("[::]:50051")
    await server.start()

    logger.info("chat_server_started", port=50051)

    await server.wait_for_termination()


# =============================================================================
# Client Example
# =============================================================================

async def chat_client_example():
    """
    Example chat client demonstrating bidirectional streaming.
    """
    async with aio.insecure_channel("localhost:50051") as channel:
        # stub = pb2_grpc.ChatServiceStub(channel)

        user_id = str(uuid4())
        room_id = "general"

        # Create bidirectional stream
        # stream = stub.Connect()

        async def send_requests():
            """Send chat requests."""
            # Join room
            # await stream.write(pb2.ChatRequest(
            #     join=pb2.JoinRoom(
            #         room_id=room_id,
            #         user_id=user_id,
            #         display_name="Alice",
            #     )
            # ))

            # Send some messages
            for i in range(5):
                await asyncio.sleep(2)
                # await stream.write(pb2.ChatRequest(
                #     message=pb2.SendMessage(
                #         room_id=room_id,
                #         content=f"Hello from Alice! ({i})",
                #     )
                # ))

            # Leave room
            # await stream.write(pb2.ChatRequest(
            #     leave=pb2.LeaveRoom(room_id=room_id)
            # ))

            # await stream.done_writing()
            pass

        async def receive_events():
            """Receive chat events."""
            # async for event in stream:
            #     if event.HasField("message"):
            #         msg = event.message
            #         print(f"[{msg.display_name}]: {msg.content}")
            #     elif event.HasField("user_joined"):
            #         print(f"* {event.user_joined.display_name} joined")
            #     elif event.HasField("user_left"):
            #         print(f"* {event.user_left.user_id} left")
            pass

        # Run send and receive concurrently
        await asyncio.gather(
            send_requests(),
            receive_events(),
        )


if __name__ == "__main__":
    asyncio.run(serve())
