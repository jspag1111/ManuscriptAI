# ChatKit JS (React + Web Component)

Use this when embedding the managed ChatKit client in a frontend app.

Source: `https://openai.github.io/chatkit-js/`

## Quickstart examples (from docs)

```jsx
function MyChat({ clientToken }) {
  const { control } = useChatKit({
    api: { url, domainKey }
  });

  return (
    <ChatKit
      control={control}
      className="h-[600px] w-[320px]"
    />
  );
}

function InitChatkit({ clientToken }) {
  const chatkit = document.createElement('openai-chatkit');
  chatkit.setOptions({ api: { url, domainKey } });

  chatkit.classList.add('h-[600px]', 'w-[320px]');

  document.body.appendChild(chatkit);
}
```
