"""
Parallel Image Processing Workers Example

Demonstrates:
- Chunked processing for large batches
- Group for parallel processing
- Chord for aggregation
- Rate limiting for external APIs
- Progress tracking with custom states
- Memory management for large files

Use Case:
    Process user-uploaded images for an e-commerce catalog:
    - Generate thumbnails (multiple sizes)
    - Optimize for web (WebP conversion)
    - Extract metadata
    - Run moderation check
    - Upload to CDN

Usage:
    from image_processing import process_image_batch
    result = process_image_batch(image_urls, user_id="usr-123")
    status = get_batch_status(result.id)

Requirements:
    celery>=5.4.0
    pillow>=10.0.0
    aiohttp>=3.9.0 (for async downloads)
    redis>=5.0.0
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import uuid4

from celery import Celery, chain, group, chord
from celery.exceptions import Reject, SoftTimeLimitExceeded
from celery.result import AsyncResult
from PIL import Image
import redis
import structlog

# =============================================================================
# CONFIGURATION
# =============================================================================

logger = structlog.get_logger()

celery_app = Celery("image_processing")
celery_app.config_from_object("celery_config")

redis_client = redis.from_url(
    os.environ.get("REDIS_URL", "redis://localhost:6379/0")
)

# Processing configuration
THUMBNAIL_SIZES = {
    "small": (150, 150),
    "medium": (300, 300),
    "large": (600, 600),
}

MAX_IMAGE_SIZE_MB = 20
SUPPORTED_FORMATS = {"JPEG", "PNG", "GIF", "WEBP"}
OUTPUT_FORMAT = "WEBP"
OUTPUT_QUALITY = 85


# =============================================================================
# MODELS
# =============================================================================


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    VALIDATING = "validating"
    GENERATING_THUMBNAILS = "generating_thumbnails"
    OPTIMIZING = "optimizing"
    MODERATING = "moderating"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ImageResult:
    """Result of processing a single image."""

    image_id: str
    original_url: str
    status: str
    thumbnails: dict[str, str] = None  # size -> CDN URL
    optimized_url: str = None
    metadata: dict = None
    moderation: dict = None
    error: str = None
    processing_time_ms: int = 0


# =============================================================================
# IMAGE PROCESSING TASKS
# =============================================================================


@celery_app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    soft_time_limit=60,
    time_limit=90,
)
def download_image(self, image_url: str, image_id: str) -> dict:
    """
    Download image from URL.

    Returns image bytes encoded as base64 for serialization.
    """
    import base64
    import requests

    log = logger.bind(image_id=image_id, url=image_url)
    log.info("downloading_image")

    self.update_state(
        state=ProcessingStatus.DOWNLOADING.value,
        meta={"image_id": image_id},
    )

    try:
        response = requests.get(
            image_url,
            timeout=30,
            stream=True,
            headers={"User-Agent": "ImageProcessor/1.0"},
        )
        response.raise_for_status()

        # Check content length
        content_length = int(response.headers.get("Content-Length", 0))
        if content_length > MAX_IMAGE_SIZE_MB * 1024 * 1024:
            raise ValueError(f"Image too large: {content_length} bytes")

        image_data = response.content
        log.info("image_downloaded", size_bytes=len(image_data))

        return {
            "image_id": image_id,
            "original_url": image_url,
            "image_data": base64.b64encode(image_data).decode("utf-8"),
            "content_type": response.headers.get("Content-Type", ""),
        }

    except requests.RequestException as e:
        log.error("download_failed", error=str(e))
        raise


@celery_app.task(bind=True)
def validate_image(self, download_result: dict) -> dict:
    """
    Validate downloaded image.

    Checks:
    - Valid image format
    - Minimum dimensions
    - Not corrupted
    """
    import base64

    image_id = download_result["image_id"]
    log = logger.bind(image_id=image_id)
    log.info("validating_image")

    self.update_state(
        state=ProcessingStatus.VALIDATING.value,
        meta={"image_id": image_id},
    )

    try:
        image_data = base64.b64decode(download_result["image_data"])
        image = Image.open(io.BytesIO(image_data))

        # Validate format
        if image.format not in SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {image.format}")

        # Validate dimensions
        width, height = image.size
        if width < 100 or height < 100:
            raise ValueError(f"Image too small: {width}x{height}")

        if width > 10000 or height > 10000:
            raise ValueError(f"Image too large: {width}x{height}")

        log.info(
            "image_validated",
            format=image.format,
            dimensions=f"{width}x{height}",
        )

        return {
            **download_result,
            "format": image.format,
            "width": width,
            "height": height,
            "mode": image.mode,
        }

    except Exception as e:
        log.error("validation_failed", error=str(e))
        raise Reject(f"Image validation failed: {e}", requeue=False)


@celery_app.task(
    bind=True,
    soft_time_limit=120,
    time_limit=180,
)
def generate_thumbnails(self, validated_result: dict) -> dict:
    """
    Generate thumbnails at multiple sizes.

    Uses high-quality LANCZOS resampling.
    """
    import base64

    image_id = validated_result["image_id"]
    log = logger.bind(image_id=image_id)
    log.info("generating_thumbnails")

    self.update_state(
        state=ProcessingStatus.GENERATING_THUMBNAILS.value,
        meta={"image_id": image_id},
    )

    try:
        image_data = base64.b64decode(validated_result["image_data"])
        original = Image.open(io.BytesIO(image_data))

        # Convert to RGB if needed (for WebP output)
        if original.mode in ("RGBA", "P"):
            original = original.convert("RGB")

        thumbnails = {}

        for size_name, dimensions in THUMBNAIL_SIZES.items():
            # Create thumbnail preserving aspect ratio
            thumb = original.copy()
            thumb.thumbnail(dimensions, Image.Resampling.LANCZOS)

            # Save to buffer
            buffer = io.BytesIO()
            thumb.save(buffer, format=OUTPUT_FORMAT, quality=OUTPUT_QUALITY)
            buffer.seek(0)

            thumbnails[size_name] = {
                "data": base64.b64encode(buffer.getvalue()).decode("utf-8"),
                "width": thumb.width,
                "height": thumb.height,
                "format": OUTPUT_FORMAT,
            }

            log.info(
                "thumbnail_generated",
                size=size_name,
                dimensions=f"{thumb.width}x{thumb.height}",
            )

        return {
            **validated_result,
            "thumbnails": thumbnails,
        }

    except SoftTimeLimitExceeded:
        log.error("thumbnail_generation_timeout")
        raise
    except Exception as e:
        log.error("thumbnail_generation_failed", error=str(e))
        raise


@celery_app.task(
    bind=True,
    soft_time_limit=60,
    time_limit=90,
)
def optimize_image(self, thumbnail_result: dict) -> dict:
    """
    Optimize original image for web.

    - Convert to WebP
    - Apply quality optimization
    - Strip metadata (optional)
    """
    import base64

    image_id = thumbnail_result["image_id"]
    log = logger.bind(image_id=image_id)
    log.info("optimizing_image")

    self.update_state(
        state=ProcessingStatus.OPTIMIZING.value,
        meta={"image_id": image_id},
    )

    try:
        image_data = base64.b64decode(thumbnail_result["image_data"])
        original = Image.open(io.BytesIO(image_data))

        # Convert mode if needed
        if original.mode in ("RGBA", "P"):
            original = original.convert("RGB")

        # Resize if too large
        max_dimension = 2000
        if original.width > max_dimension or original.height > max_dimension:
            original.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        # Save optimized
        buffer = io.BytesIO()
        original.save(
            buffer,
            format=OUTPUT_FORMAT,
            quality=OUTPUT_QUALITY,
            optimize=True,
        )
        buffer.seek(0)

        original_size = len(image_data)
        optimized_size = len(buffer.getvalue())

        log.info(
            "image_optimized",
            original_size=original_size,
            optimized_size=optimized_size,
            reduction_pct=round((1 - optimized_size / original_size) * 100, 1),
        )

        return {
            **thumbnail_result,
            "optimized_data": base64.b64encode(buffer.getvalue()).decode("utf-8"),
            "optimized_width": original.width,
            "optimized_height": original.height,
            "size_reduction_pct": round((1 - optimized_size / original_size) * 100, 1),
        }

    except Exception as e:
        log.error("optimization_failed", error=str(e))
        raise


@celery_app.task(
    bind=True,
    rate_limit="10/s",  # API rate limit
    max_retries=2,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
)
def moderate_image(self, optimized_result: dict) -> dict:
    """
    Run content moderation on image.

    Calls external moderation API (rate limited).
    """
    import base64

    image_id = optimized_result["image_id"]
    log = logger.bind(image_id=image_id)
    log.info("moderating_image")

    self.update_state(
        state=ProcessingStatus.MODERATING.value,
        meta={"image_id": image_id},
    )

    try:
        # Simulate moderation API call
        # Replace with actual API call (AWS Rekognition, Google Vision, etc.)
        moderation_result = _call_moderation_api(
            base64.b64decode(optimized_result["optimized_data"])
        )

        log.info(
            "moderation_complete",
            is_safe=moderation_result["is_safe"],
            labels=moderation_result.get("labels", []),
        )

        return {
            **optimized_result,
            "moderation": moderation_result,
        }

    except Exception as e:
        log.error("moderation_failed", error=str(e))
        # Don't fail the whole pipeline for moderation errors
        return {
            **optimized_result,
            "moderation": {"is_safe": None, "error": str(e)},
        }


@celery_app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
)
def upload_to_cdn(self, moderated_result: dict) -> dict:
    """
    Upload processed images to CDN.

    Uploads:
    - Optimized original
    - All thumbnail sizes
    """
    import base64

    image_id = moderated_result["image_id"]
    log = logger.bind(image_id=image_id)
    log.info("uploading_to_cdn")

    self.update_state(
        state=ProcessingStatus.UPLOADING.value,
        meta={"image_id": image_id},
    )

    try:
        cdn_urls = {}

        # Upload optimized original
        optimized_url = _upload_to_cdn(
            data=base64.b64decode(moderated_result["optimized_data"]),
            key=f"images/{image_id}/optimized.webp",
        )
        cdn_urls["optimized"] = optimized_url

        # Upload thumbnails
        for size_name, thumb_data in moderated_result["thumbnails"].items():
            url = _upload_to_cdn(
                data=base64.b64decode(thumb_data["data"]),
                key=f"images/{image_id}/thumb_{size_name}.webp",
            )
            cdn_urls[f"thumb_{size_name}"] = url

        log.info("cdn_upload_complete", urls=cdn_urls)

        return {
            "image_id": image_id,
            "original_url": moderated_result["original_url"],
            "cdn_urls": cdn_urls,
            "metadata": {
                "width": moderated_result["optimized_width"],
                "height": moderated_result["optimized_height"],
                "format": OUTPUT_FORMAT,
                "size_reduction_pct": moderated_result.get("size_reduction_pct", 0),
            },
            "moderation": moderated_result["moderation"],
            "status": ProcessingStatus.COMPLETED.value,
        }

    except Exception as e:
        log.error("cdn_upload_failed", error=str(e))
        raise


# =============================================================================
# BATCH PROCESSING
# =============================================================================


@celery_app.task(bind=True)
def aggregate_batch_results(
    self,
    results: list[dict],
    batch_id: str,
    user_id: str,
) -> dict:
    """
    Aggregate results from parallel image processing.
    """
    log = logger.bind(batch_id=batch_id, user_id=user_id)

    successful = [r for r in results if r.get("status") == ProcessingStatus.COMPLETED.value]
    failed = [r for r in results if r.get("status") == ProcessingStatus.FAILED.value]

    log.info(
        "batch_complete",
        total=len(results),
        successful=len(successful),
        failed=len(failed),
    )

    # Store batch results
    _store_batch_results(batch_id, results)

    # Notify user
    _notify_batch_complete(
        user_id=user_id,
        batch_id=batch_id,
        successful=len(successful),
        failed=len(failed),
    )

    return {
        "batch_id": batch_id,
        "user_id": user_id,
        "total": len(results),
        "successful": len(successful),
        "failed": len(failed),
        "results": results,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


def process_single_image(image_url: str, image_id: str) -> chain:
    """
    Create processing chain for a single image.
    """
    return chain(
        download_image.s(image_url, image_id),
        validate_image.s(),
        generate_thumbnails.s(),
        optimize_image.s(),
        moderate_image.s(),
        upload_to_cdn.s(),
    )


def process_image_batch(
    image_urls: list[str],
    user_id: str,
    batch_size: int = 10,
) -> AsyncResult:
    """
    Process a batch of images in parallel.

    Args:
        image_urls: List of image URLs to process
        user_id: User ID for tracking and notifications
        batch_size: Max concurrent images (memory management)

    Returns:
        AsyncResult for tracking the batch
    """
    batch_id = f"batch_{uuid4().hex[:12]}"

    logger.info(
        "submitting_image_batch",
        batch_id=batch_id,
        user_id=user_id,
        image_count=len(image_urls),
    )

    # Create image IDs
    images = [
        {
            "url": url,
            "id": f"img_{uuid4().hex[:8]}",
        }
        for url in image_urls
    ]

    # Create processing chains for each image
    processing_tasks = [
        process_single_image(img["url"], img["id"])
        for img in images
    ]

    # Use chord: parallel processing + aggregation
    workflow = chord(
        processing_tasks,
        aggregate_batch_results.s(batch_id=batch_id, user_id=user_id),
    )

    return workflow.apply_async(
        queue="default",
        priority=5,
    )


def process_large_batch(
    image_urls: list[str],
    user_id: str,
    chunk_size: int = 50,
) -> list[AsyncResult]:
    """
    Process very large batch by chunking.

    For batches > 100 images, splits into smaller chunks
    to manage memory and provide incremental results.

    Args:
        image_urls: List of image URLs
        user_id: User ID
        chunk_size: Images per chunk

    Returns:
        List of AsyncResults (one per chunk)
    """
    results = []

    for i in range(0, len(image_urls), chunk_size):
        chunk_urls = image_urls[i : i + chunk_size]
        result = process_image_batch(chunk_urls, user_id)
        results.append(result)

    return results


# =============================================================================
# STATUS TRACKING
# =============================================================================


def get_batch_status(task_id: str) -> dict:
    """
    Get current status of batch processing.
    """
    result = AsyncResult(task_id)

    return {
        "task_id": task_id,
        "state": result.state,
        "info": result.info if result.info else {},
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
        "result": result.get() if result.successful() else None,
    }


def get_image_progress(batch_id: str) -> dict:
    """
    Get progress of individual images in a batch.
    """
    # Get from Redis tracking
    progress_key = f"batch_progress:{batch_id}"
    progress = redis_client.hgetall(progress_key)

    return {
        image_id.decode(): status.decode()
        for image_id, status in progress.items()
    }


# =============================================================================
# HELPER FUNCTIONS (Replace with actual implementations)
# =============================================================================


def _call_moderation_api(image_data: bytes) -> dict:
    """Call image moderation API."""
    # Replace with actual API call
    return {
        "is_safe": True,
        "labels": [],
        "confidence": 0.99,
    }


def _upload_to_cdn(data: bytes, key: str) -> str:
    """Upload image to CDN."""
    # Replace with actual S3/CloudFront/etc. upload
    return f"https://cdn.example.com/{key}"


def _store_batch_results(batch_id: str, results: list[dict]) -> None:
    """Store batch results in database."""
    pass


def _notify_batch_complete(
    user_id: str,
    batch_id: str,
    successful: int,
    failed: int,
) -> None:
    """Notify user of batch completion."""
    pass


# =============================================================================
# CLI EXAMPLE
# =============================================================================

if __name__ == "__main__":
    # Example usage
    test_urls = [
        "https://example.com/image1.jpg",
        "https://example.com/image2.png",
        "https://example.com/image3.jpg",
    ]

    result = process_image_batch(
        image_urls=test_urls,
        user_id="test-user-123",
    )

    print(f"Batch submitted: {result.id}")
    print("Track with: get_batch_status('{}')\n".format(result.id))
