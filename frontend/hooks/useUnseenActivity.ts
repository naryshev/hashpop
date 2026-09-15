"use client";

/**
 * Compatibility re-export. Deal-update seen-state now lives with the quieter
 * notification bell (`lib/dealNotifications`). Opening Activity still clears
 * the bell; chat unread is owned by the messages dock.
 */
export { markDealUpdatesSeen as markActivitySeen } from "../lib/dealNotifications";
