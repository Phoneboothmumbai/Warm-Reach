import { useState, useEffect } from "react";
import { useAuth, API } from "@/App";
import {
  MessageSquare,
  Mail,
  MessageCircle,
  Linkedin,
  Send,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Edit,
  RefreshCw,
  Calendar,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground border-border" },
  pending_approval: { label: "Pending Approval", color: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  approved: { label: "Approved", color: "bg-primary/15 text-primary border-primary/20" },
  scheduled: { label: "Scheduled", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  sent: { label: "Sent", color: "bg-secondary/15 text-secondary border-secondary/20" },
  delivered: { label: "Delivered", color: "bg-secondary/15 text-secondary border-secondary/20" },
  failed: { label: "Failed", color: "bg-destructive/15 text-destructive border-destructive/20" },
  bounced: { label: "Bounced", color: "bg-destructive/15 text-destructive border-destructive/20" }
};

const channelIcons = {
  email: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin
};

export const MessagesPage = () => {
  const { authFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  
  const [generateForm, setGenerateForm] = useState({
    contact_id: "",
    blueprint_id: ""
  });

  const [editedContent, setEditedContent] = useState("");

  useEffect(() => {
    fetchData();
  }, [statusFilter, channelFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${API}/messages?limit=100`;
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      if (channelFilter !== "all") {
        url += `&channel=${channelFilter}`;
      }

      const [messagesRes, contactsRes, blueprintsRes] = await Promise.all([
        authFetch(url),
        authFetch(`${API}/contacts?limit=100`),
        authFetch(`${API}/blueprints`)
      ]);

      if (messagesRes.ok) setMessages(await messagesRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (blueprintsRes.ok) setBlueprints(await blueprintsRes.json());
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMessage = async () => {
    if (!generateForm.contact_id || !generateForm.blueprint_id) {
      toast.error("Please select a contact and blueprint");
      return;
    }

    setGenerating(true);
    try {
      const response = await authFetch(`${API}/messages/generate`, {
        method: "POST",
        body: JSON.stringify(generateForm)
      });

      if (response.ok) {
        const result = await response.json();
        setGeneratedResult(result);
        toast.success("Message generated successfully");
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to generate message");
      }
    } catch (error) {
      toast.error("Failed to generate message");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveMessages = async (messageIds) => {
    try {
      const response = await authFetch(`${API}/messages/approve`, {
        method: "POST",
        body: JSON.stringify({ message_ids: messageIds })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.approved_count} message(s) approved`);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to approve messages");
      }
    } catch (error) {
      toast.error("Failed to approve messages");
    }
  };

  const handleUpdateContent = async () => {
    if (!selectedMessage) return;

    try {
      const response = await authFetch(
        `${API}/messages/${selectedMessage.id}/content?content=${encodeURIComponent(editedContent)}`,
        { method: "PUT" }
      );

      if (response.ok) {
        toast.success("Message content updated");
        setEditDialogOpen(false);
        setSelectedMessage(null);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to update message");
      }
    } catch (error) {
      toast.error("Failed to update message");
    }
  };

  const openEditDialog = (message) => {
    setSelectedMessage(message);
    setEditedContent(message.content);
    setEditDialogOpen(true);
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact ? `${contact.first_name} ${contact.last_name}` : "Unknown";
  };

  const getBlueprintName = (blueprintId) => {
    const blueprint = blueprints.find(b => b.id === blueprintId);
    return blueprint?.name || "Unknown";
  };

  const pendingMessages = messages.filter(m => m.status === "pending_approval");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="heading-2" data-testid="messages-heading">Messages</h1>
          <p className="text-muted-foreground">
            Generate, review, and approve outreach messages
          </p>
        </div>
        <Button onClick={() => setGenerateDialogOpen(true)} data-testid="generate-message-btn">
          <MessageSquare className="w-4 h-4 mr-2" />
          Generate Message
        </Button>
      </div>

      {/* Pending Approval Banner */}
      {pendingMessages.length > 0 && (
        <Card className="card-surface border-yellow-500/30 bg-yellow-500/5" data-testid="pending-approval-banner">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-semibold">{pendingMessages.length} message(s) pending approval</p>
                  <p className="text-sm text-muted-foreground">Review and approve to schedule sending</p>
                </div>
              </div>
              <Button
                onClick={() => handleApproveMessages(pendingMessages.map(m => m.id))}
                data-testid="approve-all-btn"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="message-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-40" data-testid="message-channel-filter">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={fetchData} data-testid="refresh-messages-btn">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages List */}
      <Card className="card-surface">
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No messages yet</p>
              <Button 
                variant="link" 
                onClick={() => setGenerateDialogOpen(true)}
                className="mt-2"
              >
                Generate your first message
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((message) => {
                const ChannelIcon = channelIcons[message.channel] || Mail;
                const statusCfg = statusConfig[message.status] || statusConfig.draft;
                const canEdit = ["draft", "pending_approval"].includes(message.status);

                return (
                  <div
                    key={message.id}
                    className="p-4 hover:bg-muted/30 transition-colors"
                    data-testid={`message-row-${message.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        message.channel === "email" && "bg-primary/10 text-primary",
                        message.channel === "whatsapp" && "bg-green-500/10 text-green-600 dark:text-green-400",
                        message.channel === "linkedin" && "bg-blue-600/10 text-blue-600 dark:text-blue-400"
                      )}>
                        <ChannelIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium">{getContactName(message.contact_id)}</span>
                          <span className="text-muted-foreground">via</span>
                          <span className="text-sm text-muted-foreground capitalize">{message.channel}</span>
                          <Badge className={cn("text-xs border ml-auto", statusCfg.color)}>
                            {statusCfg.label}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          Blueprint: {getBlueprintName(message.blueprint_id)}
                        </p>

                        <div className="p-3 bg-muted/30 rounded-lg">
                          <pre className="text-sm whitespace-pre-wrap font-mono line-clamp-4">
                            {message.content}
                          </pre>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Created: {new Date(message.created_at).toLocaleString()}</span>
                          {message.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Scheduled: {new Date(message.scheduled_at).toLocaleString()}
                            </span>
                          )}
                          {message.sent_at && (
                            <span className="flex items-center gap-1 text-secondary">
                              <Send className="w-3.5 h-3.5" />
                              Sent: {new Date(message.sent_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(message)}
                            data-testid={`edit-message-${message.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {message.status === "pending_approval" && (
                          <Button
                            size="sm"
                            onClick={() => handleApproveMessages([message.id])}
                            data-testid={`approve-message-${message.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Generate Message Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate New Message</DialogTitle>
            <DialogDescription>
              Select a contact and blueprint to generate a personalized message
            </DialogDescription>
          </DialogHeader>

          {!generatedResult ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Contact *</Label>
                  <Select
                    value={generateForm.contact_id}
                    onValueChange={(value) => setGenerateForm({ ...generateForm, contact_id: value })}
                  >
                    <SelectTrigger data-testid="generate-contact-select">
                      <SelectValue placeholder="Choose a contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts
                        .filter(c => c.status !== "blacklisted")
                        .map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.first_name} {contact.last_name} - {contact.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Blueprint *</Label>
                  <Select
                    value={generateForm.blueprint_id}
                    onValueChange={(value) => setGenerateForm({ ...generateForm, blueprint_id: value })}
                  >
                    <SelectTrigger data-testid="generate-blueprint-select">
                      <SelectValue placeholder="Choose a blueprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {blueprints.map((blueprint) => (
                        <SelectItem key={blueprint.id} value={blueprint.id}>
                          {blueprint.name} ({blueprint.channel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={handleGenerateMessage}
                  disabled={generating}
                  data-testid="generate-submit-btn"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Generate Message
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-secondary/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-secondary" />
                    <span className="font-semibold">Message Generated!</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    To: {generatedResult.contact?.first_name} {generatedResult.contact?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Blueprint: {generatedResult.blueprint?.name}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Generated Content</Label>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {generatedResult.message?.content}
                    </pre>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4" />
                  Rate limit remaining: {generatedResult.rate_limit_remaining} messages
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setGeneratedResult(null);
                    setGenerateForm({ contact_id: "", blueprint_id: "" });
                  }}
                >
                  Generate Another
                </Button>
                <Button
                  onClick={() => {
                    setGenerateDialogOpen(false);
                    setGeneratedResult(null);
                    setGenerateForm({ contact_id: "", blueprint_id: "" });
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setSelectedMessage(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Message Content</DialogTitle>
            <DialogDescription>
              Modify the message content before approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Message Content</Label>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                data-testid="edit-message-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateContent} data-testid="save-message-btn">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
