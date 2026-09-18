"""Regression tests for embedding replacement and provider batch integrity."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from commands import embedding_commands
from open_notebook.ai.models import model_manager
from open_notebook.utils import embedding


@pytest.fixture
def source_embedding_mocks(monkeypatch):
    source = SimpleNamespace(full_text="Source document", asset=None)
    mocks = SimpleNamespace(
        chunks=Mock(return_value=["First chunk", "Second chunk"]),
        generate=AsyncMock(return_value=[[1.0, 0.0], [0.0, 1.0]]),
        query=AsyncMock(),
    )
    monkeypatch.setattr(
        embedding_commands.Source, "get", AsyncMock(return_value=source)
    )
    monkeypatch.setattr(embedding_commands, "chunk_text", mocks.chunks)
    monkeypatch.setattr(embedding_commands, "generate_embeddings", mocks.generate)
    monkeypatch.setattr(embedding_commands, "repo_query", mocks.query)
    return mocks


@pytest.mark.asyncio
async def test_source_keeps_existing_embeddings_when_provider_fails(
    source_embedding_mocks,
):
    mocks = source_embedding_mocks
    mocks.generate.side_effect = RuntimeError("Embedding provider unavailable")

    with pytest.raises(RuntimeError, match="Embedding provider unavailable"):
        await embedding_commands.embed_source_command(
            embedding_commands.EmbedSourceInput(source_id="source:test")
        )

    mocks.query.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid_stage", ["empty_chunks", "missing_embeddings"])
async def test_source_keeps_existing_embeddings_when_validation_fails(
    source_embedding_mocks, invalid_stage
):
    mocks = source_embedding_mocks
    if invalid_stage == "empty_chunks":
        mocks.chunks.return_value = []
    else:
        mocks.generate.return_value = [[1.0, 0.0]]

    message = (
        "No chunks created"
        if invalid_stage == "empty_chunks"
        else "Embedding count mismatch"
    )
    with pytest.raises(ValueError, match=message):
        await embedding_commands.embed_source_command(
            embedding_commands.EmbedSourceInput(source_id="source:test")
        )

    mocks.query.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("record_type", "command", "input_data"),
    [
        (
            embedding_commands.Note,
            embedding_commands.embed_note_command,
            embedding_commands.EmbedNoteInput(note_id="note:test"),
        ),
        (
            embedding_commands.SourceInsight,
            embedding_commands.embed_insight_command,
            embedding_commands.EmbedInsightInput(insight_id="source_insight:test"),
        ),
        (
            embedding_commands.Source,
            embedding_commands.embed_source_command,
            embedding_commands.EmbedSourceInput(source_id="source:test"),
        ),
    ],
    ids=["note", "insight", "source"],
)
async def test_empty_record_raises_permanent_failure_for_worker(
    monkeypatch, record_type, command, input_data
):
    record = SimpleNamespace(content=" \n ", full_text=" \n ", asset=None)
    monkeypatch.setattr(record_type, "get", AsyncMock(return_value=record))
    query = AsyncMock()
    monkeypatch.setattr(embedding_commands, "repo_query", query)

    with pytest.raises(ValueError, match="has no (content|text) to embed"):
        await command(input_data)

    query.assert_not_awaited()


@pytest.mark.asyncio
async def test_source_generates_embeddings_before_replacing_existing(
    source_embedding_mocks,
):
    mocks = source_embedding_mocks
    calls = Mock()
    calls.attach_mock(mocks.generate, "generate")
    calls.attach_mock(mocks.query, "replace")

    result = await embedding_commands.embed_source_command(
        embedding_commands.EmbedSourceInput(source_id="source:test")
    )

    assert result.success is True
    assert result.chunks_created == 2
    assert [call[0] for call in calls.mock_calls] == ["generate", "replace"]
    records = mocks.query.call_args.args[1]["records"]
    assert [(record["content"], record["embedding"]) for record in records] == [
        ("First chunk", [1.0, 0.0]),
        ("Second chunk", [0.0, 1.0]),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("incorrect_count", [0, 1, 3])
async def test_embedding_batch_retries_incomplete_or_extra_results(
    monkeypatch, incorrect_count
):
    expected = [[1.0, 0.0], [0.0, 1.0]]
    model = SimpleNamespace(
        model_name="test-model",
        aembed=AsyncMock(side_effect=[[[9.0, 9.0]] * incorrect_count, expected]),
    )
    monkeypatch.setattr(
        model_manager, "get_embedding_model", AsyncMock(return_value=model)
    )
    monkeypatch.setattr(embedding, "EMBEDDING_RETRY_DELAY", 0)

    result = await embedding.generate_embeddings(["first", "second"])

    assert result == expected
    assert model.aembed.await_count == 2


@pytest.mark.asyncio
async def test_embedding_batch_rejects_persistently_incorrect_result_count(monkeypatch):
    model = SimpleNamespace(model_name="test-model", aembed=AsyncMock(return_value=[]))
    monkeypatch.setattr(
        model_manager, "get_embedding_model", AsyncMock(return_value=model)
    )
    monkeypatch.setattr(embedding, "EMBEDDING_RETRY_DELAY", 0)

    with pytest.raises(RuntimeError, match="Embedding count mismatch"):
        await embedding.generate_embeddings(["first"])

    assert model.aembed.await_count == embedding.EMBEDDING_MAX_RETRIES


@pytest.mark.asyncio
async def test_embedding_batch_retry_preserves_text_vector_alignment(monkeypatch):
    model = SimpleNamespace(
        model_name="test-model",
        aembed=AsyncMock(
            side_effect=[
                [[1.0]],
                [[1.0], [2.0]],
                [[3.0], [4.0]],
            ]
        ),
    )
    monkeypatch.setattr(
        model_manager, "get_embedding_model", AsyncMock(return_value=model)
    )
    monkeypatch.setattr(embedding, "EMBEDDING_BATCH_SIZE", 2)
    monkeypatch.setattr(embedding, "EMBEDDING_RETRY_DELAY", 0)

    result = await embedding.generate_embeddings(["first", "second", "third", "fourth"])

    assert result == [[1.0], [2.0], [3.0], [4.0]]
    assert [call.args[0] for call in model.aembed.await_args_list] == [
        ["first", "second"],
        ["first", "second"],
        ["third", "fourth"],
    ]
