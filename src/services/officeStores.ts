// Données du bureau partagées entre l'interface et les agents : clients (prospects) et rendez-vous.
// En ligne (Firebase) quand il est configuré, sinon sur l'appareil — voir src/agent/stores.ts.
export { appointmentsStore, clientsStore } from '../agent/stores';

export const newAppointmentId = () => `rdv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
