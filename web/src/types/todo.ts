export interface Todo {
  id: string;
  text: string;
  is_completed: boolean;
  priority?: number;
  due_date?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface CreateTodoRequest {
  text: string;
  priority?: number;
  due_date?: string | null;
  tags?: string[];
}

export interface UpdateTodoRequest {
  text?: string;
  is_completed?: boolean;
  priority?: number;
  due_date?: string | null;
  tags?: string[];
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  user_id: string;
  created_at: string;
}
