-- Create chat_support_conversations table
CREATE TABLE public.chat_support_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'waiting')),
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  assigned_admin_id UUID
);

-- Create chat_support_messages table
CREATE TABLE public.chat_support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  is_from_admin BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.chat_support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_support_messages ENABLE ROW LEVEL SECURITY;

-- RLS for chat_support_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.chat_support_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
  ON public.chat_support_conversations FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can create conversations"
  ON public.chat_support_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update all conversations"
  ON public.chat_support_conversations FOR UPDATE
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can update their own conversations"
  ON public.chat_support_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS for chat_support_messages
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_support_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all messages"
  ON public.chat_support_messages FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can create messages in their conversations"
  ON public.chat_support_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_support_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create messages in any conversation"
  ON public.chat_support_messages FOR INSERT
  WITH CHECK (
    is_admin_or_manager(auth.uid()) AND auth.uid() = sender_id
  );

CREATE POLICY "Message senders can update their messages"
  ON public.chat_support_messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Admins can update any message"
  ON public.chat_support_messages FOR UPDATE
  USING (is_admin_or_manager(auth.uid()));

-- Update timestamp trigger
CREATE TRIGGER update_chat_support_conversations_updated_at
  BEFORE UPDATE ON public.chat_support_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_support_conversations;