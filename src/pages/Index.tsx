import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BarChart3, GitBranch, Eye, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: BarChart3,
      title: "Token-Level Analysis",
      description: "See probability distributions for every token in the completion"
    },
    {
      icon: GitBranch, 
      title: "Interactive Branching",
      description: "Click any token or alternative to explore different paths"
    },
    {
      icon: Eye,
      title: "Visual Heatmaps",
      description: "Color-coded tokens make probability patterns instantly visible"
    },
    {
      icon: Zap,
      title: "Real-time Exploration", 
      description: "Interactive tooltips and charts for immediate insights"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-surface/30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">Logprob Visualizer</h1>
            </div>
            <Button onClick={() => navigate("/playground")} className="gap-2">
              Start Exploring
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              See your completion,
              <br />
              <span className="text-primary">token by token</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Explore token-level probabilities from OpenAI Chat Completions. 
              Understand model uncertainty, investigate alternatives, and branch conversations 
              with interactive visualizations.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                onClick={() => navigate("/playground")}
                className="gap-2 text-lg px-8"
              >
                Start a Run
                <ArrowRight className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">GPT-4</Badge>
                <Badge variant="outline">GPT-4 Mini</Badge>
                <Badge variant="outline">GPT-3.5</Badge>
              </div>
            </div>

            {/* Demo visualization */}
            <Card className="max-w-2xl mx-auto mb-16">
              <CardHeader>
                <CardTitle className="text-left text-lg">Example: Token probabilities</CardTitle>
                <CardDescription className="text-left">
                  Hover over highlighted tokens to see alternatives
                </CardDescription>
              </CardHeader>
              <CardContent className="text-left">
                <div className="bg-surface p-4 rounded-lg font-mono text-sm leading-relaxed">
                  <span className="token-span token-high-prob">The</span>
                  <span className="token-span token-high-prob"> Burj</span>
                  <span className="token-span token-high-prob"> Khalifa</span>
                  <span className="token-span token-med-high-prob"> in</span>
                  <span className="token-span token-high-prob"> Dubai</span>
                  <span className="token-span token-med-low-prob"> is</span>
                  <span className="token-span token-med-low-prob"> currently</span>
                  <span className="token-span token-high-prob"> the</span>
                  <span className="token-span token-high-prob"> world</span>
                  <span className="token-span token-high-prob">'s</span>
                  <span className="token-span token-high-prob"> tallest</span>
                  <span className="token-span token-high-prob"> building</span>
                  <span className="token-span token-med-high-prob">,</span>
                  <span className="token-span token-low-prob border-b-2 border-dashed border-token-low"> measuring</span>
                  <span className="token-span token-high-prob"> 828</span>
                  <span className="token-span token-med-high-prob"> meters</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-surface/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Powerful Analysis Tools</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for prompt engineers, ML researchers, and product teams who need to understand AI model behavior
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="text-center">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Ready to Explore?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Start analyzing token probabilities and discover how AI models make decisions
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/playground")}
              className="gap-2 text-lg px-8"
            >
              Launch Playground
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
