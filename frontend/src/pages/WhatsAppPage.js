import { useState, useEffect, useRef } from "react";
import { useAuth, API } from "@/App";
import {
  MessageCircle,
  Send,
  Phone,
  User,
  Clock,
  CheckCheck,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cloud,
  Smartphone,
  AlertTriangle,
  Settings,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Message status icon component
const MessageStatusIcon = ({ status }) => {
  switch (status) {
    case "sent":
      return <Check className="w-3 h-3 text-muted-foreground" />;
    case "delivered":
      return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    case "failed":
      return <AlertCircle className="w-3 h-3 text-destructive" />;
    default:
      return <Clock className="w-3 h-3 text-muted-foreground" />;
  }
};

// Format phone number for display
const formatPhone = (phone) => {
  if (!phone) return "";
  // Add + if not present and format
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  return `+${cleaned}`;
};

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const WhatsAppPage = () => {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState("cloud");
  const [loading, setLoading] = useState(true);
  
  // Cloud API state
  const [cloudInbox, setCloudInbox] = useState({ contacts: [], connected_number: "" });
  const [cloudConfig, setCloudConfig] = useState(null);
  
  // Web state (Phase 2)
  const [webInbox, setWebInbox] = useState({ contacts: [], connected_number: "", session_status: "disconnected" });
  const [webEnabled, setWebEnabled] = useState(false);
  const [webStatus, setWebStatus] = useState({ status: "disconnected", qr_code: null });
  
  // Chat state
  const [selectedContact, setSelectedContact] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  
  // New contact dialog
  const [newContactPhone, setNewContactPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, cloudRes, webStatusRes, webInboxRes] = await Promise.all([
        authFetch(`${API}/settings/whatsapp`),
        authFetch(`${API}/wa/cloud/inbox`),
        authFetch(`${API}/wa/web/status`),
        authFetch(`${API}/wa/web/inbox`)
      ]);

      if (configRes.ok) {
        const config = await configRes.json();
        setCloudConfig(config);
      }

      if (cloudRes.ok) {
        const data = await cloudRes.json();
        setCloudInbox(data);
      }

      if (webStatusRes.ok) {
        const webStatus = await webStatusRes.json();
        setWebEnabled(webStatus.enabled || false);
      }

      if (webInboxRes.ok) {
        const webData = await webInboxRes.json();
        setWebInbox(webData);
      }
    } catch (error) {
      toast.error("Failed to load WhatsApp data");
    } finally {
      setLoading(false);
    }
  };

  const loadChat = async (contact, integrationType) => {
    setSelectedContact({ ...contact, integration_type: integrationType });
    setLoadingChat(true);
    setChatMessages([]);

    try {
      const endpoint = integrationType === "cloud_api" 
        ? `${API}/wa/cloud/chat/${contact.id}`
        : `${API}/wa/web/chat/${contact.id}`;
      
      const response = await authFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setChatMessages(data.messages || []);
        
        // Refresh inbox to update unread counts
        if (integrationType === "cloud_api") {
          const inboxRes = await authFetch(`${API}/wa/cloud/inbox`);
          if (inboxRes.ok) setCloudInbox(await inboxRes.json());
        }
      }
    } catch (error) {
      toast.error("Failed to load chat");
    } finally {
      setLoadingChat(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedContact) return;

    setSending(true);
    try {
      const endpoint = selectedContact.integration_type === "cloud_api"
        ? `${API}/wa/cloud/send`
        : `${API}/wa/web/send`;

      const response = await authFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          to_phone: selectedContact.phone_number,
          message: newMessage.trim()
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success("Message sent!");
        setNewMessage("");
        
        // Reload chat to show new message
        await loadChat(selectedContact, selectedContact.integration_type);
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const startNewChat = async (integrationType) => {
    if (!newContactPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    // Clean phone number
    const phone = newContactPhone.replace(/\D/g, '');
    
    if (phone.length < 10) {
      toast.error("Invalid phone number");
      return;
    }

    // Create a temporary contact object
    const tempContact = {
      id: null,
      phone_number: phone,
      name: null,
      connected_number: integrationType === "cloud_api" ? cloudInbox.connected_number : webInbox.connected_number
    };

    setSelectedContact({ ...tempContact, integration_type: integrationType });
    setChatMessages([]);
    setNewContactPhone("");
  };

  const filteredCloudContacts = cloudInbox.contacts.filter(c => 
    !searchQuery || 
    c.phone_number?.includes(searchQuery) || 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp</h1>
          <p className="text-muted-foreground">
            Send and receive WhatsApp messages
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="cloud" data-testid="wa-cloud-tab">
            <Cloud className="w-4 h-4 mr-2" />
            Cloud API
            {cloudConfig?.is_configured && (
              <Badge variant="secondary" className="ml-2 text-xs">Connected</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="web" data-testid="wa-web-tab">
            <Smartphone className="w-4 h-4 mr-2" />
            Web Login
            {webEnabled && webInbox.session_status === "connected" && (
              <Badge variant="secondary" className="ml-2 text-xs bg-green-500/20 text-green-600">Connected</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Cloud API Tab */}
        <TabsContent value="cloud" className="space-y-4">
          {!cloudConfig?.is_configured ? (
            <Card className="card-surface">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  WhatsApp Cloud API Not Configured
                </CardTitle>
                <CardDescription>
                  Connect your WhatsApp Business account to start sending messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => window.location.href = '/settings'}>
                  <Settings className="w-4 h-4 mr-2" />
                  Go to Settings
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[70vh]">
              {/* Contacts List */}
              <Card className="card-surface lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Conversations
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      {cloudInbox.connected_number || "Not set"}
                    </Badge>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[55vh]">
                    {/* New Chat Section */}
                    <div className="p-3 border-b">
                      <div className="flex gap-2">
                        <Input
                          placeholder="New chat: +1234567890"
                          value={newContactPhone}
                          onChange={(e) => setNewContactPhone(e.target.value)}
                          className="text-sm font-mono"
                          data-testid="new-chat-phone-input"
                        />
                        <Button
                          size="sm"
                          onClick={() => startNewChat("cloud_api")}
                          disabled={!newContactPhone.trim()}
                          data-testid="start-new-chat-btn"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Contact List */}
                    {filteredCloudContacts.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Start a new chat above</p>
                      </div>
                    ) : (
                      filteredCloudContacts.map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => loadChat(contact, "cloud_api")}
                          className={cn(
                            "p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                            selectedContact?.id === contact.id && "bg-muted"
                          )}
                          data-testid={`contact-${contact.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                              <User className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium truncate">
                                  {contact.name || formatPhone(contact.phone_number)}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(contact.last_message_at)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground truncate">
                                  {contact.last_message_preview || "No messages"}
                                </p>
                                {contact.unread_count > 0 && (
                                  <Badge className="bg-green-500 text-white text-xs">
                                    {contact.unread_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Chat Area */}
              <Card className="card-surface lg:col-span-2">
                {!selectedContact ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a conversation</p>
                    <p className="text-sm">Choose from your contacts or start a new chat</p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Chat Header */}
                    <div className="p-4 border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {selectedContact.name || formatPhone(selectedContact.phone_number)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {selectedContact.phone_number}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <Cloud className="w-3 h-3 mr-1" />
                        Cloud API
                      </Badge>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4">
                      {loadingChat ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <p className="text-sm">No messages yet</p>
                          <p className="text-xs">Send a message to start the conversation</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={cn(
                                "flex",
                                msg.direction === "outbound" ? "justify-end" : "justify-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[70%] rounded-lg px-3 py-2",
                                  msg.direction === "outbound"
                                    ? "bg-green-600 text-white"
                                    : "bg-muted"
                                )}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <div className={cn(
                                  "flex items-center justify-end gap-1 mt-1",
                                  msg.direction === "outbound" ? "text-green-100" : "text-muted-foreground"
                                )}>
                                  <span className="text-[10px]">
                                    {formatTime(msg.created_at)}
                                  </span>
                                  {msg.direction === "outbound" && (
                                    <MessageStatusIcon status={msg.status} />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>

                    {/* Message Input */}
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          className="min-h-[44px] max-h-[120px] resize-none"
                          rows={1}
                          data-testid="message-input"
                        />
                        <Button
                          onClick={sendMessage}
                          disabled={sending || !newMessage.trim()}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid="send-message-btn"
                        >
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Press Enter to send, Shift+Enter for new line
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Web Login Tab (Phase 2) */}
        <TabsContent value="web" className="space-y-4">
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>⚠️ Risk Warning - WhatsApp Web Automation</AlertTitle>
            <AlertDescription>
              WhatsApp Web automation is <strong>against WhatsApp's Terms of Service</strong> and may result in 
              your phone number being banned. Use at your own risk. This integration uses your personal WhatsApp 
              account via QR scan, not the official Business API.
            </AlertDescription>
          </Alert>

          {!webEnabled ? (
            <Card className="card-surface">
              <CardHeader>
                <CardTitle>WhatsApp Web Integration</CardTitle>
                <CardDescription>
                  Connect your personal WhatsApp account via QR scan. This is separate from the Business Cloud API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-destructive/10 border-destructive/30">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertTitle>Important: Account Ban Risk</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>By enabling this feature, you acknowledge that:</p>
                    <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                      <li>WhatsApp may ban your phone number without warning</li>
                      <li>This integration is unofficial and not supported by WhatsApp</li>
                      <li>Rate limits are stricter (20 messages/hour) to minimize detection</li>
                      <li>Sessions may disconnect unexpectedly and require re-scanning QR</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="risk-accept"
                    className="w-4 h-4"
                    data-testid="wa-web-risk-checkbox"
                  />
                  <label htmlFor="risk-accept" className="text-sm">
                    I understand and accept the risk of account ban
                  </label>
                </div>

                <Button 
                  onClick={async () => {
                    const checkbox = document.getElementById('risk-accept');
                    if (!checkbox?.checked) {
                      toast.error("Please accept the risk acknowledgment first");
                      return;
                    }
                    try {
                      const res = await authFetch(`${API}/wa/web/enable`, { method: "POST" });
                      if (res.ok) {
                        setWebEnabled(true);
                        toast.success("WhatsApp Web integration enabled");
                      } else {
                        const err = await res.json();
                        toast.error(err.detail || "Failed to enable");
                      }
                    } catch (e) {
                      toast.error("Failed to enable WhatsApp Web");
                    }
                  }}
                  variant="destructive"
                  data-testid="enable-wa-web-btn"
                >
                  Enable WhatsApp Web Integration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[70vh]">
              {/* Web Contacts List - Similar to Cloud API but for Web */}
              <Card className="card-surface lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Web Conversations
                    </CardTitle>
                    <Badge variant="outline" className={cn(
                      "font-mono text-xs",
                      webInbox.session_status === "connected" ? "border-green-500 text-green-600" : "border-yellow-500 text-yellow-600"
                    )}>
                      {webInbox.session_status === "connected" ? webInbox.connected_number : webInbox.session_status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {webInbox.session_status !== "connected" ? (
                    <div className="text-center py-8">
                      <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="text-sm text-muted-foreground mb-4">
                        {webInbox.session_status === "qr_pending" 
                          ? "Scan QR code to connect" 
                          : "Not connected"}
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            const res = await authFetch(`${API}/wa/web/start`, {
                              method: "POST",
                              body: JSON.stringify({ risk_accepted: true })
                            });
                            if (res.ok) {
                              toast.success("Starting QR login...");
                              fetchData();
                            } else {
                              const err = await res.json();
                              toast.error(err.detail || "Failed to start");
                            }
                          } catch (e) {
                            toast.error("Failed to start session");
                          }
                        }}
                        data-testid="start-wa-web-btn"
                      >
                        <Smartphone className="w-4 h-4 mr-2" />
                        Start QR Login
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[55vh]">
                      <p className="text-sm text-muted-foreground p-4 text-center">
                        WhatsApp Web inbox functionality coming soon
                      </p>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Chat Area Placeholder */}
              <Card className="card-surface lg:col-span-2">
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Smartphone className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">WhatsApp Web Chat</p>
                  <p className="text-sm">Connect via QR code to start messaging</p>
                  {webInbox.session_status === "connected" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-4"
                      onClick={async () => {
                        try {
                          await authFetch(`${API}/wa/web/disconnect`, { method: "POST" });
                          toast.success("Disconnected");
                          fetchData();
                        } catch (e) {
                          toast.error("Failed to disconnect");
                        }
                      }}
                      data-testid="disconnect-wa-web-btn"
                    >
                      Disconnect Session
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppPage;
