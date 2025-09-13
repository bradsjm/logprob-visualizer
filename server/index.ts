import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import OpenAI from "openai";

const PORT = Number(process.env.PORT ?? 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: false });
await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });

const ModelsResponse = z.object({ id: z.string(), name: z.string() }).array();

const CompleteRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
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

app.get("/api/models", async (_req, reply) => {
  // Hard-coded allowed models; adjust as needed or read from env.
  const models = [
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4o", name: "GPT-4o" },
  ];
  reply.send(models);
});

app.post("/api/complete", async (req, reply) => {
  const start = Date.now();
  const parsed = CompleteRequest.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request", issues: parsed.error.issues });
  }
  const body = parsed.data;

  // Clamp ranges explicitly (defense in depth)
  const clampedTopLogprobs = Math.max(1, Math.min(10, body.top_logprobs));
  const clampedMaxTokens = Math.max(1, Math.min(256, body.max_tokens));

  // top_k removed — not supported in this app

  // Handle force_prefix behavior
  const messages = [...body.messages];
  let force_prefix_echo: string | undefined;
  if (body.force_prefix && (body.continuation_mode ?? "assistant-prefix") === "assistant-prefix") {
    messages.push({ role: "assistant", content: body.force_prefix });
    force_prefix_echo = body.force_prefix;
  }

  if (!OPENAI_API_KEY) {
    return reply.code(500).send({ error: "Missing OPENAI_API_KEY on server" });
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

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
      return reply.code(409).send({ error: "Model response lacked token logprobs. Pick a supported model." });
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
      usage: completion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: completion.model,
      latency,
      force_prefix_echo,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "OpenAI error");
    return reply.code(502).send({ error: "Upstream OpenAI error", details: (err as Error).message });
  }
});

app.listen({ host: "0.0.0.0", port: PORT }).then(() => {
  app.log.info(`API listening on http://localhost:${PORT}`);
});
