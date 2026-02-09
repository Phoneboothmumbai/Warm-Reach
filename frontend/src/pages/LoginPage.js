import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Zap, Mail, Lock, User, Building, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = window.location.pathname;
  const { login, register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(location === "/register" ? "register" : "login");
  
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: ""
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success("Welcome back!");
      navigate("/app/dashboard");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(registerForm);
      toast.success("Account created successfully!");
      navigate("/app/dashboard");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background noise-bg">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/5 flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-2xl tracking-tight">WarmReach</h1>
              <p className="text-sm text-muted-foreground">Outreach Engine</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="heading-1 mb-4">
              Context-Aware<br />
              <span className="text-primary">Outreach</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Build relationships, not spam. A disciplined approach to B2B outreach 
              that respects your prospects and protects your brand.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {[
              { label: "Email Safety", value: "10/day limit" },
              { label: "WhatsApp", value: "Template-first" },
              { label: "LinkedIn", value: "3 posts/week" },
              { label: "Context Gates", value: "Auto-block" }
            ].map((item, i) => (
              <div key={i} className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border/50">
                <p className="caption mb-1">{item.label}</p>
                <p className="text-lg font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Safety over speed. Quality over quantity.
        </p>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight">WarmReach</h1>
              <p className="text-xs text-muted-foreground">Outreach Engine</p>
            </div>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="heading-3">Get Started</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
                  <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          required
                          data-testid="login-email-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          required
                          data-testid="login-password-input"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading}
                      data-testid="login-submit-btn"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Sign In
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-firstname">First Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="register-firstname"
                            placeholder="John"
                            className="pl-10"
                            value={registerForm.first_name}
                            onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })}
                            required
                            data-testid="register-firstname-input"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-lastname">Last Name</Label>
                        <Input
                          id="register-lastname"
                          placeholder="Doe"
                          value={registerForm.last_name}
                          onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })}
                          required
                          data-testid="register-lastname-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10"
                          value={registerForm.email}
                          onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                          required
                          data-testid="register-email-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="Min. 6 characters"
                          className="pl-10"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          required
                          minLength={6}
                          data-testid="register-password-input"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading}
                      data-testid="register-submit-btn"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};
