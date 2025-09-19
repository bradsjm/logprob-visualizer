import { StreamTransport } from "@/lib/transport/stream";
import type { Transport } from "@/types/transport";

export const transport: Transport = new StreamTransport();
