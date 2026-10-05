// Données du bureau partagées entre l'interface et l'agent : clients (prospects) et rendez-vous.
import { Appointment, ClientLead } from '../types';
import { mockClientLeads } from '../data/mockData';
import { createStore } from './createStore';

export const clientsStore = createStore<ClientLead[]>('alwassit777.clients.v1', mockClientLeads);
export const appointmentsStore = createStore<Appointment[]>('alwassit777.appointments.v1', []);

export const newAppointmentId = () => `rdv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
