import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || process.env.BACKEND_URL || 'http://pintflow_backend:8080/api/v1';
const API_KEY = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY || '';

async function handleProxy(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const pathList = params.path || [];
  const path = pathList.join('/');
  const search = req.nextUrl.search;

  let backendBase = BACKEND_URL;
  if (!backendBase.endsWith('/api/v1')) {
    backendBase = `${backendBase.replace(/\/$/, '')}/api/v1`;
  }

  const targetUrl = `${backendBase}/${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });

  // Inject backend API_KEY on server side if configured
  if (API_KEY && !headers.has('x-api-key')) {
    headers.set('X-API-Key', API_KEY);
  }

  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: body,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to proxy request to backend: ${err.message}` }, { status: 502 });
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const OPTIONS = handleProxy;
