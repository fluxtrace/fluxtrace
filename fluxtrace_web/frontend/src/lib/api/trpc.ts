import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@backend/controllers/routers";

export const trpc = createTRPCReact<AppRouter>();
