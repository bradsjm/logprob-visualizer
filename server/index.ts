import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import OpenAI from "openai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 8787);

// Env validation
const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  MOCK_MODE: z.string().optional(),
});
const env = EnvSchema.parse(process.env);

const resolveBoolean = (v: string | undefined): boolean =>
  typeof v === "string" && ["1", "true", "yes", "on"].includes(v.toLowerCase());

const effectiveApiKey = env.OPENAI_API_KEY;
const effectiveBaseUrl = env.OPENAI_BASE_URL;
const MOCK_MODE = resolveBoolean(env.MOCK_MODE);

const app = Fastify({
  logger: true,
  genReqId: (req) =>
    (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
});

await app.register(cors, { origin: true, credentials: false });
await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });

// Types validated inline at route; dedicated ModelsResponse type removed to avoid unused variable.

const CompleteRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
  model: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  top_p: z.number().min(0).max(1).default(1),
  // top_k removed
  presence_penalty: z.number().min(-2).max(2).default(0),
  frequency_penalty: z.number().min(-2).max(2).default(0),
  max_tokens: z.number().int().min(1).max(256).default(128),
  top_logprobs: z.number().int().min(1).max(10).default(5),
  force_prefix: z.string().optional(),
  continuation_mode: z.enum(["assistant-prefix", "hint"]).optional(),
});

// Attach x-request-id header on every response
app.addHook("preHandler", async (req, reply) => {
  reply.header("x-request-id", req.id);
});

// Health endpoint
app.get("/api/health", async (req, reply) => {
  // Read version from package.json without relying on TS resolveJsonModule
  let version = "unknown";
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version?: string };
    version = pkg.version ?? version;
  } catch {
    // noop
  }
  return reply.send({
    status: "ok",
    uptime: process.uptime(),
    version,
    request_id: req.id,
  });
});

app.get("/api/models", async (_req, reply) => {
  // Hard-coded allowed models; adjust as needed or read from env.
  const models = [
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "gpt-4.1-nano-2025-04-14", name: "GPT-4.1 Nano" },
  ];
  reply.send(models);
});

app.post("/api/complete", async (req, reply) => {
  const start = Date.now();
  const parsed = CompleteRequest.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({
      error: "Invalid request",
      issues: parsed.error.issues,
      request_id: req.id,
    });
  }
  const body = parsed.data;

  // Clamp ranges explicitly (defense in depth)
  const clampedTopLogprobs = Math.max(1, Math.min(10, body.top_logprobs));
  const clampedMaxTokens = Math.max(1, Math.min(256, body.max_tokens));

  // Handle force_prefix behavior
  const messages = [...body.messages];
  let force_prefix_echo: string | undefined;
  if (
    body.force_prefix &&
    (body.continuation_mode ?? "assistant-prefix") === "assistant-prefix"
  ) {
    messages.push({ role: "assistant", content: body.force_prefix });
    force_prefix_echo = body.force_prefix;
  }

  // Support mock mode
  if (MOCK_MODE) {
    const mockText = "Hello from mock mode.";
    const mockTokens = [
      { token: "Hello", logprob: Math.log(0.9) },
      { token: " ", logprob: Math.log(0.99) },
      { token: "from", logprob: Math.log(0.8) },
      { token: " ", logprob: Math.log(0.99) },
      { token: "mock", logprob: Math.log(0.85) },
      { token: " ", logprob: Math.log(0.99) },
      { token: "mode", logprob: Math.log(0.88) },
      { token: ".", logprob: Math.log(0.95) },
    ].map((t, i) => ({
      index: i,
      token: t.token,
      logprob: t.logprob,
      prob: Math.exp(t.logprob),
      top_logprobs: [
        { token: t.token, logprob: t.logprob, prob: Math.exp(t.logprob) },
        { token: t.token.toUpperCase(), logprob: Math.log(0.05), prob: 0.05 },
      ],
    }));
    const latency = Date.now() - start;
    return reply.send({
      text: mockText,
      tokens: mockTokens,
      finish_reason: "stop",
      usage: {
        prompt_tokens: 5,
        completion_tokens: mockTokens.length,
        total_tokens: 5 + mockTokens.length,
      },
      model: body.model,
      latency,
      force_prefix_echo: undefined,
      request_id: req.id,
    });
  }

  if (!effectiveApiKey) {
    return reply
      .code(500)
      .send({ error: "Missing OPENAI_API_KEY on server", request_id: req.id });
  }

  const client = new OpenAI({
    apiKey: effectiveApiKey,
    baseURL: effectiveBaseUrl,
  });

  try {
    const completion = await client.chat.completions.create({
      model: body.model,
      messages,
      temperature: body.temperature,
      top_p: body.top_p,
      presence_penalty: body.presence_penalty,
      frequency_penalty: body.frequency_penalty,
      max_tokens: clampedMaxTokens,
      logprobs: true,
      top_logprobs: clampedTopLogprobs,
      // top_k intentionally not sent
    });

    const choice = completion.choices[0];
    const text = choice.message.content ?? "";
    const logprobItems = choice.logprobs?.content;
    if (!logprobItems || logprobItems.length === 0) {
      return reply.code(409).send({
        error: "Model response lacked token logprobs. Pick a supported model.",
        request_id: req.id,
      });
    }

    const tokens = logprobItems.map((lp, i) => ({
      index: i,
      token: lp.token ?? "",
      logprob: lp.logprob ?? Number.NEGATIVE_INFINITY,
      prob: Math.exp(lp.logprob ?? Number.NEGATIVE_INFINITY),
      top_logprobs: (lp.top_logprobs ?? []).map((alt) => ({
        token: alt.token ?? "",
        logprob: alt.logprob ?? Number.NEGATIVE_INFINITY,
        prob: Math.exp(alt.logprob ?? Number.NEGATIVE_INFINITY),
      })),
    }));

    const latency = Date.now() - start;
    return reply.send({
      text,
      tokens,
      finish_reason: choice.finish_reason ?? "unknown",
      usage: completion.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      model: completion.model,
      latency,
      force_prefix_echo,
      request_id: req.id,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "OpenAI error");
    return reply.code(502).send({
      error: "Upstream OpenAI error",
      details: (err as Error).message,
      request_id: req.id,
    });
  }
});

app.listen({ host: "0.0.0.0", port: PORT }).then(() => {
  app.log.info(`API listening on http://localhost:${PORT}`);
});
