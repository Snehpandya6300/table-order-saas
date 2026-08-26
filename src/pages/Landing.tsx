import { motion } from "framer-motion";
import {
  QrCode,
  UtensilsCrossed,
  BarChart3,
  Zap,
  ArrowRight,
  Store,
  Hash,
  CreditCard,
  Users,
  ChefHat,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

const features = [
  {
    icon: QrCode,
    title: "Scan and Order",
    description:
      "Customers scan a QR code at the counter and browse your full menu instantly—no app download required.",
  },
  {
    icon: Hash,
    title: "Token-Based Ordering",
    description:
      "Each customer gets a unique token number. The system tracks every order by token—no mix-ups, no confusion.",
  },
  {
    icon: UtensilsCrossed,
    title: "Menu Management",
    description:
      "Add categories, upload photos, update prices, and mark items available or unavailable in real time.",
  },
  {
    icon: LayoutDashboard,
    title: "Live Order Dashboard",
    description:
      "Receive orders the moment they are placed. Track every token, every item, and every status change.",
  },
  {
    icon: CreditCard,
    title: "Payment Tracking",
    description:
      "Track cash, UPI, and card payments for every order. Know exactly what's paid and what's pending.",
  },
  {
    icon: Users,
    title: "Staff Roles",
    description:
      "Assign managers and staff with different access levels. Everyone sees what they need to—nothing more.",
  },
  {
    icon: ChefHat,
    title: "KOT Management",
    description:
      "Kitchen Order Tickets flow directly from the counter to the kitchen. No paper, no delays.",
  },
  {
    icon: Store,
    title: "Built for Counter Service",
    description:
      "Designed for fast food shops, tea stalls, juice centers, chaat corners, and quick-service takeaways.",
  },
];

const businessTypes = [
  "Fast Food Shops",
  "Tea Stalls",
  "Juice Centers",
  "Chaat Corners",
  "Quick-Service Takeaways",
  "Food Courts",
  "Snack Bars",
  "Cloud Kitchens",
];

const steps = [
  "Customer scans the QR code at your counter",
  "The full menu loads on their phone",
  "They select items and place the order",
  "Your kitchen receives it instantly via KOT",
  "Track the order from received to served",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <QrCode className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              QR Table Order
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => navigate("/auth")}
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Built for counter-based businesses
            </div>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.1] sm:text-6xl lg:text-7xl">
              QR-powered ordering
              <br />
              <span className="text-muted-foreground">for every counter</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              Customers scan a code, browse your menu, and place their order
              straight from their phone. Perfect for fast food shops, tea stalls,
              juice centers, and quick-service takeaways.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="cursor-pointer px-8"
                onClick={() => navigate("/auth")}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="cursor-pointer px-8"
                onClick={() => {
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                See How It Works
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Business Types */}
      <section className="py-12 px-6 border-t border-border/50 overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Perfect for
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {businessTypes.map((type, i) => (
              <motion.span
                key={type}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-full border border-border/60 bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                {type}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-border/50">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              A focused tool built for counter businesses that want to move
              fast.
            </p>
          </motion.div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group rounded-xl border border-border/50 bg-card p-6 hover:border-border hover:shadow-sm transition-all"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <feature.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-24 px-6 bg-muted/30 border-t border-border/50"
      >
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              From scan to served in five simple steps.
            </p>
          </motion.div>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                  {i + 1}
                </div>
                <p className="text-sm font-medium">{step}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border/50">
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to modernize your counter?
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Set up your menu, generate QR codes for your counter, and start
              taking orders in minutes. No app required.
            </p>
            <Button
              size="lg"
              className="mt-8 cursor-pointer px-8"
              onClick={() => navigate("/auth")}
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground">
              <QrCode className="h-3 w-3 text-background" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              QR Table Order
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} QR Table Order. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
