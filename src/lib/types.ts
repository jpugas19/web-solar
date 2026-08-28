export interface Reading {
  ts: string;
  source: string;
  field_id: string;
  title: string | null;
  unit: string | null;
  val: number | null;
  val_text: string | null;
}

export interface LatestReading extends Reading {}

export interface AlertState {
  channel: string;
  severity: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
}

export interface FlattenedReading {
  field_id: string;
  title: string;
  unit: string;
  val: number | string;
}
