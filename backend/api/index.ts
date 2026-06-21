// Vercel serverless entry: expose the Express app as the function handler.
// All requests are rewritten to this function (see vercel.json); Express does
// the internal routing (/api/health, /api/scan/*).
import { createApp } from "../src/app";

const app = createApp();

export default app;
