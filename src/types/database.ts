// ============================================================================
// このファイルは Supabase CLI（generate_typescript_types）による自動生成です。
// 手編集しないでください。スキーマを変更した場合は再生成してください。
//
// 生成元: Supabase project `code-jenga`（ref: twkuapsjczmlfldgjgot）
// 対応マイグレーション:
//   - supabase/migrations/20260914061141_init_schema.sql
//   - supabase/migrations/20260914061323_tune_indexes_and_rls.sql
//   - supabase/migrations/20260914093123_add_turn_difficulty.sql
//   - supabase/migrations/20260915120000_apply_turn_rpc.sql
// ============================================================================

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      game_players: {
        Row: {
          game_id: string
          is_ready: boolean
          joined_at: string
          left_at: string | null
          player_id: string
          turn_order: number
        }
        Insert: {
          game_id: string
          is_ready?: boolean
          joined_at?: string
          left_at?: string | null
          player_id: string
          turn_order: number
        }
        Update: {
          game_id?: string
          is_ready?: boolean
          joined_at?: string
          left_at?: string | null
          player_id?: string
          turn_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          current_code: string | null
          current_line_count: number | null
          current_player_id: string | null
          current_turn_difficulty:
            | Database["public"]["Enums"]["turn_difficulty"]
            | null
          finish_reason:
            | Database["public"]["Enums"]["game_finish_reason"]
            | null
          finished_at: string | null
          id: string
          loser_id: string | null
          problem_id: string | null
          room_id: string
          round_no: number
          started_at: string | null
          status: Database["public"]["Enums"]["game_status"]
          turn_deadline_at: string | null
          turn_no: number
          turn_time_limit_seconds: number
        }
        Insert: {
          created_at?: string
          current_code?: string | null
          current_line_count?: number | null
          current_player_id?: string | null
          current_turn_difficulty?:
            | Database["public"]["Enums"]["turn_difficulty"]
            | null
          finish_reason?:
            | Database["public"]["Enums"]["game_finish_reason"]
            | null
          finished_at?: string | null
          id?: string
          loser_id?: string | null
          problem_id?: string | null
          room_id: string
          round_no?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          turn_deadline_at?: string | null
          turn_no?: number
          turn_time_limit_seconds?: number
        }
        Update: {
          created_at?: string
          current_code?: string | null
          current_line_count?: number | null
          current_player_id?: string | null
          current_turn_difficulty?:
            | Database["public"]["Enums"]["turn_difficulty"]
            | null
          finish_reason?:
            | Database["public"]["Enums"]["game_finish_reason"]
            | null
          finished_at?: string | null
          id?: string
          loser_id?: string | null
          problem_id?: string | null
          room_id?: string
          round_no?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          turn_deadline_at?: string | null
          turn_no?: number
          turn_time_limit_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_current_player_id_fkey"
            columns: ["current_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_loser_id_fkey"
            columns: ["loser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          created_at: string
          difficulty: string | null
          generated_by: Database["public"]["Enums"]["problem_source"]
          generation_prompt: string | null
          id: string
          initial_line_count: number
          is_verified: boolean
          language: string
          source_code: string
          test_code: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          generated_by?: Database["public"]["Enums"]["problem_source"]
          generation_prompt?: string | null
          id?: string
          initial_line_count: number
          is_verified?: boolean
          language: string
          source_code: string
          test_code: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          generated_by?: Database["public"]["Enums"]["problem_source"]
          generation_prompt?: string | null
          id?: string
          initial_line_count?: number
          is_verified?: boolean
          language?: string
          source_code?: string
          test_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_anonymous: boolean
          nickname: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_anonymous?: boolean
          nickname: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_anonymous?: boolean
          nickname?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          host_id: string
          id: string
          max_players: number
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          host_id: string
          id?: string
          max_players?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          host_id?: string
          id?: string
          max_players?: number
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          compile_output: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          executed_code: string
          exit_code: number | null
          failed_tests: number | null
          game_id: string | null
          id: string
          kind: Database["public"]["Enums"]["test_run_kind"]
          language: string
          language_version: string
          passed_tests: number | null
          piston_raw: Json | null
          problem_id: string | null
          status: Database["public"]["Enums"]["test_run_status"]
          stderr: string | null
          stdout: string | null
          total_tests: number | null
        }
        Insert: {
          compile_output?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_code: string
          exit_code?: number | null
          failed_tests?: number | null
          game_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["test_run_kind"]
          language: string
          language_version: string
          passed_tests?: number | null
          piston_raw?: Json | null
          problem_id?: string | null
          status: Database["public"]["Enums"]["test_run_status"]
          stderr?: string | null
          stdout?: string | null
          total_tests?: number | null
        }
        Update: {
          compile_output?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          executed_code?: string
          exit_code?: number | null
          failed_tests?: number | null
          game_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["test_run_kind"]
          language?: string
          language_version?: string
          passed_tests?: number | null
          piston_raw?: Json | null
          problem_id?: string | null
          status?: Database["public"]["Enums"]["test_run_status"]
          stderr?: string | null
          stdout?: string | null
          total_tests?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          code_after: string
          code_before: string
          created_at: string
          deleted_line_no: number
          deleted_line_text: string
          duration_ms: number | null
          game_id: string
          id: string
          player_id: string
          result: Database["public"]["Enums"]["turn_result"]
          test_run_id: string | null
          turn_difficulty: Database["public"]["Enums"]["turn_difficulty"]
          turn_no: number
        }
        Insert: {
          code_after: string
          code_before: string
          created_at?: string
          deleted_line_no: number
          deleted_line_text: string
          duration_ms?: number | null
          game_id: string
          id?: string
          player_id: string
          result: Database["public"]["Enums"]["turn_result"]
          test_run_id?: string | null
          turn_difficulty: Database["public"]["Enums"]["turn_difficulty"]
          turn_no: number
        }
        Update: {
          code_after?: string
          code_before?: string
          created_at?: string
          deleted_line_no?: number
          deleted_line_text?: string
          duration_ms?: number | null
          game_id?: string
          id?: string
          player_id?: string
          result?: Database["public"]["Enums"]["turn_result"]
          test_run_id?: string | null
          turn_difficulty?: Database["public"]["Enums"]["turn_difficulty"]
          turn_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "turns_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      test_run_summaries: {
        Row: {
          compile_output: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          exit_code: number | null
          failed_tests: number | null
          game_id: string | null
          id: string
          kind: Database["public"]["Enums"]["test_run_kind"]
          passed_tests: number | null
          problem_id: string | null
          status: Database["public"]["Enums"]["test_run_status"]
          stderr: string | null
          total_tests: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_turn: {
        Args: {
          p_game_id: string
          p_player_id: string
          p_expected_turn_no: number
          p_deleted_line_no: number
          p_deleted_line_text: string
          p_code_after: string
          p_turn_result: Database["public"]["Enums"]["turn_result"]
          p_next_player_id: string | null
          p_next_turn_difficulty:
            | Database["public"]["Enums"]["turn_difficulty"]
            | null
          p_finish_reason:
            | Database["public"]["Enums"]["game_finish_reason"]
            | null
          p_duration_ms: number | null
          p_test_run: Json
        }
        Returns: Json
      }
      is_game_participant: { Args: { p_game_id: string }; Returns: boolean }
      join_room: { Args: { p_code: string }; Returns: string }
    }
    Enums: {
      game_finish_reason:
        | "test_failed"
        | "timeout"
        | "no_lines_left"
        | "aborted"
      game_status: "waiting" | "generating" | "playing" | "finished" | "aborted"
      problem_source: "gemini" | "seed"
      room_status: "waiting" | "playing" | "finished" | "closed"
      test_run_kind: "problem_verification" | "turn_check"
      test_run_status: "passed" | "failed" | "error"
      turn_difficulty: "easy" | "normal" | "hard"
      turn_result: "safe" | "out" | "timeout"
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
      game_finish_reason: [
        "test_failed",
        "timeout",
        "no_lines_left",
        "aborted",
      ],
      game_status: ["waiting", "generating", "playing", "finished", "aborted"],
      problem_source: ["gemini", "seed"],
      room_status: ["waiting", "playing", "finished", "closed"],
      test_run_kind: ["problem_verification", "turn_check"],
      test_run_status: ["passed", "failed", "error"],
      turn_difficulty: ["easy", "normal", "hard"],
      turn_result: ["safe", "out", "timeout"],
    },
  },
} as const
