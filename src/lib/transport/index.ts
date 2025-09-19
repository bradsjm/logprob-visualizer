import { StreamTransport } from "@/lib/transport/stream";
import type { Transport } from "@/types/transport";

/**
 * Default streaming transport instance used for client completions.
 */
export const transport: Transport = new StreamTransport();
