export interface UniboxConversation {
  id: string;
  profile_id: string;
  linkedin_thread_id: string;
  contact_name: string | null;
  contact_linkedin_url: string | null;
  contact_headline: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  profile_name?: string;
}

export interface UniboxMessage {
  id: string;
  conversation_id: string;
  linkedin_message_id: string | null;
  sender_name: string | null;
  sender_is_me: boolean;
  body: string;
  sent_at: string | null;
  created_at: string;
}

export interface SyncStatus {
  profile_id: string;
  last_synced_at: string | null;
  is_syncing: boolean;
  conversations_synced: number;
}
