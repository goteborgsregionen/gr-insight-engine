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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      aggregate_insights: {
        Row: {
          analyzed_document_count: number | null
          created_at: string
          id: string
          insights: Json | null
          recommendations: string[] | null
          trend_data: Json | null
          user_id: string
        }
        Insert: {
          analyzed_document_count?: number | null
          created_at?: string
          id?: string
          insights?: Json | null
          recommendations?: string[] | null
          trend_data?: Json | null
          user_id: string
        }
        Update: {
          analyzed_document_count?: number | null
          created_at?: string
          id?: string
          insights?: Json | null
          recommendations?: string[] | null
          trend_data?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      analysis_queue: {
        Row: {
          attempts: number | null
          created_at: string
          document_id: string
          error_message: string | null
          id: string
          priority: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          document_id: string
          error_message?: string | null
          id?: string
          priority?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string
          document_id?: string
          error_message?: string | null
          id?: string
          priority?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_results: {
        Row: {
          analysis_focus: Json | null
          analysis_type: string | null
          analyzed_at: string | null
          custom_prompt: string | null
          document_id: string | null
          extracted_data: Json | null
          id: string
          is_valid: boolean | null
          keywords: string[] | null
          processing_time: number | null
          summary: string | null
        }
        Insert: {
          analysis_focus?: Json | null
          analysis_type?: string | null
          analyzed_at?: string | null
          custom_prompt?: string | null
          document_id?: string | null
          extracted_data?: Json | null
          id?: string
          is_valid?: boolean | null
          keywords?: string[] | null
          processing_time?: number | null
          summary?: string | null
        }
        Update: {
          analysis_focus?: Json | null
          analysis_type?: string | null
          analyzed_at?: string | null
          custom_prompt?: string | null
          document_id?: string | null
          extracted_data?: Json | null
          id?: string
          is_valid?: boolean | null
          keywords?: string[] | null
          processing_time?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_sessions: {
        Row: {
          analysis_result: Json | null
          analysis_type: string
          chat_history: Json[] | null
          claims_count: number | null
          completed_at: string | null
          context_template_ids: string[] | null
          created_at: string | null
          critique_passed: boolean | null
          critique_results: Json | null
          custom_prompt: string | null
          document_ids: string[]
          ercw_version: string | null
          full_prompt_preview: string | null
          id: string
          merged_context: Json | null
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_result?: Json | null
          analysis_type?: string
          chat_history?: Json[] | null
          claims_count?: number | null
          completed_at?: string | null
          context_template_ids?: string[] | null
          created_at?: string | null
          critique_passed?: boolean | null
          critique_results?: Json | null
          custom_prompt?: string | null
          document_ids: string[]
          ercw_version?: string | null
          full_prompt_preview?: string | null
          id?: string
          merged_context?: Json | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_result?: Json | null
          analysis_type?: string
          chat_history?: Json[] | null
          claims_count?: number | null
          completed_at?: string | null
          context_template_ids?: string[] | null
          created_at?: string | null
          critique_passed?: boolean | null
          critique_results?: Json | null
          custom_prompt?: string | null
          document_ids?: string[]
          ercw_version?: string | null
          full_prompt_preview?: string | null
          id?: string
          merged_context?: Json | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      claims_posts: {
        Row: {
          actors: string[] | null
          analysis_session_id: string | null
          assumptions: string[] | null
          claim_id: string
          claim_type: string
          created_at: string | null
          document_id: string | null
          evidence_ids: string[]
          id: string
          kpi_tags: string[] | null
          notes: string | null
          strength: string
          text: string
          updated_at: string | null
        }
        Insert: {
          actors?: string[] | null
          analysis_session_id?: string | null
          assumptions?: string[] | null
          claim_id: string
          claim_type: string
          created_at?: string | null
          document_id?: string | null
          evidence_ids?: string[]
          id?: string
          kpi_tags?: string[] | null
          notes?: string | null
          strength: string
          text: string
          updated_at?: string | null
        }
        Update: {
          actors?: string[] | null
          analysis_session_id?: string | null
          assumptions?: string[] | null
          claim_id?: string
          claim_type?: string
          created_at?: string | null
          document_id?: string | null
          evidence_ids?: string[]
          id?: string
          kpi_tags?: string[] | null
          notes?: string | null
          strength?: string
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_posts_analysis_session_id_fkey"
            columns: ["analysis_session_id"]
            isOneToOne: false
            referencedRelation: "analysis_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_posts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      comparative_analysis: {
        Row: {
          comparison_result: Json | null
          created_at: string
          document_ids: string[]
          id: string
          user_id: string
        }
        Insert: {
          comparison_result?: Json | null
          created_at?: string
          document_ids: string[]
          id?: string
          user_id: string
        }
        Update: {
          comparison_result?: Json | null
          created_at?: string
          document_ids?: string[]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      context_templates: {
        Row: {
          context_data: Json | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          is_system_default: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          context_data?: Json | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_default?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          context_data?: Json | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_default?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          auto_tagged_at: string | null
          content_hash: string | null
          document_category: string | null
          evidence_count: number | null
          evidence_extracted: boolean | null
          extraction_completed_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          internal_title: string | null
          is_latest_version: boolean
          metadata: Json | null
          organization: string | null
          parent_document_id: string | null
          status: string | null
          tags: string[] | null
          time_period: string | null
          title: string
          uploaded_at: string | null
          uploaded_by: string | null
          version_notes: string | null
          version_number: number
        }
        Insert: {
          auto_tagged_at?: string | null
          content_hash?: string | null
          document_category?: string | null
          evidence_count?: number | null
          evidence_extracted?: boolean | null
          extraction_completed_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          internal_title?: string | null
          is_latest_version?: boolean
          metadata?: Json | null
          organization?: string | null
          parent_document_id?: string | null
          status?: string | null
          tags?: string[] | null
          time_period?: string | null
          title: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_notes?: string | null
          version_number?: number
        }
        Update: {
          auto_tagged_at?: string | null
          content_hash?: string | null
          document_category?: string | null
          evidence_count?: number | null
          evidence_extracted?: boolean | null
          extraction_completed_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          internal_title?: string | null
          is_latest_version?: boolean
          metadata?: Json | null
          organization?: string | null
          parent_document_id?: string | null
          status?: string | null
          tags?: string[] | null
          time_period?: string | null
          title?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_notes?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_posts: {
        Row: {
          created_at: string | null
          document_id: string
          evidence_id: string
          headers: Json | null
          id: string
          notes: string | null
          page: number
          quote: string | null
          rows: Json | null
          section: string | null
          source_loc: string
          table_ref: string | null
          type: string
          unit_notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_id: string
          evidence_id: string
          headers?: Json | null
          id?: string
          notes?: string | null
          page: number
          quote?: string | null
          rows?: Json | null
          section?: string | null
          source_loc: string
          table_ref?: string | null
          type: string
          unit_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string
          evidence_id?: string
          headers?: Json | null
          id?: string
          notes?: string | null
          page?: number
          quote?: string | null
          rows?: Json | null
          section?: string | null
          source_loc?: string
          table_ref?: string | null
          type?: string
          unit_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_posts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
