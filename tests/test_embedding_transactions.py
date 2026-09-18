"""Real SurrealDB checks; opt in with OPEN_NOTEBOOK_TEST_SURREAL_URL.

Use a disposable, unauthenticated local SurrealDB server. Every test gets a
unique database in the embedding_test namespace, never application data.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock
from urllib.parse import urlparse
from uuid import uuid4

import pytest
import pytest_asyncio
from surrealdb import AsyncSurreal, RecordID

from commands import embedding_commands
from open_notebook.database import repository


@pytest_asyncio.fixture
async def embedding_database(monkeypatch):
    url = os.getenv("OPEN_NOTEBOOK_TEST_SURREAL_URL")
    if not url:
        pytest.skip(
            "Set OPEN_NOTEBOOK_TEST_SURREAL_URL to a disposable local SurrealDB"
        )
    if urlparse(url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("Embedding transaction tests require a local disposable SurrealDB")

    database = f"embedding_{uuid4().hex}"

    @asynccontextmanager
    async def connection():
        async with AsyncSurreal(url) as db:
            await db.use("embedding_test", database)
            yield db

    monkeypatch.setattr(repository, "db_connection", connection)
    schema = (
        Path(__file__).resolve().parents[1]
        / "open_notebook/database/migrations/1.surrealql"
    ).read_text()
    async with connection() as db:
        response = await db.query_raw(schema)
        assert "error" not in response, response
        assert all(item["status"] == "OK" for item in response["result"]), response
        await db.create(
            RecordID("source", "target"),
            {
                "title": "Transaction test",
                "full_text": "Source for embedding replacement.",
            },
        )
        await db.insert(
            "source_embedding",
            [
                {
                    "id": RecordID("source_embedding", name),
                    "source": RecordID("source", source),
                    "order": 0,
                    "content": f"Existing {name} content",
                    "embedding": [1.0, 0.0],
                }
                for name, source in [("old", "target"), ("unrelated", "other")]
            ],
        )

    monkeypatch.setattr(
        embedding_commands, "chunk_text", lambda *args, **kwargs: ["First", "Second"]
    )
    yield connection


@pytest.mark.asyncio
async def test_failed_embedding_insert_rolls_back_old_index(
    embedding_database, monkeypatch
):
    """A schema rejection after DELETE must preserve every original record."""
    async with embedding_database() as db:
        before = await db.query("SELECT * FROM source_embedding ORDER BY id;")

    monkeypatch.setattr(
        embedding_commands,
        "generate_embeddings",
        AsyncMock(return_value=[[0.5, 0.5], ["invalid-vector-value"]]),
    )
    with pytest.raises(RuntimeError):
        await embedding_commands.embed_source_command(
            embedding_commands.EmbedSourceInput(source_id="source:target")
        )

    async with embedding_database() as db:
        after = await db.query("SELECT * FROM source_embedding ORDER BY id;")
    assert after == before


@pytest.mark.asyncio
async def test_embedding_replacement_is_complete_and_repeatable(
    embedding_database, monkeypatch
):
    """Successful retries replace only the target source, without duplicates."""
    monkeypatch.setattr(
        embedding_commands,
        "generate_embeddings",
        AsyncMock(return_value=[[1.0, 0.0], [0.0, 1.0]]),
    )
    async with embedding_database() as db:
        unrelated = await db.select(RecordID("source_embedding", "unrelated"))

    for _ in range(2):
        result = await embedding_commands.embed_source_command(
            embedding_commands.EmbedSourceInput(source_id="source:target")
        )
        assert result.success is True
        assert result.chunks_created == 2
        async with embedding_database() as db:
            records = await db.query(
                "SELECT * FROM source_embedding WHERE source = source:target ORDER BY order;"
            )
            assert [record["content"] for record in records] == ["First", "Second"]
            assert [record["embedding"] for record in records] == [
                [1.0, 0.0],
                [0.0, 1.0],
            ]
            assert not await db.select(RecordID("source_embedding", "old"))
            assert (
                await db.select(RecordID("source_embedding", "unrelated")) == unrelated
            )
