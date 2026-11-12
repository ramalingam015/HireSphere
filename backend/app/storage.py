"""
Resume file storage on an S3-compatible server (SeaweedFS) (S3-compatible, via boto3).

Only the backend talks to the S3 server: clients upload to the API and download through
the JWT-protected GET /api/files/resumes/{name}; the S3 port is never exposed.
The DB stores the object key ("resumes/<name>.pdf").
"""
import os
import re
from typing import Optional

from app import config

_client = None
PREFIX = "resumes/"


def _s3():
    global _client
    if _client is None:
        import boto3
        from botocore.client import Config
        _client = boto3.client(
            "s3",
            endpoint_url=config.MINIO_ENDPOINT,
            aws_access_key_id=config.MINIO_ACCESS_KEY,
            aws_secret_access_key=config.MINIO_SECRET_KEY,
            region_name=config.MINIO_REGION,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
    return _client


def ensure_bucket() -> None:
    """Create the bucket if it doesn't exist yet."""
    from botocore.exceptions import ClientError
    try:
        _s3().head_bucket(Bucket=config.MINIO_BUCKET)
    except ClientError:
        try:
            _s3().create_bucket(Bucket=config.MINIO_BUCKET)
            print(f"[STORAGE] created S3 bucket '{config.MINIO_BUCKET}'.")
        except ClientError as exc:
            # Several uvicorn workers start at once: losing the create race is fine.
            if exc.response.get("Error", {}).get("Code") not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                raise


def safe_name(filename: str) -> str:
    """Strip directories and unsafe characters so keys/URLs stay one flat, URL-safe name."""
    base = os.path.basename(filename.replace("\\", "/"))
    return re.sub(r"[^A-Za-z0-9_.-]", "_", base).lstrip(".") or "resume.pdf"


def key_for(filename: str) -> str:
    return PREFIX + safe_name(filename)


def save_resume(filename: str, data: bytes) -> str:
    """Store a PDF under a sanitized name; returns the object key to persist in the DB."""
    key = key_for(filename)
    _s3().put_object(Bucket=config.MINIO_BUCKET, Key=key, Body=data, ContentType="application/pdf")
    return key


def read_resume(ref: str) -> Optional[bytes]:
    """Read a stored resume by DB reference (key) or bare filename. None if missing."""
    from botocore.exceptions import ClientError
    try:
        obj = _s3().get_object(Bucket=config.MINIO_BUCKET, Key=key_for(ref))
        return obj["Body"].read()
    except ClientError:
        return None


def delete_all_resumes() -> None:
    """Remove every stored resume (used by the platform reset)."""
    paginator = _s3().get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=config.MINIO_BUCKET, Prefix=PREFIX):
        objs = [{"Key": o["Key"]} for o in page.get("Contents", [])]
        if objs:
            _s3().delete_objects(Bucket=config.MINIO_BUCKET, Delete={"Objects": objs})
