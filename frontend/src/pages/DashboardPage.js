import { useState, useEffect } from "react";
import { useAuth, API } from "@/App";
import {
  Users,
  MessageSquare,
  Mail,
  MessageCircle,
  Linkedin,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Send
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const DashboardPage = () => {
  const { authFetch } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await authFetch(`${API}/analytics/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      toast.error("Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-2" />
          <div className="h-4 bg-muted rounded w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const rateLimits = metrics?.rate_limits_remaining || { email: 10, whatsapp: 10, linkedin: 3 };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="heading-2 mb-2" data-testid="dashboard-heading">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your outreach performance and rate limits
        </p>
      </div>

      {/* Rate Limits - Top Priority */}
      <div className="grid gap-4 md:grid-cols-3" data-testid="rate-limits-section">
        <RateLimitCard
          channel="Email"
          icon={Mail}
          remaining={rateLimits.email}
          total={10}
          color="primary"
        />
        <RateLimitCard
          channel="WhatsApp"
          icon={MessageCircle}
          remaining={rateLimits.whatsapp}
          total={10}
          color="green"
        />
        <RateLimitCard
          channel="LinkedIn"
          icon={Linkedin}
          remaining={rateLimits.linkedin}
          total={3}
          color="blue"
          period="weekly"
        />
      </div>

      {/* Main Metrics - Bento Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4" data-testid="metrics-grid">
        <MetricCard
          title="Total Contacts"
          value={metrics?.total_contacts || 0}
          icon={Users}
          trend="neutral"
        />
        <MetricCard
          title="Messages Sent"
          value={metrics?.total_messages_sent || 0}
          icon={Send}
          trend="up"
          trendValue="12%"
        />
        <MetricCard
          title="Total Replies"
          value={metrics?.total_replies || 0}
          icon={MessageSquare}
          trend="up"
          trendValue="8%"
        />
        <MetricCard
          title="Meetings Booked"
          value={metrics?.meetings_booked || 0}
          icon={CheckCircle}
          trend="up"
          trendValue="15%"
          highlight
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-surface" data-testid="sentiment-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Sentiment Analysis</CardTitle>
            <CardDescription>Response quality breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary" />
                <span>Positive Sentiment</span>
              </div>
              <span className="font-semibold text-secondary">
                {metrics?.positive_sentiment_rate || 0}%
              </span>
            </div>
            <Progress 
              value={metrics?.positive_sentiment_rate || 0} 
              className="h-2"
            />

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span>Blacklist Rate</span>
              </div>
              <span className="font-semibold text-destructive">
                {metrics?.blacklist_rate || 0}%
              </span>
            </div>
            <Progress 
              value={metrics?.blacklist_rate || 0} 
              className="h-2 [&>div]:bg-destructive"
            />

            {(metrics?.blacklist_rate || 0) > 5 && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg mt-4">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">
                  High blacklist rate - review your messaging strategy
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-surface" data-testid="activity-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <CardDescription>Latest messages and replies</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.recent_activity?.length > 0 ? (
              <div className="space-y-3">
                {metrics.recent_activity.slice(0, 5).map((activity, i) => (
                  <ActivityItem key={i} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
                <p className="text-sm">Start sending messages to see activity here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, trend, trendValue, highlight }) => {
  return (
    <Card className={cn("metric-card", highlight && "border-secondary/50 bg-secondary/5")}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            highlight ? "bg-secondary/20 text-secondary" : "bg-primary/10 text-primary"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && trend !== "neutral" && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend === "up" ? "text-secondary" : "text-destructive"
            )}>
              {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const RateLimitCard = ({ channel, icon: Icon, remaining, total, color, period = "daily" }) => {
  const percentage = (remaining / total) * 100;
  const isLow = percentage <= 20;
  const isMedium = percentage <= 50 && percentage > 20;

  const colorClasses = {
    primary: {
      bg: "bg-primary/10",
      text: "text-primary",
      progress: ""
    },
    green: {
      bg: "bg-green-500/10",
      text: "text-green-600 dark:text-green-400",
      progress: "[&>div]:bg-green-500"
    },
    blue: {
      bg: "bg-blue-600/10",
      text: "text-blue-600 dark:text-blue-400",
      progress: "[&>div]:bg-blue-600"
    }
  };

  const colors = colorClasses[color];

  return (
    <Card className="card-surface" data-testid={`rate-limit-${channel.toLowerCase()}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", colors.bg)}>
            <Icon className={cn("w-4 h-4", colors.text)} />
          </div>
          <div>
            <p className="font-medium">{channel}</p>
            <p className="text-xs text-muted-foreground capitalize">{period} limit</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={cn(
              "text-2xl font-bold",
              isLow && "text-destructive",
              isMedium && "text-yellow-600 dark:text-yellow-400"
            )}>
              {remaining}
            </span>
            <span className="text-sm text-muted-foreground">/ {total} remaining</span>
          </div>
          <Progress 
            value={percentage} 
            className={cn("h-2", colors.progress)}
          />
        </div>

        {isLow && (
          <Badge variant="destructive" className="mt-3 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Low capacity
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

const ActivityItem = ({ activity }) => {
  const isMessage = activity.type === "message";
  const channel = activity.channel;

  const getChannelBadge = () => {
    const classes = {
      email: "channel-email",
      whatsapp: "channel-whatsapp",
      linkedin: "channel-linkedin"
    };
    return classes[channel] || "channel-email";
  };

  const getStatusBadge = () => {
    if (isMessage) {
      const status = activity.status;
      if (status === "sent" || status === "delivered") return "status-safe";
      if (status === "pending_approval") return "status-warning";
      if (status === "failed") return "status-danger";
      return "status-neutral";
    } else {
      const sentiment = activity.sentiment;
      if (sentiment === "positive") return "status-safe";
      if (sentiment === "negative") return "status-danger";
      return "status-neutral";
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className={cn("channel-badge", getChannelBadge())}>
        {channel === "email" && <Mail className="w-3 h-3" />}
        {channel === "whatsapp" && <MessageCircle className="w-3 h-3" />}
        {channel === "linkedin" && <Linkedin className="w-3 h-3" />}
        {channel}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium capitalize">
          {isMessage ? `Message ${activity.status}` : `Reply received`}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {new Date(activity.created_at).toLocaleString()}
        </p>
      </div>
      <Badge className={cn("text-xs", getStatusBadge())}>
        {isMessage ? activity.status : activity.sentiment || "pending"}
      </Badge>
    </div>
  );
};
