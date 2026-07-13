"""
Cloudinary Upload Service
=========================
Uploads generated GLB and preview PNG files to Cloudinary after generation
completes. Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and
CLOUDINARY_API_SECRET environment variables.

If Cloudinary is not configured (missing credentials), all upload functions
raise a RuntimeError so the caller can handle the failure appropriately.
"""

import cloudinary
import cloudinary.uploader
from config import settings


def _configure():
    """Configure the Cloudinary SDK with credentials from settings."""
    if not settings.CLOUDINARY_ENABLED:
        raise RuntimeError(
            "[AI-SERVICE] Cloudinary is not configured. "
            "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and "
            "CLOUDINARY_API_SECRET environment variables."
        )
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_glb(product_id: str, glb_path: str) -> str:
    """
    Upload a GLB file to Cloudinary.

    Args:
        product_id: The product MongoDB ID (used as public_id).
        glb_path: Absolute path to the .glb file on disk.

    Returns:
        The Cloudinary secure_url for the uploaded GLB.

    Raises:
        RuntimeError: If Cloudinary is not configured or upload fails.
    """
    _configure()
    print(f"[AI-SERVICE] Uploading GLB to Cloudinary: models/{product_id} ...")
    try:
        result = cloudinary.uploader.upload(
            glb_path,
            resource_type="raw",
            folder="models",
            public_id=product_id,
            overwrite=True,
            use_filename=False,
            unique_filename=False,
        )
        url = result.get("secure_url")
        if not url:
            raise RuntimeError(
                f"[AI-SERVICE] Cloudinary GLB upload succeeded but returned no secure_url. "
                f"Full response: {result}"
            )
        print(f"[AI-SERVICE] GLB uploaded successfully: {url}")
        return url
    except Exception as e:
        raise RuntimeError(
            f"[AI-SERVICE] Failed to upload GLB to Cloudinary for product {product_id}: {e}"
        ) from e


def upload_preview(product_id: str, preview_path: str) -> str:
    """
    Upload a preview PNG to Cloudinary.

    Args:
        product_id: The product MongoDB ID (used as public_id).
        preview_path: Absolute path to the _preview.png file on disk.

    Returns:
        The Cloudinary secure_url for the uploaded preview image.

    Raises:
        RuntimeError: If Cloudinary is not configured or upload fails.
    """
    _configure()
    print(f"[AI-SERVICE] Uploading preview PNG to Cloudinary: previews/{product_id} ...")
    try:
        result = cloudinary.uploader.upload(
            preview_path,
            resource_type="image",
            folder="previews",
            public_id=product_id,
            overwrite=True,
            use_filename=False,
            unique_filename=False,
        )
        url = result.get("secure_url")
        if not url:
            raise RuntimeError(
                f"[AI-SERVICE] Cloudinary preview upload succeeded but returned no secure_url. "
                f"Full response: {result}"
            )
        print(f"[AI-SERVICE] Preview uploaded successfully: {url}")
        return url
    except Exception as e:
        raise RuntimeError(
            f"[AI-SERVICE] Failed to upload preview PNG to Cloudinary for product {product_id}: {e}"
        ) from e
