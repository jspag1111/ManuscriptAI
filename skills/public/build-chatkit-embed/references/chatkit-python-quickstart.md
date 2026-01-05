# ChatKit Python quickstart

Source: `https://openai.github.io/chatkit-python/quickstart/`

## Install (from docs)

```bash
npm install @openai/chatkit-react
```

```bash
pip install openai-chatkit
```

## Load ChatKit.js (from docs)

```html
<script
src="https://cdn.jsdelivr.net/npm/@openai/chatkit@latest/dist/chatkit.js"
async
></script>
```

## React embed (from docs)

```jsx
import { useChatKit, ChatKit } from "@openai/chatkit-react";

export function MyChat({ clientToken }) {
  const { control } = useChatKit({
    token: clientToken
  });

  return (
    <ChatKit
      control={control}
      className="h-[600px] w-[320px]"
    />
  );
}
```

## Minimal server (from docs)

```python
from chatkit import ChatKitServer

async def respond(message):
  return "Hello World!"

chatkit_server = ChatKitServer(respond)

if __name__ == "__main__":
  chatkit_server.run(host="0.0.0.0", port=80)
```

## In-memory store example (from docs)

```python
from chatkit import ThreadItem, ThreadMetadata, InMemoryChatKitStore

class MyChatKitStore(InMemoryChatKitStore):
    def __init__(self):
        self.threads = {}   # the thread_id to a ThreadMetadata
        self.items = {}     # the thread_id to list of ThreadItems

    def list_threads(self, user_id: str) -> list[ThreadMetadata]:
        # implement list threads
        pass

    def add_thread(self, thread: ThreadMetadata):
        self.threads[thread.id] = thread

    def get_thread(self, thread_id: str) -> ThreadMetadata:
        return self.threads.get(thread_id)

    def update_thread(self, thread: ThreadMetadata):
        if thread.id in self.threads:
            self.threads[thread.id] = thread

    def delete_thread(self, thread_id: str):
        self.threads.pop(thread_id, None)

    def list_items(self, thread_id: str) -> list[ThreadItem]:
        # implement list items in thread
        pass

    def add_item(self, item: ThreadItem):
        if item.thread_id not in self.items:
            self.items[item.thread_id] = []
        self.items[item.thread_id].append(item)

    def get_item(self, thread_id: str, item_id: str) -> ThreadItem:
        for item in self.items.get(thread_id, []):
            if item.id == item_id:
                return item
        return None

    def update_item(self, item: ThreadItem):
        items = self.items.get(item.thread_id, [])
        for i, existing_item in enumerate(items):
            if existing_item.id == item.id:
                items[i] = item
                return

    def delete_item(self, thread_id: str, item_id: str):
        items = self.items.get(thread_id, [])
        self.items[thread_id] = [
            item for item in items if item.id != item_id
        ]
```
