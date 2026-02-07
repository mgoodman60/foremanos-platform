"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Trash2, Copy, Check, RefreshCw, HelpCircle, Loader2, ImagePlus, X, ThumbsUp, ThumbsDown, Download, FileText, Lock, Target, ClipboardList, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import { MessageContent } from './message-content';
import { ConversationSidebar } from './conversation-sidebar';
import { WorkflowModal } from './workflow-modal';
import DailyReportTemplate, { type DailyReportData } from './daily-report-template';
import ScheduleUpdateReviewModal from './schedule-update-review-modal';
import TemplateExportDialog from './template-export-dialog';
import { analyzeScheduleImpact } from '@/lib/schedule-analyzer';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { QuickActions } from './chat/quick-actions';
import { WithTooltip } from '@/components/ui/icon-button';
import { SourceCitations, Citation } from './chat/source-citations';
import { FollowUpSuggestions } from './chat/follow-up-suggestions';
import { MessageSearch } from './chat/message-search';
import { ConfirmDialog } from './confirm-dialog';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string; // base64 encoded image
  imageName?: string; // original filename
  citations?: Citation[];
  followUpSuggestions?: string[];
}

// Role-based sample questions
const SAMPLE_QUESTIONS_INTERNAL = [
  "What's the current project schedule?",
  "Show me the project plans",
  "Upload a picture to see what you're supposed to do",
  "Upload a picture to verify if something is installed correctly",
  "What do the specs say about this?"
];

const SAMPLE_QUESTIONS_EXTERNAL = [
  "What's the current project schedule?",
  "Show me the project plans",
  "Upload a picture to see what you're supposed to do",
  "Upload a picture to verify if something is installed correctly",
  "What do the specs say about this?"
];

interface ChatInterfaceProps {
  userRole?: string;
  projectSlug?: string;
  projectId?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function ChatInterface({ userRole: propUserRole, projectSlug, projectId, mobileOpen, onMobileClose }: ChatInterfaceProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [imageContext, setImageContext] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, number>>({});
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [showMaterialTakeoff, setShowMaterialTakeoff] = useState(false);
  const [showMEPEquipment, setShowMEPEquipment] = useState(false);
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession() || {};
  const userRole = propUserRole || session?.user?.role || 'guest';
  const isLoggedIn = !!session?.user;
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Properly typed conversation metadata
  interface ConversationMetadata {
    id: string;
    title: string;
    conversationType: string;
    isReadOnly: boolean;
    finalized?: boolean;
  }
  const [currentConversation, setCurrentConversation] = useState<ConversationMetadata | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);

  // Properly typed finalization status
  interface FinalizationStatus {
    hasData: boolean;
    canFinalize: boolean;
    finalized: boolean;
  }
  const [finalizationStatus, setFinalizationStatus] = useState<FinalizationStatus | null>(null);
  const [isFinalizingReport, setIsFinalizingReport] = useState(false);
  const [showDailyReportTemplate, setShowDailyReportTemplate] = useState(false);

  // Properly typed schedule analysis (matches ScheduleUpdateReviewModal)
  interface ScheduleUpdateSuggestion {
    taskId: string;
    taskName: string;
    scheduleId?: string;
    currentStatus: string;
    currentPercentComplete: number;
    suggestedStatus: string;
    suggestedPercentComplete: number;
    confidence: number;
    reasoning: string;
    impactType: 'progress' | 'delay' | 'completion' | 'acceleration';
    severity: 'low' | 'medium' | 'high';
  }

  interface ScheduleAnalysis {
    hasScheduleImpact: boolean;
    suggestions: ScheduleUpdateSuggestion[];
    summary: string;
  }
  const [scheduleAnalysis, setScheduleAnalysis] = useState<ScheduleAnalysis | null>(null);
  const [showScheduleReview, setShowScheduleReview] = useState(false);
  const [showTemplateExportDialog, setShowTemplateExportDialog] = useState(false);
  const [analyzingSchedule, setAnalyzingSchedule] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState<{ messageId: string; text: string } | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showNewConversationConfirm, setShowNewConversationConfirm] = useState(false);

  // Check if user has full access (admin or client/owner)
  const hasFullAccess = userRole === 'admin' || userRole === 'client';
  
  // Check if current conversation is read-only
  const isReadOnly = currentConversation?.isReadOnly === true;
  
  // Select appropriate sample questions based on user role
  const SAMPLE_QUESTIONS = hasFullAccess
    ? SAMPLE_QUESTIONS_INTERNAL 
    : SAMPLE_QUESTIONS_EXTERNAL;

  const scrollToBottom = () => {
    // Scroll the chat container, not the entire page
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Only scroll when a new message is added, not on every render
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom();
      prevMessageCountRef.current = messages.length;
    }
  }, [messages]);

  // Fetch documents and generate smart suggestions
  useEffect(() => {
    const fetchDocumentsAndGenerateSuggestions = async () => {
      if (!projectSlug || documentsLoaded) return;
      
      try {
        const response = await fetchWithRetry(`/api/documents?projectId=${projectSlug}`, {
          retryOptions: {
            maxRetries: 2,
            onRetry: () => {}
          }
        });
        if (!response.ok) return;
        
        const data = await response.json();
        const documents = data.documents || [];
        
        if (documents.length > 0) {
          const suggestions: string[] = [];
          
          // Check for specific document types and generate relevant questions
          const hasSchedule = documents.some((doc: { name: string }) => 
            doc.name.toLowerCase().includes('schedule') || 
            doc.name.toLowerCase().includes('timeline')
          );
          const hasPlans = documents.some((doc: { name: string }) => 
            doc.name.toLowerCase().includes('plan') || 
            doc.name.toLowerCase().includes('blueprint')
          );
          const hasBudget = documents.some((doc: { name: string }) => 
            doc.name.toLowerCase().includes('budget') || 
            doc.name.toLowerCase().includes('cost')
          );
          const hasSpecs = documents.some((doc: { name: string }) => 
            doc.name.toLowerCase().includes('spec') || 
            doc.name.toLowerCase().includes('requirement')
          );
          const hasGeotech = documents.some((doc: { name: string }) => 
            doc.name.toLowerCase().includes('geotech') || 
            doc.name.toLowerCase().includes('soil')
          );
          
          // Generate smart suggestions based on available documents
          if (hasSchedule) {
            suggestions.push("What's the project timeline?");
            suggestions.push("When is the expected completion date?");
          }
          if (hasPlans) {
            suggestions.push("Show me the building dimensions");
            suggestions.push("What are the key architectural features?");
          }
          if (hasBudget) {
            suggestions.push("What's the total project budget?");
            suggestions.push("Break down the major cost categories");
          }
          if (hasSpecs) {
            suggestions.push("What are the material specifications?");
            suggestions.push("Explain the technical requirements");
          }
          if (hasGeotech) {
            suggestions.push("What does the geotechnical report say?");
            suggestions.push("Are there any soil concerns?");
          }
          
          // Always include these general suggestions
          suggestions.push("Summarize all project documents");
          suggestions.push("What are the critical project milestones?");
          
          // Shuffle and take top 5 suggestions
          const shuffled = suggestions.sort(() => 0.5 - Math.random());
          setSmartSuggestions(shuffled.slice(0, 5));
        }
        
        setDocumentsLoaded(true);
      } catch (error) {
        console.error('Error fetching documents for suggestions:', error);
      }
    };
    
    fetchDocumentsAndGenerateSuggestions();
  }, [projectSlug, documentsLoaded]);

  // Process and compress image
  const processImage = async (file: File): Promise<void> => {
    try {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      // Show loading toast
      const toastId = toast.loading('Processing image...');

      // Compression options
      const options = {
        maxSizeMB: 1, // Max file size 1MB
        maxWidthOrHeight: 1920, // Max dimension
        useWebWorker: true,
        fileType: file.type,
      };

      // Compress image if larger than 500KB
      let processedFile = file;
      if (file.size > 500 * 1024) {
        try {
          processedFile = await imageCompression(file, options);
        } catch (compressionError) {
          console.warn('Compression failed, using original file:', compressionError);
        }
      }

      // Check final file size
      if (processedFile.size > 5 * 1024 * 1024) {
        toast.error('Image is too large. Please use a smaller image.', { id: toastId });
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setUploadedImage(base64String);
        setUploadedImageName(file.name);
        
        // If there's a context from a sample question, set it as input
        if (imageContext) {
          setInput(imageContext);
          setImageContext('');
        }
        
        const sizeKB = (processedFile.size / 1024).toFixed(0);
        toast.success(`Image uploaded (${sizeKB} KB)`, { id: toastId });
      };
      reader.onerror = () => {
        toast.error('Failed to read image file', { id: toastId });
      };
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImage(file);
  };

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if leaving the chat container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processImage(file);
    }
  };

  // Handle paste from clipboard
  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await processImage(file);
        }
        break;
      }
    }
  };

  // Add paste event listener
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => handlePaste(e);
    document.addEventListener('paste', handlePasteEvent);
    return () => {
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [imageContext]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monitor network connection status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are offline. Please check your internet connection.');
    };

    // Set initial status
    setIsOnline(navigator.onLine);

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcut for search (Cmd/Ctrl + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && activeConversationId) {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeConversationId]);

  // Handle search result selection
  const handleSearchResultSelect = (messageId: string, highlightText: string) => {
    // Find the message element in the DOM
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement && chatContainerRef.current) {
      // Scroll to the message
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Set highlight
      setSearchHighlight({ messageId, text: highlightText });

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setSearchHighlight(null);
      }, 3000);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    setUploadedImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Conversation handlers
  const handleConversationSelect = (conversationId: string | null) => {
    setActiveConversationId(conversationId);
    if (conversationId) {
      loadConversationMessages(conversationId);
    } else {
      setMessages([]);
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setFinalizationStatus(null);
    toast.success('New conversation started');
  };

  // Fetch finalization status for daily reports
  const fetchFinalizationStatus = async (conversationId: string) => {
    try {
      const response = await fetchWithRetry(`/api/conversations/${conversationId}/finalize`, {
        retryOptions: {
          maxRetries: 2,
          onRetry: () => {}
        }
      });
      if (response.ok) {
        const status = await response.json();
        setFinalizationStatus(status);
      }
    } catch (error) {
      console.error('[FINALIZATION] Failed to fetch status:', error);
    }
  };

  // Handle Daily Report Template submission
  const handleDailyReportSubmit = async (data: DailyReportData) => {
    // Get task names from IDs
    const completedTaskNames = data.tasksCompleted;
    const inProgressTaskNames = data.tasksInProgress;

    let reportMessage = `# Daily Report - ${data.date}\n\n`;
    reportMessage += `**Crew Size:** ${data.crewSize} workers\n`;
    reportMessage += `**Weather:** ${data.weatherCondition}\n`;
    
    if (data.weatherDelay) {
      reportMessage += `**Weather Delay:** Yes - ${data.weatherDelayReason}\n`;
    }
    
    reportMessage += `\n## Tasks Completed Today\n`;
    if (completedTaskNames.length > 0) {
      completedTaskNames.forEach(task => {
        reportMessage += `- ✅ ${task}\n`;
      });
    } else {
      reportMessage += `No tasks marked as completed\n`;
    }
    
    reportMessage += `\n## Tasks In Progress\n`;
    if (inProgressTaskNames.length > 0) {
      inProgressTaskNames.forEach(task => {
        reportMessage += `- 🔄 ${task}\n`;
      });
    } else {
      reportMessage += `No tasks in progress\n`;
    }
    
    if (data.delays.length > 0) {
      reportMessage += `\n## Delays & Issues\n`;
      data.delays.forEach(delay => {
        reportMessage += `- **${delay.reason}:** ${delay.description}\n`;
      });
    }
    
    if (data.notes) {
      reportMessage += `\n## Additional Notes\n${data.notes}\n`;
    }
    
    if (data.tomorrowPlan) {
      reportMessage += `\n## Tomorrow's Plan\n${data.tomorrowPlan}\n`;
    }

    // Set the input and trigger send
    setInput(reportMessage);
    
    // Trigger send on next tick to ensure input is set
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
      }
    }, 0);

    // Analyze schedule impact after report is submitted
    if (projectSlug) {
      setAnalyzingSchedule(true);
      try {
        const analysis = await analyzeScheduleImpact(reportMessage, projectSlug);
        if (analysis.hasScheduleImpact) {
          setScheduleAnalysis(analysis);
          setShowScheduleReview(true);
          toast.success('AI detected potential schedule impacts - review suggestions');
        }
      } catch (error) {
        console.error('Error analyzing schedule impact:', error);
        // Don't show error toast, just log it
      } finally {
        setAnalyzingSchedule(false);
      }
    }
  };

  // Handle manual report finalization
  const handleFinalizeReport = () => {
    if (!activeConversationId) return;
    setShowSubmitConfirm(true);
  };

  const doFinalizeReport = async () => {
    setShowSubmitConfirm(false);
    if (!activeConversationId) return;

    setIsFinalizingReport(true);
    const toastId = toast.loading('Submitting daily report...');

    try {
      const response = await fetchWithRetry(`/api/conversations/${activeConversationId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        retryOptions: {
          maxRetries: 3,
          onRetry: (attempt) => {
            toast.loading(`Submitting daily report... (attempt ${attempt}/3)`, { id: toastId });
          }
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to finalize report');
      }

      toast.success('Daily report submitted successfully! PDF generated and saved.', { id: toastId });
      
      // Refresh finalization status
      await fetchFinalizationStatus(activeConversationId);
      
      // Reload conversation to get updated finalized state
      await loadConversationMessages(activeConversationId);

    } catch (error: unknown) {
      console.error('[FINALIZATION] Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit report', { id: toastId });
    } finally {
      setIsFinalizingReport(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    const toastId = toast.loading('Loading conversation...');
    try {
      const response = await fetchWithRetry(`/api/conversations/${conversationId}/messages`, {
        retryOptions: {
          maxRetries: 3,
          onRetry: (attempt) => {
            toast.loading(`Loading conversation... (attempt ${attempt}/3)`, { id: toastId });
          }
        }
      });
      
      if (!response.ok) {
        console.error('[LOAD MESSAGES] Failed to load:', response.status, response.statusText);
        toast.error('Failed to load conversation', { id: toastId });
        return;
      }
      
      toast.dismiss(toastId);
      
      const data = await response.json();

      // Map messages from database format (message + response) to UI format
      const loadedMessages: Message[] = [];
      data.messages.forEach((msg: { id: string; message: string; response: string; createdAt: string; hasImage?: boolean }) => {
        // Add user message if it exists and is not empty
        if (msg.message && msg.message.trim()) {
          loadedMessages.push({
            id: msg.id + '-user',
            role: 'user',
            content: msg.message,
            timestamp: new Date(msg.createdAt),
            image: msg.hasImage ? 'image' : undefined,
          });
        }
        
        // Add assistant response if it exists and is not empty
        if (msg.response && msg.response.trim()) {
          loadedMessages.push({
            id: msg.id + '-assistant',
            role: 'assistant',
            content: msg.response,
            timestamp: new Date(msg.createdAt),
          });
        }
      });
      
      setMessages(loadedMessages);

      // Set conversation metadata
      if (data.conversation) {
        setCurrentConversation(data.conversation);
        
        // Fetch finalization status for daily reports
        if (data.conversation.conversationType === 'daily_report') {
          await fetchFinalizationStatus(conversationId);
        }
      }
    } catch (error) {
      console.error('[LOAD MESSAGES] Exception:', error);
      toast.error('Failed to load conversation', { id: toastId });
    }
  };

  const sendMessage = async (e: React.FormEvent, messageText?: string) => {
    e.preventDefault();
    const messageToSend = messageText || input;
    if ((!messageToSend.trim() && !uploadedImage) || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
      image: uploadedImage || undefined,
      imageName: uploadedImageName || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const imageToSend = uploadedImage;
    const imageNameToSend = uploadedImageName;
    setUploadedImage(null);
    setUploadedImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setLoading(true);
    setRetryMessage(null);

    try {
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: messageToSend,
          image: imageToSend,
          imageName: imageNameToSend,
          projectSlug: projectSlug,
          conversationId: activeConversationId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific HTTP status codes with tailored messages
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Wait a moment.');
        } else if (response.status === 503) {
          throw new Error('Service under maintenance. Try again later.');
        } else if (response.status === 500) {
          throw new Error('Service temporarily unavailable.');
        }

        // Try to get error details from response
        try {
          const errorData = await response.json();
          const errorMsg = errorData.error || errorData.message;

          // Check for "no documents" error
          if (errorMsg && errorMsg.toLowerCase().includes('no document')) {
            throw new Error('Upload documents to enable AI chat.');
          }

          throw new Error(errorMsg || 'Failed to send message. Please try again.');
        } catch (jsonError) {
          // If JSON parsing fails, use generic message
          throw new Error('Failed to send message. Please try again.');
        }
      }

      // Handle streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream available');

        const decoder = new TextDecoder();
        let assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, assistantMessage]);

        let partialRead = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          partialRead += decoder.decode(value, { stream: true });
          let lines = partialRead.split('\n');
          partialRead = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                if (parsed.conversationId && !activeConversationId) {
                  // Set conversation ID for newly created conversations
                  setActiveConversationId(parsed.conversationId);
                }
                if (parsed.content) {
                  assistantMessage.content += parsed.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { ...assistantMessage };
                    return newMessages;
                  });
                }
                // Handle metadata with citations and follow-up suggestions
                if (parsed.metadata) {
                  const { citations, followUpSuggestions } = parsed.metadata;
                  assistantMessage.citations = citations;
                  assistantMessage.followUpSuggestions = followUpSuggestions;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { ...assistantMessage };
                    return newMessages;
                  });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } else {
        // Handle non-streaming response (e.g., access denial)
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || data.error || 'No response received',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      let errorMsg = 'Sorry, I encountered an error processing your request.';

      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMsg = 'Request timed out. The query may be too complex or the server is slow to respond. Please try again.';
        } else {
          // Use the error message we set in the response handling
          errorMsg = error.message;
        }
      }

      // Handle network errors (fetch failed entirely before getting a response)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMsg = 'Connection failed. Check your internet connection.';
      }

      // Check if it's a network connectivity issue
      if (!navigator.onLine) {
        errorMsg = 'Connection failed. Check your internet connection.';
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setRetryMessage(messageToSend);
      toast.error(errorMsg.length > 50 ? 'Failed to send message' : errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Submit feedback for a message
  const submitFeedback = async (messageId: string, rating: number) => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setFeedbackGiven(prev => ({ ...prev, [messageId]: rating }));
      toast.success(rating === 1 ? 'Thanks for the positive feedback!' : 'Thanks for your feedback');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
    }
  };

  // Export chat in multiple formats
  const exportChat = (format: 'txt' | 'json' = 'txt') => {
    if (messages.length === 0) {
      toast.error('No messages to export');
      return;
    }

    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      let blob: Blob;
      let filename: string;

      if (format === 'json') {
        // JSON export
        const exportData = {
          metadata: {
            exportedAt: new Date().toISOString(),
            user: session?.user?.email || session?.user?.username || 'Guest',
            accessLevel: hasFullAccess ? 'Full Access (Admin/Client)' : 'Guest Access',
            messageCount: messages.length,
            conversationId: activeConversationId,
          },
          messages: messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            image: msg.image || null,
            imageName: msg.imageName || null,
          })),
        };
        
        blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        filename = `chat-transcript-${timestamp}.json`;
      } else {
        // Text export
        let chatText = `ForemanOS - Chat Transcript\n`;
        chatText += `Exported: ${new Date().toLocaleString()}\n`;
        chatText += `User: ${session?.user?.email || session?.user?.username || 'Guest'}\n`;
        chatText += `Access Level: ${hasFullAccess ? 'Full Access (Admin/Client)' : 'Guest Access'}\n`;
        chatText += `\n${'='.repeat(60)}\n\n`;

        messages.forEach((msg, index) => {
          const timestamp = msg.timestamp.toLocaleString();
          const role = msg.role === 'user' ? 'YOU' : 'AI ASSISTANT';
          
          chatText += `[${timestamp}] ${role}:\n`;
          if (msg.image) {
            chatText += `[Image: ${msg.imageName || 'uploaded image'}]\n`;
          }
          chatText += `${msg.content}\n\n`;
        });

        chatText += `${'='.repeat(60)}\n`;
        chatText += `End of transcript - ${messages.length} messages\n`;
        
        blob = new Blob([chatText], { type: 'text/plain' });
        filename = `chat-transcript-${timestamp}.txt`;
      }

      // Create and download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`✓ Chat exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting chat:', error);
      toast.error('Failed to export chat');
    }
  };

  const clearChat = () => {
    if (messages.length === 0) return;
    setShowNewConversationConfirm(true);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const copyMessage = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleSampleQuestion = (question: string) => {
    // If the question is about uploading a picture, trigger the file picker
    if (question.toLowerCase().includes('upload a picture')) {
      // Store the context for when the image is uploaded
      if (question.toLowerCase().includes('supposed to do')) {
        setImageContext("What am I supposed to do here?");
      } else if (question.toLowerCase().includes('installed correctly')) {
        setImageContext("Is this installed correctly?");
      }
      fileInputRef.current?.click();
      toast.info('Please select an image to upload');
    } else {
      setInput(question);
      inputRef.current?.focus();
    }
  };

  const retryLastMessage = (e: React.FormEvent) => {
    if (retryMessage) {
      sendMessage(e, retryMessage);
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex h-[600px] md:h-[700px] bg-dark-surface rounded-lg shadow-xl overflow-hidden border border-gray-700">
      {/* Conversation Sidebar */}
      {isLoggedIn && projectSlug && projectId && (
        <ConversationSidebar
          projectSlug={projectSlug}
          projectId={projectId}
          activeConversationId={activeConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
          mobileOpen={mobileOpen}
          onMobileClose={onMobileClose}
        />
      )}

      {/* Main Chat Interface */}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Header - Mobile Optimized */}
      <div className="bg-dark-surface text-white p-2 sm:p-3 lg:p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" aria-hidden="true" />
            <div>
              <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-[#F8FAFC]">Project Assistant</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm lg:text-base text-gray-300">
                  {hasFullAccess ? 'Full Access' : 'Guest Access'}
                </p>
                {!isOnline && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                    Offline
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search button - only show when conversation is active */}
            {activeConversationId && messages.length > 0 && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-1.5 sm:p-2 hover:bg-dark-card rounded-lg transition-all transform hover:scale-110 focus:ring-2 focus:ring-[#F97316] focus:outline-none ${
                  showSearch ? 'bg-dark-card text-[#F97316]' : ''
                }`}
                aria-label="Search messages"
                title="Search messages (Ctrl/Cmd+F)"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-1.5 sm:p-2 hover:bg-dark-card rounded-lg transition-all transform hover:scale-110 focus:ring-2 focus:ring-[#F97316] focus:outline-none"
              aria-label="Toggle help"
              title="Quick help"
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {hasFullAccess && projectSlug && (
              <>
                <button
                  onClick={() => setShowDailyReportTemplate(true)}
                  className="p-1.5 sm:p-2 hover:bg-dark-card rounded-lg transition-all transform hover:scale-110 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  aria-label="Daily Report Template"
                  title="Fill structured daily report"
                >
                  <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </button>
                <button
                  onClick={() => setShowWorkflowModal(true)}
                  disabled={!activeConversationId}
                  className="p-1.5 sm:p-2 hover:bg-dark-card rounded-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#F97316] focus:outline-none"
                  aria-label="Daily Report"
                  title="Start daily report"
                >
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-[#F97316]" />
                </button>
              </>
            )}
            {/* Finalize Daily Report Button */}
            {currentConversation?.conversationType === 'daily_report' && 
             !currentConversation?.finalized && 
             finalizationStatus?.hasData && 
             hasFullAccess && (
              <button
                onClick={handleFinalizeReport}
                disabled={isFinalizingReport}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-green-500 focus:outline-none font-medium text-xs sm:text-sm shadow-lg"
                aria-label="Submit report"
                title="Finalize and submit this daily report"
              >
                {isFinalizingReport ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    <span className="hidden sm:inline">Submitting...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Submit Report</span>
                    <span className="sm:hidden">Submit</span>
                  </>
                )}
              </button>
            )}
            {/* Already Finalized Indicator + Template Export */}
            {currentConversation?.conversationType === 'daily_report' && 
             currentConversation?.finalized && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-gray-700 text-gray-300 rounded-lg text-xs sm:text-sm font-medium">
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Submitted</span>
                </div>
                <button
                  onClick={() => setShowTemplateExportDialog(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-[#F97316] hover:bg-[#ea6d0a] text-white rounded-lg text-xs sm:text-sm font-medium transition-all transform hover:scale-105"
                  title="Export using template"
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Export Template</span>
                </button>
              </>
            )}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={messages.length === 0}
                className="p-1.5 sm:p-2 hover:bg-dark-card rounded-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#F97316] focus:outline-none"
                aria-label="Export chat"
                title="Download chat transcript"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {showExportMenu && messages.length > 0 && (
                <div className="absolute right-0 top-full mt-2 bg-dark-card border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => {
                      exportChat('txt');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Export as TXT
                  </button>
                  <button
                    onClick={() => {
                      exportChat('json');
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-dark-surface transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={clearChat}
              disabled={messages.length === 0}
              className="p-1.5 sm:p-2 hover:bg-dark-card rounded-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#F97316] focus:outline-none"
              aria-label="Clear chat"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Help Panel - Compact on Mobile */}
        {showHelp && (
          <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-dark-card rounded-lg text-xs sm:text-sm animate-in slide-in-from-top border border-gray-700">
            <p className="font-semibold mb-1 sm:mb-2 text-[#F8FAFC]">Tips for effective queries:</p>
            <ul className="space-y-0.5 sm:space-y-1 text-gray-300">
              <li>• Be specific about what you need</li>
              <li>• Reference document names when needed</li>
              <li>• Ask follow-up questions for clarity</li>
              <li className="hidden sm:list-item">• Use the sample questions below to get started</li>
            </ul>
          </div>
        )}
      </div>

      {/* Message Search */}
      <MessageSearch
        conversationId={activeConversationId}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onResultSelect={handleSearchResultSelect}
      />

      {/* Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark-surface relative" 
        role="log" 
        aria-live="polite" 
        aria-label="Chat messages"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-[#F97316] bg-opacity-90 z-50 flex items-center justify-center animate-in fade-in">
            <div className="text-center text-white">
              <ImagePlus className="w-16 h-16 mx-auto mb-4 animate-bounce" />
              <p className="text-2xl font-bold uppercase tracking-wider">Drop Image Here</p>
              <p className="text-lg mt-2">Release to upload</p>
            </div>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <div className="w-16 h-16 mx-auto mb-4 relative bg-dark-card rounded-lg p-2 shadow-sm" aria-hidden="true">
              <Image 
                src="/foremanos-logo.png" 
                alt="ForemanOS Logo" 
                fill
                className="object-contain"
              />
            </div>
            <p className="text-lg font-medium text-[#F8FAFC]">How can I help with your project?</p>
            <p className="text-sm mt-2 mb-6 text-gray-300">Ask me about schedules, plans, specifications, or troubleshooting.</p>
            
            {/* Smart Suggestions or Sample Questions */}
            <div className="max-w-2xl mx-auto mt-8">
              {smartSuggestions.length > 0 ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                      Smart Suggestions (Based on your documents)
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {smartSuggestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleSampleQuestion(question)}
                        className="p-3 text-left text-sm bg-gradient-to-br from-[#2d333b] to-[#3d434b] border-2 border-gray-600 rounded-lg hover:border-[#F97316] hover:shadow-lg transition-all transform hover:scale-105 focus:ring-2 focus:ring-[#F97316] focus:outline-none group"
                        aria-label={`Use smart suggestion: ${question}`}
                      >
                        <span className="text-gray-200 group-hover:text-[#F97316] font-medium flex items-start gap-2">
                          <span className="text-[#F97316] text-xs mt-0.5">✨</span>
                          {question}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Try asking:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SAMPLE_QUESTIONS.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleSampleQuestion(question)}
                        className="p-3 text-left text-sm bg-dark-card border-2 border-gray-600 rounded-lg hover:border-[#F97316] hover:shadow-md transition-all transform hover:scale-105 focus:ring-2 focus:ring-[#F97316] focus:outline-none group"
                        aria-label={`Use sample question: ${question}`}
                      >
                        <span className="text-gray-200 group-hover:text-[#F97316] font-medium">{question}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          // Extract messageId from the message id (format: "messageId-role")
          const messageId = message.id.includes('-') ? message.id.split('-')[0] : message.id;
          const isHighlighted = searchHighlight?.messageId === messageId;

          return (
          <div
            key={message.id}
            data-message-id={messageId}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom ${
              isHighlighted ? 'bg-yellow-500/10 rounded-lg p-2 -m-2' : ''
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-card flex items-center justify-center p-1 shadow-sm" aria-hidden="true">
                <div className="relative w-full h-full">
                  <Image 
                    src="/foremanos-logo.png" 
                    alt="AI Assistant" 
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}
            <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
              <div
                className={`rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-[#F97316] text-white'
                    : 'bg-dark-card text-[#F8FAFC] shadow-md border border-gray-700'
                } ${isHighlighted ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#1F2328]' : ''}`}
              >
                {message.image && (
                  <div className="mb-3">
                    <div className="relative w-full max-w-sm aspect-video bg-gray-700 rounded-lg overflow-hidden">
                      <Image 
                        src={message.image} 
                        alt={message.imageName || 'Uploaded image'}
                        fill
                        className="object-contain"
                      />
                    </div>
                    {message.imageName && (
                      <p className="text-xs mt-1 opacity-80">{message.imageName}</p>
                    )}
                  </div>
                )}
                {message.content && (
                  <MessageContent
                    content={message.content}
                    onOpenRoom={() => setShowRoomBrowser(true)}
                    onOpenMaterials={() => setShowMaterialTakeoff(true)}
                    onOpenMEP={() => setShowMEPEquipment(true)}
                    onOpenPlans={() => setShowPlanViewer(true)}
                  />
                )}
                {/* Source Citations */}
                {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                  <SourceCitations 
                    citations={message.citations}
                    onDocumentClick={(docId, pageNum) => {
                      // Open document viewer - could integrate with existing preview
                      window.open(`/api/documents/${docId}?page=${pageNum || 1}`, '_blank');
                    }}
                  />
                )}
                {/* Follow-up Suggestions */}
                {message.role === 'assistant' && message.followUpSuggestions && message.followUpSuggestions.length > 0 && (
                  <FollowUpSuggestions 
                    suggestions={message.followUpSuggestions}
                    onSuggestionClick={(suggestion) => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    disabled={loading || isReadOnly}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">{formatTimestamp(message.timestamp)}</span>
                {message.role === 'assistant' && (
                  <>
                    <WithTooltip tooltip={copiedId === message.id ? "Copied!" : "Copy to clipboard"}>
                      <button
                        onClick={() => copyMessage(message.content, message.id)}
                        className="text-gray-500 hover:text-[#F97316] transition-colors p-1 focus:ring-2 focus:ring-[#F97316] focus:outline-none rounded"
                        aria-label="Copy message"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </WithTooltip>
                    {/* Feedback buttons */}
                    <WithTooltip tooltip="This was helpful">
                      <button
                        onClick={() => submitFeedback(message.id, 1)}
                        disabled={feedbackGiven[message.id] !== undefined}
                        className={`p-1 transition-colors focus:ring-2 focus:ring-[#F97316] focus:outline-none rounded ${
                          feedbackGiven[message.id] === 1
                            ? 'text-green-500'
                            : 'text-gray-500 hover:text-green-500'
                        } disabled:cursor-not-allowed`}
                        aria-label="Helpful response"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                    </WithTooltip>
                    <WithTooltip tooltip="This wasn't helpful">
                      <button
                        onClick={() => submitFeedback(message.id, -1)}
                        disabled={feedbackGiven[message.id] !== undefined}
                        className={`p-1 transition-colors focus:ring-2 focus:ring-[#F97316] focus:outline-none rounded ${
                          feedbackGiven[message.id] === -1
                            ? 'text-red-500'
                            : 'text-gray-500 hover:text-red-500'
                        } disabled:cursor-not-allowed`}
                        aria-label="Not helpful response"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </WithTooltip>
                  </>
                )}
              </div>
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center" aria-hidden="true">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        );
        })}

        {/* Typing Indicator */}
        {loading && (
          <div className="flex gap-3 justify-start animate-in slide-in-from-bottom">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dark-card flex items-center justify-center p-1 shadow-sm">
              <div className="relative w-full h-full">
                <Image 
                  src="/foremanos-logo.png" 
                  alt="AI Assistant" 
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            <div className="bg-dark-card text-[#F8FAFC] shadow-md rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
                <span className="text-sm text-gray-300">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - Mobile Optimized */}
      <form onSubmit={sendMessage} className="p-2 sm:p-3 lg:p-4 bg-dark-surface border-t border-gray-700">
        {retryMessage && (
          <div className="mb-1.5 sm:mb-2 p-1.5 sm:p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
            <span className="text-xs sm:text-sm text-yellow-800">Message failed to send</span>
            <button
              type="button"
              onClick={retryLastMessage}
              className="text-xs sm:text-sm text-[#F97316] hover:underline flex items-center gap-1 focus:ring-2 focus:ring-[#F97316] focus:outline-none rounded px-1.5 sm:px-2 py-1"
              aria-label="Retry sending message"
            >
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
              Retry
            </button>
          </div>
        )}
        
        {/* Read-Only Indicator */}
        {isReadOnly && (
          <div className="mb-2 p-2.5 bg-yellow-900/20 border border-yellow-700 rounded-lg flex items-center gap-2">
            <Lock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-yellow-200">
              This conversation is read-only. {currentConversation?.conversationType === 'daily_report' && 'Historical daily report chats cannot be modified.'}
            </p>
          </div>
        )}

        {/* Image Preview */}
        {uploadedImage && !isReadOnly && (
          <div className="mb-1.5 sm:mb-2 p-1.5 sm:p-2 bg-dark-card border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-dark-surface rounded overflow-hidden flex-shrink-0">
                <Image 
                  src={uploadedImage} 
                  alt="Preview" 
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-[#F8FAFC] truncate">{uploadedImageName}</p>
                <p className="text-xs text-gray-400">Image ready to send</p>
              </div>
              <WithTooltip tooltip="Remove image">
                <button
                  type="button"
                  onClick={removeImage}
                  className="p-1 hover:bg-red-900/30 rounded transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                </button>
              </WithTooltip>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 sm:gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).form?.requestSubmit();
              }
            }}
            placeholder={isReadOnly ? "This conversation is read-only" : (uploadedImage ? "Add a message..." : "Ask about your project...")}
            className="flex-1 px-2 py-1.5 sm:px-3 sm:py-2 lg:px-4 lg:py-2 text-sm sm:text-base border border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-transparent bg-dark-card text-[#F8FAFC] placeholder-gray-400 transition-all touch-manipulation"
            style={{ resize: 'none', overflow: 'hidden' }}
            disabled={loading || isReadOnly}
            aria-label="Message input"
          />
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            aria-label="Upload image"
            disabled={isReadOnly}
          />
          
          {/* Image upload button */}
          <WithTooltip tooltip={isReadOnly ? "Cannot upload image to read-only conversation" : "Upload an image"}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isReadOnly}
              className="bg-dark-card hover:bg-[#3d434b] text-gray-300 p-1.5 sm:p-2 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-sm focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none touch-manipulation border border-gray-600"
              aria-label="Upload image"
            >
              <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </WithTooltip>
          
          {/* Quick Actions */}
          {hasFullAccess && projectSlug && !isReadOnly && (
            <QuickActions
              messageContent={messages.length > 0 ? messages[messages.length - 1]?.content : undefined}
              projectSlug={projectSlug}
              conversationId={activeConversationId || undefined}
              onActionComplete={(action, result) => {
                toast.success(`${action} completed`);
              }}
            />
          )}
          
          <WithTooltip tooltip={
              !isOnline 
                ? "You are offline" 
                : isReadOnly 
                ? "Read-only conversation" 
                : "Send message"
            }>
            <button
              type="submit"
              disabled={loading || (!input.trim() && !uploadedImage) || isReadOnly || !isOnline}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white px-2 py-1.5 sm:px-3 sm:py-2 lg:px-4 lg:py-2 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-md focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none touch-manipulation"
              aria-label="Send message"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </WithTooltip>
        </div>
      </form>
      </div>

      {/* Workflow Modal */}
      {hasFullAccess && projectSlug && (
        <WorkflowModal
          isOpen={showWorkflowModal}
          onClose={() => setShowWorkflowModal(false)}
          projectSlug={projectSlug}
          conversationId={activeConversationId}
          onComplete={(summary) => {
            // The summary is already formatted by the workflow modal
            setInput(summary);
            toast.success('Report captured! Review and send when ready.');
          }}
        />
      )}

      {/* Daily Report Template Modal */}
      {hasFullAccess && projectSlug && (
        <DailyReportTemplate
          isOpen={showDailyReportTemplate}
          onClose={() => setShowDailyReportTemplate(false)}
          onSubmit={handleDailyReportSubmit}
          projectSlug={projectSlug}
        />
      )}

      {/* Schedule Update Review Modal */}
      {projectSlug && (
        <ScheduleUpdateReviewModal
          isOpen={showScheduleReview}
          onClose={() => setShowScheduleReview(false)}
          analysis={scheduleAnalysis}
          projectSlug={projectSlug}
        />
      )}

      {/* Template Export Dialog */}
      {activeConversationId && (
        <TemplateExportDialog
          isOpen={showTemplateExportDialog}
          onClose={() => setShowTemplateExportDialog(false)}
          conversationId={activeConversationId}
          conversationType={currentConversation?.conversationType || 'daily_report'}
        />
      )}

      {/* Analyzing indicator */}
      {analyzingSchedule && (
        <div className="fixed bottom-24 right-6 bg-dark-card border border-blue-500 rounded-lg px-4 py-3 shadow-lg flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span className="text-sm text-gray-300">Analyzing schedule impacts...</span>
        </div>
      )}

      <ConfirmDialog
        open={showSubmitConfirm}
        onConfirm={doFinalizeReport}
        onCancel={() => setShowSubmitConfirm(false)}
        title="Submit Daily Report"
        description="Submit this daily report? Once submitted, the report cannot be edited. A PDF will be generated and saved to the project."
        confirmLabel="Submit"
        cancelLabel="Cancel"
      />

      <ConfirmDialog
        open={showNewConversationConfirm}
        onConfirm={() => { setShowNewConversationConfirm(false); handleNewConversation(); }}
        onCancel={() => setShowNewConversationConfirm(false)}
        title="New Conversation"
        description="Start a new conversation? Current conversation will be saved in history."
        confirmLabel="Start New"
        cancelLabel="Cancel"
      />
    </div>
  );
}