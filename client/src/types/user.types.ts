export interface Permission {
  perm_id: number;
  name: string;
  description: string;
  status: string;
}

export interface Role {
  role_id: number;
  name: string;
  description: string;
  status: string;
  permissions: Permission[];
}

export interface UserProfile {
  profile_id?: number;
  user_id?: number;
  first_name: string;
  last_name: string;
  gender?: string;
  date_of_birth?: string | null;
  address?: string | null;
  user_type?: string;
  external_id?: string | null;
}

export interface UserData {
  id?: number | string; // Local ID
  user_id?: number; // MIS ID
  username?: string;
  first_name?: string; // Present in getMe response
  last_name?: string; // Present in getMe response
  email: string;
  role?: string;
  phone_number?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  profile_image?: string;
  mis_user_id?: number;
}

export interface UserFullData {
  user: UserData;
  profile: UserProfile;
  roles: Role[];
  permissions: string[];
  assignedPrograms: any[];
  assignedGrades: any[];
  forcePasswordChange: boolean;
}

export interface UserResponse {
  success: boolean;
  data: UserFullData;
}
