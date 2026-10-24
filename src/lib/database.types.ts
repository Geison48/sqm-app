
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
                },"certifications": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"certificate_number": string | null,"created_at": string,"created_by": string | null,"id": string,"issued_on": string | null,"issuer": string | null,"scope": string | null,"standard_id": string | null,"standard_name": string,"sub_supplier_id": string | null,"supplier_id": string,"updated_at": string,"updated_by": string | null,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"certificate_number"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"issued_on"?: string | null,"issuer"?: string | null,"scope"?: string | null,"standard_id"?: string | null,"standard_name": string,"sub_supplier_id"?: string | null,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null,"valid_until"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"certificate_number"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"issued_on"?: string | null,"issuer"?: string | null,"scope"?: string | null,"standard_id"?: string | null,"standard_name"?: string,"sub_supplier_id"?: string | null,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "certifications_standard_id_fkey"
      columns: ["standard_id"]
isOneToOne: false
      referencedRelation: "standards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certifications_sub_supplier_id_fkey"
      columns: ["sub_supplier_id"]
isOneToOne: false
      referencedRelation: "sub_suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certifications_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"component_standards": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"component_id": string,"created_at": string,"created_by": string | null,"id": string,"standard_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"standard_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"standard_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "component_standards_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "component_standards_standard_id_fkey"
      columns: ["standard_id"]
isOneToOne: false
      referencedRelation: "standards"
      referencedColumns: ["id"]
    }
                  ]
                },"components": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"control_plan_ref": string | null,"created_at": string,"created_by": string | null,"criticality": string,"description": string,"drawing_revision": string | null,"gw_code": string,"id": string,"notes": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"control_plan_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"criticality"?: string,"description": string,"drawing_revision"?: string | null,"gw_code": string,"id"?: string,"notes"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"control_plan_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"criticality"?: string,"description"?: string,"drawing_revision"?: string | null,"gw_code"?: string,"id"?: string,"notes"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"contact_roles": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"is_system": boolean,"label_en": string,"label_pt": string,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en": string,"label_pt": string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en"?: string,"label_pt"?: string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"contacts": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"email": string | null,"full_name": string,"id": string,"is_primary": boolean,"job_title": string | null,"phone": string | null,"plant_id": string | null,"role_code": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"is_primary"?: boolean,"job_title"?: string | null,"phone"?: string | null,"plant_id"?: string | null,"role_code": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"is_primary"?: boolean,"job_title"?: string | null,"phone"?: string | null,"plant_id"?: string | null,"role_code"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_role_code_fkey"
      columns: ["role_code"]
isOneToOne: false
      referencedRelation: "contact_roles"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "contacts_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"dedupe_key": string | null,"email_sent_at": string | null,"entity_id": string | null,"entity_table": string | null,"event_code": string,"id": string,"link_path": string | null,"params": NonNullable<Json>,"read_at": string | null,"recipient_id": string,"supplier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dedupe_key"?: string | null,"email_sent_at"?: string | null,"entity_id"?: string | null,"entity_table"?: string | null,"event_code": string,"id"?: string,"link_path"?: string | null,"params"?: NonNullable<Json>,"read_at"?: string | null,"recipient_id": string,"supplier_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string | null,"email_sent_at"?: string | null,"entity_id"?: string | null,"entity_table"?: string | null,"event_code"?: string,"id"?: string,"link_path"?: string | null,"params"?: NonNullable<Json>,"read_at"?: string | null,"recipient_id"?: string,"supplier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"plants": {
                  Row: {
                    "address_line": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"city": string | null,"country_code": string,"created_at": string,"created_by": string | null,"id": string,"is_main": boolean,"name": string,"notes": string | null,"postal_code": string | null,"state": string | null,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_main"?: boolean,"name": string,"notes"?: string | null,"postal_code"?: string | null,"state"?: string | null,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "address_line"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"city"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_main"?: boolean,"name"?: string,"notes"?: string | null,"postal_code"?: string | null,"state"?: string | null,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "plants_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"qualification_step_types": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"is_system": boolean,"label_en": string,"label_pt": string,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en": string,"label_pt": string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en"?: string,"label_pt"?: string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"qualification_steps": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"comments": string | null,"created_at": string,"created_by": string | null,"id": string,"performed_on": string | null,"qualification_id": string,"result": string,"score": number | null,"step_code": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"comments"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"performed_on"?: string | null,"qualification_id": string,"result"?: string,"score"?: number | null,"step_code": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"comments"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"performed_on"?: string | null,"qualification_id"?: string,"result"?: string,"score"?: number | null,"step_code"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "qualification_steps_qualification_id_fkey"
      columns: ["qualification_id"]
isOneToOne: false
      referencedRelation: "qualifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qualification_steps_step_code_fkey"
      columns: ["step_code"]
isOneToOne: false
      referencedRelation: "qualification_step_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "qualification_steps_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"qualifications": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"concluded_on": string | null,"created_at": string,"created_by": string | null,"final_opinion": string | null,"id": string,"purchasing_contact": string | null,"status": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"concluded_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"final_opinion"?: string | null,"id"?: string,"purchasing_contact"?: string | null,"status"?: string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"concluded_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"final_opinion"?: string | null,"id"?: string,"purchasing_contact"?: string | null,"status"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "qualifications_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"standard_requirements": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"item_code": string,"kind": string,"sort_order": number,"standard_id": string,"text_en": string,"text_pt": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"item_code": string,"kind"?: string,"sort_order"?: number,"standard_id": string,"text_en": string,"text_pt": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"item_code"?: string,"kind"?: string,"sort_order"?: number,"standard_id"?: string,"text_en"?: string,"text_pt"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "standard_requirements_standard_id_fkey"
      columns: ["standard_id"]
isOneToOne: false
      referencedRelation: "standards"
      referencedColumns: ["id"]
    }
                  ]
                },"standards": {
                  Row: {
                    "application": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"issuer": string | null,"notes": string | null,"revision": string | null,"title_en": string,"title_pt": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "application": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"issuer"?: string | null,"notes"?: string | null,"revision"?: string | null,"title_en": string,"title_pt": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "application"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"issuer"?: string | null,"notes"?: string | null,"revision"?: string | null,"title_en"?: string,"title_pt"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"sub_supplier_components": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"component_id": string,"created_at": string,"created_by": string | null,"id": string,"sub_supplier_id": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"sub_supplier_id": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"sub_supplier_id"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sub_supplier_components_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_supplier_components_sub_supplier_id_fkey"
      columns: ["sub_supplier_id"]
isOneToOne: false
      referencedRelation: "sub_suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sub_supplier_components_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"sub_suppliers": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"country_code": string | null,"created_at": string,"created_by": string | null,"id": string,"material": string | null,"name": string,"notes": string | null,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"country_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"material"?: string | null,"name": string,"notes"?: string | null,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"country_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"material"?: string | null,"name"?: string,"notes"?: string | null,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sub_suppliers_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"supplier_components": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"component_id": string,"created_at": string,"created_by": string | null,"id": string,"supplier_id": string,"supplier_part_number": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"supplier_id": string,"supplier_part_number"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"supplier_id"?: string,"supplier_part_number"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_components_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_components_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"supplier_status_history": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"from_status": string | null,"id": string,"justification": string | null,"supplier_id": string,"to_status": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"from_status"?: string | null,"id"?: string,"justification"?: string | null,"supplier_id": string,"to_status": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"from_status"?: string | null,"id"?: string,"justification"?: string | null,"supplier_id"?: string,"to_status"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_status_history_from_status_fkey"
      columns: ["from_status"]
isOneToOne: false
      referencedRelation: "supplier_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "supplier_status_history_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_status_history_to_status_fkey"
      columns: ["to_status"]
isOneToOne: false
      referencedRelation: "supplier_statuses"
      referencedColumns: ["code"]
    }
                  ]
                },"supplier_statuses": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"is_system": boolean,"label_en": string,"label_pt": string,"sort_order": number,"tone": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en": string,"label_pt": string,"sort_order"?: number,"tone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en"?: string,"label_pt"?: string,"sort_order"?: number,"tone"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"suppliers": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"country_code": string,"created_at": string,"created_by": string | null,"criticality": string,"id": string,"legal_name": string,"notes": string | null,"responsible_sqe_id": string | null,"status_code": string,"tax_id": string | null,"trade_name": string | null,"updated_at": string,"updated_by": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"criticality"?: string,"id"?: string,"legal_name": string,"notes"?: string | null,"responsible_sqe_id"?: string | null,"status_code"?: string,"tax_id"?: string | null,"trade_name"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"country_code"?: string,"created_at"?: string,"created_by"?: string | null,"criticality"?: string,"id"?: string,"legal_name"?: string,"notes"?: string | null,"responsible_sqe_id"?: string | null,"status_code"?: string,"tax_id"?: string | null,"trade_name"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_responsible_sqe_fkey"
      columns: ["responsible_sqe_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "suppliers_status_code_fkey"
      columns: ["status_code"]
isOneToOne: false
      referencedRelation: "supplier_statuses"
      referencedColumns: ["code"]
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
            "can_access_component":
{ Args: { "p_component_id": string }; Returns: boolean
                           },
"can_access_supplier":
{ Args: { "p_supplier_id": string }; Returns: boolean
                           },
"can_invite":
{ Args: { "p_role": Database["public"]['Enums']["app_role"],"p_supplier_id"?: string }; Returns: boolean
                           },
"can_manage_component":
{ Args: { "p_component_id": string }; Returns: boolean
                           },
"can_manage_supplier":
{ Args: { "p_supplier_id": string }; Returns: boolean
                           },
"can_write_supplier_row":
{ Args: { "p_supplier_id": string }; Returns: boolean
                           },
"change_supplier_status":
{ Args: { "p_justification": string,"p_status": string,"p_supplier_id": string }; Returns: undefined
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
                           },
"is_valid_cnpj":
{ Args: { "p_cnpj": string }; Returns: boolean
                           },
"normalize_tax_id":
{ Args: { "p_country": string,"p_tax_id": string }; Returns: string
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
