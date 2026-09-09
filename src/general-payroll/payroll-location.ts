export const SERVICES_LOCATION_NAME = 'Servicios';

export function payrollLocationName(location: {
  locationType?: string;
  project: { name: string } | null;
}) {
  return location.locationType === 'services'
    ? SERVICES_LOCATION_NAME
    : (location.project?.name ?? 'Proyecto no disponible');
}
