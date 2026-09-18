# Tests

Run the default suite with `uv run --frozen pytest tests/`.

## Real SurrealDB embedding checks

`test_embedding_transactions.py` verifies rollback after an insert failure,
successful index replacement, repeatability, and isolation between sources.
It uses the actual application schema and command with deterministic model
responses. Without `OPEN_NOTEBOOK_TEST_SURREAL_URL`, these tests are skipped.

Start a disposable local server, run the checks, and stop it:

```bash
docker run --detach --rm --name open-notebook-embedding-test \
  --publish 127.0.0.1:18001:8000 surrealdb/surrealdb:v2 \
  start --unauthenticated --bind 0.0.0.0:8000 memory
OPEN_NOTEBOOK_TEST_SURREAL_URL="ws://127.0.0.1:18001/rpc" \
  uv run --frozen pytest tests/test_embedding_transactions.py -q
docker stop open-notebook-embedding-test
```

Each test creates a unique database in the `embedding_test` namespace.
The container stores data in memory and removes itself when stopped; no
application data directories or credentials are used.
