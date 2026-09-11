// Navigation must not run until the latest unfinished state is durably saved.
export async function persistBeforeSessionExit(save, leave) {
  await save();
  leave();
}
