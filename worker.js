import { onRequestPost, onRequestGet } from './functions/api/join.js';

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/join' || pathname === '/api/join/') {
      return request.method === 'POST' ? onRequestPost({ request, env }) : onRequestGet();
    }
    return env.ASSETS.fetch(request);
  }
};
