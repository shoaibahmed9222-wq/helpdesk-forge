export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enforceProduction } = await import("./instrumentation-node");
    enforceProduction();
  }
}
