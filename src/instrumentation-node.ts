import { assertProductionReady } from "@/lib/production-config";

export function enforceProduction() {
  try {
    assertProductionReady();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
