export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          payload: Json;
          title: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          payload: Json;
          title?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          payload?: Json;
          title?: string | null;
          description?: string | null;
          updated_at?: string;
        };
      };
      invite_tokens: {
        Row: {
          token: string;
          allowed_email: string | null;
          created_at: string;
          expires_at: string | null;
          redeemed_by: string | null;
          notes: string | null;
        };
        Insert: {
          token: string;
          allowed_email?: string | null;
          created_at?: string;
          expires_at?: string | null;
          redeemed_by?: string | null;
          notes?: string | null;
        };
        Update: {
          allowed_email?: string | null;
          expires_at?: string | null;
          redeemed_by?: string | null;
          notes?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
