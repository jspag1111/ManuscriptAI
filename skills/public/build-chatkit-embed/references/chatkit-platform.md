# ChatKit managed embed (OpenAI platform)

Use this when embedding ChatKit with an OpenAI-hosted backend (Agent Builder workflows).

Source: `https://platform.openai.com/docs/guides/chatkit`

## Create a ChatKit session on your server (from docs)

```python
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import os

app = FastAPI()
openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

@app.post("/api/chatkit/session")
def create_chatkit_session():
    session = openai.chatkit.sessions.create({
      # ...
    })
    return { client_secret: session.client_secret }
```

## Create a session via REST (from docs)

```typescript
export default async function getChatKitSessionToken(
deviceId: string
): Promise<string> {
const response = await fetch("https://api.openai.com/v1/chatkit/sessions", {
    method: "POST",
    headers: {
    "Content-Type": "application/json",
    "OpenAI-Beta": "chatkit_beta=v1",
    Authorization: "Bearer " + process.env.VITE_OPENAI_API_SECRET_KEY,
    },
    body: JSON.stringify({
    workflow: { id: "wf_68df4b13b3588190a09d19288d4610ec0df388c3983f58d1" },
    user: deviceId,
    }),
});
const { client_secret } = await response.json();

return client_secret;
}
```

## Load ChatKit.js (from docs)

```html
<script
src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
async
></script>
```

## React embed (from docs)

```react
import { ChatKit, useChatKit } from '@openai/chatkit-react';

export function MyChat() {
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        if (existing) {
          // implement session refresh
        }
        const res = await fetch('/api/chatkit/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const { client_secret } = await res.json();
        return client_secret;
      },
    },
  });

  return <ChatKit control={control} className="h-[600px] w-[320px]" />;
}
```

## Web component embed (from docs)

```javascript
const chatkit = document.getElementById('my-chat');
  chatkit.setOptions({
    api: {
      getClientSecret(currentClientSecret) {
        if (!currentClientSecret) {
          const res = await fetch('/api/chatkit/start', { method: 'POST' })
          const {client_secret} = await res.json();
          return client_secret
        }
        const res = await fetch('/api/chatkit/refresh', {
          method: 'POST',
          body: JSON.stringify({ currentClientSecret })
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const {client_secret} = await res.json();
        return client_secret
      }
    },
  });
```
