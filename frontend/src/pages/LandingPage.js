import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Mail,
  Calendar,
  Shield,
  Zap,
  Users,
  TrendingUp,
  Clock,
  Target,
  CheckCircle,
  ArrowRight,
  Star,
  BarChart3,
  Bot,
  Sparkles
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const LandingPage = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API}/api/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    }
  };

  const problems = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "Lost Customers",
      description: "Your existing customers forget about you. No regular touchpoints means lost repeat business."
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Manual Outreach is Time-Consuming",
      description: "Sending personalized messages to hundreds of contacts manually takes hours every day."
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Spam Gets You Blocked",
      description: "Bulk messaging looks spammy. Same message to everyone = low engagement + platform bans."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "No Consistent Follow-up",
      description: "You start strong but can't maintain regular communication. Leads go cold."
    }
  ];

  const solutions = [
    {
      icon: <Bot className="w-8 h-8 text-primary" />,
      title: "AI-Powered Personalization",
      description: "Each message is uniquely crafted for every contact. No two messages are the same.",
      highlight: "100% Unique Messages"
    },
    {
      icon: <Calendar className="w-8 h-8 text-primary" />,
      title: "Smart Scheduling",
      description: "Random 30-60 minute gaps between messages. Looks human, avoids platform bans.",
      highlight: "Anti-Ban Protection"
    },
    {
      icon: <Zap className="w-8 h-8 text-primary" />,
      title: "Set & Forget Automation",
      description: "Configure once, runs daily. 10 WhatsApp + 10 Emails automatically sent every day.",
      highlight: "Fully Automated"
    },
    {
      icon: <Shield className="w-8 h-8 text-primary" />,
      title: "Respectful Outreach",
      description: "Max 2 messages per contact per month. Build relationships, not annoyance.",
      highlight: "No Spam"
    }
  ];

  const features = [
    "AI-generated personalized messages",
    "WhatsApp Web integration",
    "Email automation (coming soon)",
    "Contact management & CSV import",
    "Blueprint templates",
    "Message approval workflow",
    "Smart scheduling with random gaps",
    "Business hours only (9 AM - 6 PM)",
    "Max 2 contacts/month limit",
    "Real-time delivery tracking",
    "Conversation inbox",
    "Multi-tenant SaaS ready"
  ];

  const useCases = [
    {
      title: "IT Services & MSPs",
      description: "Keep clients aware of your services. Proactive outreach about security, maintenance, and new solutions.",
      icon: "💻"
    },
    {
      title: "Retail & E-commerce",
      description: "Re-engage past customers. Announce new products, offers, and updates without spamming.",
      icon: "🛒"
    },
    {
      title: "Consultants & Agencies",
      description: "Stay top-of-mind with prospects. Gradual nurturing that converts cold leads to clients.",
      icon: "📊"
    },
    {
      title: "Real Estate",
      description: "Follow up with property seekers. Share new listings and market updates automatically.",
      icon: "🏠"
    },
    {
      title: "Healthcare & Clinics",
      description: "Patient engagement and appointment reminders. Build lasting patient relationships.",
      icon: "🏥"
    },
    {
      title: "Education & Training",
      description: "Course updates, enrollment reminders, and alumni engagement on autopilot.",
      icon: "📚"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">WarmReach</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#use-cases" className="text-muted-foreground hover:text-foreground transition-colors">Use Cases</a>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Login
              </Button>
              <Button onClick={() => navigate("/register")}>
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-2">
            <Sparkles className="w-4 h-4 mr-2" />
            AI-Powered Warm Outreach
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Stop Losing Customers to{" "}
            <span className="text-primary">Silence</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Automatically send personalized WhatsApp & Email messages to your contacts. 
            Build awareness, create recall, and stay top-of-mind — without spamming.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" onClick={() => navigate("/register")} className="text-lg px-8">
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("#features")} className="text-lg px-8">
              See How It Works
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              10 messages/day free
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Cancel anytime
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              The Problem with Customer Outreach
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Most businesses lose customers not because of bad service, but because they simply forget to stay in touch.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {problems.map((problem, index) => (
              <Card key={index} className="bg-background border-destructive/20">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
                    {problem.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{problem.title}</h3>
                  <p className="text-muted-foreground text-sm">{problem.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">The Solution</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Warm Outreach That Actually Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              WarmReach automates personalized messaging at scale — making every contact feel valued, not marketed to.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {solutions.map((solution, index) => (
              <Card key={index} className="bg-background hover:shadow-lg transition-shadow">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                      {solution.icon}
                    </div>
                    <div>
                      <Badge variant="secondary" className="mb-2">{solution.highlight}</Badge>
                      <h3 className="font-semibold text-xl mb-2">{solution.title}</h3>
                      <p className="text-muted-foreground">{solution.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-muted-foreground">
              Powerful features to automate your customer outreach
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-background rounded-lg">
                <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">B2B & B2C</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built for Every Business
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Whether you're a service provider or selling products, WarmReach helps you stay connected with customers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {useCases.map((useCase, index) => (
              <Card key={index} className="bg-background hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="text-4xl mb-4">{useCase.icon}</div>
                  <h3 className="font-semibold text-lg mb-2">{useCase.title}</h3>
                  <p className="text-muted-foreground text-sm">{useCase.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground">
              Start free. Scale as you grow.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="bg-background">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="font-semibold text-xl mb-2">Starter</h3>
                  <div className="text-4xl font-bold mb-2">Free</div>
                  <p className="text-muted-foreground text-sm">Perfect for trying out</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>10 messages/day</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>50 contacts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>WhatsApp only</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Basic templates</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full" onClick={() => navigate("/register")}>
                  Get Started
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-background border-primary shadow-lg relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary">Most Popular</Badge>
              </div>
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="font-semibold text-xl mb-2">Professional</h3>
                  <div className="text-4xl font-bold mb-2">₹2,999<span className="text-lg font-normal">/mo</span></div>
                  <p className="text-muted-foreground text-sm">For growing businesses</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>50 messages/day</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>500 contacts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>WhatsApp + Email</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>AI personalization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Custom blueprints</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Priority support</span>
                  </li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/register")}>
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="bg-background">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="font-semibold text-xl mb-2">Enterprise</h3>
                  <div className="text-4xl font-bold mb-2">Custom</div>
                  <p className="text-muted-foreground text-sm">For large organizations</p>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Unlimited messages</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Unlimited contacts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>All channels</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>API access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Dedicated support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Custom integrations</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Build Lasting Customer Relationships?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join hundreds of businesses using WarmReach to stay connected with their customers.
          </p>
          <Button size="lg" onClick={() => navigate("/register")} className="text-lg px-8">
            Start Your Free Trial
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">WarmReach</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2026 WarmReach. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
