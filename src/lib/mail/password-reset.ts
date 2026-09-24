import { createServerFn } from "@tanstack/react-start";

const GENERIC = "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder. The link expires in one hour.";

export const getPasswordResetNotice = createServerFn({ method: "GET" }).handler(async () => {
  const { developerNotice } = await import("./deliver.server");
  return { notice: developerNotice() };
});

export const checkResetToken = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const token = typeof input === "object" && input && "token" in input ? String((input as { token: unknown }).token) : "";
    return { token: token.slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const { auth } = await import("@/lib/auth/server");
    const { ensurePasswordResetDelivery, inspectResetToken } = await import("./deliver.server");
    await ensurePasswordResetDelivery(auth);
    const status = await inspectResetToken(auth, data.token);
    return { status };
  });

export { GENERIC as RESET_REQUEST_MESSAGE };
