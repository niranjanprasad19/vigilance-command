export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_entries: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          classification: Database["public"]["Enums"]["classification"]
          client_request_id: string | null
          hash: string
          kind: string
          mode: Database["public"]["Enums"]["ops_mode"]
          payload: Json
          prev_hash: string
          seq: number
          ts: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          classification?: Database["public"]["Enums"]["classification"]
          client_request_id?: string | null
          hash: string
          kind: string
          mode?: Database["public"]["Enums"]["ops_mode"]
          payload?: Json
          prev_hash: string
          seq?: never
          ts?: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          classification?: Database["public"]["Enums"]["classification"]
          client_request_id?: string | null
          hash?: string
          kind?: string
          mode?: Database["public"]["Enums"]["ops_mode"]
          payload?: Json
          prev_hash?: string
          seq?: never
          ts?: string
        }
        Relationships: []
      }
      audit_roots: {
        Row: {
          entry_count: number
          id: string
          key_id: string
          prev_root_hash: string | null
          root_hash: string
          signature: string
          signed_at: string
          window_end_seq: number
          window_start_seq: number
        }
        Insert: {
          entry_count: number
          id?: string
          key_id: string
          prev_root_hash?: string | null
          root_hash: string
          signature: string
          signed_at?: string
          window_end_seq: number
          window_start_seq: number
        }
        Update: {
          entry_count?: number
          id?: string
          key_id?: string
          prev_root_hash?: string | null
          root_hash?: string
          signature?: string
          signed_at?: string
          window_end_seq?: number
          window_start_seq?: number
        }
        Relationships: []
      }
      decision_approvals: {
        Row: {
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          decision_id: string
          id: string
          modified_action: string | null
          outcome: string
          user_id: string
        }
        Insert: {
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          decision_id: string
          id?: string
          modified_action?: string | null
          outcome: string
          user_id: string
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          decision_id?: string
          id?: string
          modified_action?: string | null
          outcome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_approvals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          action: string
          auto_execute: boolean
          classification: Database["public"]["Enums"]["classification"]
          confidence: number | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_label: string | null
          event_id: string
          fusion_step: string | null
          id: string
          level: number
          mode: Database["public"]["Enums"]["ops_mode"]
          model_version: string
          modified_action: string | null
          observed_at: string | null
          policy_version: number | null
          rationale: string
          resolved_at: string | null
          score: number | null
          sensor_band: string | null
          severity: string | null
          source_sensor: string | null
          status: string
        }
        Insert: {
          action: string
          auto_execute?: boolean
          classification?: Database["public"]["Enums"]["classification"]
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_label?: string | null
          event_id: string
          fusion_step?: string | null
          id?: string
          level: number
          mode?: Database["public"]["Enums"]["ops_mode"]
          model_version?: string
          modified_action?: string | null
          observed_at?: string | null
          policy_version?: number | null
          rationale: string
          resolved_at?: string | null
          score?: number | null
          sensor_band?: string | null
          severity?: string | null
          source_sensor?: string | null
          status?: string
        }
        Update: {
          action?: string
          auto_execute?: boolean
          classification?: Database["public"]["Enums"]["classification"]
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_label?: string | null
          event_id?: string
          fusion_step?: string | null
          id?: string
          level?: number
          mode?: Database["public"]["Enums"]["ops_mode"]
          model_version?: string
          modified_action?: string | null
          observed_at?: string | null
          policy_version?: number | null
          rationale?: string
          resolved_at?: string | null
          score?: number | null
          sensor_band?: string | null
          severity?: string | null
          source_sensor?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          callsign: string
          created_at: string
          id: string
          unit: string | null
        }
        Insert: {
          callsign: string
          created_at?: string
          id: string
          unit?: string | null
        }
        Update: {
          callsign?: string
          created_at?: string
          id?: string
          unit?: string | null
        }
        Relationships: []
      }
      roe_policies: {
        Row: {
          active: boolean
          approved_by: string | null
          auto_execute_ceiling: number
          created_at: string
          created_by: string | null
          dual_confirm_from: number
          id: string
          name: string
          thresholds: Json
          version: number
        }
        Insert: {
          active?: boolean
          approved_by?: string | null
          auto_execute_ceiling?: number
          created_at?: string
          created_by?: string | null
          dual_confirm_from?: number
          id?: string
          name: string
          thresholds: Json
          version: number
        }
        Update: {
          active?: boolean
          approved_by?: string | null
          auto_execute_ceiling?: number
          created_at?: string
          created_by?: string | null
          dual_confirm_from?: number
          id?: string
          name?: string
          thresholds?: Json
          version?: number
        }
        Relationships: []
      }
      tasking_orders: {
        Row: {
          asset: string
          classification: Database["public"]["Enums"]["classification"]
          client_request_id: string | null
          created_at: string
          decision_id: string | null
          directive: string
          id: string
          issued_by: string | null
          mode: Database["public"]["Enums"]["ops_mode"]
          sensor_band: string | null
          source: string
          source_sensor: string | null
          status: string
          trigger_label: string | null
          trigger_level: number | null
        }
        Insert: {
          asset: string
          classification?: Database["public"]["Enums"]["classification"]
          client_request_id?: string | null
          created_at?: string
          decision_id?: string | null
          directive: string
          id?: string
          issued_by?: string | null
          mode?: Database["public"]["Enums"]["ops_mode"]
          sensor_band?: string | null
          source: string
          source_sensor?: string | null
          status?: string
          trigger_label?: string | null
          trigger_level?: number | null
        }
        Update: {
          asset?: string
          classification?: Database["public"]["Enums"]["classification"]
          client_request_id?: string | null
          created_at?: string
          decision_id?: string | null
          directive?: string
          id?: string
          issued_by?: string | null
          mode?: Database["public"]["Enums"]["ops_mode"]
          sensor_band?: string | null
          source?: string
          source_sensor?: string | null
          status?: string
          trigger_label?: string | null
          trigger_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tasking_orders_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_audit: {
        Args: {
          _classification?: Database["public"]["Enums"]["classification"]
          _idempotency_key?: string
          _kind: string
          _mode?: Database["public"]["Enums"]["ops_mode"]
          _payload?: Json
        }
        Returns: {
          hash: string
          seq: number
          ts: string
        }[]
      }
      can_act: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      highest_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      verify_audit_chain: {
        Args: never
        Returns: {
          broken_at: number
          ok: boolean
          total: number
        }[]
      }
    }
    Enums: {
      app_role: "operator" | "supervisor" | "commander" | "auditor"
      classification: "UNCLASSIFIED" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET"
      ops_mode: "TRAINING" | "LIVE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["operator", "supervisor", "commander", "auditor"],
      classification: ["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET"],
      ops_mode: ["TRAINING", "LIVE"],
    },
  },
} as const
