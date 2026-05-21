import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, MessageCircle, User, Circle, Clock, CheckCircle, XCircle, AlertTriangle, Inbox, TimerReset } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInHours, format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  AFTER_SALES_ATTACHMENT_BUCKET,
  AFTER_SALES_CATEGORY,
  AFTER_SALES_SUPPORT_OPTIONS,
  getAfterSalesSupportLabel,
} from '@/lib/afterSalesSupport';
import { cn } from '@/lib/utils';
import { buildSupportReplyEmailHtml, buildSupportReplyEmailText } from '@/lib/email-templates';
import { logAdminAction } from '@/lib/audit-log';
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility';

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

interface SupportRequest {
  attachment_paths: string[];
  attachment_urls?: Array<{ path: string; url: string }>;
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  customer_phone: string | null;
  subject: string | null;
  message: string;
  category: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  source: string;
  order_id: string | null;
  order_number: string | null;
  delivery_date: string | null;
  product_names: string[];
  support_type: string | null;
  assigned_admin_id: string | null;
  internal_notes: string | null;
  public_reply: string | null;
  resolution_summary: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

const SUPPORT_PRIORITIES: SupportRequest['priority'][] = ['low', 'normal', 'high', 'urgent'];
const SUPPORT_CATEGORIES = ['General', 'Orders & Shipping', 'Payments', 'Returns & Refunds', 'Group Buys', AFTER_SALES_CATEGORY];
type SupportQueueFilter = 'all' | 'open' | 'overdue' | 'urgent' | 'unassigned';
const ADMIN_SUPPORT_CONVERSATION_POLL_MS = 15000;
const ADMIN_SUPPORT_QUEUE_POLL_MS = 30000;
const SUPPORT_QUEUE_FILTERS: SupportQueueFilter[] = ['all', 'open', 'overdue', 'urgent', 'unassigned'];

function isSupportQueueFilter(value: string | null): value is SupportQueueFilter {
  return Boolean(value && SUPPORT_QUEUE_FILTERS.includes(value as SupportQueueFilter));
}

function getSlaThresholdHours(request: SupportRequest) {
  switch (request.priority) {
    case 'urgent':
      return 2;
    case 'high':
      return 8;
    case 'normal':
      return 24;
    case 'low':
    default:
      return 48;
  }
}

function getSlaState(request: SupportRequest) {
  if (request.status === 'resolved' || request.status === 'closed') {
    return { state: 'resolved' as const, ageHours: 0 };
  }

  const ageHours = differenceInHours(new Date(), new Date(request.created_at));
  const threshold = getSlaThresholdHours(request);
  if (ageHours >= threshold) {
    return { state: 'overdue' as const, ageHours };
  }
  if (ageHours >= Math.max(1, Math.floor(threshold * 0.6))) {
    return { state: 'at_risk' as const, ageHours };
  }
  return { state: 'healthy' as const, ageHours };
}

export function AdminSupport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [requestReplies, setRequestReplies] = useState<Record<string, string>>({});
  const [requestSummaries, setRequestSummaries] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isDocumentVisible = useDocumentVisibility();
  const queueFilter = isSupportQueueFilter(searchParams.get('queue')) ? searchParams.get('queue')! : 'all';
  const categoryFilter = searchParams.get('category') || 'all';
  const supportTypeFilter = searchParams.get('type') || 'all';

  const updateRequestFilters = ({
    queue = queueFilter,
    category = categoryFilter,
    type = supportTypeFilter,
  }: {
    queue?: SupportQueueFilter;
    category?: string;
    type?: string;
  }) => {
    const nextParams = new URLSearchParams(searchParams);

    if (queue === 'all') nextParams.delete('queue');
    else nextParams.set('queue', queue);

    if (category === 'all') nextParams.delete('category');
    else nextParams.set('category', category);

    if (type === 'all') nextParams.delete('type');
    else nextParams.set('type', type);

    setSearchParams(nextParams, { replace: true });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch all conversations with profiles
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['admin-support-conversations'],
    refetchInterval: isDocumentVisible ? ADMIN_SUPPORT_CONVERSATION_POLL_MS : false,
    refetchOnWindowFocus: true,
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

  const { data: supportRequests, isLoading: loadingSupportRequests } = useQuery({
    queryKey: ['admin-support-requests'],
    refetchInterval: isDocumentVisible ? ADMIN_SUPPORT_QUEUE_POLL_MS : false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requests = (data || []) as SupportRequest[];
      const requestsWithAttachments = await Promise.all(
        requests.map(async (request) => {
          const attachmentPaths = request.attachment_paths || [];

          if (attachmentPaths.length === 0) {
            return { ...request, attachment_urls: [] };
          }

          const signedAttachments = await Promise.all(
            attachmentPaths.map(async (path) => {
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from(AFTER_SALES_ATTACHMENT_BUCKET)
                .createSignedUrl(path, 60 * 60);

              if (signedUrlError || !signedUrlData?.signedUrl) {
                return null;
              }

              return {
                path,
                url: signedUrlData.signedUrl,
              };
            }),
          );

          return {
            ...request,
            attachment_urls: signedAttachments.filter(
              (attachment): attachment is { path: string; url: string } => Boolean(attachment),
            ),
          };
        }),
      );

      return requestsWithAttachments;
    },
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
  }, [selectedConversationId, messages, queryClient]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedConversationId || !isDocumentVisible) return;

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
  }, [isDocumentVisible, selectedConversationId, queryClient]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendSupportRequestEmail = async ({
    requestId,
    customerName,
    customerEmail,
    subject,
    reply,
    summary,
  }: {
    requestId: string;
    customerName: string;
    customerEmail: string;
    subject: string;
    reply: string;
    summary?: string | null;
  }) => {
    if (!reply.trim()) {
      throw new Error('Add a public reply before sending an email.');
    }

    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        to: customerEmail,
        subject: `Re: ${subject}`,
        html: buildSupportReplyEmailHtml({ customerName, subject, reply, summary }),
        text: buildSupportReplyEmailText({ customerName, subject, reply, summary }),
        type: 'support_reply',
        relatedEntityType: 'support_request',
        relatedEntityId: requestId,
        requestedBy: user?.id,
      },
    });

    if (error) throw error;

    await logAdminAction({
      actorUserId: user?.id,
      action: 'support_request.email_sent',
      entityType: 'support_request',
      entityId: requestId,
      summary: `Attempted support reply email to ${customerEmail}.`,
      metadata: data || {},
    });

    return data;
  };

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

  const updateSupportRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      internalNotes,
      publicReply,
      resolutionSummary,
      priority,
      category,
      assignedAdminId,
    }: {
      requestId: string;
      status: SupportRequest['status'];
      internalNotes: string;
      publicReply?: string;
      resolutionSummary?: string;
      priority?: SupportRequest['priority'];
      category?: string;
      assignedAdminId?: string | null;
    }) => {
      const { error } = await supabase
        .from('support_requests')
        .update({
          status,
          internal_notes: internalNotes || null,
          public_reply: publicReply || null,
          resolution_summary: resolutionSummary || null,
          priority: priority || 'normal',
          category: category || 'General',
          assigned_admin_id: assignedAdminId ?? null,
          responded_at: status === 'resolved' || status === 'closed'
            ? new Date().toISOString()
            : null,
        })
        .eq('id', requestId);

      if (error) throw error;

      let emailResult: { sent?: boolean; skipped?: boolean } | null = null;
      const shouldAutoEmail =
        (status === 'resolved' || status === 'closed') &&
        Boolean((publicReply || resolutionSummary || '').trim());

      if (shouldAutoEmail) {
        const request = supportRequests?.find((item) => item.id === requestId);
        if (request?.email) {
          emailResult = await sendSupportRequestEmail({
            requestId,
            customerName: request.name,
            customerEmail: request.email,
            subject: category || request.category || 'your AJYN support request',
            reply: publicReply || resolutionSummary || internalNotes,
            summary: resolutionSummary,
          });
        }
      }

      await logAdminAction({
        actorUserId: user?.id,
        action: `support_request.${status}`,
        entityType: 'support_request',
        entityId: requestId,
        summary: `Updated support request ${requestId} to ${status}.`,
        metadata: {
          priority,
          category,
          assignedAdminId,
          hasReply: Boolean(publicReply),
          emailSent: emailResult?.sent || false,
        },
      });

      return emailResult;
    },
    onSuccess: (emailResult) => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-requests'] });
      if (emailResult?.sent) {
        toast.success('Support request updated and email sent');
      } else {
        toast.success('Support request updated');
      }
    },
    onError: () => {
      toast.error('Failed to update support request');
    },
  });

  const sendSupportEmailMutation = useMutation({
    mutationFn: sendSupportRequestEmail,
    onSuccess: (data) => {
      if (data?.sent) {
        toast.success('Support reply email sent');
      } else {
        toast.info('Email queued, but provider is not configured yet');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
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

  const supportRequestMetrics = useMemo(() => {
    const requests = supportRequests || [];
    const activeRequests = requests.filter((request) => request.status !== 'resolved' && request.status !== 'closed');
    const overdue = activeRequests.filter((request) => getSlaState(request).state === 'overdue');
    const urgent = activeRequests.filter((request) => request.priority === 'urgent');
    const unassigned = activeRequests.filter((request) => !request.assigned_admin_id);
    const afterSales = requests.filter((request) => request.category === AFTER_SALES_CATEGORY);

    return {
      total: requests.length,
      active: activeRequests.length,
      afterSales: afterSales.length,
      overdue: overdue.length,
      urgent: urgent.length,
      unassigned: unassigned.length,
    };
  }, [supportRequests]);

  const filteredSupportRequests = useMemo(() => {
    const requests = supportRequests || [];
    let filtered = requests;

    switch (queueFilter) {
      case 'open':
        filtered = filtered.filter((request) => request.status === 'new' || request.status === 'in_progress');
        break;
      case 'overdue':
        filtered = filtered.filter((request) => getSlaState(request).state === 'overdue');
        break;
      case 'urgent':
        filtered = filtered.filter(
          (request) => request.priority === 'urgent' && request.status !== 'resolved' && request.status !== 'closed',
        );
        break;
      case 'unassigned':
        filtered = filtered.filter(
          (request) => !request.assigned_admin_id && request.status !== 'resolved' && request.status !== 'closed',
        );
        break;
      case 'all':
      default:
        break;
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((request) => (request.category || 'General') === categoryFilter);
    }

    if (supportTypeFilter !== 'all') {
      filtered = filtered.filter((request) => request.support_type === supportTypeFilter);
    }

    return filtered;
  }, [categoryFilter, queueFilter, supportRequests, supportTypeFilter]);

  const supportCategoryCounts = useMemo(() => {
    return (supportRequests || []).reduce<Record<string, number>>((counts, request) => {
      const category = request.category || 'General';
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
  }, [supportRequests]);

  if (loadingConversations) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Live Chat Support</h1>
        <Badge variant="outline" className="w-fit">
          {conversations?.filter(c => c.status === 'open').length || 0} Active Chats
        </Badge>
      </div>

      <div className="grid gap-6 md:h-[600px] md:grid-cols-3">
        {/* Conversations List */}
        <Card className="flex min-h-[20rem] flex-col md:col-span-1">
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
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {getStatusIcon(conv.status)}
                            <span className="text-xs text-muted-foreground capitalize">
                              {conv.status}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              - {format(new Date(conv.updated_at), 'MMM d, h:mm a')}
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
        <Card className="flex min-h-[28rem] flex-col md:col-span-2">
          <CardHeader className="pb-2 border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5" />
                <span className="truncate">
                  {selectedConversation
                    ? selectedConversation.profile?.name || 'Chat'
                    : 'Select a conversation'}
                </span>
              </CardTitle>
              {selectedConversation && (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  {selectedConversation.status !== 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
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
                      className="w-full sm:w-auto"
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Support Requests & After-Sales</CardTitle>
          <Badge variant="outline">{supportRequestMetrics.total} requests</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-xl font-semibold">{supportRequestMetrics.active}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-xl font-semibold">{supportRequestMetrics.overdue}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Urgent</p>
                  <p className="text-xl font-semibold">{supportRequestMetrics.urgent}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <Inbox className="h-5 w-5 text-cyan-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Unassigned</p>
                  <p className="text-xl font-semibold">{supportRequestMetrics.unassigned}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <TimerReset className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">After-Sales</p>
                  <p className="text-xl font-semibold">{supportRequestMetrics.afterSales}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['open', 'Open'],
              ['overdue', 'Overdue'],
              ['urgent', 'Urgent'],
              ['unassigned', 'Unassigned'],
            ] as Array<[SupportQueueFilter, string]>).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={queueFilter === value ? 'default' : 'outline'}
                onClick={() => updateRequestFilters({ queue: value })}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={categoryFilter === 'all' ? 'default' : 'outline'}
              onClick={() => updateRequestFilters({ category: 'all', type: 'all' })}
            >
              All categories
            </Button>
            {SUPPORT_CATEGORIES.map((category) => (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={categoryFilter === category ? 'default' : 'outline'}
                onClick={() => updateRequestFilters({ category, type: category === AFTER_SALES_CATEGORY ? supportTypeFilter : 'all' })}
              >
                {category}
                <Badge variant="secondary" className="ml-2">
                  {supportCategoryCounts[category] || 0}
                </Badge>
              </Button>
            ))}
          </div>

          {(categoryFilter === AFTER_SALES_CATEGORY || supportTypeFilter !== 'all') && (
            <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-primary/15 bg-primary/5 p-3">
              <Button
                type="button"
                size="sm"
                variant={supportTypeFilter === 'all' ? 'default' : 'outline'}
                onClick={() => updateRequestFilters({ category: AFTER_SALES_CATEGORY, type: 'all' })}
              >
                All after-sales
              </Button>
              {AFTER_SALES_SUPPORT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={supportTypeFilter === option.value ? 'default' : 'outline'}
                  onClick={() => updateRequestFilters({ category: AFTER_SALES_CATEGORY, type: option.value })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}

          {loadingSupportRequests ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredSupportRequests.length > 0 ? (
            <div className="space-y-4">
              {filteredSupportRequests.map((request) => {
                const draftNotes = requestNotes[request.id] ?? request.internal_notes ?? '';
                const draftReply = requestReplies[request.id] ?? request.public_reply ?? '';
                const draftSummary = requestSummaries[request.id] ?? request.resolution_summary ?? '';
                const sla = getSlaState(request);
                const isAfterSalesRequest = request.category === AFTER_SALES_CATEGORY;
                return (
                  <div key={request.id} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{request.subject || request.name}</p>
                        <p className="text-sm text-muted-foreground">{request.name}</p>
                        <button
                          type="button"
                          className="text-sm text-primary underline-offset-4 hover:underline"
                          onClick={() => {
                            window.location.href = `mailto:${request.email}?subject=${encodeURIComponent('AJYN Support')}`;
                          }}
                        >
                          {request.email}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')} via {request.source.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={request.status === 'resolved' || request.status === 'closed' ? 'secondary' : 'default'}>
                          {request.status.replaceAll('_', ' ')}
                        </Badge>
                        <Badge variant={request.priority === 'urgent' ? 'destructive' : 'outline'}>
                          {request.priority} priority
                        </Badge>
                        {request.status !== 'resolved' && request.status !== 'closed' ? (
                          <Badge
                            variant={
                              sla.state === 'overdue'
                                ? 'destructive'
                                : sla.state === 'at_risk'
                                  ? 'outline'
                                  : 'secondary'
                            }
                          >
                            {sla.state === 'overdue'
                              ? `Overdue by ${sla.ageHours}h`
                              : sla.state === 'at_risk'
                                ? `Due soon ${sla.ageHours}h`
                                : 'Within SLA'}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {isAfterSalesRequest ? (
                      <div className="grid gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                            Support Need
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {getAfterSalesSupportLabel(request.support_type)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                            Order ID
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {request.order_number || 'Not attached'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                            Delivery Date
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {request.delivery_date ? format(new Date(request.delivery_date), 'MMM d, yyyy') : 'Not provided'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                            Contact
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">{request.email}</p>
                          {request.customer_phone ? (
                            <p className="text-xs text-muted-foreground">{request.customer_phone}</p>
                          ) : null}
                        </div>
                        <div className="md:col-span-2 xl:col-span-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/80">
                            Products
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {request.product_names?.length ? request.product_names.join(', ') : 'No product summary added'}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                      {request.message}
                    </div>

                    {request.attachment_urls && request.attachment_urls.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Customer attachments</p>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {request.attachment_urls.map((attachment) => (
                            <a
                              key={attachment.path}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-2xl border border-border/70 bg-muted/25 transition-colors hover:border-primary/40"
                            >
                              <img
                                src={attachment.url}
                                alt={`After-sales attachment ${request.order_number || request.id}`}
                                className="h-40 w-full object-cover"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <Select
                          value={request.category || 'General'}
                          onValueChange={(value) => updateSupportRequestMutation.mutate({
                            requestId: request.id,
                            status: request.status,
                            internalNotes: draftNotes,
                            publicReply: draftReply,
                            resolutionSummary: draftSummary,
                            priority: request.priority,
                            category: value,
                            assignedAdminId: request.assigned_admin_id,
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORT_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Priority</label>
                        <Select
                          value={request.priority || 'normal'}
                          onValueChange={(value) => updateSupportRequestMutation.mutate({
                            requestId: request.id,
                            status: request.status,
                            internalNotes: draftNotes,
                            publicReply: draftReply,
                            resolutionSummary: draftSummary,
                            priority: value as SupportRequest['priority'],
                            category: request.category || 'General',
                            assignedAdminId: request.assigned_admin_id,
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORT_PRIORITIES.map((priority) => (
                              <SelectItem key={priority} value={priority}>
                                {priority}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Assignment</label>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => updateSupportRequestMutation.mutate({
                            requestId: request.id,
                            status: request.status,
                            internalNotes: draftNotes,
                            publicReply: draftReply,
                            resolutionSummary: draftSummary,
                            priority: request.priority,
                            category: request.category || 'General',
                            assignedAdminId: request.assigned_admin_id === user?.id ? null : user?.id,
                          })}
                        >
                          {request.assigned_admin_id === user?.id ? 'Unassign myself' : request.assigned_admin_id ? 'Reassign to me' : 'Assign to me'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor={`request-notes-${request.id}`} className="text-sm font-medium">
                        Internal notes
                      </label>
                      <Textarea
                        id={`request-notes-${request.id}`}
                        value={draftNotes}
                        onChange={(e) => {
                          setRequestNotes((prev) => ({ ...prev, [request.id]: e.target.value }));
                        }}
                        placeholder="Add notes before marking this request as handled..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor={`request-reply-${request.id}`} className="text-sm font-medium">
                        Public reply draft
                      </label>
                      <Textarea
                        id={`request-reply-${request.id}`}
                        value={draftReply}
                        onChange={(e) => {
                          setRequestReplies((prev) => ({ ...prev, [request.id]: e.target.value }));
                        }}
                        placeholder="Draft the message you want to send back to the customer..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor={`request-summary-${request.id}`} className="text-sm font-medium">
                        Resolution summary
                      </label>
                      <Textarea
                        id={`request-summary-${request.id}`}
                        value={draftSummary}
                        onChange={(e) => {
                          setRequestSummaries((prev) => ({ ...prev, [request.id]: e.target.value }));
                        }}
                        placeholder="Capture what was decided so the ticket history stays useful..."
                        rows={2}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateSupportRequestMutation.mutate({
                          requestId: request.id,
                          status: request.status,
                          internalNotes: draftNotes,
                          publicReply: draftReply,
                          resolutionSummary: draftSummary,
                          priority: request.priority,
                          category: request.category || 'General',
                          assignedAdminId: request.assigned_admin_id,
                        })}
                        disabled={updateSupportRequestMutation.isPending}
                      >
                        Save Draft
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateSupportRequestMutation.mutate({
                          requestId: request.id,
                          status: 'in_progress',
                          internalNotes: draftNotes,
                          publicReply: draftReply,
                          resolutionSummary: draftSummary,
                          priority: request.priority,
                          category: request.category || 'General',
                          assignedAdminId: request.assigned_admin_id || user?.id || null,
                        })}
                        disabled={updateSupportRequestMutation.isPending}
                      >
                        Mark In Progress
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateSupportRequestMutation.mutate({
                          requestId: request.id,
                          status: 'resolved',
                          internalNotes: draftNotes,
                          publicReply: draftReply,
                          resolutionSummary: draftSummary,
                          priority: request.priority,
                          category: request.category || 'General',
                          assignedAdminId: request.assigned_admin_id || user?.id || null,
                        })}
                        disabled={updateSupportRequestMutation.isPending}
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateSupportRequestMutation.mutate({
                          requestId: request.id,
                          status: 'closed',
                          internalNotes: draftNotes,
                          publicReply: draftReply,
                          resolutionSummary: draftSummary,
                          priority: request.priority,
                          category: request.category || 'General',
                          assignedAdminId: request.assigned_admin_id || user?.id || null,
                        })}
                        disabled={updateSupportRequestMutation.isPending}
                      >
                        Close
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendSupportEmailMutation.mutate({
                          requestId: request.id,
                          customerName: request.name,
                          customerEmail: request.email,
                          subject: request.category || 'your AJYN support request',
                          reply: draftReply || draftSummary || draftNotes,
                          summary: draftSummary,
                        })}
                        disabled={sendSupportEmailMutation.isPending}
                      >
                        Send Email Reply
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No support requests match the current filters.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
