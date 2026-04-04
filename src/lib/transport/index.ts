import { StreamTransport } from "@/lib/transport/stream";
import type { ConnectionSettings } from "@/types/connection";
import type { Transport } from "@/types/transport";

/**
 * Creates a transport bound to the current connection settings.
 */
export function createTransport(
  settings: Readonly<ConnectionSettings>,
): Transport {
  return new StreamTransport(settings);
}
