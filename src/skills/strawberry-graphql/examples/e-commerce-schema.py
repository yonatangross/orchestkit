"""
E-Commerce GraphQL Schema Example (Strawberry 0.240+)

Complete schema for an e-commerce application with:
- Products, Categories, and Inventory
- Orders and Order Items
- Users and Addresses
- DataLoaders for N+1 prevention
- Cursor-based pagination
- Authentication and authorization
"""

import strawberry
from strawberry import Private
from strawberry.types import Info
from strawberry.dataloader import DataLoader
from strawberry.permission import BasePermission
from datetime import datetime
from decimal import Decimal
from typing import Sequence
from collections import defaultdict
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================

@strawberry.enum
class ProductStatus:
    ACTIVE = "active"
    INACTIVE = "inactive"
    OUT_OF_STOCK = "out_of_stock"
    DISCONTINUED = "discontinued"


@strawberry.enum
class OrderStatus:
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


@strawberry.enum
class PaymentStatus:
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


# =============================================================================
# SCALAR TYPES
# =============================================================================

# Money is represented as integer cents to avoid floating point issues
# e.g., $19.99 = 1999 cents


# =============================================================================
# BASE TYPES
# =============================================================================

@strawberry.type
class PageInfo:
    has_next_page: bool
    has_previous_page: bool
    start_cursor: str | None = None
    end_cursor: str | None = None


@strawberry.type
class Money:
    """Monetary amount with currency."""
    amount: int  # Cents
    currency: str = "USD"

    @strawberry.field
    def formatted(self) -> str:
        """Return formatted string like '$19.99'."""
        dollars = self.amount / 100
        return f"${dollars:.2f}"


# =============================================================================
# DOMAIN TYPES
# =============================================================================

@strawberry.type
class Category:
    id: strawberry.ID
    name: str
    slug: str
    description: str | None
    parent_id: strawberry.ID | None
    image_url: str | None
    position: int

    @strawberry.field
    async def parent(self, info: Info) -> "Category | None":
        if not self.parent_id:
            return None
        return await info.context.category_loader.load(self.parent_id)

    @strawberry.field
    async def children(self, info: Info) -> list["Category"]:
        return await info.context.category_children_loader.load(self.id)

    @strawberry.field
    async def products(
        self,
        info: Info,
        first: int = 20,
        after: str | None = None,
    ) -> "ProductConnection":
        return await info.context.product_service.list_by_category(
            category_id=self.id,
            first=first,
            after=after,
        )


@strawberry.type
class ProductImage:
    id: strawberry.ID
    url: str
    alt_text: str | None
    position: int
    is_primary: bool


@strawberry.type
class ProductVariant:
    id: strawberry.ID
    sku: str
    name: str
    price: Money
    compare_at_price: Money | None
    inventory_quantity: int
    weight: float | None
    attributes: str  # JSON string of variant attributes

    @strawberry.field
    def in_stock(self) -> bool:
        return self.inventory_quantity > 0

    @strawberry.field
    def discount_percentage(self) -> int | None:
        if self.compare_at_price and self.compare_at_price.amount > self.price.amount:
            discount = ((self.compare_at_price.amount - self.price.amount) /
                       self.compare_at_price.amount) * 100
            return int(discount)
        return None


@strawberry.type
class Product:
    id: strawberry.ID
    name: str
    slug: str
    description: str
    status: ProductStatus
    price: Money
    compare_at_price: Money | None
    category_id: strawberry.ID
    brand: str | None
    created_at: datetime
    updated_at: datetime | None

    # Private fields
    internal_cost: Private[int]  # Not exposed in schema

    @strawberry.field
    async def category(self, info: Info) -> Category:
        return await info.context.category_loader.load(self.category_id)

    @strawberry.field
    async def images(self, info: Info) -> list[ProductImage]:
        return await info.context.product_images_loader.load(self.id)

    @strawberry.field
    async def variants(self, info: Info) -> list[ProductVariant]:
        return await info.context.product_variants_loader.load(self.id)

    @strawberry.field
    async def related_products(
        self,
        info: Info,
        limit: int = 4,
    ) -> list["Product"]:
        return await info.context.product_service.get_related(self.id, limit)

    @strawberry.field
    async def reviews_summary(self, info: Info) -> "ReviewsSummary":
        return await info.context.reviews_summary_loader.load(self.id)

    @strawberry.field
    def in_stock(self) -> bool:
        # Simplified - real implementation checks variants
        return self.status == ProductStatus.ACTIVE


@strawberry.type
class ProductEdge:
    cursor: str
    node: Product


@strawberry.type
class ProductConnection:
    edges: list[ProductEdge]
    page_info: PageInfo
    total_count: int


@strawberry.type
class ReviewsSummary:
    product_id: strawberry.ID
    average_rating: float
    total_reviews: int
    rating_distribution: str  # JSON: {"5": 10, "4": 5, ...}


@strawberry.type
class Review:
    id: strawberry.ID
    product_id: strawberry.ID
    user_id: strawberry.ID
    rating: int
    title: str
    content: str
    verified_purchase: bool
    helpful_count: int
    created_at: datetime

    @strawberry.field
    async def user(self, info: Info) -> "User":
        return await info.context.user_loader.load(self.user_id)


# =============================================================================
# USER TYPES
# =============================================================================

@strawberry.type
class Address:
    id: strawberry.ID
    label: str
    first_name: str
    last_name: str
    company: str | None
    address_line1: str
    address_line2: str | None
    city: str
    state: str
    postal_code: str
    country: str
    phone: str | None
    is_default: bool


@strawberry.type
class User:
    id: strawberry.ID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    created_at: datetime

    # Private
    password_hash: Private[str]

    @strawberry.field
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @strawberry.field
    async def addresses(self, info: Info) -> list[Address]:
        return await info.context.user_addresses_loader.load(self.id)

    @strawberry.field
    async def orders(
        self,
        info: Info,
        first: int = 10,
        after: str | None = None,
    ) -> "OrderConnection":
        # Only allow users to see their own orders
        if info.context.current_user_id != self.id:
            raise PermissionError("Cannot view other user's orders")
        return await info.context.order_service.list_by_user(
            user_id=self.id,
            first=first,
            after=after,
        )


# =============================================================================
# ORDER TYPES
# =============================================================================

@strawberry.type
class OrderItem:
    id: strawberry.ID
    product_id: strawberry.ID
    variant_id: strawberry.ID | None
    quantity: int
    unit_price: Money
    total_price: Money
    product_name: str  # Snapshot at time of order
    variant_name: str | None

    @strawberry.field
    async def product(self, info: Info) -> Product | None:
        """Product may be deleted, so nullable."""
        return await info.context.product_loader.load(self.product_id)


@strawberry.type
class Order:
    id: strawberry.ID
    order_number: str
    user_id: strawberry.ID
    status: OrderStatus
    payment_status: PaymentStatus
    subtotal: Money
    shipping_cost: Money
    tax: Money
    total: Money
    notes: str | None
    shipping_address_snapshot: str  # JSON snapshot of address
    billing_address_snapshot: str
    created_at: datetime
    updated_at: datetime | None

    @strawberry.field
    async def user(self, info: Info) -> User:
        return await info.context.user_loader.load(self.user_id)

    @strawberry.field
    async def items(self, info: Info) -> list[OrderItem]:
        return await info.context.order_items_loader.load(self.id)

    @strawberry.field
    def item_count(self) -> int:
        # Computed from items, but could be denormalized
        return 0  # Placeholder - implement with actual count


@strawberry.type
class OrderEdge:
    cursor: str
    node: Order


@strawberry.type
class OrderConnection:
    edges: list[OrderEdge]
    page_info: PageInfo
    total_count: int


# =============================================================================
# INPUT TYPES
# =============================================================================

@strawberry.input
class ProductFilterInput:
    category_id: strawberry.ID | None = None
    status: ProductStatus | None = None
    min_price: int | None = None  # Cents
    max_price: int | None = None
    in_stock: bool | None = None
    search: str | None = None


@strawberry.input
class AddressInput:
    label: str
    first_name: str
    last_name: str
    company: str | None = None
    address_line1: str
    address_line2: str | None = None
    city: str
    state: str
    postal_code: str
    country: str
    phone: str | None = None
    is_default: bool = False


@strawberry.input
class CartItemInput:
    product_id: strawberry.ID
    variant_id: strawberry.ID | None = None
    quantity: int


@strawberry.input
class CreateOrderInput:
    items: list[CartItemInput]
    shipping_address_id: strawberry.ID
    billing_address_id: strawberry.ID | None = None  # Use shipping if not provided
    notes: str | None = None


@strawberry.input
class CreateReviewInput:
    product_id: strawberry.ID
    rating: int
    title: str
    content: str


# =============================================================================
# RESULT TYPES
# =============================================================================

@strawberry.type
class FieldError:
    field: str
    message: str
    code: str


@strawberry.type
class MutationError:
    message: str
    errors: list[FieldError] = strawberry.field(default_factory=list)


@strawberry.type
class CreateOrderSuccess:
    order: Order


CreateOrderResult = strawberry.union(
    "CreateOrderResult",
    [CreateOrderSuccess, MutationError],
)


@strawberry.type
class CreateReviewSuccess:
    review: Review


CreateReviewResult = strawberry.union(
    "CreateReviewResult",
    [CreateReviewSuccess, MutationError],
)


# =============================================================================
# PERMISSIONS
# =============================================================================

class IsAuthenticated(BasePermission):
    message = "Authentication required"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context.current_user_id is not None


class IsAdmin(BasePermission):
    message = "Admin access required"

    async def has_permission(self, source, info: Info, **kwargs) -> bool:
        return info.context.is_admin


# =============================================================================
# DATALOADERS
# =============================================================================

class CategoryLoader(DataLoader[str, Category]):
    def __init__(self, repo):
        super().__init__(load_fn=self.batch_load)
        self.repo = repo

    async def batch_load(self, keys: list[str]) -> Sequence[Category | None]:
        categories = await self.repo.get_many(keys)
        cat_map = {str(c.id): c for c in categories}
        return [cat_map.get(k) for k in keys]


class ProductLoader(DataLoader[str, Product]):
    def __init__(self, repo):
        super().__init__(load_fn=self.batch_load)
        self.repo = repo

    async def batch_load(self, keys: list[str]) -> Sequence[Product | None]:
        products = await self.repo.get_many(keys)
        prod_map = {str(p.id): p for p in products}
        return [prod_map.get(k) for k in keys]


class ProductImagesLoader:
    def __init__(self, repo):
        self.repo = repo
        self._loader = DataLoader(load_fn=self._batch_load)

    async def load(self, product_id: str) -> list[ProductImage]:
        return await self._loader.load(product_id)

    async def _batch_load(self, keys: list[str]) -> Sequence[list[ProductImage]]:
        images = await self.repo.get_images_for_products(keys)
        images_by_product: dict[str, list] = defaultdict(list)
        for img in images:
            images_by_product[str(img.product_id)].append(img)
        return [images_by_product.get(k, []) for k in keys]


class OrderItemsLoader:
    def __init__(self, repo):
        self.repo = repo
        self._loader = DataLoader(load_fn=self._batch_load)

    async def load(self, order_id: str) -> list[OrderItem]:
        return await self._loader.load(order_id)

    async def _batch_load(self, keys: list[str]) -> Sequence[list[OrderItem]]:
        items = await self.repo.get_items_for_orders(keys)
        items_by_order: dict[str, list] = defaultdict(list)
        for item in items:
            items_by_order[str(item.order_id)].append(item)
        return [items_by_order.get(k, []) for k in keys]


class ReviewsSummaryLoader:
    def __init__(self, repo):
        self.repo = repo
        self._loader = DataLoader(load_fn=self._batch_load)

    async def load(self, product_id: str) -> ReviewsSummary:
        return await self._loader.load(product_id)

    async def _batch_load(self, keys: list[str]) -> Sequence[ReviewsSummary]:
        summaries = await self.repo.get_reviews_summaries(keys)
        summary_map = {str(s.product_id): s for s in summaries}
        default = ReviewsSummary(
            product_id="",
            average_rating=0.0,
            total_reviews=0,
            rating_distribution="{}",
        )
        return [summary_map.get(k, default) for k in keys]


# =============================================================================
# QUERY
# =============================================================================

@strawberry.type
class Query:
    @strawberry.field
    async def product(self, info: Info, id: strawberry.ID) -> Product | None:
        return await info.context.product_loader.load(id)

    @strawberry.field
    async def product_by_slug(self, info: Info, slug: str) -> Product | None:
        return await info.context.product_service.get_by_slug(slug)

    @strawberry.field
    async def products(
        self,
        info: Info,
        first: int = 20,
        after: str | None = None,
        filter: ProductFilterInput | None = None,
    ) -> ProductConnection:
        return await info.context.product_service.list_paginated(
            first=min(first, 100),  # Max 100
            after=after,
            filter=filter,
        )

    @strawberry.field
    async def category(self, info: Info, id: strawberry.ID) -> Category | None:
        return await info.context.category_loader.load(id)

    @strawberry.field
    async def category_by_slug(self, info: Info, slug: str) -> Category | None:
        return await info.context.category_service.get_by_slug(slug)

    @strawberry.field
    async def categories(self, info: Info) -> list[Category]:
        """Get top-level categories."""
        return await info.context.category_service.get_root_categories()

    @strawberry.field
    async def search_products(
        self,
        info: Info,
        query: str,
        first: int = 20,
        after: str | None = None,
    ) -> ProductConnection:
        return await info.context.product_service.search(
            query=query,
            first=min(first, 100),
            after=after,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def me(self, info: Info) -> User | None:
        return await info.context.user_loader.load(info.context.current_user_id)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def my_orders(
        self,
        info: Info,
        first: int = 10,
        after: str | None = None,
        status: OrderStatus | None = None,
    ) -> OrderConnection:
        return await info.context.order_service.list_by_user(
            user_id=info.context.current_user_id,
            first=first,
            after=after,
            status=status,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def order(self, info: Info, id: strawberry.ID) -> Order | None:
        order = await info.context.order_service.get(id)
        if order and order.user_id != info.context.current_user_id:
            if not info.context.is_admin:
                raise PermissionError("Cannot view other user's order")
        return order


# =============================================================================
# MUTATION
# =============================================================================

@strawberry.type
class Mutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_order(
        self,
        info: Info,
        input: CreateOrderInput,
    ) -> CreateOrderResult:
        errors = []

        # Validate items
        if not input.items:
            errors.append(FieldError(
                field="items",
                message="Order must have at least one item",
                code="EMPTY_ORDER",
            ))

        for item in input.items:
            if item.quantity < 1:
                errors.append(FieldError(
                    field="items",
                    message=f"Invalid quantity for product {item.product_id}",
                    code="INVALID_QUANTITY",
                ))

        if errors:
            return MutationError(message="Validation failed", errors=errors)

        try:
            order = await info.context.order_service.create(
                user_id=info.context.current_user_id,
                items=input.items,
                shipping_address_id=input.shipping_address_id,
                billing_address_id=input.billing_address_id or input.shipping_address_id,
                notes=input.notes,
            )
            return CreateOrderSuccess(order=order)
        except Exception as e:
            return MutationError(message=str(e))

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def cancel_order(
        self,
        info: Info,
        order_id: strawberry.ID,
    ) -> Order:
        order = await info.context.order_service.get(order_id)
        if not order:
            raise ValueError("Order not found")
        if order.user_id != info.context.current_user_id:
            raise PermissionError("Cannot cancel other user's order")
        if order.status not in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
            raise ValueError("Order cannot be cancelled")

        return await info.context.order_service.cancel(order_id)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def add_address(
        self,
        info: Info,
        input: AddressInput,
    ) -> Address:
        return await info.context.user_service.add_address(
            user_id=info.context.current_user_id,
            **input.__dict__,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_review(
        self,
        info: Info,
        input: CreateReviewInput,
    ) -> CreateReviewResult:
        errors = []

        if input.rating < 1 or input.rating > 5:
            errors.append(FieldError(
                field="rating",
                message="Rating must be between 1 and 5",
                code="INVALID_RATING",
            ))

        if len(input.title) < 3:
            errors.append(FieldError(
                field="title",
                message="Title must be at least 3 characters",
                code="TITLE_TOO_SHORT",
            ))

        if errors:
            return MutationError(message="Validation failed", errors=errors)

        # Check if user has purchased the product
        has_purchased = await info.context.order_service.user_has_purchased(
            user_id=info.context.current_user_id,
            product_id=input.product_id,
        )

        review = await info.context.review_service.create(
            user_id=info.context.current_user_id,
            product_id=input.product_id,
            rating=input.rating,
            title=input.title,
            content=input.content,
            verified_purchase=has_purchased,
        )
        return CreateReviewSuccess(review=review)


# =============================================================================
# SCHEMA
# =============================================================================

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
)


# =============================================================================
# CONTEXT
# =============================================================================

class ECommerceContext:
    """GraphQL context with all dependencies."""

    def __init__(
        self,
        request,
        current_user_id: str | None,
        is_admin: bool,
        product_service,
        category_service,
        order_service,
        user_service,
        review_service,
        product_repo,
        category_repo,
        user_repo,
        order_repo,
        review_repo,
    ):
        self.request = request
        self.current_user_id = current_user_id
        self.is_admin = is_admin

        # Services
        self.product_service = product_service
        self.category_service = category_service
        self.order_service = order_service
        self.user_service = user_service
        self.review_service = review_service

        # DataLoaders (created per request)
        self.product_loader = ProductLoader(product_repo)
        self.category_loader = CategoryLoader(category_repo)
        self.user_loader = DataLoader(load_fn=self._load_users)
        self.product_images_loader = ProductImagesLoader(product_repo)
        self.product_variants_loader = ProductImagesLoader(product_repo)  # Similar pattern
        self.order_items_loader = OrderItemsLoader(order_repo)
        self.reviews_summary_loader = ReviewsSummaryLoader(review_repo)
        self.category_children_loader = DataLoader(load_fn=self._load_category_children)
        self.user_addresses_loader = DataLoader(load_fn=self._load_user_addresses)

        self._user_repo = user_repo
        self._category_repo = category_repo

    async def _load_users(self, keys: list[str]) -> Sequence:
        users = await self._user_repo.get_many(keys)
        user_map = {str(u.id): u for u in users}
        return [user_map.get(k) for k in keys]

    async def _load_category_children(self, keys: list[str]) -> Sequence[list]:
        children = await self._category_repo.get_children_for_categories(keys)
        children_map: dict[str, list] = defaultdict(list)
        for child in children:
            children_map[str(child.parent_id)].append(child)
        return [children_map.get(k, []) for k in keys]

    async def _load_user_addresses(self, keys: list[str]) -> Sequence[list]:
        addresses = await self._user_repo.get_addresses_for_users(keys)
        addr_map: dict[str, list] = defaultdict(list)
        for addr in addresses:
            addr_map[str(addr.user_id)].append(addr)
        return [addr_map.get(k, []) for k in keys]
