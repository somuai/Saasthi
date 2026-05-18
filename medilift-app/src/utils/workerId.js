/** Django user id used for sync worker scoping (asha_worker_server_id). */
export function getWorkerServerId(authState) {
  const user = authState?.user;
  const worker = authState?.workerData;
  if (user?.id != null) return String(user.id);
  if (worker?.serverId && worker.serverId !== "local-asha-worker") return String(worker.serverId);
  return null;
}
