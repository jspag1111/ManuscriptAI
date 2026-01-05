# Prepare for production (ChatKit Python)

Source: `https://openai.github.io/chatkit-python/guides/prepare-your-app-for-production/`

## React logging hooks (from docs)

```jsx
const { control } = useChatKit({
  onLog(info) {
    console.log(info);
  },
  onError(error) {
    console.error(error);
  }
});
```

## Web component logging (from docs)

```js
const chatkit = document.querySelector('openai-chatkit');
chatkit.addEventListener('log', (event) => {
  console.log(event.detail);
});
chatkit.addEventListener('error', (event) => {
  console.error(event.detail);
});
```

## Domain keys (from docs)

```js
const options = {
  api: {
    url: "https://YOUR_BACKEND_URL/chatkit",
    domainKey: "dk_..."
  }
}
```

## Authentication example (from docs)

```python
from fastapi import FastAPI, Request, Depends, HTTPException

def get_user(request: Request):
    if not request.headers.get('Authorization'):
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Your auth logic here
    return User(id="123", name="Alice")

app = FastAPI()

@app.post("/chatkit")
async def chatkit_endpoint(request: Request, user: User = Depends(get_user)):
    return StreamingResult(chatkit_server.respond(request=request, context=user))
```
