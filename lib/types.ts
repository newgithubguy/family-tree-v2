export type MemberRole = "viewer" | "editor";
export type ChangeAction = "CREATE" | "UPDATE" | "DELETE";

export interface User {
  id: string;
  display_name: string;
  email: string;
}

export interface TreeMember {
  tree_id: string;
  user_id: string;
  role: MemberRole;
}

export interface Person {
  id: string;
  tree_id: string;
  first_name: string;
  last_name: string;
  sex: "male" | "female" | "unknown";
  birth_date: string | null;
  notes: string | null;
}

export interface UnionRecord {
  id: string;
  tree_id: string;
  partner_a_person_id: string;
  partner_b_person_id: string | null;
  union_type: "married" | "unmarried" | "divorced";
  start_date: string | null;
  end_date: string | null;
}

export interface UnionChildLink {
  id: string;
  tree_id: string;
  union_id: string;
  child_person_id: string;
}

export type KinshipType = "sibling" | "cousin" | "aunt" | "uncle";

export interface KinshipLink {
  id: string;
  tree_id: string;
  person_a_id: string;
  person_b_id: string;
  kinship_type: KinshipType;
}

export interface ActivityLog {
  id: string;
  tree_id: string;
  actor_user_id: string;
  action: ChangeAction;
  target_entity: string;
  target_id: string;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
}

export interface NodePosition {
  id: string;
  tree_id: string;
  person_id: string;
  x: number;
  y: number;
  updated_at: string;
}
