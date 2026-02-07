/**
 * Guest PIN Namespace Utilities
 * Prevents PIN collisions between different project owners by
 * internally prefixing PINs with the owner's user ID.
 */

/**
 * Namespace a guest PIN with the owner's user ID.
 * Stored format: "{ownerId}_{pin}"
 */
export function namespacePIN(ownerId: string, pin: string): string {
  return `${ownerId}_${pin}`;
}

/**
 * Strip the owner prefix from a namespaced PIN.
 * Returns the user-facing PIN string.
 */
export function stripPINPrefix(namespacedPin: string): string {
  const underscoreIndex = namespacedPin.indexOf('_');
  if (underscoreIndex === -1) return namespacedPin; // Legacy un-namespaced PIN
  return namespacedPin.substring(underscoreIndex + 1);
}
