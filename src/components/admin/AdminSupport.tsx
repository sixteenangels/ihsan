import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageCircle, User, Circle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  user_id: string;
  status: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    name: string | null;
    email: string | null;
  };
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_from_admin: boolean;
  is_read: boolean;
  created_at: string;
}

export function AdminSupport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch all conversations with profiles
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['admin-support-conversations'],
    queryFn: async () => {
      const { data: convData, error } = await supabase
        .from('chat_support_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get profiles for all users
      const userIds = [...new Set(convData?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get unread counts
      const { data: unreadData } = await supabase
        .from('chat_support_messages')
        .select('conversation_id')
        .eq('is_from_admin', false)
        .eq('is_read', false);

      const unreadCounts = new Map<string, number>();
      unreadData?.forEach(msg => {
        unreadCounts.set(msg.conversation_id, (unreadCounts.get(msg.conversation_id) || 0) + 1);
      });

      return convData?.map(conv => ({
        ...conv,
        profile: profilesMap.get(conv.user_id),
        unread_count: unreadCounts.get(conv.id) || 0,
      })) as Conversation[];
    },
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['admin-support-messages', selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];

      const { data, error } = await supabase
        .from('chat_support_messages')
        .select('*')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversationId,
  });

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedConversationId && messages) {
      const unreadIds = messages
        .filter(m => !m.is_from_admin && !m.is_read)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        supabase
          .from('chat_support_messages')
          .update({ is_read: true })
          .in('id', unreadIds)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
          });
      }
    }
  }, [selectedConversationId, messages]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedConversationId) return;

    const channel = supabase
      .channel(`admin-chat-${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_support_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-support-messages', selectedConversationId] });
          queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, queryClient]);

  // Subscribe to new conversations
  useEffect(() => {
    const channel = supabase
      .channel('admin-new-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_support_conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId || !replyMessage.trim() || !user) return;

      const { error } = await supabase.from('chat_support_messages').insert({
        conversation_id: selectedConversationId,
        sender_id: user.id,
        message: replyMessage.trim(),
        is_from_admin: true,
      });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('chat_support_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
      setReplyMessage('');
    },
    onError: () => {
      toast.error('Failed to send reply');
    },
  });

  const updateConversationStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!selectedConversationId) return;

      const { error } = await supabase
        .from('chat_support_conversations')
        .update({ 
          status, 
          closed_at: status === 'closed' ? new Date().toISOString() : null 
        })
        .eq('id', selectedConversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] });
      toast.success('Conversation status updated');
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Circle className="h-3 w-3 fill-primary text-primary" />;
      case 'waiting':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'closed':
        return <CheckCircle className="h-3 w-3 text-muted-foreground" />;
      default:
        return <Circle className="h-3 w-3" />;
    }
  };

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);

  if (loadingConversations) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif">Live Chat Support</h1>
        <Badge variant="outline">
          {conversations?.filter(c => c.status === 'open').length || 0} Active Chats
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations List */}
        <Card className="md:col-span-1 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {conversations?.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  No conversations yet
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {conversations?.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={cn(
                        'w-full p-4 text-left hover:bg-muted/50 transition-colors',
                        selectedConversationId === conv.id && 'bg-muted'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">
                              {conv.profile?.name || 'Unknown User'}
                            </p>
                            {conv.unread_count && conv.unread_count > 0 ? (
                              <Badge className="h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                                {conv.unread_count}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.profile?.email}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusIcon(conv.status)}
                            <span className="text-xs text-muted-foreground capitalize">
                              {conv.status}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              • {format(new Date(conv.updated_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="md:col-span-2 flex flex-col">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {selectedConversation
                  ? selectedConversation.profile?.name || 'Chat'
                  : 'Select a conversation'}
              </CardTitle>
              {selectedConversation && (
                <div className="flex items-center gap-2">
                  {selectedConversation.status !== 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConversationStatusMutation.mutate('closed')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  )}
                  {selectedConversation.status === 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateConversationStatusMutation.mutate('open')}
                    >
                      <Circle className="h-4 w-4 mr-1" />
                      Reopen
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {!selectedConversationId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a conversation to view messages</p>
                </div>
              </div>
            ) : loadingMessages ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages?.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No messages yet
                      </p>
                    ) : (
                      messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex',
                            msg.is_from_admin ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-lg px-4 py-2',
                              msg.is_from_admin
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            )}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <p
                              className={cn(
                                'text-xs mt-1',
                                msg.is_from_admin
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a reply..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendReplyMutation.mutate();
                        }
                      }}
                      disabled={selectedConversation?.status === 'closed'}
                    />
                    <Button
                      onClick={() => sendReplyMutation.mutate()}
                      disabled={
                        !replyMessage.trim() ||
                        sendReplyMutation.isPending ||
                        selectedConversation?.status === 'closed'
                      }
                    >
                      {sendReplyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {selectedConversation?.status === 'closed' && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      This conversation is closed. Reopen to send messages.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
