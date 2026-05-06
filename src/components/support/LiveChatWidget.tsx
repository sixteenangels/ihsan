import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  message: string;
  is_from_admin: boolean;
  sender_id: string;
  created_at: string;
}

export function LiveChatWidget() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_support_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const loadMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('chat_support_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    setMessages(data || []);
  }, []);

  const findOrCreateConversation = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Look for existing open conversation
      const { data: existing, error: fetchError } = await supabase
        .from('chat_support_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        setConversationId(existing.id);
        await loadMessages(existing.id);
      } else {
        // Create new conversation
        const { data: newConv, error: createError } = await supabase
          .from('chat_support_conversations')
          .insert({ user_id: user.id, subject: 'Live Chat Support' })
          .select('id')
          .single();

        if (createError) throw createError;
        setConversationId(newConv.id);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error with conversation:', error);
      toast.error('Failed to start chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadMessages, user]);

  // Find or create conversation when widget opens
  useEffect(() => {
    if (isOpen && user) {
      findOrCreateConversation();
    }
  }, [findOrCreateConversation, isOpen, user]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !user) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('chat_support_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message: messageText,
        is_from_admin: false,
      });

      if (error) throw error;

      // Bump the conversation so new customer messages surface to admins immediately.
      await supabase
        .from('chat_support_conversations')
        .update({
          status: 'open',
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user || !isEnabled('live_chat')) {
    return null;
  }

  return (
    <>
      {/* Chat Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-20 right-4 md:bottom-6 z-50 h-14 w-14 rounded-full shadow-lg',
          isOpen && 'bg-destructive hover:bg-destructive/90'
        )}
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-36 right-4 md:bottom-24 z-50 w-[calc(100%-2rem)] max-w-sm shadow-2xl animate-in slide-in-from-bottom-4">
          <CardHeader className="pb-3 bg-primary text-primary-foreground rounded-t-lg">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Live Support Chat
            </CardTitle>
            <p className="text-sm opacity-90">We typically reply within minutes</p>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-72 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Start a conversation</p>
                  <p className="text-sm">We're here to help!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        msg.is_from_admin ? 'justify-start' : 'justify-end'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                          msg.is_from_admin
                            ? 'bg-muted text-foreground'
                            : 'bg-primary text-primary-foreground'
                        )}
                      >
                        {msg.message}
                        <p
                          className={cn(
                            'text-[10px] mt-1',
                            msg.is_from_admin ? 'text-muted-foreground' : 'opacity-70'
                          )}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 border-t">
            <div className="flex gap-2 w-full">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading || isSending}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || isLoading || isSending}
                size="icon"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
