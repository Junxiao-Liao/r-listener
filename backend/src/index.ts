import { createApp } from './app';
import type { BackendEnv } from './app.type';

const app = createApp();

export default {
	fetch(request: Request, env: BackendEnv['Bindings'], ctx: ExecutionContext) {
		const url = new URL(request.url);
		if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
			return app.fetch(request, env, ctx);
		}
		return env.ASSETS.fetch(request);
	}
} satisfies ExportedHandler<BackendEnv['Bindings']>;
