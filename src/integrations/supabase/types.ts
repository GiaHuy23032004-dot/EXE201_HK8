export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string | null
          username: string | null
          email: string | null
          phone: string | null
          address: string | null
          avatar_url: string | null
          bio: string | null
          real_name: string | null
          mentor_headline: string | null
          teaching_fields: string[] | null
          experience_years: number | null
          district: string | null
          city: string | null
          location_updated_at: string | null
          portfolio_url: string | null
          role: string
          is_blocked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          username?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          real_name?: string | null
          mentor_headline?: string | null
          teaching_fields?: string[] | null
          experience_years?: number | null
          district?: string | null
          city?: string | null
          location_updated_at?: string | null
          portfolio_url?: string | null
          role?: string
          is_blocked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string | null
          username?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          real_name?: string | null
          mentor_headline?: string | null
          teaching_fields?: string[] | null
          experience_years?: number | null
          district?: string | null
          city?: string | null
          location_updated_at?: string | null
          portfolio_url?: string | null
          role?: string
          is_blocked?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          id: string
          mentor_id: string
          title: string
          description: string | null
          category: string
          format: Database["public"]["Enums"]["course_format"]
          price: number
          location: string | null
          latitude: number | null
          longitude: number | null
          location_geocoded_at: string | null
          meeting_link: string | null
          image_url: string | null
          status: Database["public"]["Enums"]["course_status"]
          is_promoted: boolean
          students_count: number
          rating: number
          review_count: number
          start_date: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          admin_note: string | null
          is_hidden: boolean
          hidden_reason: string | null
          hidden_at: string | null
          hidden_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          title: string
          description?: string | null
          category: string
          format?: Database["public"]["Enums"]["course_format"]
          price?: number
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          location_geocoded_at?: string | null
          meeting_link?: string | null
          image_url?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          is_promoted?: boolean
          students_count?: number
          rating?: number
          review_count?: number
          start_date?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          admin_note?: string | null
          is_hidden?: boolean
          hidden_reason?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          title?: string
          description?: string | null
          category?: string
          format?: Database["public"]["Enums"]["course_format"]
          price?: number
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          location_geocoded_at?: string | null
          meeting_link?: string | null
          image_url?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          is_promoted?: boolean
          students_count?: number
          rating?: number
          review_count?: number
          start_date?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          admin_note?: string | null
          is_hidden?: boolean
          hidden_reason?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "courses_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      course_schedules: {
        Row: {
          id: string
          course_id: string
          day_of_week: string
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          day_of_week: string
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          day_of_week?: string
          start_time?: string
          end_time?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "course_schedules_course_id_fkey"; columns: ["course_id"]; referencedRelation: "courses"; referencedColumns: ["id"] }
        ]
      }
      bookings: {
        Row: {
          id: string
          course_id: string
          learner_id: string
          mentor_id: string
          schedule_id: string | null
          booking_date: string
          start_time: string
          end_time: string
          phone: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          learner_id: string
          mentor_id: string
          schedule_id?: string | null
          booking_date: string
          start_time: string
          end_time: string
          phone?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          learner_id?: string
          mentor_id?: string
          schedule_id?: string | null
          booking_date?: string
          start_time?: string
          end_time?: string
          phone?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "bookings_course_id_fkey"; columns: ["course_id"]; referencedRelation: "courses"; referencedColumns: ["id"] },
          { foreignKeyName: "bookings_learner_id_fkey"; columns: ["learner_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "bookings_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      reviews: {
        Row: {
          id: string
          course_id: string
          booking_id: string | null
          learner_id: string
          rating: number
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          booking_id?: string | null
          learner_id: string
          rating: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          booking_id?: string | null
          learner_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "reviews_course_id_fkey"; columns: ["course_id"]; referencedRelation: "courses"; referencedColumns: ["id"] },
          { foreignKeyName: "reviews_learner_id_fkey"; columns: ["learner_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      saved_courses: {
        Row: {
          id: string
          user_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "saved_courses_user_id_fkey"; columns: ["user_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "saved_courses_course_id_fkey"; columns: ["course_id"]; referencedRelation: "courses"; referencedColumns: ["id"] }
        ]
      }
      transactions: {
        Row: {
          id: string
          booking_id: string | null
          learner_id: string
          mentor_id: string
          course_id: string | null
          amount: number
          platform_fee: number
          net_amount: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          txn_type: Database["public"]["Enums"]["txn_type"]
          status: Database["public"]["Enums"]["txn_status"]
          reference_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          learner_id: string
          mentor_id: string
          course_id?: string | null
          amount: number
          platform_fee?: number
          net_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          txn_type?: Database["public"]["Enums"]["txn_type"]
          status?: Database["public"]["Enums"]["txn_status"]
          reference_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          learner_id?: string
          mentor_id?: string
          course_id?: string | null
          amount?: number
          platform_fee?: number
          net_amount?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          txn_type?: Database["public"]["Enums"]["txn_type"]
          status?: Database["public"]["Enums"]["txn_status"]
          reference_code?: string | null
          created_at?: string
        }
        Relationships: []
      }
      mentor_wallets: {
        Row: {
          id: string
          mentor_id: string
          balance: number
          held_balance: number
          total_earned: number
          bank_name: string | null
          bank_account: string | null
          bank_holder: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          balance?: number
          held_balance?: number
          total_earned?: number
          bank_name?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          balance?: number
          held_balance?: number
          total_earned?: number
          bank_name?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_wallets_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      mentor_payout_methods: {
        Row: {
          id: string
          mentor_id: string
          method_type: string
          provider_name: string
          provider_code: string | null
          account_number: string
          account_holder: string
          branch: string | null
          nickname: string | null
          is_default: boolean
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          method_type: string
          provider_name: string
          provider_code?: string | null
          account_number: string
          account_holder: string
          branch?: string | null
          nickname?: string | null
          is_default?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          method_type?: string
          provider_name?: string
          provider_code?: string | null
          account_number?: string
          account_holder?: string
          branch?: string | null
          nickname?: string | null
          is_default?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_payout_methods_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      payout_method_audit_logs: {
        Row: {
          id: string
          mentor_id: string
          payout_method_id: string | null
          action: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          payout_method_id?: string | null
          action: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          payout_method_id?: string | null
          action?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "payout_method_audit_logs_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "payout_method_audit_logs_payout_method_id_fkey"; columns: ["payout_method_id"]; referencedRelation: "mentor_payout_methods"; referencedColumns: ["id"] }
        ]
      }
      mentor_verifications: {
        Row: {
          id: string
          mentor_id: string
          status: Database["public"]["Enums"]["mentor_verification_status"]
          submitted_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          admin_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          status?: Database["public"]["Enums"]["mentor_verification_status"]
          submitted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          status?: Database["public"]["Enums"]["mentor_verification_status"]
          submitted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          admin_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_verifications_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      mentor_verification_proofs: {
        Row: {
          id: string
          verification_id: string
          mentor_id: string
          proof_type: Database["public"]["Enums"]["mentor_verification_proof_type"]
          title: string
          url: string | null
          file_path: string | null
          description: string | null
          issuer: string | null
          issued_year: number | null
          file_name: string | null
          file_size_bytes: number | null
          file_mime_type: string | null
          metadata: Json
          status: string
          review_status: string
          admin_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          verification_id: string
          mentor_id: string
          proof_type: Database["public"]["Enums"]["mentor_verification_proof_type"]
          title: string
          url?: string | null
          file_path?: string | null
          description?: string | null
          issuer?: string | null
          issued_year?: number | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_mime_type?: string | null
          metadata?: Json
          status?: string
          review_status?: string
          admin_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          verification_id?: string
          mentor_id?: string
          proof_type?: Database["public"]["Enums"]["mentor_verification_proof_type"]
          title?: string
          url?: string | null
          file_path?: string | null
          description?: string | null
          issuer?: string | null
          issued_year?: number | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_mime_type?: string | null
          metadata?: Json
          status?: string
          review_status?: string
          admin_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_verification_proofs_verification_id_fkey"; columns: ["verification_id"]; referencedRelation: "mentor_verifications"; referencedColumns: ["id"] },
          { foreignKeyName: "mentor_verification_proofs_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      mentor_verification_items: {
        Row: {
          id: string
          mentor_id: string
          proof_id: string | null
          item_type: string
          review_status: string
          admin_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          proof_id?: string | null
          item_type: string
          review_status?: string
          admin_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          proof_id?: string | null
          item_type?: string
          review_status?: string
          admin_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_verification_items_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "mentor_verification_items_proof_id_fkey"; columns: ["proof_id"]; referencedRelation: "mentor_verification_proofs"; referencedColumns: ["id"] }
        ]
      }
      mentor_trust_badges: {
        Row: {
          id: string
          mentor_id: string
          badge_type: string
          status: string
          public_visible: boolean
          reason: string | null
          granted_by: string | null
          granted_at: string
          suspended_until: string | null
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          badge_type: string
          status?: string
          public_visible?: boolean
          reason?: string | null
          granted_by?: string | null
          granted_at?: string
          suspended_until?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          badge_type?: string
          status?: string
          public_visible?: boolean
          reason?: string | null
          granted_by?: string | null
          granted_at?: string
          suspended_until?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_trust_badges_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] }
        ]
      }
      mentor_badge_events: {
        Row: {
          id: string
          mentor_id: string
          badge_type: string
          event_type: string
          reason: string | null
          created_by: string | null
          report_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          badge_type: string
          event_type: string
          reason?: string | null
          created_by?: string | null
          report_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          badge_type?: string
          event_type?: string
          reason?: string | null
          created_by?: string | null
          report_id?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_badge_events_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "mentor_badge_events_report_id_fkey"; columns: ["report_id"]; referencedRelation: "reports"; referencedColumns: ["id"] }
        ]
      }
      wallet_transactions: {
        Row: {
          id: string
          mentor_id: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          description: string
          delta: number
          balance_after: number
          reference_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          description: string
          delta: number
          balance_after: number
          reference_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          description?: string
          delta?: number
          balance_after?: number
          reference_code?: string | null
          created_at?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          id: string
          mentor_id: string
          payout_method_id: string | null
          reference_code: string | null
          amount: number
          bank_name: string
          bank_account: string
          bank_holder: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          admin_note: string | null
          rejection_reason: string | null
          processed_reference: string | null
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          payout_method_id?: string | null
          reference_code?: string | null
          amount: number
          bank_name: string
          bank_account: string
          bank_holder: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          admin_note?: string | null
          rejection_reason?: string | null
          processed_reference?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          payout_method_id?: string | null
          reference_code?: string | null
          amount?: number
          bank_name?: string
          bank_account?: string
          bank_holder?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          admin_note?: string | null
          rejection_reason?: string | null
          processed_reference?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      promoted_listings: {
        Row: {
          id: string
          course_id: string
          mentor_id: string
          fee: number
          days: number
          status: Database["public"]["Enums"]["promotion_status"]
          starts_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          mentor_id: string
          fee?: number
          days?: number
          status?: Database["public"]["Enums"]["promotion_status"]
          starts_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          mentor_id?: string
          fee?: number
          days?: number
          status?: Database["public"]["Enums"]["promotion_status"]
          starts_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          type: Database["public"]["Enums"]["report_type"]
          title: string
          reason: string
          detail: string | null
          reporter_id: string
          reported_user_id: string | null
          course_id: string | null
          booking_id: string | null
          transaction_id: string | null
          comment_id: string | null
          reviewed_target_snapshot: Json
          status: Database["public"]["Enums"]["report_status"]
          admin_verdict: string | null
          admin_email: string | null
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: Database["public"]["Enums"]["report_type"]
          title: string
          reason: string
          detail?: string | null
          reporter_id: string
          reported_user_id?: string | null
          course_id?: string | null
          booking_id?: string | null
          transaction_id?: string | null
          comment_id?: string | null
          reviewed_target_snapshot?: Json
          status?: Database["public"]["Enums"]["report_status"]
          admin_verdict?: string | null
          admin_email?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: Database["public"]["Enums"]["report_type"]
          title?: string
          reason?: string
          detail?: string | null
          reporter_id?: string
          reported_user_id?: string | null
          course_id?: string | null
          booking_id?: string | null
          transaction_id?: string | null
          comment_id?: string | null
          reviewed_target_snapshot?: Json
          status?: Database["public"]["Enums"]["report_status"]
          admin_verdict?: string | null
          admin_email?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      report_attachments: {
        Row: {
          id: string
          report_id: string
          file_url: string
          file_path: string | null
          file_type: string | null
          file_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          file_url: string
          file_path?: string | null
          file_type?: string | null
          file_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          file_url?: string
          file_path?: string | null
          file_type?: string | null
          file_name?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "report_attachments_report_id_fkey"; columns: ["report_id"]; referencedRelation: "reports"; referencedColumns: ["id"] }
        ]
      }
      mentor_strikes: {
        Row: {
          id: string
          mentor_id: string
          report_id: string | null
          level: number
          reason: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          report_id?: string | null
          level: number
          reason: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          report_id?: string | null
          level?: number
          reason?: string
          expires_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      mentor_restrictions: {
        Row: {
          id: string
          mentor_id: string
          restriction_type: string
          reason: string
          starts_at: string
          expires_at: string | null
          created_by: string | null
          report_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mentor_id: string
          restriction_type: string
          reason: string
          starts_at?: string
          expires_at?: string | null
          created_by?: string | null
          report_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mentor_id?: string
          restriction_type?: string
          reason?: string
          starts_at?: string
          expires_at?: string | null
          created_by?: string | null
          report_id?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "mentor_restrictions_mentor_id_fkey"; columns: ["mentor_id"]; referencedRelation: "profiles"; referencedColumns: ["user_id"] },
          { foreignKeyName: "mentor_restrictions_report_id_fkey"; columns: ["report_id"]; referencedRelation: "reports"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_email_by_username: {
        Args: { _username: string }
        Returns: string
      }
      has_role: {
        Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      create_mentor_payout_method: {
        Args: {
          method_type: string
          provider_name: string
          provider_code?: string | null
          account_number: string
          account_holder: string
          branch?: string | null
          nickname?: string | null
          is_default?: boolean
          confirmed: boolean
        }
        Returns: Database["public"]["Tables"]["mentor_payout_methods"]["Row"]
      }
      set_default_mentor_payout_method: {
        Args: { payout_method_id: string }
        Returns: Database["public"]["Tables"]["mentor_payout_methods"]["Row"]
      }
      delete_mentor_payout_method: {
        Args: { payout_method_id: string }
        Returns: boolean
      }
      request_mentor_withdrawal: {
        Args: {
          amount: number
          payout_method_id: string
        }
        Returns: Database["public"]["Tables"]["withdrawal_requests"]["Row"]
      }
      admin_process_withdrawal_request: {
        Args: {
          withdrawal_request_id: string
          new_status: Database["public"]["Enums"]["withdrawal_status"]
          admin_note?: string | null
          processed_reference?: string | null
        }
        Returns: Database["public"]["Tables"]["withdrawal_requests"]["Row"]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      course_format: "online" | "offline"
      course_status: "pending" | "approved" | "rejected"
      booking_status: "pending" | "upcoming" | "completed" | "cancelled" | "declined"
      mentor_verification_status: "unverified" | "draft" | "pending" | "approved" | "revision_requested" | "rejected" | "revoked"
      mentor_verification_proof_type: "social" | "certificate" | "portfolio" | "teaching_evidence"
      payment_method: "later" | "platform" | "credit_card" | "bank_transfer" | "e_wallet"
      txn_status: "success" | "refunded" | "pending" | "failed"
      txn_type: "online" | "offline" | "product"
      wallet_kind: "sale" | "withdraw" | "refund"
      withdrawal_status: "pending" | "paid" | "rejected"
      report_type: "course" | "mentor" | "comment" | "payment"
      report_status: "pending" | "resolved" | "dismissed" | "appealed"
      promotion_status: "active" | "expired" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Update"]

export type Enums<
  EnumName extends keyof DefaultSchema["Enums"]
> = DefaultSchema["Enums"][EnumName]

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      course_format: ["online", "offline"],
      course_status: ["pending", "approved", "rejected"],
      booking_status: ["pending", "upcoming", "completed", "cancelled", "declined"],
      mentor_verification_status: ["unverified", "draft", "pending", "approved", "revision_requested", "rejected", "revoked"],
      mentor_verification_proof_type: ["social", "certificate", "portfolio", "teaching_evidence"],
      payment_method: ["later", "platform", "credit_card", "bank_transfer", "e_wallet"],
      txn_status: ["success", "refunded", "pending", "failed"],
      txn_type: ["online", "offline", "product"],
      wallet_kind: ["sale", "withdraw", "refund"],
      withdrawal_status: ["pending", "paid", "rejected"],
      report_type: ["course", "mentor", "comment", "payment"],
      report_status: ["pending", "resolved", "dismissed", "appealed"],
      promotion_status: ["active", "expired", "pending"],
    },
  },
} as const
