export type Role = 'super_admin' | 'admin' | 'client';

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
  alert_id?: number;
  takedown_id?: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

export interface Takedown {
  id: number;
  alert_id: number | null;
  client_id: number;
  client_name?: string;
  title: string;
  description: string;
  target_url: string;
  scenario: string;
  status: 'validation' | 'evaluation' | 'request' | 'follow_up' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  evidence?: string; // JSON string
  platform_contacted?: string;
  request_date?: string;
  resolution_date?: string;
  created_at: string;
  updated_at: string;
  comments?: Comment[];
}

export interface Report {
  id: number;
  client_id: number | null;
  sector_id: number | null;
  client_name?: string;
  sector_name?: string;
  title: string;
  description: string;
  category: string;
  subtype?: string;
  type: 'public' | 'private';
  file_url: string;
  editable_url?: string;
  created_by: string;
  created_at: string;
  linked_alerts?: { id: number, title: string, severity: string }[];
}

export interface Sector {
  id: number;
  name: string;
  created_at: string;
}
