"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { ShieldCheck, Trash2, Loader2, CopyIcon, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  RightSidebar,
  RightSidebarHeader,
  RightSidebarContent,
  RightSidebarFooter,
  RightSidebarRail,
  useRightSidebar,
} from "@/components/ui/right-sidebar"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input"
import { SuggestedQuestions } from "./suggested-questions"
import { useChat } from "@/hooks/use-chat"
import type { ChatMessage } from "@/types/schemas"

function extractReportIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/reports\/([^/]+)$/)
  return match ? match[1] : null
}

export function ChatSidebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setMounted(true)
  }, [])

  const reportId = extractReportIdFromPath(pathname)

  // Don't render on non-report pages
  if (!reportId) {
    return null
  }

  // Render placeholder during SSR to maintain consistent component tree
  // This prevents Radix ID mismatch when both sidebars are open
  if (!mounted) {
    return (
      <RightSidebar>
        <RightSidebarHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <span className="font-semibold">BPMN Guard</span>
          </div>
        </RightSidebarHeader>
        <RightSidebarContent>
          <div className="flex-1 flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </RightSidebarContent>
        <RightSidebarFooter className="border-t p-4" />
      </RightSidebar>
    )
  }

  return <ChatSidebarContent reportId={reportId} />
}

interface ChatSidebarContentProps {
  reportId: string
}

const MAX_MESSAGE_LENGTH = 4000

function ChatSidebarContent({ reportId }: ChatSidebarContentProps) {
  const [inputValue, setInputValue] = useState("")
  const { toggleSidebar } = useRightSidebar()
  const {
    messages,
    streamingContent,
    isLoadingHistory,
    status,
    sendMessage,
    clearChat,
    isClearingChat,
    cancelRequest,
  } = useChat(reportId)

  const handleSubmit = ({ text }: { text: string }) => {
    const trimmed = text.trim()
    if (trimmed && trimmed.length <= MAX_MESSAGE_LENGTH) {
      sendMessage(trimmed)
      setInputValue("")
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }

  const isOverLimit = inputValue.length > MAX_MESSAGE_LENGTH

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question)
  }

  const isGenerating = status === 'submitted' || status === 'streaming'

  return (
    <RightSidebar>
      <RightSidebarRail />
      <RightSidebarHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <span className="font-semibold">BPMN Guard</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Delete/Reset Button with Confirmation */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={messages.length === 0 || isClearingChat}
                  title="Reset conversation"
                >
                  {isClearingChat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all messages in this conversation.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearChat()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              title="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </RightSidebarHeader>

      <RightSidebarContent>
        {isLoadingHistory ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 && !isGenerating ? (
          <Conversation className="h-full">
            <ConversationContent className="justify-center">
              <ConversationEmptyState
                icon={<ShieldCheck className="h-12 w-12 text-green-600" />}
                title="Welcome to BPMN Guard"
                description="I have access to your BPMN model and evaluation results. Ask me anything about your process!"
              >
                <div className="mt-4">
                  <SuggestedQuestions
                    onSelect={handleSuggestedQuestion}
                    disabled={isGenerating}
                  />
                </div>
              </ConversationEmptyState>
            </ConversationContent>
          </Conversation>
        ) : (
          <Conversation className="h-full">
            <ConversationContent>
              {messages.map((message, index) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1 && message.role === 'assistant'}
                />
              ))}

              {/* Show streaming message */}
              {isGenerating && (
                <Message from="assistant">
                  <MessageContent>
                    {streamingContent ? (
                      <MessageResponse>{streamingContent}</MessageResponse>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                        <span className="animate-pulse">Thinking</span>
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                      </span>
                    )}
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
      </RightSidebarContent>

      <RightSidebarFooter className="border-t p-0">
        <PromptInput
          onSubmit={handleSubmit}
          className="border-0"
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Ask about your BPMN model..."
              disabled={isLoadingHistory}
              className="min-h-[60px] max-h-[120px]"
              value={inputValue}
              onChange={handleInputChange}
            />
          </PromptInputBody>
          <PromptInputFooter className="justify-between px-3 pb-3">
            <span className={`text-xs ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              {inputValue.length > 0 && `${inputValue.length}/${MAX_MESSAGE_LENGTH}`}
            </span>
            <PromptInputSubmit
              status={status}
              onStop={cancelRequest}
              disabled={isLoadingHistory || isOverLimit}
            />
          </PromptInputFooter>
        </PromptInput>
      </RightSidebarFooter>
    </RightSidebar>
  )
}

interface ChatMessageItemProps {
  message: ChatMessage
  isLast?: boolean
}

function ChatMessageItem({ message, isLast }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="space-y-1">
      <Message from={message.role}>
        <MessageContent>
          <MessageResponse>{message.content}</MessageResponse>
        </MessageContent>
      </Message>

      {/* Show actions only for the last assistant message */}
      {message.role === 'assistant' && isLast && (
        <MessageActions>
          <MessageAction onClick={handleCopy} label="Copy" tooltip={copied ? "Copied!" : "Copy message"} className="cursor-pointer">
            {copied ? <Check className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
          </MessageAction>
        </MessageActions>
      )}
    </div>
  )
}
