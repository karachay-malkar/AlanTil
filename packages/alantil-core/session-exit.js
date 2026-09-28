export async function completeBeforeSessionExit(beforeLeave, leave) {
  await beforeLeave();
  leave();
}

// Compatibility for older cached mobile bundles. New code uses completeBeforeSessionExit.
export const persistBeforeSessionExit = completeBeforeSessionExit;
