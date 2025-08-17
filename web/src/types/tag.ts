export interface Tag {
  id: string;
  name: string;
  color?: string;
  user_id: string;
  created_at: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}
