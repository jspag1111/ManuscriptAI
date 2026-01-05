# Threads and items (ChatKit Python)

Source: `https://openai.github.io/chatkit-python/concepts/threads/`

## Thread metadata

A thread holds a conversation. Typical metadata fields include:
- id
- title
- user_id
- created_at
- updated_at
- last_item_at
- is_active

## Thread items

A thread item represents a message or event in the thread. Typical fields include:
- id
- thread_id
- role (for example: user, assistant, system, tool)
- content
- created_at
- updated_at

Use the store methods to list, add, update, and delete both threads and items.
