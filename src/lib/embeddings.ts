import { embedViaOffscreen } from "./offscreen-bridge";

export const embeddingsEnabled = () => true; // local only
export const embedText  = (t: string) => embedViaOffscreen(t);
export const embedQuery = (q: string) => embedViaOffscreen(q);
