# Respond to user message (ChatKit Python)

Source: `https://openai.github.io/chatkit-python/guides/respond-to-user-message/`

## Request context (from docs)

```python
from dataclasses import dataclass
from starlette.requests import Request

@dataclass
class RequestContext:
    request: Request
    user: User
```

## Respond using OpenAI (from docs)

```python
from openai import OpenAI
client = OpenAI()

async def respond(message: ThreadItem, context: RequestContext):
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": message.content},
        ],
    )
    return response.choices[0].message.content
```

## Attach context to ChatKitServer (from docs)

```python
chatkit_server = ChatKitServer(
    respond=respond,
    context_cls=RequestContext,
)
```

## FastAPI endpoint (from docs)

```python
from fastapi import FastAPI, Depends
from starlette.requests import Request

@app.post("/chatkit")
async def chatkit_stream(
    request: Request,
    user: User = Depends(get_user)
):
    return StreamingResult(
        chatkit_server.respond(
            request=request,
            context=RequestContext(request=request, user=user)
        )
    )
```

## Postgres store skeleton (from docs)

```python
import psycopg
from psycopg.rows import dict_row

class PostgresChatKitStore(ChatKitStore):
    def __init__(self, connection_url: str):
        self.connection_url = connection_url

    def _get_connection(self):
        return psycopg.connect(self.connection_url, row_factory=dict_row)

    def create_schema(self):
        with self._get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS threads (
                        id UUID PRIMARY KEY,
                        title TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        created_at TIMESTAMP NOT NULL,
                        updated_at TIMESTAMP NOT NULL,
                        last_item_at TIMESTAMP NOT NULL,
                        is_active BOOLEAN NOT NULL
                    );
                    """
                )
```
