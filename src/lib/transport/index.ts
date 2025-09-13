import { RestTransport } from "@/lib/transport/rest";
import { StreamTransport } from "@/lib/transport/stream";
import type { Transport } from "@/types/transport";

const USE_STREAMING = (import.meta.env.VITE_STREAMING ?? "false").toString() === "true";

export const transport: Transport = USE_STREAMING
  ? new StreamTransport()
  : new RestTransport();

