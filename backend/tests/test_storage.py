"""Unit tests for app.storage against an in-memory fake S3."""
from app import config, storage
from .conftest import FakeS3


def test_save_returns_key_and_stores_object(fake_s3):
    ref = storage.save_resume("a.pdf", b"pdfbytes")
    assert ref == "resumes/a.pdf"
    assert fake_s3.objects[(config.MINIO_BUCKET, "resumes/a.pdf")] == b"pdfbytes"


def test_read_by_key_or_basename():
    storage.save_resume("a.pdf", b"x")
    assert storage.read_resume("resumes/a.pdf") == b"x"
    assert storage.read_resume("a.pdf") == b"x"


def test_read_missing_returns_none():
    assert storage.read_resume("ghost.pdf") is None


def test_read_blocks_path_traversal(fake_s3):
    fake_s3.objects[(config.MINIO_BUCKET, "secret.txt")] = b"secret"
    assert storage.read_resume("../secret.txt") is None
    assert storage.read_resume("..\\secret.txt") is None


def test_ensure_bucket_creates_when_missing(monkeypatch):
    fake = FakeS3(bucket_exists=False)
    monkeypatch.setattr(storage, "_s3", lambda: fake)
    storage.ensure_bucket()
    assert config.MINIO_BUCKET in fake.buckets


def test_delete_all_resumes_clears_prefix_only(fake_s3):
    storage.save_resume("a.pdf", b"1")
    storage.save_resume("b.pdf", b"2")
    fake_s3.objects[(config.MINIO_BUCKET, "other/keep.txt")] = b"3"
    storage.delete_all_resumes()
    assert list(fake_s3.objects) == [(config.MINIO_BUCKET, "other/keep.txt")]


def test_save_sanitizes_hostile_and_spaced_filenames(fake_s3):
    assert storage.save_resume("../../etc/pass wd #1.pdf", b"x") == "resumes/pass_wd__1.pdf"
    assert storage.save_resume("a/b\\c d.pdf", b"x") == "resumes/c_d.pdf"
    assert all(k.count("/") == 1 for (_, k) in fake_s3.objects)  # flat keys only


def test_ensure_bucket_tolerates_create_race(monkeypatch):
    """Two workers starting together: the loser's create_bucket must not crash startup."""
    from botocore.exceptions import ClientError
    from app import storage

    class RacyClient:
        def head_bucket(self, **_):
            raise ClientError({"Error": {"Code": "404"}}, "HeadBucket")

        def create_bucket(self, **_):
            raise ClientError({"Error": {"Code": "BucketAlreadyOwnedByYou"}}, "CreateBucket")

    monkeypatch.setattr(storage, "_s3", lambda: RacyClient())
    storage.ensure_bucket()  # must not raise
