import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

// Env validation
const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
});
const env = EnvSchema.parse(process.env);

const effectiveApiKey = env.OPENAI_API_KEY;
const effectiveBaseUrl = env.OPENAI_BASE_URL;

const app = Fastify({
  logger: true,
  genReqId: (req) =>
    (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
});

await app.register(cors, { origin: true, credentials: false });
await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });

// Types validated inline at route; dedicated ModelsResponse type removed to avoid unused variable.

// Models config (loaded from JSON with validation)
const ModelItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
const ModelsSchema = z.array(ModelItemSchema);
type ModelItem = z.infer<typeof ModelItemSchema>;

const MODELS_FILE = path.resolve(process.cwd(), "server", "models.json");
let availableModels: ReadonlyArray<ModelItem> = Object.freeze([]);
try {
  const raw = fs.readFileSync(MODELS_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  availableModels = Object.freeze(ModelsSchema.parse(parsed));
} catch (err) {
  // Log using Fastify logger and keep a minimal fallback
  app.log.error({ err }, "Failed to load models.json");
}

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
  if (availableModels.length === 0) {
    // Provide a clear signal but keep endpoint functional
    app.log.warn("No models loaded from models.json; returning empty list");
  }
  reply.send(availableModels);
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

// NDJSON streaming completion route
app.post("/api/complete/stream", async (req, reply) => {
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

  if (!effectiveApiKey) {
    return reply
      .code(500)
      .send({ error: "Missing OPENAI_API_KEY on server", request_id: req.id });
  }

  const client = new OpenAI({
    apiKey: effectiveApiKey,
    baseURL: effectiveBaseUrl,
  });

  // Handle force_prefix behavior for the streaming generation
  const messages = [...body.messages];
  let force_prefix_echo: string | undefined;
  if (
    body.force_prefix &&
    (body.continuation_mode ?? "assistant-prefix") === "assistant-prefix"
  ) {
    messages.push({ role: "assistant", content: body.force_prefix });
    force_prefix_echo = body.force_prefix;
  }

  // Prepare NDJSON response (after validation)
  reply.raw.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("x-request-id", req.id);

  const write = (obj: unknown) => {
    try {
      reply.raw.write(JSON.stringify(obj) + "\n");
    } catch (err) {
      req.log.error({ err }, "Write failed");
    }
  };

  const end = () => {
    try {
      reply.raw.end();
    } catch {
      // noop
    }
  };

  try {
    // Type-safe parsing for logprob deltas coming from the SDK helper events
    const LogprobAltSchema = z.object({ token: z.string(), logprob: z.number() });
    const LogprobDeltaSchema = z.object({
      token: z.string().optional().default(""),
      logprob: z.number().optional().default(Number.NEGATIVE_INFINITY),
      top_logprobs: z.array(LogprobAltSchema).optional().default([]),
    });

    let aggregated = "";
    const tokens: Array<{
      index: number;
      token: string;
      logprob: number;
      prob: number;
      top_logprobs: Array<{ token: string; logprob: number; prob: number }>;
    }> = [];
    let tokenIndex = 0;

    // Use SDK streaming helper which emits granular events, including logprobs
    const stream = await client.chat.completions.stream({
      model: body.model,
      messages,
      temperature: body.temperature,
      top_p: body.top_p,
      presence_penalty: body.presence_penalty,
      frequency_penalty: body.frequency_penalty,
      max_tokens: Math.max(1, Math.min(256, body.max_tokens)),
      logprobs: true,
      top_logprobs: Math.max(1, Math.min(10, body.top_logprobs)),
    });

    // Text content deltas
    stream.on("content.delta", ({ delta }: { delta: string }) => {
      if (delta) {
        aggregated += delta;
        write({ type: "delta", delta });
      }
    });

    // Token logprobs deltas (array per event)
    stream.on(
      "logprobs.content.delta",
      ({ content }: { content: Array<{ token: string; logprob: number; top_logprobs?: Array<{ token: string; logprob: number }> }> }) => {
        for (const item of content) {
          const tokenOut = {
            index: tokenIndex++,
            token: item.token ?? "",
            logprob: item.logprob ?? Number.NEGATIVE_INFINITY,
            prob: Math.exp(item.logprob ?? Number.NEGATIVE_INFINITY),
            top_logprobs: (item.top_logprobs ?? []).map((alt) => ({
              token: alt.token ?? "",
              logprob: alt.logprob ?? Number.NEGATIVE_INFINITY,
              prob: Math.exp(alt.logprob ?? Number.NEGATIVE_INFINITY),
            })),
          };
          tokens.push(tokenOut);
          write({ type: "logprobs", delta: tokenOut });
        }
      }
    );

    stream.on("end", () => {
      const latency = Date.now() - start;
      // We may not have usage here; keep zeros for consistency with prior fallback
      write({
        type: "done",
        completion: {
          text: aggregated,
          tokens,
          finish_reason: "stop",
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: body.model,
          latency,
          force_prefix_echo,
        },
      });
      end();
    });

    stream.on("error", (err: unknown) => {
      req.log.error({ err }, "Stream error");
      write({ type: "done", error: (err as Error).message });
      end();
    });
    // Keep the route alive until the stream finishes
    await stream.done();
  } catch (err) {
    req.log.error({ err }, "Stream error");
    write({ type: "done", error: (err as Error).message });
    end();
  }
});

app.listen({ host: HOST, port: PORT }).then(() => {
  app.log.info(`API listening on http://${HOST}:${PORT}`);
});
