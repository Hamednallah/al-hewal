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
      admin_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: number
          ip_hash: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: number
          ip_hash?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: number
          ip_hash?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invites: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          tier: Database["public"]["Enums"]["admin_tier"]
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          tier: Database["public"]["Enums"]["admin_tier"]
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          tier?: Database["public"]["Enums"]["admin_tier"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          language_pref: string
          last_login_at: string | null
          status: Database["public"]["Enums"]["admin_status"]
          tier: Database["public"]["Enums"]["admin_tier"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          language_pref?: string
          last_login_at?: string | null
          status?: Database["public"]["Enums"]["admin_status"]
          tier?: Database["public"]["Enums"]["admin_tier"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          language_pref?: string
          last_login_at?: string | null
          status?: Database["public"]["Enums"]["admin_status"]
          tier?: Database["public"]["Enums"]["admin_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      amenities: {
        Row: {
          category: string | null
          icon: string
          id: number
          key: string
          label_ar: string
          label_en: string
        }
        Insert: {
          category?: string | null
          icon: string
          id?: number
          key: string
          label_ar: string
          label_en: string
        }
        Update: {
          category?: string | null
          icon?: string
          id?: number
          key?: string
          label_ar?: string
          label_en?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          city: string | null
          contacted_at: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          inquiry_type: Database["public"]["Enums"]["inquiry_type"]
          ip_hash: string | null
          locale: string
          message: string | null
          name: string | null
          notes: string | null
          phone: string | null
          property_id: string | null
          referrer: string | null
          region: string | null
          source: Database["public"]["Enums"]["lead_source"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          city?: string | null
          contacted_at?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"]
          ip_hash?: string | null
          locale: string
          message?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          referrer?: string | null
          region?: string | null
          source: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          city?: string | null
          contacted_at?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"]
          ip_hash?: string | null
          locale?: string
          message?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          referrer?: string | null
          region?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          id: number
          locale: string
          path: string
          property_id: string | null
          region: string | null
          visitor_hash: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: number
          locale: string
          path: string
          property_id?: string | null
          region?: string | null
          visitor_hash: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: number
          locale?: string
          path?: string
          property_id?: string | null
          region?: string | null
          visitor_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_views_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views_daily: {
        Row: {
          country: string
          date: string
          locale: string
          property_id: string
          region: string
          view_count: number
        }
        Insert: {
          country?: string
          date: string
          locale: string
          property_id: string
          region?: string
          view_count: number
        }
        Update: {
          country?: string
          date?: string
          locale?: string
          property_id?: string
          region?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "page_views_daily_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views_default: {
        Row: {
          country: string | null
          created_at: string
          id: number
          locale: string
          path: string
          property_id: string | null
          region: string | null
          visitor_hash: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: number
          locale: string
          path: string
          property_id?: string | null
          region?: string | null
          visitor_hash: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: number
          locale?: string
          path?: string
          property_id?: string | null
          region?: string | null
          visitor_hash?: string
        }
        Relationships: []
      }
      page_views_y2026m05: {
        Row: {
          country: string | null
          created_at: string
          id: number
          locale: string
          path: string
          property_id: string | null
          region: string | null
          visitor_hash: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: number
          locale: string
          path: string
          property_id?: string | null
          region?: string | null
          visitor_hash: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: number
          locale?: string
          path?: string
          property_id?: string | null
          region?: string | null
          visitor_hash?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          area_sqm: number
          bathrooms: number
          bedrooms: number
          city: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description_ar: string
          description_en: string
          district: string | null
          facade: string | null
          featured: boolean
          featured_order: number | null
          google_maps_url: string | null
          id: string
          lat: number | null
          lng: number | null
          plot_number: string | null
          price_negotiable: boolean
          price_sar: number
          search_vector: unknown
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          street_width_m: number | null
          title_ar: string
          title_en: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
        }
        Insert: {
          area_sqm: number
          bathrooms: number
          bedrooms: number
          city: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_ar: string
          description_en: string
          district?: string | null
          facade?: string | null
          featured?: boolean
          featured_order?: number | null
          google_maps_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          plot_number?: string | null
          price_negotiable?: boolean
          price_sar: number
          search_vector?: unknown
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          street_width_m?: number | null
          title_ar: string
          title_en: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Update: {
          area_sqm?: number
          bathrooms?: number
          bedrooms?: number
          city?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_ar?: string
          description_en?: string
          district?: string | null
          facade?: string | null
          featured?: boolean
          featured_order?: number | null
          google_maps_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          plot_number?: string | null
          price_negotiable?: boolean
          price_sar?: number
          search_vector?: unknown
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          street_width_m?: number | null
          title_ar?: string
          title_en?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenities: {
        Row: {
          amenity_id: number
          property_id: string
        }
        Insert: {
          amenity_id: number
          property_id: string
        }
        Update: {
          amenity_id?: number
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          alt_ar: string
          alt_en: string
          blob_pathname: string
          blob_url: string
          blurhash: string | null
          bytes: number
          created_at: string
          height: number
          id: string
          is_hero: boolean
          position: number
          property_id: string
          webp_url: string | null
          width: number
        }
        Insert: {
          alt_ar: string
          alt_en: string
          blob_pathname: string
          blob_url: string
          blurhash?: string | null
          bytes: number
          created_at?: string
          height: number
          id?: string
          is_hero?: boolean
          position?: number
          property_id: string
          webp_url?: string | null
          width: number
        }
        Update: {
          alt_ar?: string
          alt_en?: string
          blob_pathname?: string
          blob_url?: string
          blurhash?: string | null
          bytes?: number
          created_at?: string
          height?: number
          id?: string
          is_hero?: boolean
          position?: number
          property_id?: string
          webp_url?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_clicks: {
        Row: {
          created_at: string
          created_day: string | null
          id: number
          lead_id: string | null
          property_id: string | null
        }
        Insert: {
          created_at?: string
          created_day?: string | null
          id?: number
          lead_id?: string | null
          property_id?: string | null
        }
        Update: {
          created_at?: string
          created_day?: string | null
          id?: number
          lead_id?: string | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_clicks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_clicks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      admin_status: "active" | "deactivated" | "pending_invite"
      admin_tier: "super_admin" | "standard_admin"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "invite"
        | "promote"
        | "deactivate"
        | "feature_toggle"
      inquiry_type: "general" | "maintenance"
      lead_source: "whatsapp" | "contact_form" | "call_click"
      property_status:
        | "draft"
        | "available"
        | "starting_soon"
        | "reserved"
        | "sold"
      property_type: "villa" | "duplex" | "apartment" | "investment"
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
      admin_status: ["active", "deactivated", "pending_invite"],
      admin_tier: ["super_admin", "standard_admin"],
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "invite",
        "promote",
        "deactivate",
        "feature_toggle",
      ],
      inquiry_type: ["general", "maintenance"],
      lead_source: ["whatsapp", "contact_form", "call_click"],
      property_status: [
        "draft",
        "available",
        "starting_soon",
        "reserved",
        "sold",
      ],
      property_type: ["villa", "duplex", "apartment", "investment"],
    },
  },
} as const

