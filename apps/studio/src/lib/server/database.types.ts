export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      trace_runs: {
        Row: {
          id: string;
          app: string;
          agent: string;
          capture_mode: string;
          started_at: string;
          ended_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          app: string;
          agent: string;
          capture_mode: string;
          started_at: string;
          ended_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          app?: string;
          agent?: string;
          capture_mode?: string;
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trace_events: {
        Row: {
          id: string;
          run_id: string;
          sequence: number;
          event_type: string;
          event_timestamp: string;
          actor: Json;
          summary: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          run_id: string;
          sequence: number;
          event_type: string;
          event_timestamp: string;
          actor: Json;
          summary: string;
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          sequence?: number;
          event_type?: string;
          event_timestamp?: string;
          actor?: Json;
          summary?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trace_events_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "trace_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      trace_findings: {
        Row: {
          id: string;
          run_id: string;
          finding_type: string;
          severity: string;
          title: string;
          summary: string;
          evidence_event_ids: string[];
          recommendation: string;
          created_at: string;
        };
        Insert: {
          id: string;
          run_id: string;
          finding_type: string;
          severity: string;
          title: string;
          summary: string;
          evidence_event_ids?: string[];
          recommendation: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          finding_type?: string;
          severity?: string;
          title?: string;
          summary?: string;
          evidence_event_ids?: string[];
          recommendation?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trace_findings_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "trace_runs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
