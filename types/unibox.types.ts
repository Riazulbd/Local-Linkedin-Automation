export interface MessageThread {
  id: string;
  profile_id: string;
  lead_id: string | null;
  linkedin_thread_id: string | null;
  participant_name: string | null;
  participant_url: string | null;
  participant_avatar: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  campaign_id: string | null;
  created_at: string;
  updated_at: string;
  // Compatibility fields used by existing components.
  contact_name?: string | null;
  contact_linkedin_url?: string | null;
  contact_headline?: string | null;
  profile_name?: string;
}

export interface Message {
  id: string;
  thread_id: string;
  linkedin_msg_id: string | null;
  direction: 'sent' | 'received';
  body: string;
  sent_at: string;
  is_read: boolean;
  created_at: string;
  // Compatibility fields used by existing components.
  sender_name?: string | null;
  sender_is_me?: boolean;
}

// Compatibility aliases.
export type UniboxConversation = MessageThread;
export type UniboxMessage = Message;

export interface SyncStatus {
  profile_id: string;
  last_synced_at: string | null;
  is_syncing: boolean;
  conversations_synced: number;
}
