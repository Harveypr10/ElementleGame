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
      admin_settings: {
        Row: {
          description: string | null
          id: number
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: number
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: number
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      allocation_log: {
        Row: {
          allocated_count: number
          created_at: string
          demand_row_id: number | null
          demand_run_id: string | null
          error_context: string | null
          generated_count: number
          id: number
          run_id: string
          scope_id: string
          scope_type: string
          status: string | null
          unmet_count: number
        }
        Insert: {
          allocated_count: number
          created_at?: string
          demand_row_id?: number | null
          demand_run_id?: string | null
          error_context?: string | null
          generated_count: number
          id?: number
          run_id: string
          scope_id: string
          scope_type: string
          status?: string | null
          unmet_count: number
        }
        Update: {
          allocated_count?: number
          created_at?: string
          demand_row_id?: number | null
          demand_run_id?: string | null
          error_context?: string | null
          generated_count?: number
          id?: number
          run_id?: string
          scope_id?: string
          scope_type?: string
          status?: string | null
          unmet_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_allocation_log_demand_row"
            columns: ["demand_row_id"]
            isOneToOne: false
            referencedRelation: "demand_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_missed_flag_changes: {
        Row: {
          changed_at: string | null
          id: number
          new_value: boolean | null
          old_value: boolean | null
          user_id: string | null
        }
        Insert: {
          changed_at?: string | null
          id?: number
          new_value?: boolean | null
          old_value?: boolean | null
          user_id?: string | null
        }
        Update: {
          changed_at?: string | null
          id?: number
          new_value?: boolean | null
          old_value?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      available_question_spec: {
        Row: {
          active: boolean
          category_id: number
          created_at: string | null
          date_range: unknown
          deactivate_reason: string | null
          end_date: string
          id: number
          location: string | null
          region: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          category_id: number
          created_at?: string | null
          date_range?: unknown
          deactivate_reason?: string | null
          end_date: string
          id?: number
          location?: string | null
          region: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          category_id?: number
          created_at?: string | null
          date_range?: unknown
          deactivate_reason?: string | null
          end_date?: string
          id?: number
          location?: string | null
          region?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_aqs_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_aqs_location"
            columns: ["location"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
        ]
      }
      available_question_spec_archive: {
        Row: {
          active: boolean
          archived_at: string
          archived_by: string | null
          category_id: number
          created_at: string | null
          date_range: unknown
          deactivate_reason: string | null
          end_date: string
          id: number
          location: string | null
          region: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          active: boolean
          archived_at?: string
          archived_by?: string | null
          category_id: number
          created_at?: string | null
          date_range?: unknown
          deactivate_reason?: string | null
          end_date: string
          id: number
          location?: string | null
          region: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          archived_at?: string
          archived_by?: string | null
          category_id?: number
          created_at?: string | null
          date_range?: unknown
          deactivate_reason?: string | null
          end_date?: string
          id?: number
          location?: string | null
          region?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_aqs_archive_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_aqs_archive_location"
            columns: ["location"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          icon_url: string | null
          id: number
          name: string
          threshold: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: number
          name: string
          threshold?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: number
          name?: string
          threshold?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_percentile_job_logs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: number
          job_name: string
          job_type: string
          processed_users: number | null
          region: string
          started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name?: string
          job_type: string
          processed_users?: number | null
          region?: string
          started_at?: string
          status: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name?: string
          job_type?: string
          processed_users?: number | null
          region?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      debug_events: {
        Row: {
          created_at: string | null
          id: number
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: number
          payload?: Json | null
        }
        Relationships: []
      }
      demand_scheduler_config: {
        Row: {
          frequency_hours: number
          id: string
          start_time: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          frequency_hours: number
          id?: string
          start_time: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          frequency_hours?: number
          id?: string
          start_time?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_scheduler_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "demand_scheduler_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_summary: {
        Row: {
          archive_days: number
          categories: Json | null
          created_at: string
          end_date: string
          future_days: number
          id: number
          location: unknown
          priority: number | null
          processed_at: string | null
          region: string | null
          run_id: string
          scope_id: string
          scope_type: string
          start_date: string
          status: string | null
          tier: string | null
          trigger_reason: string | null
          updated_at: string | null
        }
        Insert: {
          archive_days?: number
          categories?: Json | null
          created_at?: string
          end_date: string
          future_days?: number
          id?: number
          location?: unknown
          priority?: number | null
          processed_at?: string | null
          region?: string | null
          run_id: string
          scope_id: string
          scope_type: string
          start_date: string
          status?: string | null
          tier?: string | null
          trigger_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          archive_days?: number
          categories?: Json | null
          created_at?: string
          end_date?: string
          future_days?: number
          id?: number
          location?: unknown
          priority?: number | null
          processed_at?: string | null
          region?: string | null
          run_id?: string
          scope_id?: string
          scope_type?: string
          start_date?: string
          status?: string | null
          tier?: string | null
          trigger_reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      game_attempts_region: {
        Row: {
          allocated_region_id: number | null
          completed_at: string | null
          digits: string | null
          id: number
          num_guesses: number | null
          result: string | null
          started_at: string | null
          streak_day_status: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          allocated_region_id?: number | null
          completed_at?: string | null
          digits?: string | null
          id?: number
          num_guesses?: number | null
          result?: string | null
          started_at?: string | null
          streak_day_status?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          allocated_region_id?: number | null
          completed_at?: string | null
          digits?: string | null
          id?: number
          num_guesses?: number | null
          result?: string | null
          started_at?: string | null
          streak_day_status?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_game_attempts_alloc_region"
            columns: ["allocated_region_id"]
            isOneToOne: false
            referencedRelation: "questions_allocated_region"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "game_attempts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_attempts_user: {
        Row: {
          allocated_user_id: number
          completed_at: string | null
          digits: string | null
          id: number
          num_guesses: number | null
          result: string | null
          started_at: string | null
          streak_day_status: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocated_user_id: number
          completed_at?: string | null
          digits?: string | null
          id?: number
          num_guesses?: number | null
          result?: string | null
          started_at?: string | null
          streak_day_status?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocated_user_id?: number
          completed_at?: string | null
          digits?: string | null
          id?: number
          num_guesses?: number | null
          result?: string | null
          started_at?: string | null
          streak_day_status?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_attempts_user_allocated_user_id_fkey"
            columns: ["allocated_user_id"]
            isOneToOne: false
            referencedRelation: "questions_allocated_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_user_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "game_attempts_user_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guesses_region: {
        Row: {
          game_attempt_id: number
          guess_value: string
          guessed_at: string | null
          id: number
        }
        Insert: {
          game_attempt_id: number
          guess_value: string
          guessed_at?: string | null
          id?: number
        }
        Update: {
          game_attempt_id?: number
          guess_value?: string
          guessed_at?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "guesses_game_attempt_id_game_attempts_id_fk"
            columns: ["game_attempt_id"]
            isOneToOne: false
            referencedRelation: "current_streak_attempts"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "guesses_game_attempt_id_game_attempts_id_fk"
            columns: ["game_attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts_region"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_game_attempt_id_game_attempts_id_fk"
            columns: ["game_attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts_region_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      guesses_user: {
        Row: {
          game_attempt_id: number
          guess_value: string
          guessed_at: string | null
          id: number
        }
        Insert: {
          game_attempt_id: number
          guess_value: string
          guessed_at?: string | null
          id?: number
        }
        Update: {
          game_attempt_id?: number
          guess_value?: string
          guessed_at?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "guesses_user_game_attempt_id_fkey"
            columns: ["game_attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guesses_user_game_attempt_id_fkey"
            columns: ["game_attempt_id"]
            isOneToOne: false
            referencedRelation: "game_attempts_user_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      location_allocation: {
        Row: {
          allocation_active: boolean | null
          created_at: string
          id: number
          location_id: string
          questions_allocated: number | null
          score: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allocation_active?: boolean | null
          created_at?: string
          id?: number
          location_id: string
          questions_allocated?: number | null
          score: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allocation_active?: boolean | null
          created_at?: string
          id?: number
          location_id?: string
          questions_allocated?: number | null
          score?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_allocation_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_allocation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "location_allocation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_allocation_audit: {
        Row: {
          action: string
          allocation_active: boolean | null
          audit_id: string
          changed_at: string
          location_id: string | null
          score: number | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          allocation_active?: boolean | null
          audit_id?: string
          changed_at?: string
          location_id?: string | null
          score?: number | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          allocation_active?: boolean | null
          audit_id?: string
          changed_at?: string
          location_id?: string | null
          score?: number | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          id: number
          location: unknown
          name: string
          population: number | null
          region: string
          size_category: string
        }
        Insert: {
          id?: number
          location: unknown
          name: string
          population?: number | null
          region?: string
          size_category: string
        }
        Update: {
          id?: number
          location?: unknown
          name?: string
          population?: number | null
          region?: string
          size_category?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_locations_region"
            columns: ["region"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
      }
      monthly_job_logs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: number
          job_name: string
          job_type: string
          processed_users: number | null
          region: string
          started_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name: string
          job_type?: string
          processed_users?: number | null
          region: string
          started_at?: string
          status: string
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: number
          job_name?: string
          job_type?: string
          processed_users?: number | null
          region?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string
          stripe_invoice_id: string
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          paid_at: string
          stripe_invoice_id: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string
          stripe_invoice_id?: string
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      populated_places: {
        Row: {
          active: boolean | null
          geom: unknown
          id: string
          local_type: string | null
          name1: string | null
          name2: string | null
          populated_place: string | null
          postcode_district: string | null
          total_questions: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          geom?: unknown
          id: string
          local_type?: string | null
          name1?: string | null
          name2?: string | null
          populated_place?: string | null
          postcode_district?: string | null
          total_questions?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          geom?: unknown
          id?: string
          local_type?: string | null
          name1?: string | null
          name2?: string | null
          populated_place?: string | null
          postcode_district?: string | null
          total_questions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_places_district"
            columns: ["postcode_district"]
            isOneToOne: false
            referencedRelation: "postcode_districts"
            referencedColumns: ["postcode_district"]
          },
        ]
      }
      postcode_districts: {
        Row: {
          country: string | null
          county_unitary: string | null
          district_borough: string | null
          postcode_district: string
          region: string | null
        }
        Insert: {
          country?: string | null
          county_unitary?: string | null
          district_borough?: string | null
          postcode_district: string
          region?: string | null
        }
        Update: {
          country?: string | null
          county_unitary?: string | null
          district_borough?: string | null
          postcode_district?: string
          region?: string | null
        }
        Relationships: []
      }
      postcodes: {
        Row: {
          geom: unknown
          id: string
          local_type: string | null
          name1: string | null
          name2: string | null
          populated_place: string | null
          postcode_district: string | null
        }
        Insert: {
          geom?: unknown
          id: string
          local_type?: string | null
          name1?: string | null
          name2?: string | null
          populated_place?: string | null
          postcode_district?: string | null
        }
        Update: {
          geom?: unknown
          id?: string
          local_type?: string | null
          name1?: string | null
          name2?: string | null
          populated_place?: string | null
          postcode_district?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_postcodes_district"
            columns: ["postcode_district"]
            isOneToOne: false
            referencedRelation: "postcode_districts"
            referencedColumns: ["postcode_district"]
          },
        ]
      }
      promotions: {
        Row: {
          active: boolean
          billing_period: string
          code: string
          created_at: string
          description: string | null
          discount_duration_months: number
          discount_type: string
          discount_value: number
          ends_at: string
          id: string
          max_redemptions_per_user: number
          min_days_remaining: number | null
          name: string
          region: string | null
          requires_active: boolean
          requires_lapsed: boolean
          starts_at: string
          stripe_coupon_id: string | null
          stripe_promotion_code_id: string | null
          tier_type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_period?: string
          code: string
          created_at?: string
          description?: string | null
          discount_duration_months: number
          discount_type: string
          discount_value: number
          ends_at: string
          id?: string
          max_redemptions_per_user?: number
          min_days_remaining?: number | null
          name: string
          region?: string | null
          requires_active?: boolean
          requires_lapsed?: boolean
          starts_at: string
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          tier_type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_period?: string
          code?: string
          created_at?: string
          description?: string | null
          discount_duration_months?: number
          discount_type?: string
          discount_value?: number
          ends_at?: string
          id?: string
          max_redemptions_per_user?: number
          min_days_remaining?: number | null
          name?: string
          region?: string | null
          requires_active?: boolean
          requires_lapsed?: boolean
          starts_at?: string
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          tier_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_generation_settings: {
        Row: {
          created_at: string | null
          demand_type: string
          id: number
          min_threshold: number
          scope_type: string
          seed_amount: number | null
          target_topup: number
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          demand_type: string
          id?: number
          min_threshold: number
          scope_type: string
          seed_amount?: number | null
          target_topup: number
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          demand_type?: string
          id?: number
          min_threshold?: number
          scope_type?: string
          seed_amount?: number | null
          target_topup?: number
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      questions_allocated_region: {
        Row: {
          allocator_run_id: string | null
          category_hint: string | null
          category_id: number
          created_at: string | null
          demand_run_id: string | null
          id: number
          puzzle_date: string
          question_id: number
          region: string
          slot_type: string | null
          trigger_reason: string | null
        }
        Insert: {
          allocator_run_id?: string | null
          category_hint?: string | null
          category_id: number
          created_at?: string | null
          demand_run_id?: string | null
          id?: number
          puzzle_date: string
          question_id: number
          region: string
          slot_type?: string | null
          trigger_reason?: string | null
        }
        Update: {
          allocator_run_id?: string | null
          category_hint?: string | null
          category_id?: number
          created_at?: string | null
          demand_run_id?: string | null
          id?: number
          puzzle_date?: string
          question_id?: number
          region?: string
          slot_type?: string | null
          trigger_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_alloc_region_question"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_master_region"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_allocated_region_region"
            columns: ["region"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_qar_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_allocated_user: {
        Row: {
          allocator_run_id: string | null
          category_hint: string | null
          category_id: number
          created_at: string | null
          demand_run_id: string | null
          id: number
          puzzle_date: string
          question_id: number
          slot_type: string | null
          tier: string | null
          trigger_reason: string | null
          user_id: string
        }
        Insert: {
          allocator_run_id?: string | null
          category_hint?: string | null
          category_id: number
          created_at?: string | null
          demand_run_id?: string | null
          id?: number
          puzzle_date: string
          question_id: number
          slot_type?: string | null
          tier?: string | null
          trigger_reason?: string | null
          user_id: string
        }
        Update: {
          allocator_run_id?: string | null
          category_hint?: string | null
          category_id?: number
          created_at?: string | null
          demand_run_id?: string | null
          id?: number
          puzzle_date?: string
          question_id?: number
          slot_type?: string | null
          tier?: string | null
          trigger_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_alloc_user_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_alloc_user_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_alloc_user_question"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_master_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qau_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_master_region: {
        Row: {
          accuracy_score: number | null
          ai_model_used: string | null
          answer_date_canonical: string
          archive_id: number | null
          categories: Json | null
          created_at: string | null
          event_description: string
          event_origin: string
          event_title: string
          id: number
          populated_place_id: string | null
          quality_score: number | null
          question_kind: string | null
          regions: Json
        }
        Insert: {
          accuracy_score?: number | null
          ai_model_used?: string | null
          answer_date_canonical: string
          archive_id?: number | null
          categories?: Json | null
          created_at?: string | null
          event_description: string
          event_origin: string
          event_title: string
          id?: number
          populated_place_id?: string | null
          quality_score?: number | null
          question_kind?: string | null
          regions?: Json
        }
        Update: {
          accuracy_score?: number | null
          ai_model_used?: string | null
          answer_date_canonical?: string
          archive_id?: number | null
          categories?: Json | null
          created_at?: string | null
          event_description?: string
          event_origin?: string
          event_title?: string
          id?: number
          populated_place_id?: string | null
          quality_score?: number | null
          question_kind?: string | null
          regions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fk_qmr_pop_place"
            columns: ["populated_place_id"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_master_user: {
        Row: {
          accuracy_score: number | null
          ai_model_used: string | null
          answer_date_canonical: string
          archive_id: number | null
          categories: Json | null
          created_at: string | null
          event_description: string
          event_origin: string
          event_title: string
          id: number
          populated_place_id: string | null
          quality_score: number | null
          question_kind: string | null
          regions: Json
        }
        Insert: {
          accuracy_score?: number | null
          ai_model_used?: string | null
          answer_date_canonical: string
          archive_id?: number | null
          categories?: Json | null
          created_at?: string | null
          event_description: string
          event_origin: string
          event_title: string
          id?: number
          populated_place_id?: string | null
          quality_score?: number | null
          question_kind?: string | null
          regions?: Json
        }
        Update: {
          accuracy_score?: number | null
          ai_model_used?: string | null
          answer_date_canonical?: string
          archive_id?: number | null
          categories?: Json | null
          created_at?: string | null
          event_description?: string
          event_origin?: string
          event_title?: string
          id?: number
          populated_place_id?: string | null
          quality_score?: number | null
          question_kind?: string | null
          regions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fk_qmu_pop_place"
            columns: ["populated_place_id"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_to_generate: {
        Row: {
          ai_model_used: string | null
          allocator_run_id: string | null
          attempt_count: number | null
          category_hint: string | null
          category_id: number | null
          created_at: string
          demand_run_id: string | null
          error_context: string | null
          failed_candidate_date: string | null
          failed_candidate_description: string | null
          generator_version: string | null
          id: number
          populated_place_id: string | null
          priority: number
          puzzle_date: string | null
          region: string | null
          run_id: string | null
          scope_id: string
          scope_type: string
          slot_type: string | null
          spec_id: number | null
          status: string
          tier: string | null
          token_usage_generator: number | null
          token_usage_verifier: number | null
          trigger_reason: string | null
          updated_at: string
        }
        Insert: {
          ai_model_used?: string | null
          allocator_run_id?: string | null
          attempt_count?: number | null
          category_hint?: string | null
          category_id?: number | null
          created_at?: string
          demand_run_id?: string | null
          error_context?: string | null
          failed_candidate_date?: string | null
          failed_candidate_description?: string | null
          generator_version?: string | null
          id?: number
          populated_place_id?: string | null
          priority?: number
          puzzle_date?: string | null
          region?: string | null
          run_id?: string | null
          scope_id: string
          scope_type: string
          slot_type?: string | null
          spec_id?: number | null
          status?: string
          tier?: string | null
          token_usage_generator?: number | null
          token_usage_verifier?: number | null
          trigger_reason?: string | null
          updated_at?: string
        }
        Update: {
          ai_model_used?: string | null
          allocator_run_id?: string | null
          attempt_count?: number | null
          category_hint?: string | null
          category_id?: number | null
          created_at?: string
          demand_run_id?: string | null
          error_context?: string | null
          failed_candidate_date?: string | null
          failed_candidate_description?: string | null
          generator_version?: string | null
          id?: number
          populated_place_id?: string | null
          priority?: number
          puzzle_date?: string | null
          region?: string | null
          run_id?: string | null
          scope_id?: string
          scope_type?: string
          slot_type?: string | null
          spec_id?: number | null
          status?: string
          tier?: string | null
          token_usage_generator?: number | null
          token_usage_verifier?: number | null
          trigger_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_qtg_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qtg_pop_place"
            columns: ["populated_place_id"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_to_generate_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "available_question_spec"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_to_generate_archive: {
        Row: {
          ai_model_used: string | null
          allocator_run_id: string | null
          archive_id: number
          attempt_count: number | null
          attempts: number | null
          category_hint: string | null
          category_id: number | null
          created_at: string
          demand_run_id: string | null
          error_context: string | null
          failed_candidate_date: string | null
          failed_candidate_description: string | null
          final_status: string
          generator_version: string | null
          id: number
          populated_place_id: string | null
          priority: number
          processed_at: string | null
          puzzle_date: string | null
          region: string | null
          run_id: string | null
          scope_id: string
          scope_type: string
          slot_type: string | null
          spec_id: number | null
          status: string
          tier: string | null
          token_usage_generator: number | null
          token_usage_verifier: number | null
          trigger_reason: string | null
          updated_at: string
        }
        Insert: {
          ai_model_used?: string | null
          allocator_run_id?: string | null
          archive_id?: number
          attempt_count?: number | null
          attempts?: number | null
          category_hint?: string | null
          category_id?: number | null
          created_at?: string
          demand_run_id?: string | null
          error_context?: string | null
          failed_candidate_date?: string | null
          failed_candidate_description?: string | null
          final_status: string
          generator_version?: string | null
          id?: number
          populated_place_id?: string | null
          priority?: number
          processed_at?: string | null
          puzzle_date?: string | null
          region?: string | null
          run_id?: string | null
          scope_id: string
          scope_type: string
          slot_type?: string | null
          spec_id?: number | null
          status?: string
          tier?: string | null
          token_usage_generator?: number | null
          token_usage_verifier?: number | null
          trigger_reason?: string | null
          updated_at?: string
        }
        Update: {
          ai_model_used?: string | null
          allocator_run_id?: string | null
          archive_id?: number
          attempt_count?: number | null
          attempts?: number | null
          category_hint?: string | null
          category_id?: number | null
          created_at?: string
          demand_run_id?: string | null
          error_context?: string | null
          failed_candidate_date?: string | null
          failed_candidate_description?: string | null
          final_status?: string
          generator_version?: string | null
          id?: number
          populated_place_id?: string | null
          priority?: number
          processed_at?: string | null
          puzzle_date?: string | null
          region?: string | null
          run_id?: string | null
          scope_id?: string
          scope_type?: string
          slot_type?: string | null
          spec_id?: number | null
          status?: string
          tier?: string | null
          token_usage_generator?: number | null
          token_usage_verifier?: number | null
          trigger_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_archive_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_archive_populated_place"
            columns: ["populated_place_id"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_archive_spec"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "available_question_spec"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_to_generate_log: {
        Row: {
          action: string
          changed_at: string
          log_id: number
          new_row: Json | null
          old_row: Json | null
          row_id: number | null
        }
        Insert: {
          action: string
          changed_at?: string
          log_id?: number
          new_row?: Json | null
          old_row?: Json | null
          row_id?: number | null
        }
        Update: {
          action?: string
          changed_at?: string
          log_id?: number
          new_row?: Json | null
          old_row?: Json | null
          row_id?: number | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string
          default_date_format: string
          id: number
          name: string
        }
        Insert: {
          code: string
          default_date_format: string
          id?: number
          name: string
        }
        Update: {
          code?: string
          default_date_format?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string | null
          badge_count: number
          badge_id: number | null
          game_type: string
          id: number
          is_awarded: boolean
          region: string
          user_id: string | null
        }
        Insert: {
          awarded_at?: string | null
          badge_count?: number
          badge_id?: number | null
          game_type?: string
          id?: number
          is_awarded?: boolean
          region?: string
          user_id?: string | null
        }
        Update: {
          awarded_at?: string | null
          badge_count?: number
          badge_id?: number | null
          game_type?: string
          id?: number
          is_awarded?: boolean
          region?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_category_preferences: {
        Row: {
          category_id: number
          created_at: string | null
          id: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id: number
          created_at?: string | null
          id?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: number
          created_at?: string | null
          id?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ucp_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ucp_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_ucp_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          accepted_terms: boolean
          accepted_terms_at: string | null
          active_locations_count: number
          ads_consent: boolean
          ads_consent_updated_at: string | null
          apple_linked: boolean | null
          archive_synced_count: number | null
          categories_last_changed_at: string | null
          created_at: string | null
          date_first_subscription: string | null
          email: string
          email_verified: boolean | null
          first_name: string | null
          google_linked: boolean | null
          id: string
          is_admin: boolean | null
          last_name: string | null
          location: unknown
          magic_link: boolean | null
          password_created: boolean | null
          postcode: string | null
          postcode_last_changed_at: string | null
          region: string | null
          signup_method: string | null
          stripe_customer_id: string | null
          stripe_default_payment_method_id: string | null
          subscription_end_date: string | null
          total_locations_allocated: number
          updated_at: string | null
          user_tier_id: string | null
        }
        Insert: {
          accepted_terms?: boolean
          accepted_terms_at?: string | null
          active_locations_count?: number
          ads_consent?: boolean
          ads_consent_updated_at?: string | null
          apple_linked?: boolean | null
          archive_synced_count?: number | null
          categories_last_changed_at?: string | null
          created_at?: string | null
          date_first_subscription?: string | null
          email: string
          email_verified?: boolean | null
          first_name?: string | null
          google_linked?: boolean | null
          id: string
          is_admin?: boolean | null
          last_name?: string | null
          location?: unknown
          magic_link?: boolean | null
          password_created?: boolean | null
          postcode?: string | null
          postcode_last_changed_at?: string | null
          region?: string | null
          signup_method?: string | null
          stripe_customer_id?: string | null
          stripe_default_payment_method_id?: string | null
          subscription_end_date?: string | null
          total_locations_allocated?: number
          updated_at?: string | null
          user_tier_id?: string | null
        }
        Update: {
          accepted_terms?: boolean
          accepted_terms_at?: string | null
          active_locations_count?: number
          ads_consent?: boolean
          ads_consent_updated_at?: string | null
          apple_linked?: boolean | null
          archive_synced_count?: number | null
          categories_last_changed_at?: string | null
          created_at?: string | null
          date_first_subscription?: string | null
          email?: string
          email_verified?: boolean | null
          first_name?: string | null
          google_linked?: boolean | null
          id?: string
          is_admin?: boolean | null
          last_name?: string | null
          location?: unknown
          magic_link?: boolean | null
          password_created?: boolean | null
          postcode?: string | null
          postcode_last_changed_at?: string | null
          region?: string | null
          signup_method?: string | null
          stripe_customer_id?: string | null
          stripe_default_payment_method_id?: string | null
          subscription_end_date?: string | null
          total_locations_allocated?: number
          updated_at?: string | null
          user_tier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_profiles_region"
            columns: ["region"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_profiles_user_tier_id_fkey"
            columns: ["user_tier_id"]
            isOneToOne: false
            referencedRelation: "user_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      user_promo_grants: {
        Row: {
          expires_at: string
          granted_at: string
          id: string
          next_reminder_at: string | null
          promotion_id: string
          redeemed: boolean
          redeemed_at: string | null
          reminder_interval_days: number
          reminders_sent: number
          stripe_promotion_code_id: string | null
          user_id: string
        }
        Insert: {
          expires_at: string
          granted_at?: string
          id?: string
          next_reminder_at?: string | null
          promotion_id: string
          redeemed?: boolean
          redeemed_at?: string | null
          reminder_interval_days?: number
          reminders_sent?: number
          stripe_promotion_code_id?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string
          granted_at?: string
          id?: string
          next_reminder_at?: string | null
          promotion_id?: string
          redeemed?: boolean
          redeemed_at?: string | null
          reminder_interval_days?: number
          reminders_sent?: number
          stripe_promotion_code_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_promo_grants_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_promo_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_promo_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          category_preferences: Json | null
          clues_enabled: boolean | null
          dark_mode: boolean | null
          date_format_preference: string | null
          digit_preference: string | null
          holiday_saver_active: boolean
          id: number
          sounds_enabled: boolean | null
          streak_saver_active: boolean
          text_size: string | null
          updated_at: string | null
          use_region_default: boolean | null
          user_id: string
        }
        Insert: {
          category_preferences?: Json | null
          clues_enabled?: boolean | null
          dark_mode?: boolean | null
          date_format_preference?: string | null
          digit_preference?: string | null
          holiday_saver_active?: boolean
          id?: number
          sounds_enabled?: boolean | null
          streak_saver_active?: boolean
          text_size?: string | null
          updated_at?: string | null
          use_region_default?: boolean | null
          user_id: string
        }
        Update: {
          category_preferences?: Json | null
          clues_enabled?: boolean | null
          dark_mode?: boolean | null
          date_format_preference?: string | null
          digit_preference?: string | null
          holiday_saver_active?: boolean
          id?: number
          sounds_enabled?: boolean | null
          streak_saver_active?: boolean
          text_size?: string | null
          updated_at?: string | null
          use_region_default?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_settings_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_user_settings_profile"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats_region: {
        Row: {
          avg_guesses_after_exclusions: number | null
          cumulative_monthly_percentile: number | null
          current_streak: number | null
          days_in_month_to_date: number | null
          games_played: number | null
          games_played_month: number | null
          games_won: number | null
          guess_distribution: Json | null
          id: number
          max_streak: number | null
          missed_yesterday_flag_region: boolean
          qualifying_games: number | null
          region: string
          score_final: number | null
          score_final_all_users: number | null
          score_term1: number | null
          score_term2: number | null
          streak_savers_used_month: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_guesses_after_exclusions?: number | null
          cumulative_monthly_percentile?: number | null
          current_streak?: number | null
          days_in_month_to_date?: number | null
          games_played?: number | null
          games_played_month?: number | null
          games_won?: number | null
          guess_distribution?: Json | null
          id?: number
          max_streak?: number | null
          missed_yesterday_flag_region?: boolean
          qualifying_games?: number | null
          region?: string
          score_final?: number | null
          score_final_all_users?: number | null
          score_term1?: number | null
          score_term2?: number | null
          streak_savers_used_month?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_guesses_after_exclusions?: number | null
          cumulative_monthly_percentile?: number | null
          current_streak?: number | null
          days_in_month_to_date?: number | null
          games_played?: number | null
          games_played_month?: number | null
          games_won?: number | null
          guess_distribution?: Json | null
          id?: number
          max_streak?: number | null
          missed_yesterday_flag_region?: boolean
          qualifying_games?: number | null
          region?: string
          score_final?: number | null
          score_final_all_users?: number | null
          score_term1?: number | null
          score_term2?: number | null
          streak_savers_used_month?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_stats_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_user_stats_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats_user: {
        Row: {
          avg_guesses_after_exclusions: number | null
          cumulative_monthly_percentile: number | null
          current_streak: number | null
          days_in_month_to_date: number | null
          games_played: number | null
          games_played_month: number | null
          games_won: number | null
          guess_distribution: Json | null
          holiday_active: boolean
          holiday_days_taken_current_period: number
          holiday_end_date: string | null
          holiday_ended: boolean
          holiday_start_date: string | null
          holidays_used_year: number
          id: number
          max_streak: number | null
          missed_yesterday_flag_user: boolean
          next_holiday_reset_date: string | null
          qualifying_games: number | null
          score_final: number | null
          score_final_all_users: number | null
          score_term1: number | null
          score_term2: number | null
          streak_savers_used_month: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_guesses_after_exclusions?: number | null
          cumulative_monthly_percentile?: number | null
          current_streak?: number | null
          days_in_month_to_date?: number | null
          games_played?: number | null
          games_played_month?: number | null
          games_won?: number | null
          guess_distribution?: Json | null
          holiday_active?: boolean
          holiday_days_taken_current_period?: number
          holiday_end_date?: string | null
          holiday_ended?: boolean
          holiday_start_date?: string | null
          holidays_used_year?: number
          id?: number
          max_streak?: number | null
          missed_yesterday_flag_user?: boolean
          next_holiday_reset_date?: string | null
          qualifying_games?: number | null
          score_final?: number | null
          score_final_all_users?: number | null
          score_term1?: number | null
          score_term2?: number | null
          streak_savers_used_month?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_guesses_after_exclusions?: number | null
          cumulative_monthly_percentile?: number | null
          current_streak?: number | null
          days_in_month_to_date?: number | null
          games_played?: number | null
          games_played_month?: number | null
          games_won?: number | null
          guess_distribution?: Json | null
          holiday_active?: boolean
          holiday_days_taken_current_period?: number
          holiday_end_date?: string | null
          holiday_ended?: boolean
          holiday_start_date?: string | null
          holidays_used_year?: number
          id?: number
          max_streak?: number | null
          missed_yesterday_flag_user?: boolean
          next_holiday_reset_date?: string | null
          qualifying_games?: number | null
          score_final?: number | null
          score_final_all_users?: number | null
          score_term1?: number | null
          score_term2?: number | null
          streak_savers_used_month?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_stats_user_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          amount_paid: number | null
          auto_renew: boolean
          billing_period: string
          created_at: string
          currency: string
          discount_duration_months: number | null
          discount_expires_at: string | null
          discount_started_at: string | null
          discount_type: string | null
          discount_value: number | null
          effective_start_at: string | null
          expires_at: string | null
          id: number
          payment_reference: string | null
          revenuecat_product_id: string | null
          revenuecat_subscriber_id: string | null
          reverted_to_standard: boolean
          source: string | null
          status: string
          stripe_customer_id: string | null
          stripe_discount_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_price_id: string | null
          stripe_promotion_code_id: string | null
          stripe_subscription_id: string | null
          tier: string | null
          updated_at: string
          user_id: string
          user_tier_id: string | null
          validity: unknown
        }
        Insert: {
          amount_paid?: number | null
          auto_renew?: boolean
          billing_period?: string
          created_at?: string
          currency?: string
          discount_duration_months?: number | null
          discount_expires_at?: string | null
          discount_started_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          effective_start_at?: string | null
          expires_at?: string | null
          id?: number
          payment_reference?: string | null
          revenuecat_product_id?: string | null
          revenuecat_subscriber_id?: string | null
          reverted_to_standard?: boolean
          source?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_discount_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_price_id?: string | null
          stripe_promotion_code_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id: string
          user_tier_id?: string | null
          validity?: unknown
        }
        Update: {
          amount_paid?: number | null
          auto_renew?: boolean
          billing_period?: string
          created_at?: string
          currency?: string
          discount_duration_months?: number | null
          discount_expires_at?: string | null
          discount_started_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          effective_start_at?: string | null
          expires_at?: string | null
          id?: number
          payment_reference?: string | null
          revenuecat_product_id?: string | null
          revenuecat_subscriber_id?: string | null
          reverted_to_standard?: boolean
          source?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_discount_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_price_id?: string | null
          stripe_promotion_code_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          updated_at?: string
          user_id?: string
          user_tier_id?: string | null
          validity?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_subscriptions_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_user_subscriptions_profile"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_subscriptions_tier"
            columns: ["user_tier_id"]
            isOneToOne: false
            referencedRelation: "user_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tier: {
        Row: {
          active: boolean
          billing_period: string
          created_at: string
          currency: string
          description: string | null
          holiday_duration_days: number
          holiday_savers: number
          id: string
          intro_allowed: boolean
          region: string
          revenuecat_product_id: string | null
          sort_order: number | null
          streak_savers: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          subscription_cost: number
          subscription_duration_months: number | null
          tier: string
          tier_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          holiday_duration_days?: number
          holiday_savers?: number
          id?: string
          intro_allowed?: boolean
          region: string
          revenuecat_product_id?: string | null
          sort_order?: number | null
          streak_savers?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subscription_cost: number
          subscription_duration_months?: number | null
          tier: string
          tier_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          holiday_duration_days?: number
          holiday_savers?: number
          id?: string
          intro_allowed?: boolean
          region?: string
          revenuecat_product_id?: string | null
          sort_order?: number | null
          streak_savers?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          subscription_cost?: number
          subscription_duration_months?: number | null
          tier?: string
          tier_type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_streak_attempts: {
        Row: {
          attempt_id: number | null
          completed_at: string | null
          num_guesses: number | null
          puzzle_date: string | null
          region: string | null
          result: string | null
          streak_day_status: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_allocated_region_region"
            columns: ["region"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "game_attempts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "game_attempts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_attempts_region_with_details: {
        Row: {
          allocated_region_id: number | null
          answer_date_canonical: string | null
          category_id: number | null
          category_name: string | null
          completed_at: string | null
          digits: string | null
          event_title: string | null
          id: number | null
          num_guesses: number | null
          puzzle_date: string | null
          question_id: number | null
          region: string | null
          result: string | null
          started_at: string | null
          streak_day_status: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_alloc_region_question"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_master_region"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_allocated_region_region"
            columns: ["region"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fk_game_attempts_alloc_region"
            columns: ["allocated_region_id"]
            isOneToOne: false
            referencedRelation: "questions_allocated_region"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qar_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "game_attempts_user_id_user_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_attempts_user_with_details: {
        Row: {
          allocated_user_id: number | null
          answer_date_canonical: string | null
          category_id: number | null
          category_name: string | null
          completed_at: string | null
          digits: string | null
          event_title: string | null
          id: number | null
          num_guesses: number | null
          place_name: string | null
          puzzle_date: string | null
          question_id: number | null
          result: string | null
          started_at: string | null
          streak_day_status: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_alloc_user_question"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_master_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_qau_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_user_allocated_user_id_fkey"
            columns: ["allocated_user_id"]
            isOneToOne: false
            referencedRelation: "questions_allocated_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_attempts_user_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "game_attempts_user_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      location_allocation_with_place_active: {
        Row: {
          allocation_active: boolean | null
          created_at: string | null
          id: number | null
          location_id: string | null
          place_active: boolean | null
          score: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_allocation_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "populated_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_allocation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_current_tier"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "location_allocation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_usage_summary: {
        Row: {
          id: number | null
          spec_id: number | null
          token_usage_generator: number | null
          token_usage_total: number | null
          token_usage_verifier: number | null
        }
        Insert: {
          id?: number | null
          spec_id?: number | null
          token_usage_generator?: number | null
          token_usage_total?: never
          token_usage_verifier?: number | null
        }
        Update: {
          id?: number | null
          spec_id?: number | null
          token_usage_generator?: number | null
          token_usage_total?: never
          token_usage_verifier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_archive_spec"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "available_question_spec"
            referencedColumns: ["id"]
          },
        ]
      }
      user_current_tier: {
        Row: {
          tier: string | null
          user_id: string | null
        }
        Insert: {
          tier?: never
          user_id?: string | null
        }
        Update: {
          tier?: never
          user_id?: string | null
        }
        Relationships: []
      }
      v_allocator_run_summary: {
        Row: {
          allocator_run_id: string | null
          demand_rows_processed: number | null
          finished_at: string | null
          started_at: string | null
          total_allocated: number | null
          total_generated: number | null
          total_unmet: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      activate_holiday_mode: {
        Args: { p_start_date?: string; p_user_id: string }
        Returns: string
      }
      activate_holiday_mode_mobile: {
        Args: { p_duration_days: number; p_user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      add_region_holiday_attempt: {
        Args: { p_puzzle_date: string; p_region: string; p_user_id: string }
        Returns: undefined
      }
      add_user_holiday_attempt: {
        Args: { p_puzzle_date: string; p_user_id: string }
        Returns: undefined
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      allocate_for_scope: {
        Args: {
          p_category_id: number
          p_question_id: number
          p_run_id: string
          p_scope_date: string
          p_scope_id: string
          p_scope_type: string
          p_slot_type: string
        }
        Returns: string
      }
      allocate_monthly_percentile_badges: { Args: never; Returns: undefined }
      archive_and_delete_job:
        | {
            Args: {
              final_status: string
              job_id: number
              p_error_context?: string
            }
            Returns: undefined
          }
        | { Args: { final_status: string; job_id: number }; Returns: undefined }
      archive_and_delete_spec: {
        Args: { p_reason: string; p_spec_id: number }
        Returns: undefined
      }
      archive_and_insert_subscription: {
        Args: {
          p_amount_paid: number
          p_auto_renew: boolean
          p_currency: string
          p_expires_at: string
          p_old_status?: string
          p_status: string
          p_stripe_customer_id: string
          p_stripe_price_id: string
          p_stripe_subscription_id: string
          p_user_id: string
          p_user_tier_id: string
        }
        Returns: undefined
      }
      calculate_cumulative_percentiles: { Args: never; Returns: undefined }
      calculate_monthly_scores: { Args: never; Returns: undefined }
      check_and_award_elementle_badge_mobile: {
        Args: {
          p_game_type: string
          p_guess_count: number
          p_region: string
          p_user_id: string
        }
        Returns: {
          awarded_at: string
          badge_category: string
          badge_count: number
          badge_id: number
          badge_name: string
          badge_threshold: number
          game_type: string
          id: number
          is_awarded: boolean
          region: string
          user_id: string
        }[]
      }
      check_and_award_percentile_badge_mobile: {
        Args: { p_game_type: string; p_region: string; p_user_id: string }
        Returns: {
          awarded_at: string
          badge_category: string
          badge_count: number
          badge_id: number
          badge_name: string
          badge_threshold: number
          game_type: string
          id: number
          is_awarded: boolean
          region: string
          user_id: string
        }[]
      }
      check_and_award_streak_badge_mobile: {
        Args: {
          p_game_type: string
          p_region: string
          p_streak: number
          p_user_id: string
        }
        Returns: {
          awarded_at: string
          badge_category: string
          badge_count: number
          badge_id: number
          badge_name: string
          badge_threshold: number
          game_type: string
          id: number
          is_awarded: boolean
          region: string
          user_id: string
        }[]
      }
      count_unplayed_region_archive: {
        Args: { rid: string; today: string }
        Returns: number
      }
      count_unplayed_user_archive: {
        Args: { today: string; uid: string }
        Returns: number
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_unattempted_allocations: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      describe_table_columns: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
          udt_name: string
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      end_holiday_mode: {
        Args: { p_acknowledge?: boolean; p_user_id: string }
        Returns: string
      }
      end_holiday_mode_mobile: {
        Args: { p_acknowledge?: boolean; p_user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_allocator_run_summary: {
        Args: never
        Returns: {
          allocator_run_id: string
          demand_rows_processed: number
          finished_at: string
          started_at: string
          total_allocated: number
          total_generated: number
          total_unmet: number
        }[]
      }
      get_current_streak_attempts: {
        Args: never
        Returns: {
          attempt_id: number
          completed_at: string
          num_guesses: number
          puzzle_date: string
          region: string
          result: string
          streak_day_status: number
          user_id: string
        }[]
      }
      get_game_attempts_region_with_details: {
        Args: never
        Returns: {
          allocated_region_id: number
          answer_date_canonical: string
          category_id: number
          category_name: string
          completed_at: string
          digits: string
          event_title: string
          id: number
          num_guesses: number
          puzzle_date: string
          question_id: number
          region: string
          result: string
          started_at: string
          streak_day_status: number
          updated_at: string
          user_id: string
        }[]
      }
      get_game_attempts_user_with_details: {
        Args: never
        Returns: {
          allocated_user_id: number
          answer_date_canonical: string
          category_id: number
          category_name: string
          completed_at: string
          digits: string
          event_title: string
          id: number
          num_guesses: number
          place_name: string
          puzzle_date: string
          question_id: number
          result: string
          started_at: string
          streak_day_status: number
          updated_at: string
          user_id: string
        }[]
      }
      get_location_allocation_with_place_active: {
        Args: never
        Returns: {
          allocation_active: boolean
          created_at: string
          id: number
          location_id: string
          place_active: boolean
          score: number
          user_id: string
        }[]
      }
      get_nearby_locations: {
        Args: { p_radius_meters?: number; p_user_id: string }
        Returns: {
          distance_meters: number
          id: number
          size_category: string
        }[]
      }
      get_questions_usage_summary: {
        Args: never
        Returns: {
          id: number
          spec_id: number
          token_usage_generator: number
          token_usage_total: number
          token_usage_verifier: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      insert_pending_subscription: {
        Args: {
          p_stripe_customer_id: string
          p_user_id: string
          p_user_tier_id: string
        }
        Returns: undefined
      }
      jwt_custom_claims: { Args: never; Returns: Json }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_spec_dead: { Args: { p_spec_id: number }; Returns: undefined }
      nightly_holiday_allowance_reset: { Args: never; Returns: undefined }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      populate_user_locations:
        | { Args: { p_user_id: string }; Returns: undefined }
        | {
            Args: { p_postcode: string; p_user_id: string }
            Returns: undefined
          }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      reallocate_jobs_for_inactive_place: {
        Args: { p_place_id: string }
        Returns: undefined
      }
      rebuild_allocation_counts: { Args: never; Returns: undefined }
      recalc_holiday_progress: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      refresh_allocation_flag_for_user_location:
        | {
            Args: { p_location_id: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: { p_location_id: string; p_user_id: string }
            Returns: undefined
          }
      reset_holiday_allowance_if_due: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      run_user_allocation: { Args: { p_user_id: string }; Returns: undefined }
      seed_available_question_spec: {
        Args: { p_region: string }
        Returns: undefined
      }
      seed_category_specs:
        | { Args: never; Returns: undefined }
        | { Args: { p_region: string }; Returns: undefined }
      seed_user_category_specs: {
        Args: { p_region: string }
        Returns: undefined
      }
      seed_user_location_specs:
        | { Args: { p_place_id: string }; Returns: undefined }
        | { Args: { p_place_id: string; p_region: string }; Returns: undefined }
      split_available_spec: {
        Args: { p_event_date: string; p_spec_id: number }
        Returns: undefined
      }
      split_spec_and_reset_job: {
        Args: {
          p_category_id: number
          p_event_date: string
          p_job_id: number
          p_reason: string
          p_region: string
        }
        Returns: Json
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      top_places_for_postcode_v3: {
        Args: { p_postcode: string }
        Returns: {
          distance_miles: number
          id: string
          local_type: string
          name: string
          score: number
        }[]
      }
      top_up_all_users_locations: { Args: never; Returns: undefined }
      top_up_user_locations: {
        Args: { p_postcode: string; p_user_id: string }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_demand_cron_schedule: {
        Args: { new_schedule: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      user_archive_demand:
        | {
            Args: { today: string }
            Returns: {
              min_threshold: number
              region: string
              seed_amount: number
              target_topup: number
              tier: string
              unplayed_archive: number
              user_id: string
            }[]
          }
        | {
            Args: { target_user?: string; today: string }
            Returns: {
              debug_info: string
              min_threshold: number
              region: string
              seed_amount: number
              target_topup: number
              tier: string
              unplayed_archive: number
              user_id: string
            }[]
          }
      user_future_demand:
        | {
            Args: { today: string }
            Returns: {
              future_count: number
              min_threshold: number
              region: string
              target_topup: number
              tier: string
              user_id: string
            }[]
          }
        | {
            Args: { target_user?: string; today: string }
            Returns: {
              future_count: number
              min_threshold: number
              region: string
              target_topup: number
              tier: string
              user_id: string
            }[]
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
    Enums: {},
  },
} as const
