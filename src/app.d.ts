import type { KVNamespace, D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				SESSIONS: KVNamespace;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
				CRON_SECRET: string;
			};
		}
		interface Locals {
			user?: { email: string; name: string; picture: string };
		}
		interface PageData {
			user?: { email: string; name: string; picture: string } | null;
		}
	}
}

export {};
