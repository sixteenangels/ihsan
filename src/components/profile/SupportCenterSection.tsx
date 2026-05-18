import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Headphones, Inbox, Loader2, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility';

type SupportConversation = Tables<'chat_support_conversations'>;
type SupportMessage = Tables<'chat_support_messages'>;
type LegacySupportRequest = Pick<
  Tables<'support_requests'>,
  'id' | 'status' | 'source' | 'message' | 'created_at' | 'responded_at'
>;

const SUPPORT_SUBJECTS = [
  'General Support',
  'Orders & Shipping',
  'Payments',
  'Returns & Refunds',
  'Group Buys',
];
const SUPPORT_CONVERSATION_POLL_MS = 20000;
const SUPPORT_REQUEST_POLL_MS = 45000;

function getConversationStatusVariant(status: string) {
  if (status === 'closed') return 'secondary' as const;
  if (status === 'waiting') return 'outline' as const;
  return 'default' as const;
}

function getRequestStatusVariant(status: string) {
  if (status === 'resolved' || status === 'closed') return 'secondary' as const;
  if (status === 'in_progress') return 'outline' as const;
  return 'default' as const;
}

export function SupportCenterSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draftReply, setDraftReply] = useState('');
  const [newConversationSubject, setNewConversationSubject] = useState(SUPPORT_SUBJECTS[0]);
  const [newConversationMessage, setNewConversationMessage] = useState('');
  const isDocumentVisible = useDocumentVisibility();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['support-conversations', user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: isDocumentVisible ? SUPPORT_CONVERSATION_POLL_MS : false,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SupportConversation[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('chat_support_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['support-messages', selectedConversationId],
    enabled: Boolean(selectedConversationId),
    queryFn: async (): Promise<SupportMessage[]> => {
      if (!selectedConversationId) return [];

      const { data, error } = await supabase
        .from('chat_support_messages')
        .select('*')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: supportRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['support-requests', user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: isDocumentVisible ? SUPPORT_REQUEST_POLL_MS : false,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<LegacySupportRequest[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('support_requests')
        .select('id, status, source, message, created_at, responded_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversationId || !isDocumentVisible) return;

    const messagesChannel = supabase
      .channel(`support-messages-${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_support_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['support-messages', selectedConversationId] });
          if (user?.id) {
            queryClient.invalidateQueries({ queryKey: ['support-conversations', user.id] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [isDocumentVisible, queryClient, selectedConversationId, user?.id]);

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('Sign in to contact support.');
      }

      const trimmedMessage = newConversationMessage.trim();
      if (!trimmedMessage) {
        throw new Error('Add a message before starting a support thread.');
      }

      const payload: TablesInsert<'chat_support_conversations'> = {
        user_id: user.id,
        subject: newConversationSubject,
        status: 'open',
      };

      const { data: conversation, error: conversationError } = await supabase
        .from('chat_support_conversations')
        .insert(payload)
        .select('*')
        .single();

      if (conversationError) throw conversationError;

      const messagePayload: TablesInsert<'chat_support_messages'> = {
        conversation_id: conversation.id,
        sender_id: user.id,
        message: trimmedMessage,
        is_from_admin: false,
      };

      const { error: messageError } = await supabase
        .from('chat_support_messages')
        .insert(messagePayload);

      if (messageError) throw messageError;

      return conversation;
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['support-conversations', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['support-messages', conversation.id] });
      setSelectedConversationId(conversation.id);
      setNewConversationMessage('');
      toast.success('Support thread started.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start support thread.');
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedConversationId) {
        throw new Error('Choose a support thread first.');
      }

      const trimmedReply = draftReply.trim();
      if (!trimmedReply) {
        throw new Error('Type a message before sending.');
      }

      const payload: TablesInsert<'chat_support_messages'> = {
        conversation_id: selectedConversationId,
        sender_id: user.id,
        message: trimmedReply,
        is_from_admin: false,
      };

      const { error } = await supabase.from('chat_support_messages').insert(payload);
      if (error) throw error;

      await supabase
        .from('chat_support_conversations')
        .update({
          status: 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedConversationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['support-conversations', user?.id] });
      setDraftReply('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message.');
    },
  });

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="px-5 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            Contact Support
          </CardTitle>
          <CardDescription>
            Start a new thread for a fresh issue, or continue an existing conversation below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Topic</label>
              <div className="flex flex-wrap gap-2">
                {SUPPORT_SUBJECTS.map((subject) => (
                  <Button
                    key={subject}
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    variant={newConversationSubject === subject ? 'default' : 'outline'}
                    onClick={() => setNewConversationSubject(subject)}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Message</label>
              <Textarea
                value={newConversationMessage}
                onChange={(event) => setNewConversationMessage(event.target.value)}
                placeholder="Tell support what happened, what you need, and any order number involved..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              className="h-10 w-full rounded-xl sm:w-auto"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending}
            >
              {createConversationMutation.isPending ? 'Starting...' : 'Start Support Thread'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="min-h-[520px] rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Your Threads
            </CardTitle>
            <CardDescription>Follow open issues and past support conversations.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[420px] px-4 pb-4 sm:px-5">
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">
                  No support threads yet. Start one above whenever you need help.
                </p>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={cn(
                        'w-full rounded-2xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/40',
                        selectedConversationId === conversation.id && 'bg-muted',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">
                          {conversation.subject || 'Support conversation'}
                        </p>
                        <Badge variant={getConversationStatusVariant(conversation.status)}>
                          {conversation.status}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {new Date(conversation.updated_at).toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="min-h-[520px] rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              {selectedConversation?.subject || 'Support Messages'}
            </CardTitle>
            <CardDescription>
              {selectedConversation
                ? 'Continue the conversation here.'
                : 'Select a support thread to review messages.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 sm:px-6">
            <ScrollArea className="h-[320px] rounded-2xl border border-border/70 p-3.5 sm:p-4">
              {selectedConversationId && messagesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : !selectedConversation ? (
                <p className="py-8 text-sm text-muted-foreground">
                  Pick a thread on the left to read or reply.
                </p>
              ) : messages.length === 0 ? (
                <p className="py-8 text-sm text-muted-foreground">
                  No messages in this thread yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('flex', message.is_from_admin ? 'justify-start' : 'justify-end')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                          message.is_from_admin
                            ? 'bg-muted text-foreground'
                            : 'bg-primary text-primary-foreground',
                        )}
                      >
                        <p>{message.message}</p>
                        <p
                          className={cn(
                            'mt-1 text-[10px]',
                            message.is_from_admin
                              ? 'text-muted-foreground'
                              : 'text-primary-foreground/70',
                          )}
                        >
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Reply</label>
              <div className="flex gap-2">
                <Input
                  value={draftReply}
                  onChange={(event) => setDraftReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendReplyMutation.mutate();
                    }
                  }}
                  placeholder="Write your reply to support..."
                  disabled={!selectedConversation || sendReplyMutation.isPending}
                />
                <Button
                  className="rounded-xl"
                  onClick={() => sendReplyMutation.mutate()}
                  disabled={!selectedConversation || !draftReply.trim() || sendReplyMutation.isPending}
                >
                  {sendReplyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="px-5 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Request History
          </CardTitle>
          <CardDescription>
            Older tracked requests tied directly to your account appear here when available.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 sm:px-6">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : supportRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No separate support request records yet. Your main support conversations appear above.
            </p>
          ) : (
            <div className="space-y-3">
              {supportRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {request.source.replaceAll('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={getRequestStatusVariant(request.status)}>
                      {request.status.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {request.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
