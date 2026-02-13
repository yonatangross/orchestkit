"""
Travel Booking Saga Example

A complete example of a saga orchestrating flight, hotel, and car rental bookings
with full compensation support and FastAPI integration.

This demonstrates:
- Multi-service coordination
- Parallel step execution
- Complex compensation logic
- External API integration patterns
- Production-ready error handling
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Protocol
from uuid import UUID

from pydantic import BaseModel, Field
from uuid_utils import uuid7


# -----------------------------------------------------------------------------
# Domain Models
# -----------------------------------------------------------------------------


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    FAILED = "failed"


@dataclass
class FlightBooking:
    booking_id: str
    flight_number: str
    departure_date: datetime
    origin: str
    destination: str
    price: Decimal
    status: BookingStatus = BookingStatus.PENDING
    confirmation_code: str | None = None


@dataclass
class HotelBooking:
    booking_id: str
    hotel_name: str
    check_in: datetime
    check_out: datetime
    room_type: str
    price: Decimal
    status: BookingStatus = BookingStatus.PENDING
    confirmation_code: str | None = None


@dataclass
class CarRentalBooking:
    booking_id: str
    rental_company: str
    pickup_date: datetime
    return_date: datetime
    car_class: str
    price: Decimal
    status: BookingStatus = BookingStatus.PENDING
    confirmation_code: str | None = None


class TravelBookingRequest(BaseModel):
    """API request model for travel booking."""

    customer_id: UUID
    trip_id: UUID = Field(default_factory=uuid7)

    # Flight details
    flight_number: str
    origin: str
    destination: str
    departure_date: datetime

    # Hotel details
    hotel_name: str
    check_in: datetime
    check_out: datetime
    room_type: str = "standard"

    # Car rental details (optional)
    rental_company: str | None = None
    car_pickup_date: datetime | None = None
    car_return_date: datetime | None = None
    car_class: str = "economy"

    # Payment
    payment_method_id: str


class TravelBookingResponse(BaseModel):
    """API response model."""

    saga_id: str
    status: str
    flight_confirmation: str | None = None
    hotel_confirmation: str | None = None
    car_confirmation: str | None = None
    total_price: Decimal
    message: str


# -----------------------------------------------------------------------------
# Service Protocols
# -----------------------------------------------------------------------------


class FlightService(Protocol):
    async def reserve(
        self,
        flight_number: str,
        departure_date: datetime,
        customer_id: str,
        idempotency_key: str,
    ) -> FlightBooking:
        ...

    async def confirm(self, booking_id: str, payment_id: str) -> str:
        """Returns confirmation code."""
        ...

    async def cancel(self, booking_id: str, idempotency_key: str) -> None:
        ...


class HotelService(Protocol):
    async def reserve(
        self,
        hotel_name: str,
        check_in: datetime,
        check_out: datetime,
        room_type: str,
        customer_id: str,
        idempotency_key: str,
    ) -> HotelBooking:
        ...

    async def confirm(self, booking_id: str, payment_id: str) -> str:
        """Returns confirmation code."""
        ...

    async def cancel(self, booking_id: str, idempotency_key: str) -> None:
        ...


class CarRentalService(Protocol):
    async def reserve(
        self,
        rental_company: str,
        pickup_date: datetime,
        return_date: datetime,
        car_class: str,
        customer_id: str,
        idempotency_key: str,
    ) -> CarRentalBooking:
        ...

    async def confirm(self, booking_id: str, payment_id: str) -> str:
        """Returns confirmation code."""
        ...

    async def cancel(self, booking_id: str, idempotency_key: str) -> None:
        ...


class PaymentService(Protocol):
    async def authorize(
        self,
        payment_method_id: str,
        amount: Decimal,
        customer_id: str,
        idempotency_key: str,
    ) -> str:
        """Returns authorization_id."""
        ...

    async def capture(self, authorization_id: str, idempotency_key: str) -> str:
        """Returns payment_id."""
        ...

    async def void(self, authorization_id: str, idempotency_key: str) -> None:
        """Void an authorization."""
        ...


class NotificationService(Protocol):
    async def send_confirmation(
        self,
        customer_id: str,
        booking_details: dict,
    ) -> None:
        ...

    async def send_cancellation(
        self,
        customer_id: str,
        reason: str,
    ) -> None:
        ...


# -----------------------------------------------------------------------------
# Saga Implementation
# -----------------------------------------------------------------------------


class SagaStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    FAILED = "failed"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATED = "compensated"
    SKIPPED = "skipped"


@dataclass
class SagaStep:
    name: str
    action: Any  # Callable
    compensation: Any  # Callable
    timeout_seconds: int = 60
    status: StepStatus = StepStatus.PENDING
    result: dict = field(default_factory=dict)
    error: str | None = None


@dataclass
class TravelBookingSagaContext:
    """Context holding all saga state and accumulated data."""

    saga_id: str = field(default_factory=lambda: str(uuid7()))
    status: SagaStatus = SagaStatus.PENDING

    # Input data
    request: TravelBookingRequest | None = None

    # Step results (accumulated during execution)
    flight_booking: FlightBooking | None = None
    hotel_booking: HotelBooking | None = None
    car_booking: CarRentalBooking | None = None
    authorization_id: str | None = None
    payment_id: str | None = None
    flight_confirmation: str | None = None
    hotel_confirmation: str | None = None
    car_confirmation: str | None = None

    # Computed
    total_price: Decimal = Decimal("0")

    # Timestamps
    started_at: datetime | None = None
    completed_at: datetime | None = None


class TravelBookingSaga:
    """
    Travel booking saga orchestrating flight, hotel, and car rental.

    Saga Steps:
    1. Reserve flight (compensate: cancel flight)
    2. Reserve hotel (compensate: cancel hotel)
    3. Reserve car rental - optional (compensate: cancel car)
    4. Authorize payment (compensate: void authorization)
    5. Confirm all bookings (pivot point - no compensation)
    6. Capture payment (no compensation needed)
    7. Send confirmation notification (no compensation needed)

    Compensation triggers if any step fails before payment capture.
    """

    def __init__(
        self,
        flight_service: FlightService,
        hotel_service: HotelService,
        car_service: CarRentalService,
        payment_service: PaymentService,
        notification_service: NotificationService,
        saga_repository: Any,  # SagaRepository protocol
    ):
        self.flight = flight_service
        self.hotel = hotel_service
        self.car = car_service
        self.payment = payment_service
        self.notification = notification_service
        self.repo = saga_repository

    async def execute(self, request: TravelBookingRequest) -> TravelBookingSagaContext:
        """Execute the complete travel booking saga."""
        ctx = TravelBookingSagaContext(request=request)
        ctx.status = SagaStatus.RUNNING
        ctx.started_at = datetime.now(timezone.utc)
        await self.repo.save(ctx)

        steps = self._build_steps(ctx)
        failed_at_index: int | None = None

        try:
            for i, step in enumerate(steps):
                if step.status == StepStatus.SKIPPED:
                    continue

                step.status = StepStatus.RUNNING
                await self.repo.save(ctx)

                try:
                    result = await asyncio.wait_for(
                        step.action(),
                        timeout=step.timeout_seconds,
                    )
                    step.result = result or {}
                    step.status = StepStatus.COMPLETED

                except asyncio.TimeoutError:
                    step.status = StepStatus.FAILED
                    step.error = f"Step timed out after {step.timeout_seconds}s"
                    failed_at_index = i
                    break

                except Exception as e:
                    step.status = StepStatus.FAILED
                    step.error = str(e)
                    failed_at_index = i
                    break

                await self.repo.save(ctx)

            if failed_at_index is not None:
                await self._compensate(ctx, steps, failed_at_index)
            else:
                ctx.status = SagaStatus.COMPLETED
                ctx.completed_at = datetime.now(timezone.utc)

        except Exception as e:
            ctx.status = SagaStatus.FAILED
            ctx.completed_at = datetime.now(timezone.utc)
            raise

        await self.repo.save(ctx)
        return ctx

    def _build_steps(self, ctx: TravelBookingSagaContext) -> list[SagaStep]:
        """Build saga steps based on request."""
        request = ctx.request
        steps = [
            SagaStep(
                name="reserve_flight",
                action=lambda: self._reserve_flight(ctx),
                compensation=lambda: self._cancel_flight(ctx),
                timeout_seconds=30,
            ),
            SagaStep(
                name="reserve_hotel",
                action=lambda: self._reserve_hotel(ctx),
                compensation=lambda: self._cancel_hotel(ctx),
                timeout_seconds=30,
            ),
        ]

        # Optional car rental
        if request.rental_company:
            steps.append(
                SagaStep(
                    name="reserve_car",
                    action=lambda: self._reserve_car(ctx),
                    compensation=lambda: self._cancel_car(ctx),
                    timeout_seconds=30,
                )
            )
        else:
            steps.append(
                SagaStep(
                    name="reserve_car",
                    action=lambda: None,
                    compensation=lambda: None,
                    status=StepStatus.SKIPPED,
                )
            )

        steps.extend([
            SagaStep(
                name="authorize_payment",
                action=lambda: self._authorize_payment(ctx),
                compensation=lambda: self._void_payment(ctx),
                timeout_seconds=60,
            ),
            SagaStep(
                name="confirm_bookings",
                action=lambda: self._confirm_bookings(ctx),
                compensation=lambda: None,  # Pivot point - no compensation
                timeout_seconds=60,
            ),
            SagaStep(
                name="capture_payment",
                action=lambda: self._capture_payment(ctx),
                compensation=lambda: None,  # No compensation after capture
                timeout_seconds=60,
            ),
            SagaStep(
                name="send_notification",
                action=lambda: self._send_confirmation(ctx),
                compensation=lambda: None,  # Notification is fire-and-forget
                timeout_seconds=10,
            ),
        ])

        return steps

    async def _compensate(
        self,
        ctx: TravelBookingSagaContext,
        steps: list[SagaStep],
        failed_index: int,
    ) -> None:
        """Execute compensations in reverse order."""
        ctx.status = SagaStatus.COMPENSATING
        await self.repo.save(ctx)

        # Compensate completed steps in reverse order
        for i in range(failed_index - 1, -1, -1):
            step = steps[i]
            if step.status != StepStatus.COMPLETED:
                continue

            try:
                await asyncio.wait_for(
                    step.compensation(),
                    timeout=step.timeout_seconds,
                )
                step.status = StepStatus.COMPENSATED

            except Exception as e:
                # Log but continue with other compensations
                step.error = f"Compensation failed: {e}"

            await self.repo.save(ctx)

        # Send cancellation notification
        try:
            await self.notification.send_cancellation(
                customer_id=str(ctx.request.customer_id),
                reason="One or more bookings could not be completed",
            )
        except Exception:
            pass  # Best effort

        ctx.status = SagaStatus.COMPENSATED
        ctx.completed_at = datetime.now(timezone.utc)

    # -------------------------------------------------------------------------
    # Step Implementations
    # -------------------------------------------------------------------------

    async def _reserve_flight(self, ctx: TravelBookingSagaContext) -> dict:
        """Reserve flight - Step 1."""
        request = ctx.request
        booking = await self.flight.reserve(
            flight_number=request.flight_number,
            departure_date=request.departure_date,
            customer_id=str(request.customer_id),
            idempotency_key=f"flight-{ctx.saga_id}",
        )
        ctx.flight_booking = booking
        ctx.total_price += booking.price
        return {"flight_booking_id": booking.booking_id}

    async def _cancel_flight(self, ctx: TravelBookingSagaContext) -> None:
        """Cancel flight reservation - Compensation for Step 1."""
        if ctx.flight_booking:
            await self.flight.cancel(
                booking_id=ctx.flight_booking.booking_id,
                idempotency_key=f"cancel-flight-{ctx.saga_id}",
            )

    async def _reserve_hotel(self, ctx: TravelBookingSagaContext) -> dict:
        """Reserve hotel - Step 2."""
        request = ctx.request
        booking = await self.hotel.reserve(
            hotel_name=request.hotel_name,
            check_in=request.check_in,
            check_out=request.check_out,
            room_type=request.room_type,
            customer_id=str(request.customer_id),
            idempotency_key=f"hotel-{ctx.saga_id}",
        )
        ctx.hotel_booking = booking
        ctx.total_price += booking.price
        return {"hotel_booking_id": booking.booking_id}

    async def _cancel_hotel(self, ctx: TravelBookingSagaContext) -> None:
        """Cancel hotel reservation - Compensation for Step 2."""
        if ctx.hotel_booking:
            await self.hotel.cancel(
                booking_id=ctx.hotel_booking.booking_id,
                idempotency_key=f"cancel-hotel-{ctx.saga_id}",
            )

    async def _reserve_car(self, ctx: TravelBookingSagaContext) -> dict:
        """Reserve car rental - Step 3 (optional)."""
        request = ctx.request
        if not request.rental_company:
            return {}

        booking = await self.car.reserve(
            rental_company=request.rental_company,
            pickup_date=request.car_pickup_date,
            return_date=request.car_return_date,
            car_class=request.car_class,
            customer_id=str(request.customer_id),
            idempotency_key=f"car-{ctx.saga_id}",
        )
        ctx.car_booking = booking
        ctx.total_price += booking.price
        return {"car_booking_id": booking.booking_id}

    async def _cancel_car(self, ctx: TravelBookingSagaContext) -> None:
        """Cancel car rental - Compensation for Step 3."""
        if ctx.car_booking:
            await self.car.cancel(
                booking_id=ctx.car_booking.booking_id,
                idempotency_key=f"cancel-car-{ctx.saga_id}",
            )

    async def _authorize_payment(self, ctx: TravelBookingSagaContext) -> dict:
        """Authorize payment - Step 4."""
        request = ctx.request
        authorization_id = await self.payment.authorize(
            payment_method_id=request.payment_method_id,
            amount=ctx.total_price,
            customer_id=str(request.customer_id),
            idempotency_key=f"auth-{ctx.saga_id}",
        )
        ctx.authorization_id = authorization_id
        return {"authorization_id": authorization_id}

    async def _void_payment(self, ctx: TravelBookingSagaContext) -> None:
        """Void payment authorization - Compensation for Step 4."""
        if ctx.authorization_id:
            await self.payment.void(
                authorization_id=ctx.authorization_id,
                idempotency_key=f"void-{ctx.saga_id}",
            )

    async def _confirm_bookings(self, ctx: TravelBookingSagaContext) -> dict:
        """Confirm all bookings - Step 5 (PIVOT POINT)."""
        # This is the pivot point - after this, we don't compensate
        # Run confirmations in parallel for speed

        async def confirm_flight():
            return await self.flight.confirm(
                booking_id=ctx.flight_booking.booking_id,
                payment_id=ctx.authorization_id,
            )

        async def confirm_hotel():
            return await self.hotel.confirm(
                booking_id=ctx.hotel_booking.booking_id,
                payment_id=ctx.authorization_id,
            )

        async def confirm_car():
            if ctx.car_booking:
                return await self.car.confirm(
                    booking_id=ctx.car_booking.booking_id,
                    payment_id=ctx.authorization_id,
                )
            return None

        # Execute confirmations in parallel
        flight_conf, hotel_conf, car_conf = await asyncio.gather(
            confirm_flight(),
            confirm_hotel(),
            confirm_car(),
        )

        ctx.flight_confirmation = flight_conf
        ctx.hotel_confirmation = hotel_conf
        ctx.car_confirmation = car_conf

        return {
            "flight_confirmation": flight_conf,
            "hotel_confirmation": hotel_conf,
            "car_confirmation": car_conf,
        }

    async def _capture_payment(self, ctx: TravelBookingSagaContext) -> dict:
        """Capture authorized payment - Step 6."""
        payment_id = await self.payment.capture(
            authorization_id=ctx.authorization_id,
            idempotency_key=f"capture-{ctx.saga_id}",
        )
        ctx.payment_id = payment_id
        return {"payment_id": payment_id}

    async def _send_confirmation(self, ctx: TravelBookingSagaContext) -> dict:
        """Send confirmation notification - Step 7."""
        await self.notification.send_confirmation(
            customer_id=str(ctx.request.customer_id),
            booking_details={
                "saga_id": ctx.saga_id,
                "flight": {
                    "confirmation": ctx.flight_confirmation,
                    "flight_number": ctx.request.flight_number,
                    "departure": ctx.request.departure_date.isoformat(),
                },
                "hotel": {
                    "confirmation": ctx.hotel_confirmation,
                    "hotel_name": ctx.request.hotel_name,
                    "check_in": ctx.request.check_in.isoformat(),
                    "check_out": ctx.request.check_out.isoformat(),
                },
                "car": {
                    "confirmation": ctx.car_confirmation,
                    "company": ctx.request.rental_company,
                } if ctx.car_confirmation else None,
                "total_price": str(ctx.total_price),
            },
        )
        return {"notification_sent": True}


# -----------------------------------------------------------------------------
# FastAPI Integration
# -----------------------------------------------------------------------------


def create_travel_booking_router(saga: TravelBookingSaga):
    """Create FastAPI router for travel booking saga."""
    from fastapi import APIRouter, HTTPException, BackgroundTasks

    router = APIRouter(prefix="/travel", tags=["travel-booking"])

    @router.post("/book", response_model=TravelBookingResponse)
    async def book_travel(
        request: TravelBookingRequest,
        background_tasks: BackgroundTasks,
    ) -> TravelBookingResponse:
        """
        Book a complete travel package (flight + hotel + optional car).

        This initiates a saga that coordinates all bookings and handles
        failures with automatic compensation.
        """
        try:
            ctx = await saga.execute(request)

            if ctx.status == SagaStatus.COMPLETED:
                return TravelBookingResponse(
                    saga_id=ctx.saga_id,
                    status="completed",
                    flight_confirmation=ctx.flight_confirmation,
                    hotel_confirmation=ctx.hotel_confirmation,
                    car_confirmation=ctx.car_confirmation,
                    total_price=ctx.total_price,
                    message="Booking completed successfully",
                )
            else:
                return TravelBookingResponse(
                    saga_id=ctx.saga_id,
                    status=ctx.status.value,
                    flight_confirmation=None,
                    hotel_confirmation=None,
                    car_confirmation=None,
                    total_price=Decimal("0"),
                    message="Booking failed - all reservations have been cancelled",
                )

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Booking failed: {str(e)}",
            )

    @router.get("/booking/{saga_id}")
    async def get_booking_status(saga_id: str) -> dict:
        """Get the status of a travel booking saga."""
        ctx = await saga.repo.get(saga_id)
        if not ctx:
            raise HTTPException(status_code=404, detail="Booking not found")

        return {
            "saga_id": ctx.saga_id,
            "status": ctx.status.value,
            "flight_confirmation": ctx.flight_confirmation,
            "hotel_confirmation": ctx.hotel_confirmation,
            "car_confirmation": ctx.car_confirmation,
            "total_price": str(ctx.total_price),
            "started_at": ctx.started_at.isoformat() if ctx.started_at else None,
            "completed_at": ctx.completed_at.isoformat() if ctx.completed_at else None,
        }

    return router


# -----------------------------------------------------------------------------
# Example Usage
# -----------------------------------------------------------------------------

"""
# Initialize services (implement protocols for your providers)
flight_service = FlightServiceImpl(amadeus_client)
hotel_service = HotelServiceImpl(booking_com_client)
car_service = CarRentalServiceImpl(enterprise_client)
payment_service = PaymentServiceImpl(stripe_client)
notification_service = NotificationServiceImpl(sendgrid_client)
saga_repository = PostgresSagaRepository(db_session)

# Create saga
saga = TravelBookingSaga(
    flight_service=flight_service,
    hotel_service=hotel_service,
    car_service=car_service,
    payment_service=payment_service,
    notification_service=notification_service,
    saga_repository=saga_repository,
)

# Create FastAPI router
router = create_travel_booking_router(saga)
app.include_router(router, prefix="/api/v1")

# API request example:
# POST /api/v1/travel/book
# {
#     "customer_id": "550e8400-e29b-41d4-a716-446655440000",
#     "flight_number": "AA123",
#     "origin": "JFK",
#     "destination": "LAX",
#     "departure_date": "2026-03-15T08:00:00Z",
#     "hotel_name": "Marriott Downtown",
#     "check_in": "2026-03-15",
#     "check_out": "2026-03-18",
#     "room_type": "deluxe",
#     "rental_company": "Enterprise",
#     "car_pickup_date": "2026-03-15T10:00:00Z",
#     "car_return_date": "2026-03-18T10:00:00Z",
#     "car_class": "midsize",
#     "payment_method_id": "pm_1234567890"
# }
"""
