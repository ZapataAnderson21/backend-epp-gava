export function notificationPermission(type: string): string {
  if (type.startsWith('purchase_order_')) return 'orders.view';
  if (type.startsWith('request_')) return 'requests.view';
  if (type.startsWith('emergency_')) return 'emergencies.view';
  if (type.startsWith('project_')) return 'projects.view';
  if (type.startsWith('task_') || type.startsWith('subtask_'))
    return 'progress.view';
  return 'dashboard.view';
}

export function notificationRecipientPermission(type: string): string {
  if (type === 'purchase_order_pending') return 'orders.authorize';
  if (type === 'request_created') return 'requests.review';
  if (type === 'emergency_created') return 'emergencies.manage';
  return notificationPermission(type);
}
