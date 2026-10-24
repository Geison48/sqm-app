
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"description_en": string | null,"description_pt": string | null,"id": string,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"description_en"?: string | null,"description_pt"?: string | null,"id"?: string,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"description_en"?: string | null,"description_pt"?: string | null,"id"?: string,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"attachments": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"description": string | null,"entity_id": string,"entity_table": string,"file_name": string,"id": string,"internal_only": boolean,"mime_type": string | null,"size_bytes": number | null,"storage_bucket": string,"storage_path": string,"supersedes_id": string | null,"supplier_id": string | null,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"entity_id": string,"entity_table": string,"file_name": string,"id"?: string,"internal_only"?: boolean,"mime_type"?: string | null,"size_bytes"?: number | null,"storage_bucket"?: string,"storage_path": string,"supersedes_id"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"entity_id"?: string,"entity_table"?: string,"file_name"?: string,"id"?: string,"internal_only"?: boolean,"mime_type"?: string | null,"size_bytes"?: number | null,"storage_bucket"?: string,"storage_path"?: string,"supersedes_id"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "attachments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": Database["public"]['Enums']["app_role"] | null,"after": Json | null,"at": string,"before": Json | null,"changed_fields": (string)[],"id": number,"record_id": string,"supplier_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"changed_fields"?: (string)[],"id"?: never,"record_id": string,"supplier_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["app_role"] | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"changed_fields"?: (string)[],"id"?: never,"record_id"?: string,"supplier_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"suppliers": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"country_code": string,"created_at": string,"created_by": string | null,"id": string,"legal_name": string,"responsible_sqe_id": string | null,"tax_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"legal_name": string,"responsible_sqe_id"?: string | null,"tax_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"legal_name"?: string,"responsible_sqe_id"?: string | null,"tax_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_responsible_sqe_fkey"
      columns: ["responsible_sqe_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"email": string,"full_name": string,"id": string,"invited_at": string | null,"invited_by": string | null,"language": Database["public"]['Enums']["app_language"],"role": Database["public"]['Enums']["app_role"],"supplier_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email": string,"full_name": string,"id": string,"invited_at"?: string | null,"invited_by"?: string | null,"language"?: Database["public"]['Enums']["app_language"],"role": Database["public"]['Enums']["app_role"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"invited_at"?: string | null,"invited_by"?: string | null,"language"?: Database["public"]['Enums']["app_language"],"role"?: Database["public"]['Enums']["app_role"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "users_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_access_supplier":
{ Args: { "p_supplier_id": string }; Returns: boolean
                           },
"can_invite":
{ Args: { "p_role": Database["public"]['Enums']["app_role"],"p_supplier_id"?: string }; Returns: boolean
                           },
"can_manage_supplier":
{ Args: { "p_supplier_id": string }; Returns: boolean
                           },
"can_write_supplier_row":
{ Args: { "p_supplier_id": string }; Returns: boolean
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"current_supplier_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_internal":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_sqm":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "app_language": "pt-BR"|"en","app_role": "sqe"|"sqm"|"supplier"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_language": ["pt-BR", "en"],"app_role": ["sqe", "sqm", "supplier"]
          }
        }
} as const
