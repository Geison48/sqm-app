
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
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"category": string | null,"created_at": string,"created_by": string | null,"description": string | null,"entity_id": string,"entity_table": string,"file_name": string,"id": string,"internal_only": boolean,"mime_type": string | null,"size_bytes": number | null,"storage_bucket": string,"storage_path": string,"supersedes_id": string | null,"supplier_id": string | null,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"entity_id": string,"entity_table": string,"file_name": string,"id"?: string,"internal_only"?: boolean,"mime_type"?: string | null,"size_bytes"?: number | null,"storage_bucket"?: string,"storage_path": string,"supersedes_id"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"entity_id"?: string,"entity_table"?: string,"file_name"?: string,"id"?: string,"internal_only"?: boolean,"mime_type"?: string | null,"size_bytes"?: number | null,"storage_bucket"?: string,"storage_path"?: string,"supersedes_id"?: string | null,"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
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
                },"audit_answers": {
                  Row: {
                    "answered_at": string | null,"answered_by": string | null,"audit_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"comment": string | null,"created_at": string,"created_by": string | null,"element_code": string,"element_title_en": string | null,"element_title_pt": string | null,"evidence": string | null,"id": string,"is_star": boolean,"item_code": string,"not_applicable": boolean,"question_en": string,"question_pt": string,"result": string | null,"score": number | null,"sort_order": number,"supplier_id": string,"template_item_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"audit_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"element_code": string,"element_title_en"?: string | null,"element_title_pt"?: string | null,"evidence"?: string | null,"id"?: string,"is_star"?: boolean,"item_code": string,"not_applicable"?: boolean,"question_en": string,"question_pt": string,"result"?: string | null,"score"?: number | null,"sort_order"?: number,"supplier_id": string,"template_item_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"audit_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"element_code"?: string,"element_title_en"?: string | null,"element_title_pt"?: string | null,"evidence"?: string | null,"id"?: string,"is_star"?: boolean,"item_code"?: string,"not_applicable"?: boolean,"question_en"?: string,"question_pt"?: string,"result"?: string | null,"score"?: number | null,"sort_order"?: number,"supplier_id"?: string,"template_item_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_answers_audit_id_fkey"
      columns: ["audit_id"]
isOneToOne: false
      referencedRelation: "audits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_answers_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_answers_template_item_id_fkey"
      columns: ["template_item_id"]
isOneToOne: false
      referencedRelation: "audit_template_items"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_counters": {
                  Row: {
                    "last_number": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_number"?: number,"year": number
                  }
                  Update: {
                    "last_number"?: number,"year"?: number
                  }
                  Relationships: [
                    
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
                },"audit_plans": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"return_comment": string | null,"status": string,"submitted_at": string | null,"submitted_by": string | null,"updated_at": string,"updated_by": string | null,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"return_comment"?: string | null,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"year": number
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"return_comment"?: string | null,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"audit_scopes": {
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
                },"audit_template_items": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"element_code": string,"element_title_en": string | null,"element_title_pt": string | null,"guidance_en": string | null,"guidance_pt": string | null,"id": string,"is_star": boolean,"item_code": string,"question_en": string,"question_pt": string,"scope_code": string | null,"sort_order": number,"standard_requirement_id": string | null,"template_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"element_code": string,"element_title_en"?: string | null,"element_title_pt"?: string | null,"guidance_en"?: string | null,"guidance_pt"?: string | null,"id"?: string,"is_star"?: boolean,"item_code": string,"question_en": string,"question_pt": string,"scope_code"?: string | null,"sort_order"?: number,"standard_requirement_id"?: string | null,"template_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"element_code"?: string,"element_title_en"?: string | null,"element_title_pt"?: string | null,"guidance_en"?: string | null,"guidance_pt"?: string | null,"id"?: string,"is_star"?: boolean,"item_code"?: string,"question_en"?: string,"question_pt"?: string,"scope_code"?: string | null,"sort_order"?: number,"standard_requirement_id"?: string | null,"template_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_template_items_scope_code_fkey"
      columns: ["scope_code"]
isOneToOne: false
      referencedRelation: "audit_scopes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "audit_template_items_standard_requirement_id_fkey"
      columns: ["standard_requirement_id"]
isOneToOne: false
      referencedRelation: "standard_requirements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_template_items_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "audit_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_templates": {
                  Row: {
                    "based_on_id": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"method": string,"name_en": string,"name_pt": string,"notes": string | null,"status": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "based_on_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"method": string,"name_en": string,"name_pt": string,"notes"?: string | null,"status"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "based_on_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"method"?: string,"name_en"?: string,"name_pt"?: string,"notes"?: string | null,"status"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_templates_based_on_id_fkey"
      columns: ["based_on_id"]
isOneToOne: false
      referencedRelation: "audit_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_types": {
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
                },"audits": {
                  Row: {
                    "actual_end": string | null,"actual_start": string | null,"auditor_ids": (string)[],"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"classification": string | null,"created_at": string,"created_by": string | null,"downgrade_reasons": (string)[],"element_scores": NonNullable<Json>,"id": string,"lead_auditor_id": string | null,"number": string,"plan_id": string | null,"planned_end": string,"planned_start": string,"plant_id": string | null,"report_issued_at": string | null,"scope_codes": (string)[],"score_percent": number | null,"status": string,"status_suggestion": string | null,"status_suggestion_resolution": string | null,"summary": string | null,"supplier_id": string,"template_id": string | null,"title": string | null,"type_code": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_end"?: string | null,"actual_start"?: string | null,"auditor_ids"?: (string)[],"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"classification"?: string | null,"created_at"?: string,"created_by"?: string | null,"downgrade_reasons"?: (string)[],"element_scores"?: NonNullable<Json>,"id"?: string,"lead_auditor_id"?: string | null,"number": string,"plan_id"?: string | null,"planned_end": string,"planned_start": string,"plant_id"?: string | null,"report_issued_at"?: string | null,"scope_codes"?: (string)[],"score_percent"?: number | null,"status"?: string,"status_suggestion"?: string | null,"status_suggestion_resolution"?: string | null,"summary"?: string | null,"supplier_id": string,"template_id"?: string | null,"title"?: string | null,"type_code": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "actual_end"?: string | null,"actual_start"?: string | null,"auditor_ids"?: (string)[],"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"classification"?: string | null,"created_at"?: string,"created_by"?: string | null,"downgrade_reasons"?: (string)[],"element_scores"?: NonNullable<Json>,"id"?: string,"lead_auditor_id"?: string | null,"number"?: string,"plan_id"?: string | null,"planned_end"?: string,"planned_start"?: string,"plant_id"?: string | null,"report_issued_at"?: string | null,"scope_codes"?: (string)[],"score_percent"?: number | null,"status"?: string,"status_suggestion"?: string | null,"status_suggestion_resolution"?: string | null,"summary"?: string | null,"supplier_id"?: string,"template_id"?: string | null,"title"?: string | null,"type_code"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audits_lead_auditor_id_fkey"
      columns: ["lead_auditor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audits_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "audit_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audits_plant_id_fkey"
      columns: ["plant_id"]
isOneToOne: false
      referencedRelation: "plants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audits_status_suggestion_fkey"
      columns: ["status_suggestion"]
isOneToOne: false
      referencedRelation: "supplier_statuses"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "audits_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audits_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "audit_templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audits_type_code_fkey"
      columns: ["type_code"]
isOneToOne: false
      referencedRelation: "audit_types"
      referencedColumns: ["code"]
    }
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
                },"characteristic_types": {
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
                },"containment_actions": {
                  Row: {
                    "action_taken": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"done_on": string | null,"id": string,"location_code": string,"nc_id": string,"qty_checked": number,"qty_nok": number,"qty_ok": number,"responsible": string | null,"sn_or_lot": string | null,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_taken"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"done_on"?: string | null,"id"?: string,"location_code": string,"nc_id": string,"qty_checked"?: number,"qty_nok"?: number,"qty_ok"?: number,"responsible"?: string | null,"sn_or_lot"?: string | null,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "action_taken"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"done_on"?: string | null,"id"?: string,"location_code"?: string,"nc_id"?: string,"qty_checked"?: number,"qty_nok"?: number,"qty_ok"?: number,"responsible"?: string | null,"sn_or_lot"?: string | null,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "containment_actions_location_code_fkey"
      columns: ["location_code"]
isOneToOne: false
      referencedRelation: "containment_locations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "containment_actions_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "containment_actions_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "containment_actions_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"containment_locations": {
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
                },"controlled_shipment_periods": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"end_reason": string | null,"ended_at": string | null,"ended_by": string | null,"id": string,"start_reason": string,"started_at": string,"started_by": string | null,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_reason"?: string | null,"ended_at"?: string | null,"ended_by"?: string | null,"id"?: string,"start_reason": string,"started_at"?: string,"started_by"?: string | null,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_reason"?: string | null,"ended_at"?: string | null,"ended_by"?: string | null,"id"?: string,"start_reason"?: string,"started_at"?: string,"started_by"?: string | null,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "controlled_shipment_periods_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"cost_types": {
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
                },"dispositions": {
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
                },"doc_counters": {
                  Row: {
                    "kind": string,"last_number": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "kind": string,"last_number"?: number,"year": number
                  }
                  Update: {
                    "kind"?: string,"last_number"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"eight_d_disciplines": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"deadline_hours": number,"id": string,"is_system": boolean,"label_en": string,"label_pt": string,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"deadline_hours": number,"id"?: string,"is_system"?: boolean,"label_en": string,"label_pt": string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"deadline_hours"?: number,"id"?: string,"is_system"?: boolean,"label_en"?: string,"label_pt"?: string,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"eight_d_step_versions": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"content": NonNullable<Json>,"created_at": string,"created_by": string | null,"decision": string | null,"discipline": string,"id": string,"nc_id": string,"review_comment": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"step_id": string,"submitted_at": string,"submitted_by": string | null,"supplier_id": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"content": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"decision"?: string | null,"discipline": string,"id"?: string,"nc_id": string,"review_comment"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"step_id": string,"submitted_at"?: string,"submitted_by"?: string | null,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null,"version": number
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"decision"?: string | null,"discipline"?: string,"id"?: string,"nc_id"?: string,"review_comment"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"step_id"?: string,"submitted_at"?: string,"submitted_by"?: string | null,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "eight_d_step_versions_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eight_d_step_versions_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eight_d_step_versions_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "eight_d_steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eight_d_step_versions_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"eight_d_steps": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"content": NonNullable<Json>,"created_at": string,"created_by": string | null,"current_version": number,"discipline": string,"due_at": string,"id": string,"nc_id": string,"review_comment": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"submitted_at": string | null,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"current_version"?: number,"discipline": string,"due_at": string,"id"?: string,"nc_id": string,"review_comment"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"current_version"?: number,"discipline"?: string,"due_at"?: string,"id"?: string,"nc_id"?: string,"review_comment"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eight_d_steps_discipline_fkey"
      columns: ["discipline"]
isOneToOne: false
      referencedRelation: "eight_d_disciplines"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "eight_d_steps_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eight_d_steps_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eight_d_steps_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"email_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"dedupe_key": string | null,"event_code": string,"id": string,"last_error": string | null,"link_path": string | null,"locale": string,"notification_id": string | null,"params": NonNullable<Json>,"recipient_email": string,"recipient_name": string | null,"recipient_user_id": string | null,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"event_code": string,"id"?: string,"last_error"?: string | null,"link_path"?: string | null,"locale"?: string,"notification_id"?: string | null,"params"?: NonNullable<Json>,"recipient_email": string,"recipient_name"?: string | null,"recipient_user_id"?: string | null,"sent_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"dedupe_key"?: string | null,"event_code"?: string,"id"?: string,"last_error"?: string | null,"link_path"?: string | null,"locale"?: string,"notification_id"?: string | null,"params"?: NonNullable<Json>,"recipient_email"?: string,"recipient_name"?: string | null,"recipient_user_id"?: string | null,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_outbox_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_outbox_recipient_user_id_fkey"
      columns: ["recipient_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"escalation_rules": {
                  Row: {
                    "active": boolean,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"contact_role_codes": (string)[],"created_at": string,"created_by": string | null,"days_after_due": number,"id": string,"notify_responsible_sqe": boolean,"notify_sqm": boolean,"notify_supplier_users": boolean,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"contact_role_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"days_after_due": number,"id"?: string,"notify_responsible_sqe"?: boolean,"notify_sqm"?: boolean,"notify_supplier_users"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"contact_role_codes"?: (string)[],"created_at"?: string,"created_by"?: string | null,"days_after_due"?: number,"id"?: string,"notify_responsible_sqe"?: boolean,"notify_sqm"?: boolean,"notify_supplier_users"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"failure_modes": {
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
                },"findings": {
                  Row: {
                    "action_due_date": string | null,"action_plan": string | null,"action_responsible": string | null,"answer_id": string | null,"audit_id": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"classification": string,"created_at": string,"created_by": string | null,"description": string,"effectiveness_comment": string | null,"id": string,"nc_id": string | null,"requirement": string | null,"responded_at": string | null,"responded_by": string | null,"response_due": string | null,"sqe_comment": string | null,"status": string,"supplier_id": string,"updated_at": string,"updated_by": string | null,"verified_at": string | null,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_due_date"?: string | null,"action_plan"?: string | null,"action_responsible"?: string | null,"answer_id"?: string | null,"audit_id": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"classification": string,"created_at"?: string,"created_by"?: string | null,"description": string,"effectiveness_comment"?: string | null,"id"?: string,"nc_id"?: string | null,"requirement"?: string | null,"responded_at"?: string | null,"responded_by"?: string | null,"response_due"?: string | null,"sqe_comment"?: string | null,"status"?: string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "action_due_date"?: string | null,"action_plan"?: string | null,"action_responsible"?: string | null,"answer_id"?: string | null,"audit_id"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"classification"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"effectiveness_comment"?: string | null,"id"?: string,"nc_id"?: string | null,"requirement"?: string | null,"responded_at"?: string | null,"responded_by"?: string | null,"response_due"?: string | null,"sqe_comment"?: string | null,"status"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "findings_answer_id_fkey"
      columns: ["answer_id"]
isOneToOne: false
      referencedRelation: "audit_answers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "findings_audit_id_fkey"
      columns: ["audit_id"]
isOneToOne: false
      referencedRelation: "audits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "findings_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "findings_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "findings_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_characteristics": {
                  Row: {
                    "accept_number": number | null,"aql_level": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"char_type_code": string,"created_at": string,"created_by": string | null,"id": string,"instrument": string | null,"is_critical": boolean,"lower_limit": number | null,"method": string | null,"name_en": string,"name_pt": string,"nominal": number | null,"plan_id": string,"sample_size": number | null,"sampling": string,"sort_order": number,"specification": string | null,"standard_requirement_id": string | null,"unit": string | null,"updated_at": string,"updated_by": string | null,"upper_limit": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accept_number"?: number | null,"aql_level"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"char_type_code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instrument"?: string | null,"is_critical"?: boolean,"lower_limit"?: number | null,"method"?: string | null,"name_en": string,"name_pt": string,"nominal"?: number | null,"plan_id": string,"sample_size"?: number | null,"sampling"?: string,"sort_order"?: number,"specification"?: string | null,"standard_requirement_id"?: string | null,"unit"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"upper_limit"?: number | null
                  }
                  Update: {
                    "accept_number"?: number | null,"aql_level"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"char_type_code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instrument"?: string | null,"is_critical"?: boolean,"lower_limit"?: number | null,"method"?: string | null,"name_en"?: string,"name_pt"?: string,"nominal"?: number | null,"plan_id"?: string,"sample_size"?: number | null,"sampling"?: string,"sort_order"?: number,"specification"?: string | null,"standard_requirement_id"?: string | null,"unit"?: string | null,"updated_at"?: string,"updated_by"?: string | null,"upper_limit"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_characteristics_char_type_code_fkey"
      columns: ["char_type_code"]
isOneToOne: false
      referencedRelation: "characteristic_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "inspection_characteristics_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "inspection_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_characteristics_standard_requirement_id_fkey"
      columns: ["standard_requirement_id"]
isOneToOne: false
      referencedRelation: "standard_requirements"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_plans": {
                  Row: {
                    "active": boolean,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"component_id": string,"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"revision": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"revision"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"revision"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_plans_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_results": {
                  Row: {
                    "auto_evaluated": boolean,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"characteristic_id": string,"comment": string | null,"created_at": string,"created_by": string | null,"id": string,"inspection_id": string,"inspection_unit_id": string,"measured_text": string | null,"measured_values": (number)[],"ok": boolean | null,"qty_inspected": number | null,"qty_nok": number | null,"serial_unit_id": string,"supplier_id": string,"updated_at": string,"updated_by": string | null,"waiver_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_evaluated"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"characteristic_id": string,"comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspection_id": string,"inspection_unit_id": string,"measured_text"?: string | null,"measured_values"?: (number)[],"ok"?: boolean | null,"qty_inspected"?: number | null,"qty_nok"?: number | null,"serial_unit_id": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null,"waiver_id"?: string | null
                  }
                  Update: {
                    "auto_evaluated"?: boolean,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"characteristic_id"?: string,"comment"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspection_id"?: string,"inspection_unit_id"?: string,"measured_text"?: string | null,"measured_values"?: (number)[],"ok"?: boolean | null,"qty_inspected"?: number | null,"qty_nok"?: number | null,"serial_unit_id"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"waiver_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_results_characteristic_id_fkey"
      columns: ["characteristic_id"]
isOneToOne: false
      referencedRelation: "inspection_characteristics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_results_inspection_id_fkey"
      columns: ["inspection_id"]
isOneToOne: false
      referencedRelation: "inspections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_results_inspection_unit_id_fkey"
      columns: ["inspection_unit_id"]
isOneToOne: false
      referencedRelation: "inspection_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_results_serial_unit_id_fkey"
      columns: ["serial_unit_id"]
isOneToOne: false
      referencedRelation: "serial_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_results_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_results_waiver_id_fkey"
      columns: ["waiver_id"]
isOneToOne: false
      referencedRelation: "waivers"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_types": {
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
                },"inspection_units": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"inspection_id": string,"result": string | null,"serial_unit_id": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspection_id": string,"result"?: string | null,"serial_unit_id": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspection_id"?: string,"result"?: string | null,"serial_unit_id"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_units_inspection_id_fkey"
      columns: ["inspection_id"]
isOneToOne: false
      referencedRelation: "inspections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_units_serial_unit_id_fkey"
      columns: ["serial_unit_id"]
isOneToOne: false
      referencedRelation: "serial_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspection_units_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"inspections": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"completed_at": string | null,"component_id": string,"created_at": string,"created_by": string | null,"id": string,"inspected_on": string,"inspector_id": string | null,"location": string | null,"notes": string | null,"number": string,"plan_id": string,"result": string | null,"status": string,"supplier_id": string,"type_code": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_at"?: string | null,"component_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspected_on"?: string,"inspector_id"?: string | null,"location"?: string | null,"notes"?: string | null,"number": string,"plan_id": string,"result"?: string | null,"status"?: string,"supplier_id": string,"type_code": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_at"?: string | null,"component_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"inspected_on"?: string,"inspector_id"?: string | null,"location"?: string | null,"notes"?: string | null,"number"?: string,"plan_id"?: string,"result"?: string | null,"status"?: string,"supplier_id"?: string,"type_code"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspections_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_inspector_id_fkey"
      columns: ["inspector_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "inspection_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspections_type_code_fkey"
      columns: ["type_code"]
isOneToOne: false
      referencedRelation: "inspection_types"
      referencedColumns: ["code"]
    }
                  ]
                },"lessons_learned": {
                  Row: {
                    "action": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"component_id": string | null,"created_at": string,"created_by": string | null,"failure": string,"failure_mode_code": string | null,"id": string,"keywords": (string)[],"nc_id": string,"root_cause": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"failure": string,"failure_mode_code"?: string | null,"id"?: string,"keywords"?: (string)[],"nc_id": string,"root_cause": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "action"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"failure"?: string,"failure_mode_code"?: string | null,"id"?: string,"keywords"?: (string)[],"nc_id"?: string,"root_cause"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_learned_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_learned_failure_mode_code_fkey"
      columns: ["failure_mode_code"]
isOneToOne: false
      referencedRelation: "failure_modes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "lessons_learned_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_learned_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_learned_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"nc_comments": {
                  Row: {
                    "body": string,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"internal": boolean,"nc_id": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"internal"?: boolean,"nc_id": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"internal"?: boolean,"nc_id"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nc_comments_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nc_comments_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nc_comments_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"nc_costs": {
                  Row: {
                    "amount": number | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"chargeable": boolean,"cost_type_code": string,"created_at": string,"created_by": string | null,"currency": string,"description": string,"id": string,"nc_id": string,"quantity": number,"responded_at": string | null,"responded_by": string | null,"sqe_decision_comment": string | null,"status": string,"supplier_id": string,"supplier_response": string | null,"unit_amount": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: never,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"chargeable"?: boolean,"cost_type_code": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description": string,"id"?: string,"nc_id": string,"quantity"?: number,"responded_at"?: string | null,"responded_by"?: string | null,"sqe_decision_comment"?: string | null,"status"?: string,"supplier_id": string,"supplier_response"?: string | null,"unit_amount": number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: never,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"chargeable"?: boolean,"cost_type_code"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string,"id"?: string,"nc_id"?: string,"quantity"?: number,"responded_at"?: string | null,"responded_by"?: string | null,"sqe_decision_comment"?: string | null,"status"?: string,"supplier_id"?: string,"supplier_response"?: string | null,"unit_amount"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nc_costs_cost_type_code_fkey"
      columns: ["cost_type_code"]
isOneToOne: false
      referencedRelation: "cost_types"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "nc_costs_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nc_costs_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nc_costs_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"nc_counters": {
                  Row: {
                    "last_number": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_number"?: number,"year": number
                  }
                  Update: {
                    "last_number"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"nc_items": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"id": string,"nc_id": string,"notes": string | null,"quantity": number | null,"serial_unit_id": string | null,"sn_or_lot": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nc_id": string,"notes"?: string | null,"quantity"?: number | null,"serial_unit_id"?: string | null,"sn_or_lot": string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"nc_id"?: string,"notes"?: string | null,"quantity"?: number | null,"serial_unit_id"?: string | null,"sn_or_lot"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nc_items_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nc_items_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nc_items_serial_unit_id_fkey"
      columns: ["serial_unit_id"]
isOneToOne: false
      referencedRelation: "serial_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nc_items_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"nc_origins": {
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
                },"nc_severities": {
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
                },"ncs": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"closed_at": string | null,"closed_by": string | null,"closure_comment": string | null,"component_id": string | null,"created_at": string,"created_by": string | null,"customer_affected": boolean,"description": string,"detected_location": string | null,"detected_on": string,"disposition_code": string | null,"disposition_notes": string | null,"effectiveness_method": string | null,"effectiveness_result": string | null,"effectiveness_target": string | null,"effectiveness_verified": boolean,"effectiveness_verified_at": string | null,"effectiveness_verified_by": string | null,"failure_mode_code": string | null,"finding_id": string | null,"id": string,"number": string,"opened_at": string,"origin_code": string,"quantity_affected": number | null,"response_due_at": string | null,"severity_code": string,"sqe_review_comment": string | null,"status": string,"suggested_8d": boolean,"suggestion_reasons": (string)[],"supplier_action": string | null,"supplier_id": string,"supplier_responded_at": string | null,"title": string,"type": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closure_comment"?: string | null,"component_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_affected"?: boolean,"description": string,"detected_location"?: string | null,"detected_on"?: string,"disposition_code"?: string | null,"disposition_notes"?: string | null,"effectiveness_method"?: string | null,"effectiveness_result"?: string | null,"effectiveness_target"?: string | null,"effectiveness_verified"?: boolean,"effectiveness_verified_at"?: string | null,"effectiveness_verified_by"?: string | null,"failure_mode_code"?: string | null,"finding_id"?: string | null,"id"?: string,"number": string,"opened_at"?: string,"origin_code": string,"quantity_affected"?: number | null,"response_due_at"?: string | null,"severity_code": string,"sqe_review_comment"?: string | null,"status"?: string,"suggested_8d"?: boolean,"suggestion_reasons"?: (string)[],"supplier_action"?: string | null,"supplier_id": string,"supplier_responded_at"?: string | null,"title": string,"type": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closure_comment"?: string | null,"component_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_affected"?: boolean,"description"?: string,"detected_location"?: string | null,"detected_on"?: string,"disposition_code"?: string | null,"disposition_notes"?: string | null,"effectiveness_method"?: string | null,"effectiveness_result"?: string | null,"effectiveness_target"?: string | null,"effectiveness_verified"?: boolean,"effectiveness_verified_at"?: string | null,"effectiveness_verified_by"?: string | null,"failure_mode_code"?: string | null,"finding_id"?: string | null,"id"?: string,"number"?: string,"opened_at"?: string,"origin_code"?: string,"quantity_affected"?: number | null,"response_due_at"?: string | null,"severity_code"?: string,"sqe_review_comment"?: string | null,"status"?: string,"suggested_8d"?: boolean,"suggestion_reasons"?: (string)[],"supplier_action"?: string | null,"supplier_id"?: string,"supplier_responded_at"?: string | null,"title"?: string,"type"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ncs_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ncs_disposition_code_fkey"
      columns: ["disposition_code"]
isOneToOne: false
      referencedRelation: "dispositions"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ncs_failure_mode_code_fkey"
      columns: ["failure_mode_code"]
isOneToOne: false
      referencedRelation: "failure_modes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ncs_finding_id_fkey"
      columns: ["finding_id"]
isOneToOne: false
      referencedRelation: "findings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ncs_origin_code_fkey"
      columns: ["origin_code"]
isOneToOne: false
      referencedRelation: "nc_origins"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ncs_severity_code_fkey"
      columns: ["severity_code"]
isOneToOne: false
      referencedRelation: "nc_severities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ncs_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_events": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"created_at": string,"created_by": string | null,"id": string,"is_system": boolean,"label_en": string,"label_pt": string,"send_email": boolean,"sort_order": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en": string,"label_pt": string,"send_email"?: boolean,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_system"?: boolean,"label_en"?: string,"label_pt"?: string,"send_email"?: boolean,"sort_order"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
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
                },"rca_tools": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"content": NonNullable<Json>,"created_at": string,"created_by": string | null,"eight_d_step_id": string,"id": string,"nc_id": string,"supplier_id": string,"tool_type": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"eight_d_step_id": string,"id"?: string,"nc_id": string,"supplier_id": string,"tool_type": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"eight_d_step_id"?: string,"id"?: string,"nc_id"?: string,"supplier_id"?: string,"tool_type"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rca_tools_eight_d_step_id_fkey"
      columns: ["eight_d_step_id"]
isOneToOne: false
      referencedRelation: "eight_d_steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rca_tools_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "nc_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rca_tools_nc_id_fkey"
      columns: ["nc_id"]
isOneToOne: false
      referencedRelation: "ncs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rca_tools_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"repairs": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"completed_on": string | null,"completion_notes": string | null,"created_at": string,"created_by": string | null,"description": string,"id": string,"performed_by": string | null,"serial_unit_id": string,"started_on": string,"status": string,"supplier_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_on"?: string | null,"completion_notes"?: string | null,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"performed_by"?: string | null,"serial_unit_id": string,"started_on"?: string,"status"?: string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_on"?: string | null,"completion_notes"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"performed_by"?: string | null,"serial_unit_id"?: string,"started_on"?: string,"status"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "repairs_serial_unit_id_fkey"
      columns: ["serial_unit_id"]
isOneToOne: false
      referencedRelation: "serial_units"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "repairs_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"serial_units": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"component_id": string,"created_at": string,"created_by": string | null,"id": string,"identifier": string,"kind": string,"notes": string | null,"production_date": string | null,"quantity": number,"scrapped": boolean,"supplier_id": string,"tag": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"identifier": string,"kind"?: string,"notes"?: string | null,"production_date"?: string | null,"quantity"?: number,"scrapped"?: boolean,"supplier_id": string,"tag"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"component_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"identifier"?: string,"kind"?: string,"notes"?: string | null,"production_date"?: string | null,"quantity"?: number,"scrapped"?: boolean,"supplier_id"?: string,"tag"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "serial_units_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "serial_units_supplier_id_fkey"
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
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"email": string,"email_notifications": boolean,"full_name": string,"id": string,"invited_at": string | null,"invited_by": string | null,"language": Database["public"]['Enums']["app_language"],"password_set_at": string | null,"role": Database["public"]['Enums']["app_role"],"supplier_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email": string,"email_notifications"?: boolean,"full_name": string,"id": string,"invited_at"?: string | null,"invited_by"?: string | null,"language"?: Database["public"]['Enums']["app_language"],"password_set_at"?: string | null,"role": Database["public"]['Enums']["app_role"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string,"email_notifications"?: boolean,"full_name"?: string,"id"?: string,"invited_at"?: string | null,"invited_by"?: string | null,"language"?: Database["public"]['Enums']["app_language"],"password_set_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"supplier_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
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
                },"waivers": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"characteristic_ids": (string)[],"component_id": string,"created_at": string,"created_by": string | null,"decided_at": string | null,"decided_by": string | null,"decision_comment": string | null,"description": string,"id": string,"justification": string,"max_quantity": number | null,"number": string,"serial_unit_ids": (string)[],"status": string,"supplier_id": string,"updated_at": string,"updated_by": string | null,"used_quantity": number,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"characteristic_ids"?: (string)[],"component_id": string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_comment"?: string | null,"description": string,"id"?: string,"justification": string,"max_quantity"?: number | null,"number": string,"serial_unit_ids"?: (string)[],"status"?: string,"supplier_id": string,"updated_at"?: string,"updated_by"?: string | null,"used_quantity"?: number,"valid_until"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"characteristic_ids"?: (string)[],"component_id"?: string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_comment"?: string | null,"description"?: string,"id"?: string,"justification"?: string,"max_quantity"?: number | null,"number"?: string,"serial_unit_ids"?: (string)[],"status"?: string,"supplier_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"used_quantity"?: number,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "waivers_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waivers_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "nc_overview": {
                  Row: {
                    "approved_steps": number | null,"cancelled_at": string | null,"closed_at": string | null,"component_id": string | null,"failure_mode_code": string | null,"gw_code": string | null,"id": string,"next_due_at": string | null,"number": string,"opened_at": string,"origin_code": string,"pending_with": string | null,"severity_code": string,"status": string,"suggested_8d": boolean,"supplier_id": string,"supplier_name": string,"title": string,"type": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "ncs_component_id_fkey"
      columns: ["component_id"]
isOneToOne: false
      referencedRelation: "components"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ncs_failure_mode_code_fkey"
      columns: ["failure_mode_code"]
isOneToOne: false
      referencedRelation: "failure_modes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ncs_origin_code_fkey"
      columns: ["origin_code"]
isOneToOne: false
      referencedRelation: "nc_origins"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ncs_severity_code_fkey"
      columns: ["severity_code"]
isOneToOne: false
      referencedRelation: "nc_severities"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "ncs_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "activate_template":
{ Args: { "p_template_id": string }; Returns: undefined
                           },
"add_inspection_unit":
{ Args: { "p_inspection_id": string,"p_unit_id": string }; Returns: string
                           },
"apply_waiver":
{ Args: { "p_result_id": string,"p_waiver_id": string }; Returns: undefined
                           },
"audit_report_visible":
{ Args: { "p_audit_id": string }; Returns: boolean
                           },
"audit_score":
{ Args: { "p_audit_id": string }; Returns: Json
                           },
"can_access_component":
{ Args: { "p_component_id": string }; Returns: boolean
                           },
"can_access_supplier":
{ Args: { "p_supplier_id": string }; Returns: boolean
                           },
"can_edit_inspection":
{ Args: { "p_inspection_id": string }; Returns: boolean
                           },
"can_execute_audit":
{ Args: { "p_audit_id": string }; Returns: boolean
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
"claim_email_batch":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"created_at": string,
"dedupe_key": string | null,
"event_code": string,
"id": string,
"last_error": string | null,
"link_path": string | null,
"locale": string,
"notification_id": string | null,
"params": NonNullable<Json>,
"recipient_email": string,
"recipient_name": string | null,
"recipient_user_id": string | null,
"sent_at": string | null,
"status": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "email_outbox"
        isOneToOne: false
        isSetofReturn: true
      } },
"close_8d":
{ Args: { "p_action": string,"p_comment"?: string,"p_failure": string,"p_keywords": (string)[],"p_nc_id": string,"p_root_cause": string }; Returns: string
                           },
"complete_audit":
{ Args: { "p_audit_id": string,"p_summary"?: string }; Returns: Json
                           },
"complete_inspection":
{ Args: { "p_inspection_id": string }; Returns: string
                           },
"complete_repair":
{ Args: { "p_notes": string,"p_repair_id": string }; Returns: undefined
                           },
"convert_nc_to_8d":
{ Args: { "p_nc_id": string }; Returns: undefined
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"current_supplier_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"export_tables":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"generate_audit_plan":
{ Args: { "p_year": number }; Returns: string
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
"mark_email_result":
{ Args: { "p_error"?: string,"p_id": string,"p_ok": boolean }; Returns: undefined
                           },
"mark_password_set":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"my_pending_items":
{ Args: Record<PropertyKey, never>; Returns: {
              "days_left": number,"detail": string,"due_at": string,"due_on": string,"entity_id": string,"entity_table": string,"grp": string,"kind": string,"link": string,"ref": string,"responsible_sqe_id": string,"supplier_id": string,"supplier_name": string
            }[]
                           },
"needs_password":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"new_template_version":
{ Args: { "p_template_id": string }; Returns: string
                           },
"normalize_tax_id":
{ Args: { "p_country": string,"p_tax_id": string }; Returns: string
                           },
"plan_component":
{ Args: { "p_plan_id": string }; Returns: string
                           },
"resolve_audit_status_suggestion":
{ Args: { "p_apply": boolean,"p_audit_id": string,"p_justification": string }; Returns: undefined
                           },
"respond_finding":
{ Args: { "p_action_plan": string,"p_due": string,"p_finding_id": string,"p_responsible": string }; Returns: undefined
                           },
"respond_nc_cost":
{ Args: { "p_accept": boolean,"p_cost_id": string,"p_justification": string }; Returns: undefined
                           },
"respond_simple_nc":
{ Args: { "p_action": string,"p_nc_id": string }; Returns: undefined
                           },
"review_8d_step":
{ Args: { "p_approve": boolean,"p_comment": string,"p_step_id": string }; Returns: undefined
                           },
"review_audit_plan":
{ Args: { "p_approve": boolean,"p_comment": string,"p_plan_id": string }; Returns: undefined
                           },
"review_finding":
{ Args: { "p_accept": boolean,"p_comment": string,"p_finding_id": string }; Returns: undefined
                           },
"review_simple_nc":
{ Args: { "p_accept": boolean,"p_comment": string,"p_nc_id": string }; Returns: undefined
                           },
"review_waiver":
{ Args: { "p_approve": boolean,"p_comment": string,"p_waiver_id": string }; Returns: undefined
                           },
"run_daily_jobs":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"save_8d_step":
{ Args: { "p_content": Json,"p_step_id": string,"p_submit": boolean }; Returns: undefined
                           },
"scrap_unit":
{ Args: { "p_reason": string,"p_unit_id": string }; Returns: undefined
                           },
"start_audit":
{ Args: { "p_audit_id": string }; Returns: undefined
                           },
"submit_audit_plan":
{ Args: { "p_plan_id": string }; Returns: undefined
                           },
"suggest_8d":
{ Args: { "p_component_id": string,"p_customer_affected": boolean,"p_failure_mode": string,"p_severity": string }; Returns: Json
                           },
"verify_finding":
{ Args: { "p_comment": string,"p_finding_id": string }; Returns: undefined
                           },
"waiver_is_active":
{ Args: { "p_waiver_id": string }; Returns: boolean
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
