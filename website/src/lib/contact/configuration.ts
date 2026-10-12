export function accessAcknowledgementsEnabled(): boolean {
  return process.env.ACCESS_REQUEST_ACK_ENABLED === "true";
}
