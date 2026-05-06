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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean | null
          label: string | null
          phone: string
          postal_code: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_message_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      backup_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          is_used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_variant_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_variant_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_variant_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          product_count: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          product_count?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          product_count?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          is_from_admin: boolean | null
          is_read: boolean | null
          message: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_from_admin?: boolean | null
          is_read?: boolean | null
          message: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_from_admin?: boolean | null
          is_read?: boolean | null
          message?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_support_conversations: {
        Row: {
          assigned_admin_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_admin_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_admin_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_support_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_from_admin: boolean
          is_read: boolean
          message: string
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          is_read?: boolean
          message: string
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          is_read?: boolean
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      comparison_history: {
        Row: {
          compared_at: string
          id: string
          product_ids: string[]
          user_id: string
        }
        Insert: {
          compared_at?: string
          id?: string
          product_ids: string[]
          user_id: string
        }
        Update: {
          compared_at?: string
          id?: string
          product_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_amount: number | null
          starts_at: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          starts_at?: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_amount?: number | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      gift_cards: {
        Row: {
          balance: number
          code: string
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          initial_value: number
          is_active: boolean | null
          redeemed_by: string | null
        }
        Insert: {
          balance: number
          code: string
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          initial_value: number
          is_active?: boolean | null
          redeemed_by?: string | null
        }
        Update: {
          balance?: number
          code?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          initial_value?: number
          is_active?: boolean | null
          redeemed_by?: string | null
        }
        Relationships: []
      }
      group_buy_participants: {
        Row: {
          group_buy_id: string
          id: string
          joined_at: string
          payment_reference: string | null
          payment_status: string | null
          quantity: number | null
          shipping_address: Json | null
          user_id: string
          variant_id: string | null
        }
        Insert: {
          group_buy_id: string
          id?: string
          joined_at?: string
          payment_reference?: string | null
          payment_status?: string | null
          quantity?: number | null
          shipping_address?: Json | null
          user_id: string
          variant_id?: string | null
        }
        Update: {
          group_buy_id?: string
          id?: string
          joined_at?: string
          payment_reference?: string | null
          payment_status?: string | null
          quantity?: number | null
          shipping_address?: Json | null
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_buy_participants_group_buy_id_fkey"
            columns: ["group_buy_id"]
            isOneToOne: false
            referencedRelation: "group_buys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_buy_participants_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_buys: {
        Row: {
          created_at: string
          created_by: string
          current_participants: number | null
          discount_percentage: number | null
          expires_at: string
          id: string
          max_participants: number | null
          min_participants: number
          product_id: string
          status: Database["public"]["Enums"]["group_buy_status"] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_participants?: number | null
          discount_percentage?: number | null
          expires_at: string
          id?: string
          max_participants?: number | null
          min_participants: number
          product_id: string
          status?: Database["public"]["Enums"]["group_buy_status"] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_participants?: number | null
          discount_percentage?: number | null
          expires_at?: string
          id?: string
          max_participants?: number | null
          min_participants?: number
          product_id?: string
          status?: Database["public"]["Enums"]["group_buy_status"] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_buys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          created_at: string
          description: string
          id: string
          order_id: string | null
          points: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          order_id?: string | null
          points: number
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          points?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_broadcast: boolean | null
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_broadcast?: boolean | null
          is_read?: boolean | null
          message: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_broadcast?: boolean | null
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_name: string
          product_variant_id: string
          quantity: number
          total_price: number
          unit_price: number
          variant_details: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_name: string
          product_variant_id: string
          quantity: number
          total_price: number
          unit_price: number
          variant_details?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string
          product_variant_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          variant_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          location_name: string | null
          longitude: number | null
          notes: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          notes?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          notes?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_notes: string | null
          created_at: string
          estimated_delivery_end: string | null
          estimated_delivery_start: string | null
          group_buy_id: string | null
          id: string
          is_group_buy_master: boolean | null
          notes: string | null
          order_number: string
          packaging_cost: number | null
          packaging_type: string | null
          parent_order_id: string | null
          payment_reference: string | null
          shipping_address: Json | null
          shipping_class_id: string | null
          shipping_price: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          total_amount: number
          updated_at: string
          user_id: string
          wallet_credit_used: number | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          estimated_delivery_end?: string | null
          estimated_delivery_start?: string | null
          group_buy_id?: string | null
          id?: string
          is_group_buy_master?: boolean | null
          notes?: string | null
          order_number: string
          packaging_cost?: number | null
          packaging_type?: string | null
          parent_order_id?: string | null
          payment_reference?: string | null
          shipping_address?: Json | null
          shipping_class_id?: string | null
          shipping_price?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal: number
          total_amount: number
          updated_at?: string
          user_id: string
          wallet_credit_used?: number | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          estimated_delivery_end?: string | null
          estimated_delivery_start?: string | null
          group_buy_id?: string | null
          id?: string
          is_group_buy_master?: boolean | null
          notes?: string | null
          order_number?: string
          packaging_cost?: number | null
          packaging_type?: string | null
          parent_order_id?: string | null
          payment_reference?: string | null
          shipping_address?: Json | null
          shipping_class_id?: string | null
          shipping_price?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
          wallet_credit_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_group_buy_id_fkey"
            columns: ["group_buy_id"]
            isOneToOne: false
            referencedRelation: "group_buys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_class_id_fkey"
            columns: ["shipping_class_id"]
            isOneToOne: false
            referencedRelation: "shipping_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      price_drop_alerts: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          target_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          target_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          target_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_drop_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bundles: {
        Row: {
          bundled_product_id: string | null
          created_at: string | null
          id: string
          product_id: string | null
        }
        Insert: {
          bundled_product_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
        }
        Update: {
          bundled_product_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_bundles_bundled_product_id_fkey"
            columns: ["bundled_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bundles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          order_index: number | null
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          order_index?: number | null
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          order_index?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          created_at: string
          id: string
          is_published: boolean | null
          product_id: string
          question: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          id?: string
          is_published?: boolean | null
          product_id: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          created_at?: string
          id?: string
          is_published?: boolean | null
          product_id?: string
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shipping_rules: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean | null
          price: number
          product_id: string
          shipping_class_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean | null
          price: number
          product_id: string
          shipping_class_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean | null
          price?: number
          product_id?: string
          shipping_class_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_shipping_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shipping_rules_shipping_class_id_fkey"
            columns: ["shipping_class_id"]
            isOneToOne: false
            referencedRelation: "shipping_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean | null
          price_override: number | null
          product_id: string
          size: string | null
          sku: string | null
          stock: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          price_override?: number | null
          product_id: string
          size?: string | null
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          price_override?: number | null
          product_id?: string
          size?: string | null
          sku?: string | null
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          description: string | null
          flash_deal_ends_at: string | null
          id: string
          is_active: boolean | null
          is_flash_deal: boolean | null
          is_fragile: boolean
          is_free_shipping: boolean | null
          is_group_buy_eligible: boolean | null
          is_ready_now: boolean | null
          item_code: string
          name: string
          product_number: string | null
          rating: number | null
          reinforced_packaging_cost: number | null
          review_count: number | null
          updated_at: string
        }
        Insert: {
          base_price: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          flash_deal_ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_flash_deal?: boolean | null
          is_fragile?: boolean
          is_free_shipping?: boolean | null
          is_group_buy_eligible?: boolean | null
          is_ready_now?: boolean | null
          item_code: string
          name: string
          product_number?: string | null
          rating?: number | null
          reinforced_packaging_cost?: number | null
          review_count?: number | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          flash_deal_ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_flash_deal?: boolean | null
          is_fragile?: boolean
          is_free_shipping?: boolean | null
          is_group_buy_eligible?: boolean | null
          is_ready_now?: boolean | null
          item_code?: string
          name?: string
          product_number?: string | null
          rating?: number | null
          reinforced_packaging_cost?: number | null
          review_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birthday: string | null
          created_at: string
          email: string | null
          google_id: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          google_id?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          google_id?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          generated_at: string
          id: string
          order_id: string
          pdf_url: string | null
          qr_code: string | null
          receipt_number: string
        }
        Insert: {
          generated_at?: string
          id?: string
          order_id: string
          pdf_url?: string | null
          qr_code?: string | null
          receipt_number: string
        }
        Update: {
          generated_at?: string
          id?: string
          order_id?: string
          pdf_url?: string | null
          qr_code?: string | null
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          total_referrals: number | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          total_referrals?: number | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          total_referrals?: number | null
          user_id?: string
        }
        Relationships: []
      }
      referral_tracking: {
        Row: {
          created_at: string
          id: string
          referred_user_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          order_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string
          refund_amount: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          order_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          refund_amount?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          order_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          refund_amount?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_response: string | null
          admin_response_at: string | null
          comment: string | null
          created_at: string
          id: string
          image_url: string | null
          is_approved: boolean | null
          is_verified: boolean | null
          order_id: string | null
          product_id: string
          rating: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          admin_response_at?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean | null
          is_verified?: boolean | null
          order_id?: string | null
          product_id: string
          rating: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          admin_response_at?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean | null
          is_verified?: boolean | null
          order_id?: string | null
          product_id?: string
          rating?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      shipping_classes: {
        Row: {
          base_price: number | null
          created_at: string
          estimated_days_max: number
          estimated_days_min: number
          id: string
          is_active: boolean | null
          name: string
          shipping_type_id: string
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          estimated_days_max: number
          estimated_days_min: number
          id?: string
          is_active?: boolean | null
          name: string
          shipping_type_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          created_at?: string
          estimated_days_max?: number
          estimated_days_min?: number
          id?: string
          is_active?: boolean | null
          name?: string
          shipping_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_classes_shipping_type_id_fkey"
            columns: ["shipping_type_id"]
            isOneToOne: false
            referencedRelation: "shipping_types"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_info: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string
          location: string | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location?: string | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          location?: string | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          order_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          order_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          order_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_expired_group_buys: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "customer" | "manager" | "admin"
      coupon_type: "percentage" | "fixed_amount"
      group_buy_status: "open" | "filled" | "closed" | "cancelled"
      order_status:
        | "pending"
        | "payment_received"
        | "order_processed"
        | "order_placed"
        | "confirmed"
        | "processing"
        | "packed_for_delivery"
        | "shipped"
        | "in_transit"
        | "in_ghana"
        | "ready_for_delivery"
        | "handed_to_courier"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "refunded"
      order_status_old:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "refunded"
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
      app_role: ["customer", "manager", "admin"],
      coupon_type: ["percentage", "fixed_amount"],
      group_buy_status: ["open", "filled", "closed", "cancelled"],
      order_status: [
        "pending",
        "payment_received",
        "order_processed",
        "order_placed",
        "confirmed",
        "processing",
        "packed_for_delivery",
        "shipped",
        "in_transit",
        "in_ghana",
        "ready_for_delivery",
        "handed_to_courier",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
      ],
      order_status_old: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
      ],
    },
  },
} as const
