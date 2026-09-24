import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type CalendarCapability = {
  connected: false;
  lastSync: null;
  calendarWriteAvailable: false;
};

export const getCalendarCapability = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async (): Promise<CalendarCapability> => {
    return {
      connected: false,
      lastSync: null,
      calendarWriteAvailable: false,
    };
  });
