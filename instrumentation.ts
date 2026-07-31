export async function register() {
  // Challenge updates are triggered through /api/cron/update-challenges by an
  // external scheduler. Long-lived timers here keep builds alive and do not
  // behave reliably in serverless runtimes.
}
