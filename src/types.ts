export type Role = 'super_admin' | 'analyst' | 'client';

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  client_id: number | null;
  client_name?: string;
  status: 'active' | 'inactive';
  is_temp_password: number;
  last_login?: string;
  created_at: string;
}

export interface AccessLog {
  id: number;
  user_id: number;
  action: string;
  ip: string;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  code?: string;
  created_at: string;
}

export interface ClientModule {
  client_id: number;
  module_name: string;
  is_active: number;
}

export interface TechnicalAsset {
  id: number;
  client_id: number;
  type: string;
  data: any;
}

export interface ClientContact {
  id: number;
  client_id: number;
  name: string;
  phone: string;
  email: string;
  position: string;
}

export interface ClientConfig {
  modules: ClientModule[];
  assets: TechnicalAsset[];
  details: any;
  contacts: ClientContact[];
}

export interface Alert {
  id: number;
  client_id: number;
  client_alert_id: number;
  client_name: string;
  category: string;
  title: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved' | 'false_positive';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  created_at: string;
}

export interface Comment {
  id: number;
  alert_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}
