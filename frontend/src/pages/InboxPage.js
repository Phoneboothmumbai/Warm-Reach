import { useState, useEffect } from "react";
import { useAuth, API } from "@/App";
import {
  Inbox as InboxIcon,
  Mail,
  MessageCircle,
  Linkedin,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Check,
  AlertTriangle,
  RefreshCw,
  Filter,
  Eye,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sentimentConfig = {
  positive: {
    icon: ThumbsUp,
    label: "Positive",
    color: "bg-secondary/15 text-secondary border-secondary/20",
    description: "Contact is interested"
  },
  neutral: {
    icon: Minus,
    label: "Neutral",
    color: "bg-muted text-muted-foreground border-border",
    description: "Unclear intent"
  },
  negative: {
    icon: ThumbsDown,
    label: "Negative",
    color: "bg-destructive/15 text-destructive border-destructive/20",
    description: "Will be blacklisted"
  }
};

const channelIcons = {
  email: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin
};

export const InboxPage = () => {
  const { authFetch } = useAuth();
  const [replies, setReplies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [selectedReply, setSelectedReply] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [sentimentFilter, readFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = `${API}/inbox?limit=100`;
      if (sentimentFilter !== "all") {
        url += `&sentiment=${sentimentFilter}`;
      }
      if (readFilter !== "all") {
        url += `&is_read=${readFilter === "read"}`;
      }

      const [repliesRes, contactsRes] = await Promise.all([
        authFetch(url),
        authFetch(`${API}/contacts?limit=200`)
      ]);

      if (repliesRes.ok) setReplies(await repliesRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
    } catch (error) {
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  };

  const handleSetSentiment = async (replyId, sentiment) => {
    try {
      const response = await authFetch(`${API}/inbox/${replyId}/sentiment?sentiment=${sentiment}`, {
        method: "POST"
      });

      if (response.ok) {
        toast.success(
          sentiment === "negative" 
            ? "Reply marked negative - contact blacklisted" 
            : `Reply marked as ${sentiment}`
        );
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to update sentiment");
      }
    } catch (error) {
      toast.error("Failed to update sentiment");
    }
  };

  const handleMarkRead = async (replyId) => {
    try {
      const response = await authFetch(`${API}/inbox/${replyId}/read`, {
        method: "POST"
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to mark as read");
    }
  };

  const getContactInfo = (contactId) => {
    return contacts.find(c => c.id === contactId);
  };

  const openDetail = (reply) => {
    setSelectedReply(reply);
    setDetailDialogOpen(true);
    if (!reply.is_read) {
      handleMarkRead(reply.id);
    }
  };

  const unreadCount = replies.filter(r => !r.is_read).length;
  const pendingSentimentCount = replies.filter(r => !r.sentiment).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="heading-2" data-testid="inbox-heading">Inbox</h1>
          <p className="text-muted-foreground">
            Review replies and manage sentiment classification
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} data-testid="refresh-inbox-btn">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {(unreadCount > 0 || pendingSentimentCount > 0) && (
        <div className="flex gap-4">
          {unreadCount > 0 && (
            <Badge className="px-3 py-1.5 bg-primary/15 text-primary border-primary/20">
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {unreadCount} unread
            </Badge>
          )}
          {pendingSentimentCount > 0 && (
            <Badge className="px-3 py-1.5 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              {pendingSentimentCount} need classification
            </Badge>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="w-48" data-testid="sentiment-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiments</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
          </SelectContent>
        </Select>

        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-40" data-testid="read-filter">
            <SelectValue placeholder="Read Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Replies List */}
      <Card className="card-surface">
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading inbox...
            </div>
          ) : replies.length === 0 ? (
            <div className="p-8 text-center">
              <InboxIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No replies yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Replies to your outreach will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {replies.map((reply) => {
                const contact = getContactInfo(reply.contact_id);
                const ChannelIcon = channelIcons[reply.channel] || Mail;
                const sentimentCfg = reply.sentiment ? sentimentConfig[reply.sentiment] : null;
                const SentimentIcon = sentimentCfg?.icon;

                return (
                  <div
                    key={reply.id}
                    className={cn(
                      "p-4 hover:bg-muted/30 transition-colors cursor-pointer",
                      !reply.is_read && "bg-primary/5"
                    )}
                    onClick={() => openDetail(reply)}
                    data-testid={`reply-row-${reply.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        reply.channel === "email" && "bg-primary/10 text-primary",
                        reply.channel === "whatsapp" && "bg-green-500/10 text-green-600 dark:text-green-400",
                        reply.channel === "linkedin" && "bg-blue-600/10 text-blue-600 dark:text-blue-400"
                      )}>
                        <ChannelIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={cn("font-medium", !reply.is_read && "text-primary")}>
                            {contact ? `${contact.first_name} ${contact.last_name}` : "Unknown Contact"}
                          </span>
                          {!reply.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="text-sm text-muted-foreground capitalize ml-auto">
                            {reply.channel}
                          </span>
                        </div>

                        {contact && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {contact.email} {contact.company_name && `• ${contact.company_name}`}
                          </p>
                        )}

                        <div className="p-3 bg-muted/30 rounded-lg mb-3">
                          <p className="text-sm line-clamp-3">{reply.content}</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(reply.created_at).toLocaleString()}
                          </span>

                          {sentimentCfg ? (
                            <Badge className={cn("text-xs border", sentimentCfg.color)}>
                              <SentimentIcon className="w-3 h-3 mr-1" />
                              {sentimentCfg.label}
                            </Badge>
                          ) : (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-secondary hover:bg-secondary/10"
                                onClick={() => handleSetSentiment(reply.id, "positive")}
                                data-testid={`sentiment-positive-${reply.id}`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 hover:bg-muted"
                                onClick={() => handleSetSentiment(reply.id, "neutral")}
                                data-testid={`sentiment-neutral-${reply.id}`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:bg-destructive/10"
                                onClick={() => handleSetSentiment(reply.id, "negative")}
                                data-testid={`sentiment-negative-${reply.id}`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Reply Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply Details</DialogTitle>
            <DialogDescription>
              Review the reply and classify sentiment
            </DialogDescription>
          </DialogHeader>

          {selectedReply && (
            <div className="space-y-4 py-4">
              {/* Contact Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  {(() => {
                    const contact = getContactInfo(selectedReply.contact_id);
                    return contact ? (
                      <>
                        <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                        <p className="text-sm text-muted-foreground">{contact.email}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Unknown Contact</p>
                    );
                  })()}
                </div>
              </div>

              {/* Reply Content */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Reply Content</p>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedReply.content}</p>
                </div>
              </div>

              {/* Channel & Time */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2 capitalize">
                  {selectedReply.channel === "email" && <Mail className="w-4 h-4" />}
                  {selectedReply.channel === "whatsapp" && <MessageCircle className="w-4 h-4" />}
                  {selectedReply.channel === "linkedin" && <Linkedin className="w-4 h-4" />}
                  {selectedReply.channel}
                </div>
                <span>{new Date(selectedReply.created_at).toLocaleString()}</span>
              </div>

              {/* Sentiment Actions */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Classify Sentiment</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(sentimentConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    const isSelected = selectedReply.sentiment === key;
                    
                    return (
                      <Button
                        key={key}
                        variant={isSelected ? "default" : "outline"}
                        className={cn(
                          "flex-col h-auto py-3",
                          isSelected && key === "positive" && "bg-secondary hover:bg-secondary/90",
                          isSelected && key === "negative" && "bg-destructive hover:bg-destructive/90"
                        )}
                        onClick={() => handleSetSentiment(selectedReply.id, key)}
                        data-testid={`detail-sentiment-${key}`}
                      >
                        <Icon className="w-5 h-5 mb-1" />
                        <span className="text-xs">{config.label}</span>
                      </Button>
                    );
                  })}
                </div>
                {selectedReply.sentiment === "negative" && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    This contact has been blacklisted
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
