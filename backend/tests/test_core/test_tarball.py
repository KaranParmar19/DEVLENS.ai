"""
DevLens AI — Core Tests: Tarball Extraction
"""

import io
import tarfile
from app.core.file_utils import extract_tarball_files


def create_mock_tarball(files: dict[str, str], prefix: str = "org-repo-12345") -> bytes:
    """Helper to generate an in-memory tar.gz archive mimicking GitHub's tarball export."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path, text in files.items():
            full_name = f"{prefix}/{path}"
            data = text.encode("utf-8")
            ti = tarfile.TarInfo(name=full_name)
            ti.size = len(data)
            tar.addfile(ti, io.BytesIO(data))
    buf.seek(0)
    return buf.getvalue()


def test_extract_tarball_files_strips_prefix():
    """Tarball extraction should strip the GitHub top-level archive prefix."""
    mock_files = {
        "src/main.py": "print('hello')",
        "README.md": "# Readme",
    }
    tar_bytes = create_mock_tarball(mock_files)
    extracted = extract_tarball_files(tar_bytes)

    assert "src/main.py" in extracted
    assert extracted["src/main.py"] == "print('hello')"
    assert "README.md" in extracted


def test_extract_tarball_respects_allowed_paths():
    """Only paths in allowed_paths should be extracted when filtered."""
    mock_files = {
        "src/main.py": "code",
        "secret.key": "secret",
    }
    tar_bytes = create_mock_tarball(mock_files)
    extracted = extract_tarball_files(tar_bytes, allowed_paths={"src/main.py"})

    assert "src/main.py" in extracted
    assert "secret.key" not in extracted
