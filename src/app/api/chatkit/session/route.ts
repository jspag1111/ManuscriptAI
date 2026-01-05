import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getEnv = (name: string) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = getEnv('OPENAI_API_KEY');
    const workflowId = getEnv('OPENAI_CHATKIT_WORKFLOW_ID');
    if (!apiKey || !workflowId) {
      return NextResponse.json(
        {
          error:
            'OpenAI ChatKit is not configured. Set OPENAI_API_KEY and OPENAI_CHATKIT_WORKFLOW_ID.',
        },
        { status: 500 }
      );
    }

    await request.json().catch(() => null);

    const response = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'chatkit_beta=v1',
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: userId,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.error || response.statusText || 'ChatKit session failed.';
      return NextResponse.json({ error: message }, { status: response.status });
    }

    if (!data?.client_secret) {
      return NextResponse.json({ error: 'ChatKit session missing client_secret.' }, { status: 500 });
    }

    return NextResponse.json({ client_secret: data.client_secret });
  } catch (error) {
    console.error('ChatKit session error', error);
    const message = error instanceof Error ? error.message : 'ChatKit session failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
