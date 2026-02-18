'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Circle, Search } from '@mui/icons-material';
import { createClient } from '@/lib/supabase/client';

interface ConversationRow {
  id: string;
  profile_id: string | null;
  contact_name: string | null;
  contact_linkedin_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  linkedin_profiles: { name: string } | null;
}

interface Conversation {
  id: string;
  profile_id: string;
  contact_name: string;
  contact_linkedin_url: string;
  last_message_text: string;
  last_message_at: string;
  unread_count: number;
  profile_name: string;
}

interface Message {
  id: string;
  sender_name: string | null;
  sender_is_me: boolean | null;
  body: string;
  sent_at: string | null;
}

interface Profile {
  id: string;
  name: string;
}

function normalizeConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    profile_id: row.profile_id ?? '',
    contact_name: row.contact_name ?? 'Unknown Contact',
    contact_linkedin_url: row.contact_linkedin_url ?? '',
    last_message_text: row.last_message_text ?? '',
    last_message_at: row.last_message_at ?? '',
    unread_count: row.unread_count ?? 0,
    profile_name: row.linkedin_profiles?.name ?? 'Unknown Profile',
  };
}

export default function UniboxPage() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');

  useEffect(() => {
    let mounted = true;

    const loadProfiles = async () => {
      const { data } = await supabase
        .from('linkedin_profiles')
        .select('id, name')
        .order('name', { ascending: true });

      if (!mounted) return;
      setProfiles((data ?? []) as Profile[]);
    };

    void loadProfiles();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const loadConversations = async () => {
      let query = supabase
        .from('unibox_conversations')
        .select(
          'id, profile_id, contact_name, contact_linkedin_url, last_message_text, last_message_at, unread_count, linkedin_profiles(name)'
        )
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (profileFilter !== 'all') {
        query = query.eq('profile_id', profileFilter);
      }

      const { data } = await query;
      if (!mounted) return;

      const nextConversations = ((data ?? []) as ConversationRow[]).map(normalizeConversation);
      setConversations(nextConversations);
      setSelectedConversation((current) => {
        if (!current) return null;
        return nextConversations.find((item) => item.id === current.id) ?? null;
      });
    };

    void loadConversations();

    const channel = supabase
      .channel('unibox-conversations-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unibox_conversations',
        },
        () => {
          void loadConversations();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [profileFilter, supabase]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    let mounted = true;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('unibox_messages')
        .select('id, sender_name, sender_is_me, body, sent_at')
        .eq('conversation_id', selectedConversation.id)
        .order('sent_at', { ascending: true, nullsFirst: true });

      if (!mounted) return;
      setMessages((data ?? []) as Message[]);
    };

    void loadMessages();

    const channel = supabase
      .channel(`unibox-messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unibox_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        () => {
          void loadMessages();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedConversation, supabase]);

  const filteredConversations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;

    return conversations.filter((conversation) =>
      conversation.contact_name.toLowerCase().includes(needle)
    );
  }, [conversations, search]);

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex' }} data-animate="page">
      <Paper
        sx={{
          width: 380,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h5" fontWeight={600} mb={2}>
            Unibox
          </Typography>

          <TextField
            size="small"
            placeholder="Search conversations..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel>Filter by profile</InputLabel>
            <Select
              value={profileFilter}
              onChange={(event) => setProfileFilter(String(event.target.value))}
              label="Filter by profile"
            >
              <MenuItem value="all">All Profiles</MenuItem>
              {profiles.map((profile) => (
                <MenuItem key={profile.id} value={profile.id}>
                  {profile.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
          {filteredConversations.map((conversation) => (
            <ListItemButton
              key={conversation.id}
              selected={selectedConversation?.id === conversation.id}
              onClick={() => setSelectedConversation(conversation)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <ListItemAvatar>
                <Badge badgeContent={conversation.unread_count} color="error">
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {conversation.contact_name.charAt(0).toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={600}>
                      {conversation.contact_name}
                    </Typography>
                    <Chip
                      label={conversation.profile_name}
                      size="small"
                      sx={{ bgcolor: 'success.dark', color: 'common.white', fontSize: '0.7rem' }}
                    />
                  </Stack>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {conversation.last_message_text || 'No messages yet'}
                  </Typography>
                }
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {selectedConversation ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
          <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider', borderRadius: 0 }}>
            <Typography variant="h6" fontWeight={600}>
              {selectedConversation.contact_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedConversation.contact_linkedin_url || 'No LinkedIn URL'}
            </Typography>
          </Paper>

          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Stack spacing={2}>
              {messages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: message.sender_is_me ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '70%',
                      bgcolor: message.sender_is_me ? 'primary.main' : 'background.paper',
                      color: message.sender_is_me ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    {!message.sender_is_me && (
                      <Typography variant="caption" fontWeight={600} color="primary.light" mb={0.5} display="block">
                        {message.sender_name || 'Contact'}
                      </Typography>
                    )}
                    <Typography variant="body2">{message.body}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}>
                      {message.sent_at ? new Date(message.sent_at).toLocaleTimeString() : 'Unknown time'}
                    </Typography>
                  </Paper>
                </Box>
              ))}
            </Stack>
          </Box>

          <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider', borderRadius: 0 }}>
            <Typography variant="caption" color="info.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Circle sx={{ fontSize: 8 }} /> Read-only mode - Reply in LinkedIn to maintain account safety
            </Typography>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
          <Typography color="text.secondary">Select a conversation to view messages</Typography>
        </Box>
      )}
    </Box>
  );
}
